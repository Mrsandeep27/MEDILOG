import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VISION_PROMPT = `You are an expert Indian medical prescription reader. You can accurately read handwritten doctor prescriptions, even messy cursive handwriting.

IMPORTANT: Read the prescription image with extreme care. Extract EVERY piece of information visible.

Return JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "patient_name": "string or null",
  "doctor_name": "string or null",
  "hospital_name": "string or null",
  "visit_date": "YYYY-MM-DD or null",
  "diagnosis": "string or null — include chief complaints (c/o) and impressions (Imp:)",
  "vitals": "string or null — e.g. BP: 110/70, PR: 60bpm, Temp: 98.6°F",
  "medicines": [
    {
      "name": "full medicine name with formulation (e.g. Tab Paracetamol, Syr Amoxicillin, Inj 5% Dextrose)",
      "dosage": "e.g. 500mg, 10ml, 1 tablet, stat",
      "frequency": "once_daily|twice_daily|thrice_daily|four_times_daily|weekly|as_needed|stat|custom",
      "duration": "e.g. 5 days, 2 weeks, stat, continuous",
      "before_food": true or false,
      "route": "oral|iv|im|topical|inhaled or null"
    }
  ],
  "instructions": ["list of non-medicine advice like 'Adequate fluid intake', 'Rest for 3 days', 'Follow up after 1 week'"],
  "notes": "any other important information visible on the prescription"
}

CRITICAL RULES for reading Indian prescriptions:
1. Read EVERY line of handwritten text. Do NOT skip anything after the Rx symbol.
2. Items after arrows (→), dashes (-), or bullet points are usually instructions or medicines.
3. "Adv:" or "Advice:" sections contain instructions — extract these into the "instructions" array.
4. Include IV fluids (e.g. "5% Dextrose IV stat", "NS drip", "RL") as medicines with route: "iv".
5. Include ORS, supplements, and non-drug items (e.g. "ORS 2 sachets") as medicines too.
6. "Adequate fluid intake", "bed rest", "soft diet" etc. go into "instructions" array, NOT medicines.

ABBREVIATION GUIDE:
- Rx/℞ = prescription starts here
- c/o = complaints of, Imp = impression/diagnosis
- Tab = tablet, Cap = capsule, Syr = syrup, Inj = injection, Oint = ointment, Drops = drops
- OD/QD = once_daily, BD/BID = twice_daily, TDS/TID = thrice_daily, QID = four_times_daily
- SOS = as_needed, HS = at bedtime, stat = immediately (one time)
- AC = before food (before_food: true), PC = after food (before_food: false)
- IV = intravenous, IM = intramuscular, SC = subcutaneous
- BP = blood pressure, PR = pulse rate, Temp = temperature, SpO2 = oxygen saturation
- # = number, /7 = for 7 days, /52 = for a week
- DD/MM/YY or DD/MM/YYYY for dates → convert to YYYY-MM-DD

HANDWRITING TIPS:
- Doctors often write brand names in CAPITALS or with first letter capitalized
- Numbers near medicine names are usually dosages (500 = 500mg, 250 = 250mg)
- "1-0-1" means twice daily (morning-afternoon-night), "1-1-1" means thrice daily
- "1+1+1" is same as "1-1-1" = thrice_daily
- If you can partially read a word, give your best interpretation
- Read Hindi/Hinglish/Kannada/Telugu text — regional languages are common
- Look for text in ALL areas: header, body, margins, and footer`;

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
          jsonMode: true,
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
            jsonMode: true,
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
