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
  /** Force JSON output from Gemini (responseMimeType: application/json) */
  jsonMode?: boolean;
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
  const { temperature = 0.1, maxOutputTokens = 2048, feature = "unknown", userId, systemInstruction, jsonMode = false } = options;

  // Atomic key rotation — each call grabs a unique starting key index
  // This prevents concurrent requests from hammering the same key
  const startKeyIndex = currentKeyIndex % apiKeys.length;
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;

  const errors: string[] = [];
  const startTime = Date.now();
  const invalidKeys = new Set<number>();

  for (let k = 0; k < apiKeys.length; k++) {
    const keyIndex = (startKeyIndex + k) % apiKeys.length;
    if (invalidKeys.has(keyIndex)) continue;
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
              generationConfig: {
                temperature,
                maxOutputTokens,
                ...(jsonMode ? { responseMimeType: "application/json" } : {}),
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
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
          errors.push(`K${keyIndex + 1}/${model}: empty`);
          continue; // try next model
        }

        const status = response.status;

        // 403 = key invalid/expired — mark key as bad, skip remaining models
        if (status === 403) {
          errors.push(`K${keyIndex + 1}: invalid/expired`);
          invalidKeys.add(keyIndex);
          break; // try next key
        }

        // 429 = rate limit on THIS specific model. Each Gemini model has its
        // own per-minute quota, so try a DIFFERENT model on the same key first.
        // Only after all models fail on this key do we move to the next key.
        if (status === 429) {
          errors.push(`K${keyIndex + 1}/${model}: 429 rate-limit`);
          continue; // try next model on same key
        }

        // 4xx (other) = bad request/model not found — try next model with same key
        if (status >= 400 && status < 500) {
          errors.push(`K${keyIndex + 1}/${model}: ${status}`);
          continue; // try next model
        }

        // 5xx = transient server issue — try next model first, then next key
        errors.push(`K${keyIndex + 1}/${model}: ${status}`);
        continue; // try next model on same key
      } catch (err) {
        errors.push(
          `K${keyIndex + 1}/${model}: ${err instanceof Error ? err.message : String(err)}`
        );
        continue; // try next model
      }
    }
  }

  // Log failure with FULL error trail
  const errorSummary = errors.join(" | ");
  logUsage({
    feature,
    model_used: "none",
    key_index: 0,
    duration: Date.now() - startTime,
    success: false,
    error: errorSummary,
    user_id: userId,
  });

  // Show user a friendlier message; full trail is in server logs
  const userMessage = errors.some((e) => e.includes("503") || e.includes("overloaded"))
    ? "AI service is temporarily overloaded. Please try again in a moment."
    : errors.some((e) => e.includes("429") || e.includes("rate-limit"))
      ? "Daily AI quota reached. Please try again later."
      : "AI service is unavailable. Please try again.";

  console.error(`[Gemini] ${errorSummary}`);
  throw new Error(userMessage);
}

export function parseJsonResponse(text: string): Record<string, unknown> {
  // Strip markdown code blocks if present (```json ... ```)
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch {
      // JSON might be truncated — try to repair by closing open strings/arrays/objects
      let partial = cleaned.substring(firstBrace, lastBrace + 1);
      // Close any unclosed strings
      const quoteCount = (partial.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) partial += '"';
      // Close unclosed arrays and objects
      const openBrackets = (partial.match(/\[/g) || []).length - (partial.match(/]/g) || []).length;
      const openBraces = (partial.match(/\{/g) || []).length - (partial.match(/}/g) || []).length;
      for (let i = 0; i < openBrackets; i++) partial += "]";
      for (let i = 0; i < openBraces; i++) partial += "}";
      try {
        return JSON.parse(partial);
      } catch {
        // Still failed — return empty
      }
    }
  }
  return {};
}
