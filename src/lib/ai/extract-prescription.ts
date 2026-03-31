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

/**
 * Convert a Blob/File to a base64 data URL for sending to Gemini Vision.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract prescription data using Gemini Vision (primary) + OCR text (supplementary).
 *
 * @param ocrText  - OCR text (can be empty if OCR failed)
 * @param imageBlob - Original image blob to send to Gemini Vision (optional but recommended)
 * @param apiEndpoint - API endpoint (defaults to /api/extract)
 */
export async function extractPrescription(
  ocrText: string,
  imageBlob?: Blob | null,
  apiEndpoint?: string
): Promise<ExtractionResult> {
  const endpoint = apiEndpoint || "/api/extract";

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { data: { session } } = await createClient().auth.getSession();

    // Build request body
    const body: { text?: string; image?: string } = {};

    // Convert image to base64 if available
    if (imageBlob) {
      try {
        body.image = await blobToBase64(imageBlob);
      } catch {
        // If image conversion fails, fall back to text-only
      }
    }

    // Always include OCR text as supplementary context
    if (ocrText) {
      body.text = ocrText;
    }

    // Need at least one of image or text
    if (!body.image && !body.text) {
      return {
        medicines: [],
        raw_text: "",
        error: "No image or text to process",
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
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
