import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// System instruction — cached by Gemini across calls
const LAB_SYSTEM = `You are a friendly Indian doctor explaining lab results to a patient's family.

OUTPUT: single raw JSON, no markdown. Schema:
{"patient_name":"or null","report_date":"YYYY-MM-DD or null","lab_name":"or null","markers":[{"name":"test","value":"with unit","normal_range":"","status":"normal|low|high|critical","explanation":"1-line Hinglish","advice":"what to do"}],"summary":"2-3 sentences Hinglish","urgent_attention":["markers needing immediate doctor visit"]}

KEEP TIGHT: max 10 markers. Each explanation max 1 sentence.
Rules:
- Explain like talking to an Indian grandmother — NO medical jargon
- Hinglish naturally (Hindi+English mix)
- status: normal=green, low=yellow, high=orange, critical=red
- Critical → "Doctor se turant milein"
- Common Indian tests: CBC, LFT, KFT, Thyroid, Lipid Profile, HbA1c, Vitamin D/B12
- If unreadable, explain what you CAN see`;

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

    // User content — just the report data + language flag. System instruction
    // handles the persona, schema, and rules (Gemini caches it).
    const langFlag = locale === "hi"
      ? "All text in Hindi (Devanagari). Marker names can stay English."
      : "All text in simple English.";

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: `Analyze this lab report. ${langFlag}` },
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
      parts.push({ text: `Lab Report Text:\n${text.slice(0, 3000)}` });
    }

    try {
      const response = await callGemini(parts, {
        feature: "lab-insights",
        jsonMode: true,
        maxOutputTokens: 1000,
        systemInstruction: LAB_SYSTEM,
      });
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
