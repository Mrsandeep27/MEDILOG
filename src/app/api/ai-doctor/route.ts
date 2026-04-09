import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";
import { loadActiveRules } from "@/lib/ai/medical/rules-server";
import { detectSafetyViolations } from "@/lib/ai/medical/safety-detector";
import { draftRuleFromBadAnswer, isAutoApprovable } from "@/lib/ai/medical/rule-writer";
import { prisma } from "@/lib/db/prisma";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Persona — sent as systemInstruction so Gemini caches it across calls.
// The dynamic LIVE MEDICAL RULES block from active_rules table is appended
// at request time, so adding a rule via the admin UI takes effect within
// 60s without a code deploy.
const DOCTOR_PERSONA = `You are "Dr. MediFamily" — a warm Indian family doctor assistant. Reply in Hinglish (Hindi+English mix) naturally, like a caring family doctor.

OUTPUT: a single raw JSON object, no markdown. Schema:
{
  "urgency": "green|yellow|orange|red",
  "urgency_label": "Home Care|See Doctor Soon|See Doctor Today|Rush to Hospital",
  "possible_causes": ["short cause", ...],
  "what_to_do": ["short step", ...],
  "home_remedies": ["short remedy", ...],
  "otc_medicines": [{"name":"OTC only","dosage":"","when":"","warning":""}],
  "when_to_rush": ["red flag", ...],
  "doctor_type": "specialist name",
  "reply": "2-3 warm sentences in Hinglish",
  "follow_up_questions": ["short Q", ...]
}

KEEP IT TIGHT: max 3 items per list, max 2 OTC medicines, reply ≤ 3 sentences.

GROUNDING: When the user message includes a PATIENT BRIEF, you MUST use it to ground every answer. Reference the patient's actual conditions, medicines, vitals, and contraindications. The brief's CONTRAINDICATIONS section overrides any general medical knowledge — never suggest a drug listed there.`;

interface ChatHistoryItem {
  role: string;
  text: string;
}

interface PatientPayload {
  name?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  current_medicines?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication — prevents cost abuse and unaudited PII processing
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authData.user.id;

