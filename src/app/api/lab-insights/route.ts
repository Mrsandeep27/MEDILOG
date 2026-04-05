import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, image, locale } = body;

    if (!text && !image) {
      return NextResponse.json({ error: "No report data provided" }, { status: 400 });
    }

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: LAB_INSIGHT_PROMPT },
    ];

    if (image) {
      const base64Match = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (base64Match) {
        let mime = `image/${base64Match[1]}`;
        if (mime === "image/jpg") mime = "image/jpeg";
        parts.push({ inlineData: { mimeType: mime, data: base64Match[2] } });
      }
    }

    if (text) {
      parts.push({ text: `\n\nLab Report Text:\n${text}` });
    }

    if (locale === "hi") {
      parts.push({ text: "\n\nIMPORTANT: All explanations, advice, summary must be in Hindi (Devanagari script). Marker names can stay in English." });
    } else {
      parts.push({ text: "\n\nIMPORTANT: All explanations, advice, summary must be in simple English." });
    }

    try {
      const response = await callGemini(parts, { feature: "lab-insights", jsonMode: true });
      const parsed = parseJsonResponse(response);
      if (!Array.isArray(parsed.markers)) parsed.markers = [];

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("Lab AI error:", err);
      return NextResponse.json(
        { error: `AI failed: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Lab insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
