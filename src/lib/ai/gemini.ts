/**
 * Gemini API helper with:
 * 1. Multiple API key rotation (round-robin across keys)
 * 2. Model fallback per key (tries 4 models before moving to next key)
 * 3. Automatic retry loop
 *
 * Flow:
 * Key1 → model1 → model2 → model3 → model4 → all failed?
 * Key2 → model1 → model2 → model3 → model4 → all failed?
 * Key3 → model1 → model2 → model3 → model4 → all failed?
 * → Error: all keys and models exhausted
 *
 * Set env vars:
 * GOOGLE_AI_API_KEY=key1            (required, primary key)
 * GOOGLE_AI_API_KEY_2=key2          (optional)
 * GOOGLE_AI_API_KEY_3=key3          (optional)
 * GOOGLE_AI_API_KEY_4=key4          (optional)
 * GOOGLE_AI_API_KEY_5=key5          (optional)
 */

// Ordered by: highest free RPD first
const VISION_MODELS = [
  "gemini-3.1-flash-lite-preview",  // 15 RPM, 500 RPD
  "gemini-2.5-flash-lite",          // 10 RPM, 20 RPD
  "gemini-3-flash-preview",         // 5 RPM, 20 RPD
  "gemini-2.5-flash",               // 5 RPM, 20 RPD
];

const TEXT_MODELS = [
  "gemini-3.1-flash-lite-preview",  // 15 RPM, 500 RPD
  "gemini-2.5-flash-lite",          // 10 RPM, 20 RPD
  "gemini-3-flash-preview",         // 5 RPM, 20 RPD
];

// Track which key to start with (round-robin across requests)
let currentKeyIndex = 0;

function getApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GOOGLE_AI_API_KEY;
  if (primary) keys.push(primary);

  // Support up to 10 additional keys
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
}

export async function callGemini(
  parts: GeminiPart[],
  options: GeminiOptions = {}
): Promise<string> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) throw new Error("No GOOGLE_AI_API_KEY configured");

  const hasImage = parts.some((p) => p.inlineData);
  const models = hasImage ? VISION_MODELS : TEXT_MODELS;
  const { temperature = 0.1, maxOutputTokens = 2048 } = options;

  let lastError = "";
  const startKeyIndex = currentKeyIndex % apiKeys.length;

  // Try each API key
  for (let k = 0; k < apiKeys.length; k++) {
    const keyIndex = (startKeyIndex + k) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];

    // Try each model with this key
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { temperature, maxOutputTokens },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            // Success! Advance round-robin to next key for next request
            currentKeyIndex = (keyIndex + 1) % apiKeys.length;
            return text;
          }
          lastError = `Key${keyIndex + 1}/${model}: empty response`;
          continue;
        }

        const status = response.status;
        const errBody = await response.text().catch(() => "");

        if (status === 429 || status === 404 || status === 400) {
          lastError = `Key${keyIndex + 1}/${model}: ${status}`;
          console.warn(`Gemini Key${keyIndex + 1}/${model} → ${status}, trying next...`);
          continue;
        }

        // 403 = invalid key, skip to next key entirely
        if (status === 403) {
          lastError = `Key${keyIndex + 1}: invalid/expired`;
          console.warn(`Gemini Key${keyIndex + 1} → 403 (invalid), skipping key...`);
          break; // break model loop, move to next key
        }

        lastError = `Key${keyIndex + 1}/${model}: ${status}`;
        break;
      } catch (err) {
        lastError = `Key${keyIndex + 1}/${model}: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }
    }
  }

  throw new Error(`All AI models failed. ${lastError}`);
}

/**
 * Parse JSON from AI response (handles markdown blocks, extra text)
 */
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
