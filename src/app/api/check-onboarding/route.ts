import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const cookieStore = await cookies();

    // Auth client — verifies the user's session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // read-only in GET
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ onboarded: false });
    }

    // Use admin client to bypass RLS — user is already authenticated above
    const { data: selfMember } = await supabaseAdmin
      .from("members")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("relation", "self")
      .eq("is_deleted", false)
      .limit(1)
      .single();

    return NextResponse.json({
      onboarded: !!selfMember,
      memberName: selfMember?.name || null,
    });
  } catch {
    return NextResponse.json({ onboarded: false });
  }
}
