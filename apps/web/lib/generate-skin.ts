/**
 * AI-powered custom skin generator.
 *
 * Takes a creator's vibe context (title, transformation goal, vibe prompt) and
 * uses Claude to generate a color palette + typography token set. The result is
 * deep-merged with classic-minimal defaults so the full SkinTokens interface is
 * always satisfied.
 *
 * Returns null when LLM_PROVIDER=stub (no API call made).
 */

import type { SkinTokens } from "@guide-rail/shared";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { pickSeedSkin, type SeedMatch } from "@/lib/skin-seed-matcher";
import { MODIFIERS } from "@/lib/skin-color-library";

export interface SkinVibeContext {
  title: string;
  targetTransformation?: string | null;
  vibePrompt?: string | null;
  niche?: string | null;
  /** When present along with `refinementPrompt`, run in refine mode:
   *  the LLM is asked to return a partial delta over `currentTokens`. */
  currentTokens?: SkinTokens;
  refinementPrompt?: string | null;
  /** Seed-mode base. When present, the prompt describes this preset as a
   *  "starting palette" so Claude refines from it rather than inventing
   *  one from scratch. Chosen by `pickSeedSkin` over the curated catalog. */
  seed?: SeedMatch;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/** Turn detected modifier words into explicit constraint lines for the LLM. */
function describeModifiers(vibePrompt: string | null | undefined): string[] {
  if (!vibePrompt) return [];
  const lower = vibePrompt.toLowerCase();
  const lines: string[] = [];
  for (const [name, mod] of Object.entries(MODIFIERS)) {
    const re = new RegExp(`\\b${name}\\b`);
    if (!re.test(lower)) continue;
    const bits: string[] = [];
    if (mod.hueRange) bits.push(`hues ${mod.hueRange[0]}°–${mod.hueRange[1]}°`);
    if (mod.satMul && mod.satMul > 1) bits.push("high-saturation accents");
    else if (mod.satMul && mod.satMul < 1) bits.push("low-saturation, desaturated accents");
    if (mod.lightMul && mod.lightMul > 1) bits.push("lighter overall");
    else if (mod.lightMul && mod.lightMul < 1) bits.push("darker overall");
    if (bits.length === 0) continue;
    lines.push(`Lean ${name.toUpperCase()}: ${bits.join(", ")}.`);
  }
  return lines;
}

export function buildSkinPrompt(ctx: SkinVibeContext): string {
  const isRefine = !!(ctx.currentTokens && ctx.refinementPrompt);

  if (isRefine) {
    const t = ctx.currentTokens!;
    return `You are a design systems expert. Refine an existing brand skin based on the creator's feedback.

Program title: "${ctx.title}"
${ctx.targetTransformation ? `Goal: ${ctx.targetTransformation}\n` : ""}Current palette:
- background.default: ${t.color.background.default}
- background.elevated: ${t.color.background.elevated}
- text.primary: ${t.color.text.primary}
- text.secondary: ${t.color.text.secondary}
- accent.primary: ${t.color.accent.primary}
- accent.secondary: ${t.color.accent.secondary}
- heading font: ${t.text.heading.display.font}
- body font: ${t.text.body.md.font}

Refinement request: "${ctx.refinementPrompt}"

Respond with ONLY a JSON object — no explanation, no markdown fences. Return ONLY the fields you want to change. Use the exact shape below, omitting any fields that should stay as-is. Empty objects are fine.

{
  "color": {
    "background": { "default": "#rrggbb", "elevated": "#rrggbb", "hero": "#rrggbb", "surface": "#rrggbb" },
    "border": { "subtle": "#rrggbb" },
    "text": { "primary": "#rrggbb", "secondary": "#rrggbb" },
    "accent": { "primary": "#rrggbb", "secondary": "#rrggbb" },
    "accentHover": "#rrggbb"
  },
  "text": {
    "heading": {
      "display": { "font": "CSS font-family string", "size": "72px", "weight": "700", "lineHeight": "1.1" },
      "xl":      { "font": "CSS font-family string", "size": "48px", "weight": "700", "lineHeight": "1.15" },
      "lg":      { "font": "CSS font-family string", "size": "30px", "weight": "600", "lineHeight": "1.2" },
      "md":      { "font": "CSS font-family string", "size": "24px", "weight": "600", "lineHeight": "1.3" }
    },
    "body": {
      "md": { "font": "CSS font-family string", "size": "16px", "weight": "400", "lineHeight": "1.6" },
      "sm": { "font": "CSS font-family string", "size": "14px", "weight": "400", "lineHeight": "1.5" }
    }
  }
}

Rules:
- All hex colors must be valid 6-digit (e.g. #1a2b3c)
- Preserve text.primary contrast against color.background.default
- Keep changes focused on what the creator asked for; do not randomize unrelated fields`;
  }

  const parts: string[] = [];
  parts.push(`Program title: "${ctx.title}"`);
  if (ctx.targetTransformation) parts.push(`Goal: ${ctx.targetTransformation}`);
  if (ctx.vibePrompt) parts.push(`Vibe: ${ctx.vibePrompt}`);
  if (ctx.niche) parts.push(`Niche: ${ctx.niche}`);

  // Translate quality words ("warm", "bright", "muted") from the vibe prompt
  // into explicit constraints so the LLM doesn't hand-wave them away.
  const modifierLines = describeModifiers(ctx.vibePrompt);
  if (modifierLines.length > 0) {
    parts.push("Palette constraints (derived from vibe):");
    for (const line of modifierLines) parts.push(`  - ${line}`);
  }

  // If we found a close-in-genre preset, anchor Claude on its palette so the
  // output stays in the right neighborhood (especially light vs. dark).
  let seedBlock = "";
  if (ctx.seed) {
    const s = ctx.seed.tokens;
    seedBlock =
      `Starting palette (close match for this vibe): "${ctx.seed.name}" — ${ctx.seed.description}\n` +
      `  background.default: ${s.color.background.default}\n` +
      `  background.elevated: ${s.color.background.elevated}\n` +
      `  text.primary:        ${s.color.text.primary}\n` +
      `  accent.primary:      ${s.color.accent.primary}\n` +
      `  accent.secondary:    ${s.color.accent.secondary}\n` +
      `  heading font:        ${s.text.heading.display.font}\n` +
      `  body font:           ${s.text.body.md.font}\n` +
      `\n` +
      `Refine this palette so it feels uniquely on-brand for the program above,\n` +
      `but keep its general character — light vs. dark, warm vs. cool, serif vs. sans.\n` +
      `Do NOT flip the background from light to dark (or vice versa) unless the\n` +
      `program's vibe explicitly calls for it.\n\n`;
  }

  return `You are a design systems expert. Generate a custom brand skin for a digital learning program.

${parts.join("\n")}

${seedBlock}

Respond with ONLY a JSON object — no explanation, no markdown fences. Use this exact shape:

{
  "color": {
    "background": {
      "default": "#rrggbb",
      "elevated": "#rrggbb",
      "hero": "#rrggbb",
      "surface": "#rrggbb"
    },
    "border": { "subtle": "#rrggbb" },
    "text": {
      "primary": "#rrggbb",
      "secondary": "#rrggbb"
    },
    "accent": {
      "primary": "#rrggbb",
      "secondary": "#rrggbb"
    },
    "accentHover": "#rrggbb",
    "semantic": {
      "success": "#22c55e",
      "warning": "#f59e0b",
      "error": "#ef4444",
      "actionDo": "#rrggbb",
      "actionReflect": "#rrggbb"
    }
  },
  "text": {
    "heading": {
      "display": { "font": "CSS font-family string", "size": "72px", "weight": "700", "lineHeight": "1.1" },
      "xl":      { "font": "CSS font-family string", "size": "48px", "weight": "700", "lineHeight": "1.15" },
      "lg":      { "font": "CSS font-family string", "size": "30px", "weight": "600", "lineHeight": "1.2" },
      "md":      { "font": "CSS font-family string", "size": "24px", "weight": "600", "lineHeight": "1.3" }
    },
    "body": {
      "md": { "font": "CSS font-family string", "size": "16px", "weight": "400", "lineHeight": "1.6" },
      "sm": { "font": "CSS font-family string", "size": "14px", "weight": "400", "lineHeight": "1.5" }
    },
    "label": {
      "sm": { "font": "CSS font-family string", "size": "12px", "weight": "500", "lineHeight": "1.4" }
    }
  }
}

Rules:
- All colors must be valid 6-digit hex strings starting with # (e.g. #1a2b3c)
- Use Google Fonts or system font stacks with proper CSS font-family fallbacks
- Ensure text.primary has strong contrast against color.background.default
- Make the palette unique and cohesive — it should feel on-brand for the program
- Do NOT use generic defaults — base your choices on the program context above`;
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------

async function callAnthropicForSkin(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

async function callGeminiForSkin(prompt: string): Promise<string> {
  const { GEMINI_API_BASE, getGeminiTextModel } = await import("@guide-rail/ai");
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");

  const model = getGeminiTextModel();
  const res = await fetch(
    `${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// JSON extraction + merge
// ---------------------------------------------------------------------------

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text;
}

/** Deep-merge `override` onto `base`, returning a new object. */
export function deepMerge<T>(base: T, override: Partial<T>): T {
  if (!override || typeof override !== "object") return base;
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override as object)) {
    const bv = (base as Record<string, unknown>)[key];
    const ov = (override as Record<string, unknown>)[key];
    if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object") {
      result[key] = deepMerge(bv, ov as Partial<typeof bv>);
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a custom SkinTokens bundle from the creator's vibe context.
 *
 * Returns null when LLM_PROVIDER=stub or when the API call/parse fails
 * (caller should skip creating a CustomSkin in those cases).
 */
export async function generateSkinFromVibe(
  ctx: SkinVibeContext,
): Promise<SkinTokens | null> {
  const provider = process.env.LLM_PROVIDER || "stub";

  if (provider === "stub") {
    console.info("[SkinGen] Stub mode — skipping skin generation");
    return null;
  }

  if (provider !== "anthropic" && provider !== "gemini") {
    console.warn(`[SkinGen] Provider "${provider}" not supported for skin generation, skipping`);
    return null;
  }

  // In seed mode, pick the closest preset as a starting point so the palette
  // stays in the right genre (especially light vs. dark). Refine mode ignores
  // this — it always merges onto the creator's currentTokens.
  const seed = !ctx.currentTokens ? pickSeedSkin(ctx) ?? undefined : undefined;
  if (seed) {
    console.info(`[SkinGen] seed=${seed.skinId} score=${seed.score}`);
  } else if (!ctx.currentTokens) {
    console.info("[SkinGen] no seed match — falling back to classic-minimal");
  }

  const prompt = buildSkinPrompt({ ...ctx, seed });

  let raw: string;
  try {
    if (provider === "gemini") {
      raw = await callGeminiForSkin(prompt);
    } else {
      raw = await callAnthropicForSkin(prompt);
    }
  } catch (err) {
    console.error("[SkinGen] API call failed:", err);
    return null;
  }

  let partial: Partial<SkinTokens>;
  try {
    const json = extractJSON(raw);
    partial = JSON.parse(json);
  } catch (err) {
    console.error("[SkinGen] Failed to parse response:", err, "\nRaw:", raw.slice(0, 500));
    return null;
  }

  // Merge order:
  //   refine mode  → onto the creator's current tokens
  //   seed mode    → onto the matched preset (so unspecified fields inherit
  //                  the preset's warm/cool, light/dark character)
  //   no match     → classic-minimal
  const base =
    ctx.currentTokens ??
    seed?.tokens ??
    getSkinTokens("classic-minimal");
  const merged = deepMerge(base, partial as Partial<SkinTokens>);

  // Preserve id; use refinementPrompt as description when refining.
  return {
    ...merged,
    id: base.id,
    name: ctx.currentTokens ? merged.name : ctx.title,
    description: ctx.refinementPrompt ?? ctx.vibePrompt ?? merged.description ?? "Custom skin",
  };
}
