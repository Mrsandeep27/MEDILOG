import { NextRequest, NextResponse } from "next/server";

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
    const body = await request.json();
    const { image, action, question, context } = body;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

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
- Be helpful but responsible — don't replace a doctor's advice`;

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: chatPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
          }),
        }
      );

      if (!response.ok) {
        return NextResponse.json({ error: "AI service error" }, { status: 500 });
      }

      const result = await response.json();
      const answer = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't answer that.";

      return NextResponse.json({ answer });
    }

    // === IDENTIFY: Read medicine from image ===
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // image is base64 data URL — extract the base64 part
    const base64Match = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ error: "Invalid image format. Please upload a JPG or PNG." }, { status: 400 });
    }

    let mimeType = `image/${base64Match[1]}`;
    const base64Data = base64Match[2];

    // Normalize mime type
    if (mimeType === "image/jpg") mimeType = "image/jpeg";

    // Check base64 size (Vercel limit ~4.5MB, Gemini limit ~20MB)
    const sizeInBytes = Math.ceil(base64Data.length * 0.75);
    if (sizeInBytes > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Please use a smaller photo (under 4MB)." }, { status: 400 });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: MEDICINE_INFO_PROMPT },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Vision error:", response.status, errText);
      if (response.status === 400) {
        return NextResponse.json({ error: "Image could not be processed. Try a clearer photo." }, { status: 400 });
      }
      if (response.status === 429) {
        return NextResponse.json({ error: "AI rate limit reached. Please wait a minute and try again." }, { status: 429 });
      }
      return NextResponse.json({ error: `AI service error (${response.status}). Please try again.` }, { status: 500 });
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Parse JSON from response
    let parsed;
    try {
      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = { name: "Unknown", uses: ["Could not identify medicine from image"], summary_hindi: "Dawai pehchaan nahi paaye" };
      }
    } catch {
      parsed = { name: "Unknown", uses: ["Could not parse medicine info"], summary_hindi: "Dawai ki jaankari nahi mil payi" };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Medicine info error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
