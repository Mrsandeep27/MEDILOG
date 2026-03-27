import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin emails — set in Vercel env var (comma-separated)
function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_EMAILS || "";
  return emails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Verify admin from Supabase Auth token
async function verifyAdmin(request: NextRequest): Promise<{ email: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0 || !adminEmails.includes(email)) {
    return null;
  }

  return { email };
}

// Helper: count rows in a table with optional filter
async function countRows(table: string, filter?: Record<string, unknown>): Promise<number> {
  try {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value);
      }
    }
    const { count } = await query;
    return count || 0;
  } catch {
    return 0;
  }
}

// GET: Admin dashboard data
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") || "overview";

    if (section === "overview") {
      const [
        totalMembers,
        totalRecords,
        totalMedicines,
        totalReminders,
        totalFeedback,
        newFeedback,
        totalFamilies,
      ] = await Promise.all([
        countRows("members", { is_deleted: false }),
        countRows("health_records", { is_deleted: false }),
        countRows("medicines", { is_deleted: false }),
        countRows("reminders", { is_deleted: false }),
        countRows("feedback"),
        countRows("feedback", { status: "new" }),
        countRows("families"),
      ]);

      const { data: recentFeedback } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      return NextResponse.json({
        stats: { totalMembers, totalRecords, totalMedicines, totalReminders, totalFeedback, newFeedback, totalFamilies },
        recentFeedback: recentFeedback || [],
      });
    }

    if (section === "users") {
      const { data: members } = await supabase
        .from("members")
        .select("id, name, relation, gender, blood_group, user_id, created_at")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100);
      return NextResponse.json({ members: members || [] });
    }

    if (section === "feedback") {
      const status = searchParams.get("status") || undefined;
      const category = searchParams.get("category") || undefined;

      let query = supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(100);
      if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);

      const { data: feedback } = await query;
      const { count: total } = await supabase.from("feedback").select("*", { count: "exact", head: true });
      const { count: newCount } = await supabase.from("feedback").select("*", { count: "exact", head: true }).eq("status", "new");

      return NextResponse.json({
        feedback: feedback || [],
        stats: { total: total || 0, new: newCount || 0 },
      });
    }

    if (section === "families") {
      const { data: families } = await supabase
        .from("families")
        .select("*, family_members(*, users(email, name))")
        .order("created_at", { ascending: false });
      return NextResponse.json({ families: families || [] });
    }

    if (section === "records") {
      const { data: records } = await supabase
        .from("health_records")
        .select("*, members(name)")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);
      return NextResponse.json({ records: records || [] });
    }

    if (section === "api-usage") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: totalCalls } = await supabase.from("api_usage").select("*", { count: "exact", head: true });
      const { count: todayCalls } = await supabase.from("api_usage").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString());
      const { count: successCalls } = await supabase.from("api_usage").select("*", { count: "exact", head: true }).eq("success", true);
      const { data: recentCalls } = await supabase.from("api_usage").select("*").order("created_at", { ascending: false }).limit(20);

      const total = totalCalls || 0;
      const success = successCalls || 0;

      return NextResponse.json({
        totalCalls: total,
        todayCalls: todayCalls || 0,
        successCalls: success,
        failedCalls: total - success,
        successRate: total > 0 ? Math.round((success / total) * 100) : 0,
        avgDuration: 0,
        byFeature: [],
        recentCalls: recentCalls || [],
      });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH: Admin actions (update feedback, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "update_feedback") {
      const { id, status, admin_note } = body;
      const updateData: Record<string, string> = {};
      if (status) updateData.status = status;
      if (admin_note !== undefined) updateData.admin_note = admin_note;

      const { data, error } = await supabase.from("feedback").update(updateData).eq("id", id).select().single();
      if (error) throw error;

      return NextResponse.json({ success: true, feedback: data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Admin PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
