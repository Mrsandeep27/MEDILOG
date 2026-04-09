import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { draftRuleFromBadAnswer, isAutoApprovable } from "@/lib/ai/medical/rule-writer";
import { invalidateRulesCache } from "@/lib/ai/medical/rules-server";

/**
 * POST /api/feedback/ai-message
 * ──────────────────────────────
 * Receives a 👎 from a user on an AI Doctor message. Logs it as a
 * rule_candidate so the admin can decide whether to lock down a new rule.
 *
 * Fire-and-forget from the client side — never throws past the catch.
 */

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ConvMsg { role: string; text: string }

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authData.user.id;

    const body = await request.json() as {
      conversation?: ConvMsg[];
      patientBrief?: string;
      aiResponse?: string;
      userMessage?: string;
    };

    if (!Array.isArray(body.conversation) || body.conversation.length === 0) {
      return NextResponse.json({ error: "conversation required" }, { status: 400 });
    }

    // P0.3: Rate limit — max 5 thumbs-down per user per hour to prevent
    // denial-of-wallet attacks (each one triggers a Gemini rule-writer call)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentCount = await prisma.ruleCandidate.count({
      where: { user_id: userId, created_at: { gte: oneHourAgo } },
    });
    if (recentCount >= 5) {
      return NextResponse.json({ error: "Too many feedback signals. Try again later." }, { status: 429 });
    }

    const triggerReason = body.userMessage
      ? `User flagged AI reply to: "${body.userMessage.slice(0, 200)}"`
      : "User flagged AI reply as not helpful";

    // 1. Log the candidate
    const candidate = await prisma.ruleCandidate.create({
      data: {
        trigger_source: "user_thumbs_down",
        trigger_reason: triggerReason.slice(0, 500),
        conversation: JSON.stringify(body.conversation).slice(0, 8000),
        patient_brief: body.patientBrief?.slice(0, 4000),
        ai_response: body.aiResponse?.slice(0, 4000),
        user_id: userId,
        status: "pending",
      },
    });

    // 2. Draft a rule (fire-and-forget so the user response is instant)
    draftAndMaybeApprove(candidate.id, {
      triggerReason,
      conversation: body.conversation,
      patientBrief: body.patientBrief,
      aiResponse: body.aiResponse,
    }).catch((e) => console.error("[feedback] draft failed:", e));

    return NextResponse.json({ ok: true, candidate_id: candidate.id });
  } catch (err) {
    console.error("[feedback/ai-message] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function draftAndMaybeApprove(
  candidateId: string,
  input: {
    triggerReason: string;
    conversation: Array<{ role: string; text: string }>;
    patientBrief?: string;
    aiResponse?: string;
  }
) {
  const draft = await draftRuleFromBadAnswer(input);
  if (!draft) return;

  await prisma.ruleCandidate.update({
    where: { id: candidateId },
    data: {
      proposed_rule: draft.rule_text,
      proposed_category: draft.category,
      proposed_severity: draft.severity,
    },
  });

  if (isAutoApprovable(draft)) {
    await prisma.activeRule.create({
      data: {
        rule_text: draft.rule_text,
        category: draft.category,
        severity: draft.severity,
        source: "auto_safe",
        candidate_id: candidateId,
        is_active: true,
      },
    });
    await prisma.ruleCandidate.update({
      where: { id: candidateId },
      data: {
        status: "approved",
        reviewer_email: "auto_safe",
        reviewed_at: new Date(),
        final_rule: draft.rule_text,
      },
    });
    invalidateRulesCache();
  }
}
