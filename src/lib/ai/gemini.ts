/**
 * Gemini API helper with:
 * 1. Multiple API key rotation (round-robin)
 * 2. Model fallback per key
 * 3. API usage tracking (logs every call to DB)
 */

import { prisma } from "@/lib/db/prisma";

// Vision: accuracy-first order (prescriptions need sharp reading)
const VISION_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
];

// Text: accuracy-first for medical advice (AI doctor, chat)
const TEXT_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
];

let currentKeyIndex = 0;

function getApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GOOGLE_AI_API_KEY;
  if (primary) keys.push(primary);
  for (let i = 2; i <= 11; i++) {
    const key = process.env[`GOOGLE_AI_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  feature?: string; // for tracking: medicine-info, lab-insights, extract, ai-doctor
  userId?: string;
  /** System instruction — separated from user content to prevent prompt injection */
  systemInstruction?: string;
}

// Log API usage to database (fire-and-forget)
function logUsage(data: {
  feature: string;
  model_used: string;
  key_index: number;
  duration: number;
  success: boolean;
  error?: string;
  user_id?: string;
  tokens_in?: number;
  tokens_out?: number;
}) {
  prisma.apiUsage.create({ data: {
    feature: data.feature,
    model_used: data.model_used,
    key_index: data.key_index,
    duration: data.duration,
    success: data.success,
    error: data.error?.slice(0, 200),
    user_id: data.user_id,
    tokens_in: data.tokens_in,
    tokens_out: data.tokens_out,
  }}).catch(() => {}); // fire-and-forget, don't block response
}

export async function callGemini(
  parts: GeminiPart[],
  options: GeminiOptions = {}
): Promise<string> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) throw new Error("No GOOGLE_AI_API_KEY configured");

  const hasImage = parts.some((p) => p.inlineData);
  const models = hasImage ? VISION_MODELS : TEXT_MODELS;
  const { temperature = 0.1, maxOutputTokens = 2048, feature = "unknown", userId, systemInstruction } = options;

  let lastError = "";
  const startKeyIndex = currentKeyIndex % apiKeys.length;
  const startTime = Date.now();

  for (let k = 0; k < apiKeys.length; k++) {
    const keyIndex = (startKeyIndex + k) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];

    for (const model of models) {
      try {
        const callStart = Date.now();
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              ...(systemInstruction ? {
                system_instruction: { parts: [{ text: systemInstruction }] },
              } : {}),
              contents: [{ parts }],
              generationConfig: { temperature, maxOutputTokens },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            currentKeyIndex = (keyIndex + 1) % apiKeys.length;

            // Log success
            logUsage({
              feature,
              model_used: model,
              key_index: keyIndex + 1,
              duration: Date.now() - callStart,
              success: true,
              user_id: userId,
              tokens_in: Math.ceil(JSON.stringify(parts).length / 4),
              tokens_out: Math.ceil(text.length / 4),
            });

            return text;
          }
          lastError = `Key${keyIndex + 1}/${model}: empty response`;
          continue;
        }

        const status = response.status;
        const errBody = await response.text().catch(() => "");

        if (status === 429 || status === 404 || status === 400) {
          lastError = `Key${keyIndex + 1}/${model}: ${status}`;
          continue;
        }

        if (status === 403) {
          lastError = `Key${keyIndex + 1}: invalid/expired`;
          break;
        }

        lastError = `Key${keyIndex + 1}/${model}: ${status}`;
        break;
      } catch (err) {
        lastError = `Key${keyIndex + 1}/${model}: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }
    }
  }

  // Log failure
  logUsage({
    feature,
    model_used: "none",
    key_index: 0,
    duration: Date.now() - startTime,
    success: false,
    error: lastError,
    user_id: userId,
  });

  throw new Error(`All AI models failed. ${lastError}`);
}

export function parseJsonResponse(text: string): Record<string, unknown> {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }
  return {};
}
