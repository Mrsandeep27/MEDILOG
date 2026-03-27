import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

const supabaseAuth = createClient(
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

// Short-lived auth cache — avoids duplicate GoTrue calls within a sync cycle
// Push and pull from same client hit within seconds; caching halves GoTrue load
const authCache = new Map<string, { userId: string; expires: number }>();
const AUTH_CACHE_TTL_MS = 30_000; // 30 seconds

function pruneAuthCache() {
  if (authCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of authCache) {
      if (v.expires < now) authCache.delete(k);
    }
  }
}

// Get Supabase user from cookie/session
async function getUser(request: NextRequest): Promise<{ userId: string } | null> {
  // Try Authorization header first (Supabase access token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Check cache — same token verified in last 30s
    const cached = authCache.get(token);
    if (cached && cached.expires > Date.now()) {
      return { userId: cached.userId };
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (!error && data.user) {
      authCache.set(token, { userId: data.user.id, expires: Date.now() + AUTH_CACHE_TTL_MS });
      pruneAuthCache();
      return { userId: data.user.id };
    }
  }

  // Try cookie-based session (sb-* cookies from Supabase Auth)
  const cookies = request.headers.get("cookie") || "";
  const accessTokenMatch = cookies.match(/sb-[^=]+-auth-token[^=]*=([^;]+)/);
  if (accessTokenMatch) {
    try {
      const parsed = JSON.parse(decodeURIComponent(accessTokenMatch[1]));
      const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      if (token) {
        const { data, error } = await supabaseAuth.auth.getUser(token);
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

    const results = { pushed: 0, errors: [] as string[], failedIds: [] as string[] };

    // Get user's member IDs for ownership validation
    const { data: userMembers } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("user_id", user.userId);
    const memberIds = new Set((userMembers || []).map((m: { id: string }) => m.id));

    // Pre-fetch user's reminder IDs for reminder_logs ownership validation
    let userReminderIds = new Set<string>();
    if (memberIds.size > 0 && tablesPayload["reminder_logs"]?.length) {
      const { data: userReminders } = await supabaseAdmin
        .from("reminders")
        .select("id")
        .in("member_id", [...memberIds]);
      userReminderIds = new Set((userReminders || []).map((r: { id: string }) => r.id));
    }

    for (const [table, items] of Object.entries(tablesPayload)) {
      if (!ALLOWED_TABLES.includes(table) || !Array.isArray(items)) continue;

      // Phase 1: Validate ownership, collect valid items (no DB calls)
      const validItems: { data: Record<string, unknown>; id: string }[] = [];

      for (const item of items.slice(0, 100)) {
        if (!item.id || typeof item.id !== "string") {
          results.errors.push("Item missing valid id");
          continue;
        }

        const data = sanitizeItem(table, item);
        data.id = item.id;

        // Ownership
        if (table === "members") {
          data.user_id = user.userId;
        } else if (table === "reminder_logs") {
          const rid = data.reminder_id as string;
          if (!rid || !userReminderIds.has(rid)) {
            const batchedReminders = tablesPayload["reminders"] || [];
            const inBatch = batchedReminders.some((r) => r.id === rid);
            if (!inBatch) {
              results.errors.push(`${item.id}: unauthorized reminder_id`);
              results.failedIds.push(item.id);
              continue;
            }
          }
        } else if ("member_id" in data && data.member_id) {
          if (!memberIds.has(data.member_id as string)) {
            const batchedMembers = tablesPayload["members"] || [];
            const inBatch = batchedMembers.some((m) => m.id === data.member_id);
            if (!inBatch) {
              results.errors.push(`${item.id}: unauthorized member_id`);
              results.failedIds.push(item.id);
              continue;
            }
          }
        }

        validItems.push({ data, id: item.id });
      }

      if (validItems.length === 0) continue;

      // Phase 2: Batch upsert — 1 DB call instead of N
      try {
        const batchData = validItems.map(v => v.data);
        const { error: batchError } = await supabaseAdmin
          .from(table)
          .upsert(batchData, { onConflict: "id" });

        if (!batchError) {
          results.pushed += validItems.length;
          if (table === "members") {
            for (const v of validItems) memberIds.add(v.data.id as string);
          }
        } else {
          // Batch failed (one bad row fails all) — fallback to per-item
          for (const { data, id } of validItems) {
            try {
              const { error } = await supabaseAdmin.from(table).upsert(data, { onConflict: "id" });
              if (error) {
                results.errors.push(`${id}: ${error.message}`);
                results.failedIds.push(id);
              } else {
                results.pushed++;
                if (table === "members") memberIds.add(data.id as string);
              }
            } catch (err) {
              results.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
              results.failedIds.push(id);
            }
          }
        }
      } catch (err) {
        // Entire batch call failed (network, etc.) — mark all as failed
        for (const { id } of validItems) results.failedIds.push(id);
        results.errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
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
    const { data: userMembers } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("user_id", user.userId);
    const memberIds = (userMembers || []).map((m: { id: string }) => m.id);

    const data: Record<string, unknown[]> = {};

    for (const [table, since] of Object.entries(sinceMap)) {
      if (!ALLOWED_TABLES.includes(table)) continue;

      let query;
      if (table === "members") {
        query = supabaseAdmin.from("members")
          .select("*")
          .eq("user_id", user.userId)
          .gt("updated_at", since);
      } else if (table === "reminder_logs") {
        if (memberIds.length === 0) { data[table] = []; continue; }
        // Get reminder IDs for this user's members
        const { data: reminders } = await supabaseAdmin
          .from("reminders")
          .select("id")
          .in("member_id", memberIds);
        const reminderIds = (reminders || []).map((r: { id: string }) => r.id);
        if (reminderIds.length === 0) { data[table] = []; continue; }
        query = supabaseAdmin.from("reminder_logs")
          .select("*")
          .in("reminder_id", reminderIds)
          .gt("updated_at", since);
      } else {
        if (memberIds.length === 0) { data[table] = []; continue; }
        query = supabaseAdmin.from(table)
          .select("*")
          .in("member_id", memberIds)
          .gt("updated_at", since);
      }

      const { data: rows, error } = await query
        .order("updated_at", { ascending: true })
        .limit(500);
      data[table] = error ? [] : (rows || []);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Sync pull error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
