import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Validate token format (alphanumeric, 32 chars)
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid share link" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find share link — combine active + expiry check in one query
  const { data: shareLink, error: linkError } = await supabase
    .from("share_links")
    .select("id, member_id, record_ids, expires_at")
    .eq("token", token)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (linkError || !shareLink) {
    return NextResponse.json(
      { error: "Share link not found or expired" },
      { status: 404 }
    );
  }

  // Get member info
  const { data: member } = await supabase
    .from("members")
    .select("name, blood_group, allergies, chronic_conditions, date_of_birth, gender")
    .eq("id", shareLink.member_id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  // Get records (with pagination limit)
  let recordsQuery = supabase
    .from("health_records")
    .select("id, type, title, doctor_name, hospital_name, visit_date, diagnosis, notes")
    .eq("member_id", shareLink.member_id)
    .eq("is_deleted", false)
    .order("visit_date", { ascending: false })
    .limit(100);

  if (shareLink.record_ids && shareLink.record_ids.length > 0) {
    recordsQuery = recordsQuery.in("id", shareLink.record_ids);
  }

  const { data: records } = await recordsQuery;

  // Get active medicines
  const { data: medicines } = await supabase
    .from("medicines")
    .select("name, dosage, frequency, is_active")
    .eq("member_id", shareLink.member_id)
    .eq("is_deleted", false);

  // Log access (anonymized — no IP or user agent stored)
  await supabase.from("share_access_logs").insert({
    share_link_id: shareLink.id,
    accessed_at: new Date().toISOString(),
  }).then(() => {}, () => {}); // Silently ignore log failures

  return NextResponse.json({
    member: {
      ...member,
      allergies: member.allergies || [],
      chronic_conditions: member.chronic_conditions || [],
    },
    records: records || [],
    medicines: medicines || [],
  });
}
