import { NextRequest, NextResponse } from "next/server";

// Legacy route — app uses Supabase Auth directly on the client.
// Kept for backwards compatibility; redirects to Supabase Auth flow.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    return NextResponse.json(
      { error: "Please use the app's signup flow (Supabase Auth)", email },
      { status: 410 }
    );
  } catch {
    return NextResponse.json({ error: "Use the app signup flow" }, { status: 410 });
  }
}
