import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();

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

    // Check if this user has a "self" member in the database
    const selfMember = await prisma.member.findFirst({
      where: { user_id: user.id, relation: "self", is_deleted: false },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      onboarded: !!selfMember,
      memberName: selfMember?.name || null,
    });
  } catch {
    return NextResponse.json({ onboarded: false });
  }
}
