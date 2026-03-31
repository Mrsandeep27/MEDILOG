import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VISION_PROMPT = `You are an expert medical prescription reader for Indian prescriptions. You can read handwritten and printed prescriptions accurately.

Look at this prescription image carefully. Extract ALL information you can see.

Return JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "doctor_name": "string or null",
  "hospital_name": "string or null",
  "visit_date": "YYYY-MM-DD or null",
  "diagnosis": "string or null",
  "medicines": [
    {
      "name": "full medicine name (include brand name + generic if visible)",
      "dosage": "e.g. 500mg, 10ml, 1 tablet",
      "frequency": "once_daily|twice_daily|thrice_daily|weekly|as_needed|custom",
      "duration": "e.g. 5 days, 2 weeks",
      "before_food": true or false
    }
  ],
  "notes": "any other important notes, follow-up dates, or instructions"
}

Rules for reading Indian prescriptions:
- Read handwritten text carefully — doctors often write in cursive/shorthand
- Common abbreviations: OD/QD = once_daily, BD/BID = twice_daily, TDS/TID = thrice_daily, QID = four times daily, SOS = as_needed, HS = at bedtime
- AC = before food (ante cibum), PC = after food (post cibum), empty stomach = before_food: true
- If unclear whether before/after food, default to false (after food)
- Tab/Tab. = tablet, Cap/Cap. = capsule, Syr/Syr. = syrup, Inj = injection, Oint = ointment
- Read Hindi/Hinglish text too (common in Indian prescriptions)
- Rx symbol (℞) marks the start of the prescription section
- Extract ALL medicines — look for names that start with capital letters after Rx
- Dates in DD/MM/YYYY should be converted to YYYY-MM-DD
- If you can partially read a medicine name, include your best interpretation
- Look for dosage numbers near medicine names (e.g. 500, 250, 10mg)`;

const TEXT_ONLY_PROMPT = `You are a medical prescription parser for Indian prescriptions. Extract structured data from the OCR text below.

Return JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "doctor_name": "string or null",
  "hospital_name": "string or null",
  "visit_date": "YYYY-MM-DD or null",
  "diagnosis": "string or null",
  "medicines": [
    {
      "name": "medicine name",
      "dosage": "e.g. 500mg, 10ml",
      "frequency": "once_daily|twice_daily|thrice_daily|weekly|as_needed|custom",
      "duration": "e.g. 5 days, 2 weeks",
      "before_food": true or false
    }
  ],
  "notes": "any other important notes from the prescription"
}

Rules:
- Extract ALL medicines mentioned
- OD/QD = once_daily, BD/BID = twice_daily, TDS/TID = thrice_daily
- AC / "before food" / "empty stomach" = before_food: true
- PC / "after food" = before_food: false (default)
- Parse Hindi/Hinglish text too (common in Indian prescriptions)
- If OCR text is garbled, try to interpret medicine names from partial text
- If a field is not found, use null
- Dates in DD/MM/YYYY should be converted to YYYY-MM-DD`;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, image } = body;

    // Validate: need either image or text
    if (!image && (!text || typeof text !== "string")) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }

    if (text && text.length > 10000) {
      return NextResponse.json({ error: "Text too long (max 10,000 chars)" }, { status: 400 });
    }

    try {
      let response: string;

      if (image) {
        // ── VISION MODE: Send image directly to Gemini ──
        // image is base64 data URL like "data:image/jpeg;base64,/9j/4AAQ..."
        let mimeType = "image/jpeg";
        let base64Data = image;

        if (image.startsWith("data:")) {
          const match = image.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
        }

        // Build parts: image + optional OCR text for extra context
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
          { inlineData: { mimeType, data: base64Data } },
        ];

        if (text && text.trim().length > 20) {
          parts.push({ text: `\n\nOCR text for additional context (may be garbled — trust the image more):\n${text}` });
        } else {
          parts.push({ text: "\n\nRead the prescription from the image above." });
        }

        response = await callGemini(parts, {
          temperature: 0.1,
          maxOutputTokens: 2048,
          feature: "extract",
          systemInstruction: VISION_PROMPT,
          userId: authData.user?.id,
        });
      } else {
        // ── TEXT-ONLY MODE: Fallback when no image ──
        response = await callGemini(
          [{ text: `OCR Text:\n${text}` }],
          {
            temperature: 0.1,
            maxOutputTokens: 1024,
            feature: "extract",
            systemInstruction: TEXT_ONLY_PROMPT,
            userId: authData.user?.id,
          }
        );
      }

      const parsed = parseJsonResponse(response);
      if (!Array.isArray(parsed.medicines)) parsed.medicines = [];

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("Extract AI error:", err);
      return NextResponse.json(
        { error: "AI extraction failed. Please try again." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Extract API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
