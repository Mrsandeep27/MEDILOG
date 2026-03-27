import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ALLOWED_TABLES = [
  "members", "health_records", "medicines", "reminders",
  "reminder_logs", "share_links", "health_metrics",
];

const ALLOWED_FIELDS: Record<string, Set<string>> = {
  members: new Set(["id", "name", "relation", "date_of_birth", "blood_group", "gender", "allergies", "chronic_conditions", "emergency_contact_name", "emergency_contact_phone", "avatar_url", "is_deleted", "created_at", "updated_at"]),
  health_records: new Set(["id", "member_id", "type", "title", "doctor_name", "hospital_name", "visit_date", "diagnosis", "notes", "image_urls", "raw_ocr_text", "ai_extracted", "tags", "is_deleted", "created_at", "updated_at"]),
  medicines: new Set(["id", "record_id", "member_id", "name", "dosage", "frequency", "duration", "before_food", "start_date", "end_date", "is_active", "is_deleted", "created_at", "updated_at"]),
  reminders: new Set(["id", "medicine_id", "member_id", "medicine_name", "member_name", "dosage", "before_food", "time", "days", "is_active", "is_deleted", "created_at", "updated_at"]),
  reminder_logs: new Set(["id", "reminder_id", "scheduled_at", "status", "acted_at", "is_deleted", "created_at", "updated_at"]),
  share_links: new Set(["id", "member_id", "created_by", "token", "record_ids", "expires_at", "is_active", "is_deleted", "created_at", "updated_at"]),
  health_metrics: new Set(["id", "member_id", "type", "value", "recorded_at", "notes", "is_deleted", "created_at", "updated_at"]),
};

function sanitizeItem(table: string, item: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[table];
  if (!allowed) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (allowed.has(key)) clean[key] = value;
  }
  return clean;
}

// Get Supabase user from cookie/session
async function getUser(request: NextRequest): Promise<{ userId: string } | null> {
  // Try Authorization header first (Supabase access token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (!error && data.user) return { userId: data.user.id };
  }

  // Try cookie-based session (sb-* cookies from Supabase Auth)
  const cookies = request.headers.get("cookie") || "";
  const accessTokenMatch = cookies.match(/sb-[^=]+-auth-token[^=]*=([^;]+)/);
  if (accessTokenMatch) {
    try {
      const parsed = JSON.parse(decodeURIComponent(accessTokenMatch[1]));
      const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) return { userId: data.user.id };
      }
    } catch { /* ignore parse errors */ }
  }

  return null;
}

// POST: Push — client sends { tables: { members: [...], health_records: [...] } }
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const tablesPayload: Record<string, Record<string, unknown>[]> = body.tables || {};

    // Fallback: old format { table, items }
    if (body.table && body.items) {
      tablesPayload[body.table] = body.items;
    }

    const results = { pushed: 0, errors: [] as string[] };

    // Get user's member IDs for ownership validation
    const { data: userMembers } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.userId);
    const memberIds = new Set((userMembers || []).map((m: { id: string }) => m.id));

    for (const [table, items] of Object.entries(tablesPayload)) {
      if (!ALLOWED_TABLES.includes(table) || !Array.isArray(items)) continue;

      for (const item of items.slice(0, 100)) {
        try {
          if (!item.id || typeof item.id !== "string") {
            results.errors.push("Item missing valid id");
            continue;
          }

          const data = sanitizeItem(table, item);
          data.id = item.id;

          // Ownership
          if (table === "members") {
            data.user_id = user.userId;
          } else if ("member_id" in data && data.member_id) {
            // For first sync, member might not be in DB yet — allow if in same batch
            if (!memberIds.has(data.member_id as string)) {
              const batchedMembers = tablesPayload["members"] || [];
              const inBatch = batchedMembers.some((m) => m.id === data.member_id);
              if (!inBatch) {
                results.errors.push(`${item.id}: unauthorized member_id`);
                continue;
              }
            }
          }

          const { error } = await supabase.from(table).upsert(data, { onConflict: "id" });
          if (error) {
            results.errors.push(`${item.id}: ${error.message}`);
          } else {
            results.pushed++;
            // Track new member IDs for subsequent tables in same request
            if (table === "members") memberIds.add(data.id as string);
          }
        } catch (err) {
          results.errors.push(`${item.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Sync push error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Pull — client sends ?tables={"members":"2000-01-01T00:00:00Z",...}
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tablesRaw = searchParams.get("tables");

    // Parse table→timestamp map
    let sinceMap: Record<string, string> = {};
    if (tablesRaw) {
      try { sinceMap = JSON.parse(tablesRaw); } catch { /* ignore */ }
    }

    // Fallback: old format ?table=members&since=...
    const singleTable = searchParams.get("table");
    if (singleTable && !tablesRaw) {
      sinceMap[singleTable] = searchParams.get("since") || "2000-01-01T00:00:00Z";
    }

    // Get user's member IDs
    const { data: userMembers } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.userId);
    const memberIds = (userMembers || []).map((m: { id: string }) => m.id);

    const data: Record<string, unknown[]> = {};

    for (const [table, since] of Object.entries(sinceMap)) {
      if (!ALLOWED_TABLES.includes(table)) continue;

      let query;
      if (table === "members") {
        query = supabase.from("members")
          .select("*")
          .eq("user_id", user.userId)
          .gt("updated_at", since);
      } else if (table === "reminder_logs") {
        // Get reminder IDs for this user's members
        const { data: reminders } = await supabase
          .from("reminders")
          .select("id")
          .in("member_id", memberIds);
        const reminderIds = (reminders || []).map((r: { id: string }) => r.id);
        if (reminderIds.length === 0) { data[table] = []; continue; }
        query = supabase.from("reminder_logs")
          .select("*")
          .in("reminder_id", reminderIds)
          .gt("updated_at", since);
      } else {
        if (memberIds.length === 0) { data[table] = []; continue; }
        query = supabase.from(table)
          .select("*")
          .in("member_id", memberIds)
          .gt("updated_at", since);
      }

      const { data: rows, error } = await query.limit(500);
      data[table] = error ? [] : (rows || []);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Sync pull error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
