import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const DOCTOR_PROMPT = `You are "Dr. MediLog" — a friendly Indian family doctor assistant. You help families understand their symptoms and guide them on what to do next.

PATIENT CONTEXT:
{PATIENT_CONTEXT}

USER'S MESSAGE: "{USER_MESSAGE}"

RESPOND IN THIS JSON FORMAT (no markdown, just raw JSON):
{
  "urgency": "green|yellow|orange|red",
  "urgency_label": "Home Care|See Doctor Soon|See Doctor Today|Rush to Hospital",
  "urgency_message": "Short urgency explanation in Hindi+English",
  "possible_causes": ["Cause 1", "Cause 2"],
  "what_to_do": ["Step 1 action", "Step 2 action"],
  "home_remedies": ["Remedy 1", "Remedy 2"],
  "otc_medicines": [
    {
      "name": "Medicine name (OTC only)",
      "dosage": "e.g. 500mg",
      "when": "e.g. Take after food, every 6 hours",
      "warning": "Don't take if allergic to X"
    }
  ],
  "when_to_rush": ["Go to hospital immediately if: symptom 1", "symptom 2"],
  "doctor_type": "Which specialist to see (e.g. General Physician, ENT, Dermatologist)",
  "reply": "Conversational reply in simple Hindi+English mix (2-4 sentences). Be warm and caring like a family doctor.",
  "follow_up_questions": ["Suggested follow-up question 1", "Question 2"]
}

SAFETY RULES (STRICTLY FOLLOW):
1. NEVER suggest prescription drugs — ONLY OTC medicines (Paracetamol, Crocin, ORS, Digene, Vicks, Caladryl, Moov, Volini, Burnol, Betadine, Strepsils, Pudinhara)
2. ALWAYS check patient's allergies before suggesting medicines
3. For children under 5 → ALWAYS say "Bachche ko doctor ko dikhayein" (yellow/orange)
4. For elderly 65+ → lower threshold for doctor visit (yellow minimum)
5. For pregnant women → NEVER suggest any medicine, always say consult doctor
6. Chest pain, breathing difficulty, unconsciousness, heavy bleeding, seizures → ALWAYS RED urgency
7. High fever (>103°F) for 3+ days → ORANGE minimum
8. If unsure → default to YELLOW (see doctor)
9. Reply in Hinglish (Hindi+English mix) naturally
10. Be warm, caring, reassuring — not clinical
11. NEVER diagnose — say "ho sakta hai" (it could be), not "yeh hai" (this is)
12. ALWAYS end with "Doctor se zaroor milein agar..." (do see a doctor if...)`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, patient, chatHistory } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build patient context
    let patientContext = "No patient info available.";
    if (patient) {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
        : null;
      patientContext = [
        `Name: ${patient.name || "Unknown"}`,
        age !== null ? `Age: ${age} years` : null,
        patient.gender ? `Gender: ${patient.gender}` : null,
        patient.blood_group ? `Blood Group: ${patient.blood_group}` : null,
        patient.allergies?.length > 0 ? `ALLERGIES: ${patient.allergies.join(", ")}` : "No known allergies",
        patient.chronic_conditions?.length > 0 ? `CHRONIC CONDITIONS: ${patient.chronic_conditions.join(", ")}` : null,
        patient.current_medicines?.length > 0 ? `CURRENT MEDICINES: ${patient.current_medicines.join(", ")}` : null,
      ].filter(Boolean).join("\n");
    }

    // Build prompt with context
    let prompt = DOCTOR_PROMPT
      .replace("{PATIENT_CONTEXT}", patientContext)
      .replace("{USER_MESSAGE}", message.slice(0, 1000));

    // Add chat history for context
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      const historyText = chatHistory
        .slice(-6) // last 6 messages for context
        .map((m: { role: string; text: string }) => `${m.role === "user" ? "Patient" : "Dr. MediLog"}: ${m.text}`)
        .join("\n");
      prompt += `\n\nPREVIOUS CONVERSATION:\n${historyText}`;
    }

    try {
      const response = await callGemini(
        [{ text: prompt }],
        { temperature: 0.3, maxOutputTokens: 1500 }
      );

      const parsed = parseJsonResponse(response);

      // Ensure required fields
      if (!parsed.urgency) parsed.urgency = "yellow";
      if (!parsed.reply) parsed.reply = response;
      if (!Array.isArray(parsed.possible_causes)) parsed.possible_causes = [];
      if (!Array.isArray(parsed.what_to_do)) parsed.what_to_do = [];
      if (!Array.isArray(parsed.home_remedies)) parsed.home_remedies = [];
      if (!Array.isArray(parsed.otc_medicines)) parsed.otc_medicines = [];
      if (!Array.isArray(parsed.when_to_rush)) parsed.when_to_rush = [];
      if (!Array.isArray(parsed.follow_up_questions)) parsed.follow_up_questions = [];

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("AI Doctor error:", err);
      return NextResponse.json(
        { error: `AI service error: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("AI Doctor route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
