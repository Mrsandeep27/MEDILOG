import { NextResponse } from "next/server";

// Legacy route — OTP auth not yet implemented with Supabase Auth.
export async function POST() {
  return NextResponse.json(
    { error: "OTP login is not available yet" },
    { status: 501 }
  );
}
