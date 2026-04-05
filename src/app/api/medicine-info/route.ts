import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MEDICINE_INFO_PROMPT = `You are a helpful Indian pharmacist assistant. A user has uploaded a photo of a medicine (tablet strip, bottle, syrup, etc).

Identify the medicine and provide information in this JSON format (no markdown, just raw JSON):
{
  "name": "Medicine name",
  "generic_name": "Generic/salt name",
  "manufacturer": "Company name or null",
  "type": "tablet/capsule/syrup/injection/cream/drops/inhaler",
  "uses": ["Use 1 in simple language", "Use 2"],
  "how_to_take": "Simple instructions (before/after food, with water, etc)",
  "common_side_effects": ["Side effect 1", "Side effect 2"],
  "serious_side_effects": ["Serious side effect 1"],
  "warnings": ["Warning 1", "Warning 2"],
  "not_for": ["Condition 1 where this should NOT be taken"],
  "generic_alternative": {
    "name": "Cheaper generic alternative",
    "approx_price": "₹XX for X tablets"
  },
  "approx_price": "₹XX for X tablets",
  "pregnancy_safe": "Yes/No/Consult doctor",
  "alcohol_safe": "Yes/No/Avoid",
  "habit_forming": "Yes/No",
  "requires_prescription": "Yes/No",
  "summary_hindi": "Medicine ka simple Hindi mein ek line description"
}

Rules:
- Write uses and side effects in SIMPLE language (not medical jargon)
- An Indian grandmother should understand your explanation
- If you can't identify the medicine clearly, set name to "Unknown" and explain in uses what you can see
- Prices should be approximate Indian MRP in ₹
- Always include Hindi summary`;

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
    const { image, action, question, context, locale } = body;

    // === CHAT: Follow-up question about a medicine ===
    if (action === "chat") {
      if (!question || !context) {
        return NextResponse.json({ error: "Question and context required" }, { status: 400 });
      }

      const chatPrompt = `You are a helpful Indian pharmacist assistant. The user is asking about this medicine:

Medicine: ${context.name} (${context.generic_name})
Uses: ${(context.uses || []).join(", ")}

User's question: "${question}"

Rules:
- Answer in simple, easy-to-understand language
- Mix Hindi and English naturally (how Indians actually talk)
- If the question is about safety, always add "Please consult your doctor" disclaimer
- Keep answer concise (2-4 sentences)
- Be helpful but responsible — don't replace a doctor's advice${locale === "hi" ? "\n- Answer in Hindi (Devanagari script)" : "\n- Answer in simple English"}`;

      try {
        const answer = await callGemini(
          [{ text: chatPrompt }],
          { temperature: 0.3, maxOutputTokens: 512, feature: "medicine-chat" }
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
      ? "\n\nIMPORTANT: Write ALL text fields (uses, how_to_take, side effects, warnings, summary_hindi) in Hindi (Devanagari script). Medicine name and generic_name can stay in English."
      : "\n\nIMPORTANT: Write all fields in simple English.";

    try {
      const text = await callGemini([
        { text: MEDICINE_INFO_PROMPT + langInstruction },
        { inlineData: { mimeType, data: base64Data } },
      ], { feature: "medicine-info", jsonMode: true });

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
