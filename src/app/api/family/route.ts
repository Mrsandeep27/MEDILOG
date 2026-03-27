import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Verify user from Supabase auth
async function getUser(request: NextRequest): Promise<string | null> {
  // Check x-user-id header (legacy)
  const headerUserId = request.headers.get("x-user-id");
  if (headerUserId) return headerUserId;

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (!error && data.user) return data.user.id;
  }

  return null;
}

// GET: Get user's family groups
export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: familyMembers } = await supabase
      .from("family_members")
      .select("role, family_id, families(id, name, invite_code, created_by, family_members(id, user_id, role, joined_at, users(id, email, name)))")
      .eq("user_id", userId);

    const families = (familyMembers || []).map((fm: Record<string, unknown>) => {
      const family = fm.families as Record<string, unknown>;
      const members = (family?.family_members as Array<Record<string, unknown>>) || [];
      return {
        id: family?.id,
        name: family?.name,
        invite_code: family?.invite_code,
        role: fm.role,
        created_by: family?.created_by,
        members: members.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          name: (m.users as Record<string, string>)?.name,
          email: (m.users as Record<string, string>)?.email,
          role: m.role,
          joined_at: m.joined_at,
        })),
      };
    });

    return NextResponse.json({ families });
  } catch (err) {
    console.error("GET /api/family error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Create or Join a family group
export async function POST(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name } = body;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Family name must be at least 2 characters" }, { status: 400 });
      }

      // Generate unique invite code
      let inviteCode = generateInviteCode();
      let { data: existing } = await supabase.from("families").select("id").eq("invite_code", inviteCode).single();
      while (existing) {
        inviteCode = generateInviteCode();
        ({ data: existing } = await supabase.from("families").select("id").eq("invite_code", inviteCode).single());
      }

      // Create family
      const { data: family, error: famErr } = await supabase
        .from("families")
        .insert({ name: name.trim(), invite_code: inviteCode, created_by: userId })
        .select()
        .single();

      if (famErr || !family) {
        return NextResponse.json({ error: "Failed to create family" }, { status: 500 });
      }

      // Add creator as admin
      await supabase.from("family_members").insert({
        family_id: family.id,
        user_id: userId,
        role: "admin",
      });

      return NextResponse.json({
        family: {
          id: family.id,
          name: family.name,
          invite_code: family.invite_code,
          role: "admin",
          created_by: family.created_by,
          members: [],
        },
      });
    }

    if (action === "join") {
      const { invite_code } = body;
      if (!invite_code || typeof invite_code !== "string") {
        return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
      }

      const { data: family } = await supabase
        .from("families")
        .select("id, name, invite_code, created_by")
        .eq("invite_code", invite_code.toUpperCase().trim())
        .single();

      if (!family) {
        return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("family_members")
        .select("id")
        .eq("family_id", family.id)
        .eq("user_id", userId)
        .single();

      if (existing) {
        return NextResponse.json({ error: "You are already a member of this family" }, { status: 400 });
      }

      await supabase.from("family_members").insert({
        family_id: family.id,
        user_id: userId,
        role: "member",
      });

      return NextResponse.json({
        family: { ...family, role: "member", members: [] },
      });
    }

    if (action === "leave") {
      const { family_id } = body;
      if (!family_id) {
        return NextResponse.json({ error: "Family ID is required" }, { status: 400 });
      }

      const { data: members } = await supabase
        .from("family_members")
        .select("id, user_id, role")
        .eq("family_id", family_id);

      if (!members) {
        return NextResponse.json({ error: "Family not found" }, { status: 404 });
      }

      const member = members.find((m: { user_id: string }) => m.user_id === userId);
      if (!member) {
        return NextResponse.json({ error: "Not a member" }, { status: 400 });
      }

      if (member.role === "admin") {
        const otherAdmins = members.filter(
          (m: { role: string; user_id: string }) => m.role === "admin" && m.user_id !== userId
        );
        if (otherAdmins.length === 0 && members.length > 1) {
          return NextResponse.json(
            { error: "Transfer admin role to another member before leaving" },
            { status: 400 }
          );
        }
      }

      await supabase.from("family_members").delete().eq("id", member.id);

      // If last member, delete the family
      if (members.length <= 1) {
        await supabase.from("families").delete().eq("id", family_id);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/family error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
