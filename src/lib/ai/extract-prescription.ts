"use client";

import type { Frequency } from "@/lib/db/schema";

export interface ExtractedMedicine {
  name: string;
  dosage?: string;
  frequency?: Frequency;
  duration?: string;
  before_food: boolean;
}

export interface ExtractionResult {
  doctor_name?: string;
  hospital_name?: string;
  visit_date?: string;
  diagnosis?: string;
  medicines: ExtractedMedicine[];
  raw_text: string;
  notes?: string;
  error?: string;
}

export async function extractPrescription(
  ocrText: string,
  apiEndpoint?: string
): Promise<ExtractionResult> {
  const endpoint = apiEndpoint || "/api/extract";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: ocrText }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        medicines: [],
        raw_text: ocrText,
        error: errData.error || `API error: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      doctor_name: data.doctor_name || undefined,
      hospital_name: data.hospital_name || undefined,
      visit_date: data.visit_date || undefined,
      diagnosis: data.diagnosis || undefined,
      notes: data.notes || undefined,
      raw_text: ocrText,
      medicines: (data.medicines || []).map((m: ExtractedMedicine) => ({
        name: m.name || "",
        dosage: m.dosage || undefined,
        frequency: m.frequency || undefined,
        duration: m.duration || undefined,
        before_food: m.before_food ?? false,
      })),
    };
  } catch (err) {
    console.error("AI extraction failed:", err);
    return {
      medicines: [],
      raw_text: ocrText,
      error: "Failed to connect to AI service",
    };
  }
}
