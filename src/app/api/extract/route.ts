import { NextRequest, NextResponse } from "next/server";

const EXTRACTION_PROMPT = `You are a medical prescription parser for Indian prescriptions. Extract structured data from the OCR text below.

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
      "before_food": true/false
    }
  ],
  "notes": "any other important notes from the prescription"
}

Rules:
- Extract ALL medicines mentioned
- For frequency mapping: OD/QD = once_daily, BD/BID = twice_daily, TDS/TID = thrice_daily
- "before food" / "empty stomach" / "AC" = before_food: true
- "after food" / "PC" = before_food: false (default)
- Parse Hindi/Hinglish text too (common in Indian prescriptions)
- If a field is not found, use null
- Dates in DD/MM/YYYY should be converted to YYYY-MM-DD`;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    if (typeof text !== "string" || text.length > 10000) {
      return NextResponse.json(
        { error: "Text too long (max 10,000 characters)" },
        { status: 400 }
      );
    }

    // Use Google Gemini Flash (free)
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Set GOOGLE_AI_API_KEY." },
        { status: 500 }
      );
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
                {
                  text: `${EXTRACTION_PROMPT}\n\nOCR Text:\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error: status", response.status);
      return NextResponse.json(
        { error: "AI extraction failed" },
        { status: 500 }
      );
    }

    const result = await response.json();
    const content =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Extract JSON robustly
    let parsed;
    try {
      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = { medicines: [], notes: content };
      }
    } catch {
      parsed = { medicines: [], notes: content };
    }

    // Ensure medicines is always an array
    if (!Array.isArray(parsed.medicines)) {
      parsed.medicines = [];
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Extract API error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
