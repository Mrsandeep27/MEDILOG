import { NextRequest, NextResponse } from "next/server";

const LAB_INSIGHT_PROMPT = `You are a friendly Indian doctor explaining lab results to a patient's family.

Analyze the lab report text/image and return JSON (no markdown, just raw JSON):
{
  "patient_name": "string or null",
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "string or null",
  "markers": [
    {
      "name": "Test name (e.g. Hemoglobin, Blood Sugar Fasting)",
      "value": "Patient's value with unit",
      "normal_range": "Normal range",
      "status": "normal|low|high|critical",
      "explanation": "Simple 1-line explanation in Hindi+English mix what this means",
      "advice": "What to do if abnormal (diet, lifestyle, or see doctor)"
    }
  ],
  "summary": "Overall summary in 2-3 simple sentences, Hindi+English mix",
  "urgent_attention": ["List any markers that need immediate doctor consultation"]
}

Rules:
- Explain like talking to an Indian grandmother — NO medical jargon
- Use Hindi+English naturally (Hinglish)
- Mark status: normal (green), low (yellow), high (orange), critical (red)
- For critical values, always say "Doctor se turant milein"
- Common Indian tests: CBC, LFT, KFT, Thyroid, Lipid Profile, HbA1c, Vitamin D/B12
- If you can't read the report clearly, explain what you CAN see`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, image } = body;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: LAB_INSIGHT_PROMPT },
    ];

    // If image provided (base64), use vision
    if (image) {
      const base64Match = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (base64Match) {
        let mime = `image/${base64Match[1]}`;
        if (mime === "image/jpg") mime = "image/jpeg";
        parts.push({
          inlineData: {
            mimeType: mime,
            data: base64Match[2],
          },
        });
      }
    }

    // If OCR text provided
    if (text) {
      parts.push({ text: `\n\nLab Report Text:\n${text}` });
    }

    if (!text && !image) {
      return NextResponse.json({ error: "No report data provided" }, { status: 400 });
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
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = { markers: [], summary: content };
      }
    } catch {
      parsed = { markers: [], summary: content };
    }

    if (!Array.isArray(parsed.markers)) parsed.markers = [];

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Lab insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
