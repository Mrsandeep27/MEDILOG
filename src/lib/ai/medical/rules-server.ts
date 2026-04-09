/**
 * Active Rules Loader (SERVER-SIDE)
 * ──────────────────────────────────
 * Reads the active_rules table from Supabase, caches the result for 60s,
 * and formats them as a single block ready to inject into Gemini's
 * systemInstruction.
 *
 * Why a 60s cache?
 *  - Each AI Doctor request would otherwise hit Postgres for the rules
 *    list. With ~50-300 rules and frequent calls, that's wasted DB time.
 *  - 60s freshness window means a newly-approved rule goes live within a
 *    minute, fast enough that the admin loop feels instant.
 *
 * Why systemInstruction (not user prompt)?
 *  - Gemini caches systemInstruction across calls in the same project,
 *    so subsequent turns are faster and cheaper.
 *  - Keeps the per-turn user content small (just patient + question).
 */

import { prisma } from "@/lib/db/prisma";

interface CachedRules {
  text: string;
  count: number;
  loadedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60s
let cache: CachedRules | null = null;

export async function loadActiveRules(): Promise<{ text: string; count: number }> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return { text: cache.text, count: cache.count };
  }

  try {
    const rules = await prisma.activeRule.findMany({
      where: { is_active: true },
      orderBy: [
        // Critical safety rules first so the model encounters them early
        { severity: "desc" },
        { created_at: "asc" },
      ],
      take: 150, // P0.4: hard cap — beyond ~150 rules, LLM gets confused
    });

    let text = formatRulesForPrompt(rules);
    // P0.4: hard token cap — ~2000 tokens ≈ 8000 chars
    if (text.length > 8000) {
      text = text.slice(0, 8000) + "\n[...rules truncated — review and consolidate in admin]";
    }
    cache = { text, count: rules.length, loadedAt: now };
    return { text, count: rules.length };
  } catch (err) {
    // DB unreachable should never break the AI — fall back to empty
    // (the hard-coded persona in DOCTOR_SYSTEM still applies).
    console.error("[rules-server] failed to load active rules:", err);
    return { text: "", count: 0 };
  }
}

/** Force-clear the cache (called after rule changes from the admin API). */
export function invalidateRulesCache(): void {
  cache = null;
}

interface RuleRow {
  rule_text: string;
  category: string;
  severity: string;
}

function formatRulesForPrompt(rules: RuleRow[]): string {
  if (rules.length === 0) return "";

  // Group by category for readability — model parses categorized lists better
  const byCategory: Record<string, string[]> = {};
  for (const r of rules) {
    const cat = r.category.toUpperCase();
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r.rule_text);
  }

  const ordered = ["SAFETY", "RED_FLAG", "GROUNDING", "DOSAGE", "TONE"];
  const remaining = Object.keys(byCategory).filter((c) => !ordered.includes(c));
  const finalOrder = [...ordered.filter((c) => byCategory[c]), ...remaining];

  const blocks: string[] = ["LIVE MEDICAL RULES (must follow):"];
  for (const cat of finalOrder) {
    const items = byCategory[cat];
    if (!items || items.length === 0) continue;
    blocks.push(`\n[${cat}]`);
    items.forEach((rule, i) => blocks.push(`${i + 1}. ${rule}`));
  }
  return blocks.join("\n");
}
