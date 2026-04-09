/**
 * Rule Writer (SERVER-SIDE)
 * ──────────────────────────
 * Given a bad-answer signal, asks Gemini to draft ONE specific rule that
 * would have prevented it. Output is a structured JSON object that gets
 * stored as a rule_candidate awaiting admin review.
 *
 * Runs ONLY when a candidate is queued (rare path) — does not affect
 * normal AI Doctor latency.
 */

import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const RULE_WRITER_SYSTEM = `You are a medical safety rule writer for an Indian family-doctor AI assistant. Given a conversation that produced a bad/unsafe answer, write ONE concise rule that would prevent the same mistake in the future.

OUTPUT: a single JSON object, no markdown:
{
  "rule_text": "ONE imperative sentence starting with NEVER, ALWAYS, or IF...THEN. Max 200 chars. Be specific.",
  "category": "safety | red_flag | grounding | dosage | tone",
  "severity": "low | normal | high | critical"
}

GUIDELINES:
- The rule must be GENERAL enough to apply to similar cases, not just this exact patient.
- Prefer rules that TIGHTEN safety. Never write a rule that weakens an existing constraint.
- Critical = patient could be harmed. High = significant risk. Normal = quality. Low = tone.
- If the bad answer was due to a missed contraindication, write the contraindication explicitly.
- If the AI gave low urgency on a red-flag symptom, write a rule mapping that symptom → red.
- If the AI suggested a non-OTC drug, write a rule banning that specific drug class.`;

interface RuleDraft {
  rule_text: string;
  category: string;
  severity: string;
}

/**
 * Draft a rule from a bad conversation. Returns null on failure (we still
 * keep the candidate; admin can write the rule manually in the UI).
 */
export async function draftRuleFromBadAnswer(input: {
  triggerReason: string;
  conversation: Array<{ role: string; text: string }>;
  patientBrief?: string;
  aiResponse?: string;
}): Promise<RuleDraft | null> {
  const conversationText = input.conversation
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.text.slice(0, 400)}`)
    .join("\n");

  const userPrompt = [
    `TRIGGER: ${input.triggerReason}`,
    input.patientBrief ? `\nPATIENT BRIEF:\n${input.patientBrief}` : "",
    `\nCONVERSATION:\n${conversationText}`,
    input.aiResponse ? `\nAI RESPONSE THAT WAS FLAGGED:\n${input.aiResponse.slice(0, 1000)}` : "",
    `\nWrite ONE rule that would prevent this. Output JSON only.`,
  ].filter(Boolean).join("\n");

  try {
    const raw = await callGemini(
      [{ text: userPrompt }],
      {
        temperature: 0.2,
        maxOutputTokens: 300,
        feature: "rule-writer",
        jsonMode: true,
        systemInstruction: RULE_WRITER_SYSTEM,
      }
    );

    const parsed = parseJsonResponse(raw) as Partial<RuleDraft>;
    if (!parsed.rule_text || typeof parsed.rule_text !== "string") return null;

    return {
      rule_text: String(parsed.rule_text).slice(0, 300),
      category: ["safety", "red_flag", "grounding", "dosage", "tone"].includes(String(parsed.category))
        ? String(parsed.category)
        : "safety",
      severity: ["low", "normal", "high", "critical"].includes(String(parsed.severity))
        ? String(parsed.severity)
        : "high",
    };
  } catch (err) {
    console.error("[rule-writer] failed:", err);
    return null;
  }
}

/**
 * Decide if a freshly drafted rule is safe to AUTO-APPROVE without admin
 * review. Only rules that strictly tighten safety qualify.
 */
export function isAutoApprovable(draft: RuleDraft): boolean {
  if (draft.category !== "safety" && draft.category !== "red_flag") return false;
  if (draft.severity !== "critical" && draft.severity !== "high") return false;

  const text = draft.rule_text.toUpperCase();
  // Whitelist: starts with restrictive verbs only
  const tightens =
    text.startsWith("NEVER") ||
    text.startsWith("ALWAYS WARN") ||
    text.startsWith("ALWAYS RECOMMEND DOCTOR") ||
    text.startsWith("ALWAYS ESCALATE") ||
    text.startsWith("RAISE URGENCY") ||
    text.startsWith("IF") && /THEN.*(NEVER|RED|EMERGENCY|DOCTOR|AVOID|DO NOT)/.test(text);

  // Hard blacklist: never auto-approve anything that loosens safety
  const loosens =
    /MAY|CAN|OK TO|ALLOWED|PERMITTED|REMOVE|DELETE|DISREGARD|SAFE TO|FINE TO|NO NEED|IGNORE|SKIP|DON'T WORRY|NOT NECESSARY|ACCEPTABLE|HARMLESS|WORRY|BOTHER/.test(text);

  return tightens && !loosens;
}
