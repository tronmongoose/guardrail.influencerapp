/**
 * Seed matcher — picks the catalog skin that best fits a vibe context, so the
 * AI skin generator can merge its output over a thematically-close palette
 * instead of always starting from `classic-minimal`.
 *
 * Rationale: the LLM tends to drift toward dark backgrounds when given only
 * an abstract vibe prompt. Anchoring on a curated preset that matches the
 * genre keeps backgrounds, fonts, and overall feel in the right neighborhood.
 */

import type { SkinTokens } from "@guide-rail/shared";
import { SKIN_CATALOG } from "./skin-bundles/catalog";
import { getSkinTokens } from "./skin-bundles/registry";

// ---------------------------------------------------------------------------
// Category synonyms — words that imply a given category even when the user
// doesn't name the category directly.
// ---------------------------------------------------------------------------

export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  classic: [
    "classic", "minimal", "minimalist", "simple", "clean", "timeless",
    "traditional", "neutral", "elegant", "bold", "muted", "soft",
  ],
  creative: [
    "creative", "artistic", "art", "retro", "vintage", "pixel", "neon",
    "literary", "writing", "code", "coding", "developer", "chalkboard",
    "esports", "gaming", "arcade", "cyberpunk", "vibrant", "bright",
  ],
  lifestyle: [
    "lifestyle", "zen", "mindful", "mindfulness", "wellness", "calm",
    "everyday", "travel", "wanderlust", "glam", "beauty", "podcast",
    "science", "daily", "chill", "warm", "cool", "earthy", "fresh",
    "pastel",
  ],
  activity: [
    "activity", "fitness", "sports", "workout", "movement", "athletic",
    "active", "training", "culinary", "cooking", "chef", "kitchen",
    "kids", "family", "fashion", "workshop", "diy", "craft", "build",
    "hologram",
  ],
  entertainment: [
    "entertainment", "film", "movie", "cinema", "noir", "festival",
    "theatrical", "performance", "show", "theater", "theatre",
  ],
  music: [
    "music", "musical", "sound", "audio", "dancefloor", "club", "backstage",
    "dj", "band", "soundwave", "bass", "beat",
  ],
  media: [
    "media", "photography", "photo", "photographer", "video", "filmmaker",
    "storytelling", "broadcast", "cinematic", "lens", "editorial",
  ],
  professional: [
    "professional", "business", "executive", "corporate", "consulting",
    "luxury", "elevated", "mindspace", "atelier", "startup", "launch",
    "founder", "tech", "ai", "command", "book", "reader", "reading",
    "adventure", "outdoors", "wellness", "home gym", "gym", "fitness",
    "workspace", "creator",
  ],
};

// Weights
const W_CATEGORY = 3;
const W_NAME     = 2;
const W_DESC     = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeedMatch {
  skinId: string;
  name: string;
  description: string;
  category: string;
  tokens: SkinTokens;
  score: number;
}

export interface SeedVibeContext {
  title?: string | null;
  vibePrompt?: string | null;
  targetTransformation?: string | null;
  niche?: string | null;
}

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/** Combine all vibe fields into one bag of words. */
function vibeWords(ctx: SeedVibeContext): Set<string> {
  const parts = [ctx.title, ctx.vibePrompt, ctx.targetTransformation, ctx.niche]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" ");
  return new Set(tokenize(parts));
}

/** The dashed id ("classic-minimal") yields ["classic", "minimal"]. */
function idTokens(id: string): string[] {
  return id.split("-").filter((w) => w.length >= 3);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreSkin(
  skin: { id: string; name: string; description: string; category: string },
  vibe: Set<string>,
  lowerVibe: string,
): number {
  if (vibe.size === 0) return 0;

  let score = 0;

  // Category hit (genre-level match)
  const synonyms = CATEGORY_SYNONYMS[skin.category] ?? [];
  for (const syn of synonyms) {
    if (syn.includes(" ")) {
      if (lowerVibe.includes(syn)) { score += W_CATEGORY; break; }
    } else if (vibe.has(syn)) {
      score += W_CATEGORY;
      break;
    }
  }

  // Name tokens — the skin's display name is the strongest textual signal
  const nameTokens = new Set([
    ...tokenize(skin.name),
    ...idTokens(skin.id),
  ]);
  for (const t of nameTokens) {
    if (vibe.has(t)) score += W_NAME;
  }

  // Description words — soft signal
  const descTokens = new Set(tokenize(skin.description));
  for (const t of descTokens) {
    if (vibe.has(t)) score += W_DESC;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pick the preset that best matches the given vibe context. Returns null
 * when no catalog entry has a non-zero score (unmatchable vibe) — callers
 * should fall back to `classic-minimal` in that case.
 *
 * Ties broken by catalog order so identical inputs return identical seeds.
 */
export function pickSeedSkin(ctx: SeedVibeContext): SeedMatch | null {
  const vibe = vibeWords(ctx);
  if (vibe.size === 0) return null;

  const lowerVibe = [ctx.title, ctx.vibePrompt, ctx.targetTransformation, ctx.niche]
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .toLowerCase();

  let best: { entry: typeof SKIN_CATALOG[number]; score: number } | null = null;

  for (const entry of SKIN_CATALOG) {
    const score = scoreSkin(entry, vibe, lowerVibe);
    if (score > 0 && (best === null || score > best.score)) {
      best = { entry, score };
    }
  }

  if (!best) return null;

  return {
    skinId: best.entry.id,
    name: best.entry.name,
    description: best.entry.description,
    category: best.entry.category,
    tokens: getSkinTokens(best.entry.id),
    score: best.score,
  };
}
