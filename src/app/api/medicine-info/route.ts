import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// System instruction — cached by Gemini across calls for speed
const MEDICINE_SYSTEM = `You are a helpful Indian pharmacist assistant. Identify medicines from photos and answer questions.

OUTPUT: single raw JSON, no markdown. Schema:
{"name":"","generic_name":"","manufacturer":"","type":"tablet|capsule|syrup|injection|cream|drops|inhaler","uses":["simple language"],"how_to_take":"","common_side_effects":[""],"serious_side_effects":[""],"warnings":[""],"not_for":[""],"generic_alternative":{"name":"","approx_price":"₹XX"},"approx_price":"₹XX","pregnancy_safe":"Yes|No|Consult doctor","alcohol_safe":"Yes|No|Avoid","habit_forming":"Yes|No","requires_prescription":"Yes|No","summary_hindi":"one line Hindi"}

KEEP TIGHT: max 3 uses, max 3 common side effects, max 2 serious, max 2 warnings.
Rules: simple language an Indian grandmother understands. Prices in ₹. Always include Hindi summary. If unidentifiable, name="Unknown".`;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { image, action, question, context, locale, type, medicines } = body;

    // === INTERACTION CHECK: Check if medicines can be safely combined ===
    if (type === "interaction" || action === "interaction") {
      if (!Array.isArray(medicines) || medicines.length < 2) {
        return NextResponse.json(
          { error: "At least 2 medicines required" },
          { status: 400 }
        );
      }

      const interactionUserPrompt = `Medicines: ${medicines.join(", ")}${locale === "hi" ? "\nReply in Hindi." : ""}`;

      const interactionSystem = `You are an Indian pharmacist AI. Check drug interactions.
OUTPUT JSON: {"interactions":[{"medicines":["A","B"],"severity":"mild|moderate|severe","description":"simple explanation"}],"overall_safe":true|false,"summary":"one line"}
No interactions → interactions:[], overall_safe:true. Max 3 interactions. Simple language. "Consult doctor" for moderate/severe.`;

      try {
        const text = await callGemini(
          [{ text: interactionUserPrompt }],
          { temperature: 0.2, maxOutputTokens: 600, feature: "medicine-interaction", jsonMode: true, systemInstruction: interactionSystem }
        );

        const parsed = parseJsonResponse(text);
        if (!Array.isArray(parsed.interactions)) parsed.interactions = [];

        // Normalize interaction shape to match what the page expects:
        // { medicines: [name1, name2], severity, description }
        const rawInteractions = parsed.interactions as Array<Record<string, unknown>>;
        const normalized = rawInteractions
          .map((i) => {
            // Accept either { medicines: [a,b] } OR { medicine_a, medicine_b }
            let meds: string[] = [];
            if (Array.isArray(i.medicines)) {
              meds = (i.medicines as unknown[]).filter(
                (m): m is string => typeof m === "string"
              );
            } else if (i.medicine_a && i.medicine_b) {
              meds = [String(i.medicine_a), String(i.medicine_b)];
            }
            if (meds.length < 2) return null;

            const severity = ["mild", "moderate", "severe"].includes(i.severity as string)
              ? (i.severity as string)
              : "moderate";

            const description = [i.description, i.recommendation]
              .filter((v) => typeof v === "string" && v.trim().length > 0)
              .join(" ");

            return {
              medicines: meds,
              severity,
              description: description || "Interaction detected — consult your doctor.",
            };
          })
          .filter((i): i is { medicines: string[]; severity: string; description: string } => i !== null);

        parsed.interactions = normalized;
        if (typeof parsed.overall_safe !== "boolean") {
          parsed.overall_safe = normalized.length === 0;
        }

        return NextResponse.json(parsed);
      } catch (err) {
        console.error("Interaction check error:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to check interactions" },
          { status: 500 }
        );
      }
    }

    // === CHAT: Follow-up question about a medicine ===
    if (action === "chat") {
      if (!question || !context) {
        return NextResponse.json({ error: "Question and context required" }, { status: 400 });
      }

      const chatUserPrompt = `Medicine: ${context.name} (${context.generic_name})\nQuestion: "${question}"${locale === "hi" ? "\nReply in Hindi." : ""}`;
      const chatSystem = `Indian pharmacist assistant. Answer medicine questions in 2-3 sentences, simple language. Always add "consult doctor" for safety questions. Hinglish is fine.`;

      try {
        const answer = await callGemini(
          [{ text: chatUserPrompt }],
          { temperature: 0.3, maxOutputTokens: 300, feature: "medicine-chat", systemInstruction: chatSystem }
        );
        return NextResponse.json({ answer });
      } catch (err) {
        console.error("Chat error:", err);
        return NextResponse.json({ error: "AI service error. Please try again." }, { status: 500 });
      }
    }

    // === IDENTIFY: Read medicine from image ===
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const base64Match = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ error: "Invalid image format. Please upload a JPG or PNG." }, { status: 400 });
    }

    let mimeType = `image/${base64Match[1]}`;
    const base64Data = base64Match[2];
    if (mimeType === "image/jpg") mimeType = "image/jpeg";

    // Check size
    const sizeInBytes = Math.ceil(base64Data.length * 0.75);
    if (sizeInBytes > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large (max 4MB). Please use a smaller photo." }, { status: 400 });
    }

    const langInstruction = locale === "hi"
      ? "Write all text fields in Hindi (Devanagari). Medicine name can stay English."
      : "Write all fields in simple English.";

    try {
      const text = await callGemini([
        { text: `Identify this medicine. ${langInstruction}` },
        { inlineData: { mimeType, data: base64Data } },
      ], { feature: "medicine-info", jsonMode: true, maxOutputTokens: 800, systemInstruction: MEDICINE_SYSTEM });

      const parsed = parseJsonResponse(text);
      if (!parsed.name) {
        parsed.name = "Unknown";
        parsed.uses = ["Could not identify medicine from image"];
        parsed.summary_hindi = "Dawai pehchaan nahi paaye";
      }
      if (!Array.isArray(parsed.medicines)) delete parsed.medicines;

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("Medicine identify error:", err);
      return NextResponse.json(
        { error: `AI failed: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Medicine info error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
