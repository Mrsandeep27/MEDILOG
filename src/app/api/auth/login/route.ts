import { NextRequest, NextResponse } from "next/server";

// Legacy route — app uses Supabase Auth directly on the client.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    return NextResponse.json(
      { error: "Please use the app's login flow (Supabase Auth)", email },
      { status: 410 }
    );
  } catch {
    return NextResponse.json({ error: "Use the app login flow" }, { status: 410 });
  }
}
