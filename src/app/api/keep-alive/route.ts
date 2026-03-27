import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// This endpoint is called by Vercel Cron every 5 days
// to prevent Supabase free tier from pausing
export async function GET() {
  try {
    const { count } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      status: "alive",
      members: count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