    const body = await request.json();
    const {
      message,
      patient,
      chatHistory,
      locale,
      // NEW: full medical brief from the client (built from Dexie)
      medicalBrief,
      // NEW: explicit pregnancy + age signals from the client (used by detector)
      isPregnant,
      ageYears,
    } = body as {
      message?: string;
      patient?: PatientPayload;
      chatHistory?: ChatHistoryItem[];
      locale?: string;
      medicalBrief?: string;
      isPregnant?: boolean;
      ageYears?: number | null;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // ── Build patient context ─────────────────────────────────────────
    // Prefer the rich `medicalBrief` from the client if provided, fall
    // back to the legacy minimal patient block for older clients.
    let patientContext: string;
    if (medicalBrief && typeof medicalBrief === "string" && medicalBrief.length > 0) {
      // P0.2: Sanitize against prompt injection — the brief is client-controlled
      patientContext = medicalBrief
        .replace(/ignore\s+(all|previous|above|every|your|the)/gi, "[REDACTED]")
        .replace(/you\s+are\s+(now|no\s+longer|not|a)/gi, "[REDACTED]")
        .replace(/forget\s+(all|everything|your|previous|the)/gi, "[REDACTED]")
        .replace(/override|disregard|bypass|jailbreak|pretend|roleplay/gi, "[REDACTED]")
        .replace(/system\s*(prompt|instruction|message)/gi, "[REDACTED]")
        .slice(0, 4000);
    } else if (patient) {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
        : null;
      patientContext = [
        `Name: ${patient.name || "Unknown"}`,
        age !== null ? `Age: ${age} years` : null,
        patient.gender ? `Gender: ${patient.gender}` : null,
        patient.blood_group ? `Blood Group: ${patient.blood_group}` : null,
        patient.allergies && patient.allergies.length > 0 ? `ALLERGIES: ${patient.allergies.join(", ")}` : "No known allergies",
        patient.chronic_conditions && patient.chronic_conditions.length > 0 ? `CHRONIC: ${patient.chronic_conditions.join(", ")}` : null,
        patient.current_medicines && patient.current_medicines.length > 0 ? `CURRENT MEDS: ${patient.current_medicines.join(", ")}` : null,
      ].filter(Boolean).join("\n");
    } else {
      patientContext = "No patient info available.";
    }

    // ── Build the per-turn user content ───────────────────────────────
    const historyText = Array.isArray(chatHistory) && chatHistory.length > 0
      ? chatHistory
          .slice(-4)
          .map((m) => `${m.role === "user" ? "Patient" : "Doctor"}: ${String(m.text || "").slice(0, 300)}`)
          .join("\n")
      : "";

    const langInstruction = locale === "hi"
      ? "Reply ENTIRELY in Hindi (Devanagari script). All JSON fields in Hindi."
      : "Reply in simple, easy English. All JSON fields in English.";

    const userPrompt = [
      `PATIENT BRIEF:\n${patientContext}`,
      historyText && `RECENT CHAT:\n${historyText}`,
      `MESSAGE: "${message.slice(0, 600)}"`,
      langInstruction,
    ].filter(Boolean).join("\n\n");

    // ── Load live rules from DB and append to system instruction ──────
    const { text: rulesText } = await loadActiveRules();
    const systemInstruction = rulesText
      ? `${DOCTOR_PERSONA}\n\n${rulesText}`
      : DOCTOR_PERSONA;

    try {
      const response = await callGemini(
        [{ text: userPrompt }],
        {
          temperature: 0.3,
          maxOutputTokens: 800,
          feature: "ai-doctor",
          jsonMode: true,
          systemInstruction,
          userId,
        }
      );

      const parsed = parseJsonResponse(response);

      // Defensive defaults
      if (!parsed.urgency) parsed.urgency = "yellow";
      if (!parsed.reply) {
        const text = response.replace(/[{}\[\]"]/g, "").trim();
        parsed.reply = text.length > 20 && text.length < 500
          ? text
          : "Apni symptoms ke baare mein thoda aur detail mein batayein taaki main aapki madad kar sakun.";
      }
      if (!Array.isArray(parsed.possible_causes)) parsed.possible_causes = [];
      if (!Array.isArray(parsed.what_to_do)) parsed.what_to_do = [];
      if (!Array.isArray(parsed.home_remedies)) parsed.home_remedies = [];
      if (!Array.isArray(parsed.otc_medicines)) parsed.otc_medicines = [];
      if (!Array.isArray(parsed.when_to_rush)) parsed.when_to_rush = [];
      if (!Array.isArray(parsed.follow_up_questions)) parsed.follow_up_questions = [];

      // ── Run safety detector ───────────────────────────────────────
      // Fast (no DB, no LLM). Fires after every response. Any violation
      // becomes a rule_candidate so the system can self-improve.
      const violations = detectSafetyViolations(
        parsed as Parameters<typeof detectSafetyViolations>[0],
        {
          allergies: patient?.allergies,
          isPregnant: isPregnant ?? false,
          ageYears: ageYears ?? null,
        },
        message
      );

      if (violations.length > 0) {
        // Fire-and-forget: queue + draft. Don't block the user response.
        queueAndDraftCandidate({
          triggerSource: "safety_detector",
          triggerReason: violations.map((v) => v.reason).join(" | "),
          conversation: [
            ...(Array.isArray(chatHistory) ? chatHistory : []),
            { role: "user", text: message },
            { role: "ai", text: parsed.reply as string },
          ],
          patientBrief: patientContext,
          aiResponse: response,
          userId,
        }).catch((e) => console.error("[ai-doctor] queueAndDraft failed:", e));

        // P0.1: BLOCK unsafe responses, don't just flag them.
        // If any CRITICAL violation is detected, strip dangerous fields
        // and override the reply with a safety message. The user must
        // never see a drug recommendation that conflicts with their
        // allergies, pregnancy status, or age.
        const hasCritical = violations.some((v) => v.severity === "critical");
        if (hasCritical) {
          parsed.otc_medicines = [];
          if (parsed.urgency === "green") parsed.urgency = "yellow";
          parsed.reply = "⚠️ Safety check triggered — " +
            violations.map((v) => v.reason).join(". ") +
            ". Please consult a doctor before taking any medicine.";
          if (!Array.isArray(parsed.what_to_do)) parsed.what_to_do = [];
          (parsed.what_to_do as string[]).unshift("Consult a doctor before taking any medicine");
        }

        (parsed as Record<string, unknown>)._safety_violations = violations.map((v) => v.reason);
      }

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("AI Doctor error:", err);
      return NextResponse.json(
        { error: `AI service error: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("AI Doctor route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Background job: insert a rule_candidate row, then call the rule writer
 * to draft a proposal. If the draft is auto-approvable (strict tighten),
 * also insert an active_rule and mark the candidate approved automatically.
 *
 * Runs as fire-and-forget after the user response is sent — never blocks
 * the user, never throws past this function.
 */
async function queueAndDraftCandidate(input: {
  triggerSource: string;
  triggerReason: string;
  conversation: Array<{ role: string; text: string }>;
  patientBrief?: string;
  aiResponse?: string;
  userId?: string;
}) {
  try {
    const candidate = await prisma.ruleCandidate.create({
      data: {
        trigger_source: input.triggerSource,
        trigger_reason: input.triggerReason.slice(0, 500),
        conversation: JSON.stringify(input.conversation).slice(0, 8000),
        patient_brief: input.patientBrief?.slice(0, 4000),
        ai_response: input.aiResponse?.slice(0, 4000),
        user_id: input.userId,
        status: "pending",
      },
    });

    const draft = await draftRuleFromBadAnswer({
      triggerReason: input.triggerReason,
      conversation: input.conversation,
      patientBrief: input.patientBrief,
      aiResponse: input.aiResponse,
    });

    if (!draft) return; // candidate stays pending without a proposal

    await prisma.ruleCandidate.update({
      where: { id: candidate.id },
      data: {
        proposed_rule: draft.rule_text,
        proposed_category: draft.category,
        proposed_severity: draft.severity,
      },
    });

    // Auto-approve safety-tightening rules — they can never make the AI
    // more dangerous, only more cautious. Everything else waits for review.
    if (isAutoApprovable(draft)) {
      // P1.2: Deduplicate — skip if a similar rule already exists
      const existing = await prisma.activeRule.findFirst({
        where: { rule_text: draft.rule_text, is_active: true },
      });
      if (existing) return; // already covered

      await prisma.activeRule.create({
        data: {
          rule_text: draft.rule_text,
          category: draft.category,
          severity: draft.severity,
          source: "auto_safe",
          candidate_id: candidate.id,
          is_active: true,
        },
      });
      await prisma.ruleCandidate.update({
        where: { id: candidate.id },
        data: {
          status: "approved",
          reviewer_email: "auto_safe",
          reviewed_at: new Date(),
          final_rule: draft.rule_text,
        },
      });
      // Invalidate the rules cache so the next request picks up the new rule
      const { invalidateRulesCache } = await import("@/lib/ai/medical/rules-server");
      invalidateRulesCache();
    }
  } catch (err) {
    console.error("[queueAndDraftCandidate] failed:", err);
  }
}
