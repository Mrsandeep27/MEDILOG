import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!/^[A-Za-z0-9\-_]{8,128}$/.test(token)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  try {
    // Find active, non-expired share link
    const { data: shareLink } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    if (!shareLink) {
      return NextResponse.json(
        { error: "Share link not found or expired" },
        { status: 404 }
      );
    }

    // Get member
    const { data: member } = await supabase
      .from("members")
      .select("name, blood_group, allergies, chronic_conditions, date_of_birth, gender")
      .eq("id", shareLink.member_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get records
    let recordQuery = supabase
      .from("health_records")
      .select("id, type, title, doctor_name, hospital_name, visit_date, diagnosis, notes")
      .eq("member_id", shareLink.member_id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (shareLink.record_ids && shareLink.record_ids.length > 0) {
      recordQuery = recordQuery.in("id", shareLink.record_ids);
    }

    const { data: records } = await recordQuery;

    // Get medicines
    const { data: medicines } = await supabase
      .from("medicines")
      .select("name, dosage, frequency, is_active")
      .eq("member_id", shareLink.member_id)
      .eq("is_deleted", false);

    // Log access (non-critical, fire-and-forget)
    supabase
      .from("share_access_logs")
      .insert({ share_link_id: shareLink.id })
      .then(() => {});

    return NextResponse.json({
      member: {
        ...member,
        allergies: member.allergies || [],
        chronic_conditions: member.chronic_conditions || [],
      },
      records: records || [],
      medicines: medicines || [],
    });
  } catch (err) {
    console.error("Share API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
