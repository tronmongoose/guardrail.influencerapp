/**
 * Keyword → color library for the Skin Studio's vibe prompt.
 *
 * When a creator types something like "warm brown tones" or "ocean to sunset
 * gradient", we detect the color intent and offer a one-click apply. Each
 * entry defines a primary/secondary pair that maps to the skin's
 * `color.accent.primary` and `color.accent.secondary` tokens.
 */

export interface ColorEntry {
  /** Display name shown in the detection chip. */
  name: string;
  /** Words that trigger this color. First word is the canonical label. */
  keywords: string[];
  /** Hex string — applied to `accent.primary` and `accentHover`. */
  primary: string;
  /** Hex string — applied to `accent.secondary`. */
  secondary: string;
}

export const COLOR_LIBRARY: ColorEntry[] = [
  // Warm neutrals
  { name: "Brown",    keywords: ["brown", "chocolate", "espresso", "mocha", "cocoa", "earthy"], primary: "#8b5e3c", secondary: "#d4a373" },
  { name: "Cream",    keywords: ["cream", "beige", "nude", "sand", "ivory", "bone"], primary: "#c8a87c", secondary: "#f5ebe0" },
  { name: "Terracotta", keywords: ["terracotta", "clay", "rust"], primary: "#c1694f", secondary: "#e6a57e" },
  { name: "Amber",    keywords: ["amber", "honey", "caramel"], primary: "#d4a017", secondary: "#f4d77c" },
  { name: "Gold",     keywords: ["gold", "golden", "goldenrod", "brass"], primary: "#c9a227", secondary: "#f4e4ba" },

  // Reds / oranges
  { name: "Red",      keywords: ["red", "crimson", "cherry", "ruby", "scarlet"], primary: "#c1272d", secondary: "#f08080" },
  { name: "Sunset",   keywords: ["sunset", "fiery", "ember"], primary: "#ff7e5f", secondary: "#feb47b" },
  { name: "Coral",    keywords: ["coral", "salmon", "peach"], primary: "#ff6f61", secondary: "#ffb199" },
  { name: "Orange",   keywords: ["orange", "tangerine", "citrus"], primary: "#f77f00", secondary: "#fcbf49" },
  { name: "Burgundy", keywords: ["burgundy", "wine", "maroon"], primary: "#800020", secondary: "#b5525c" },

  // Pinks / magentas
  { name: "Pink",     keywords: ["pink", "bubblegum"], primary: "#ec4899", secondary: "#f9a8d4" },
  { name: "Rose",     keywords: ["rose", "dusty rose", "blush"], primary: "#d88880", secondary: "#f4c2c2" },
  { name: "Magenta",  keywords: ["magenta", "fuchsia"], primary: "#c026d3", secondary: "#e879f9" },

  // Purples
  { name: "Purple",   keywords: ["purple", "violet", "grape"], primary: "#7c3aed", secondary: "#c4b5fd" },
  { name: "Lavender", keywords: ["lavender", "lilac", "periwinkle"], primary: "#8e7cc3", secondary: "#d4b5e8" },
  { name: "Plum",     keywords: ["plum", "eggplant", "aubergine"], primary: "#5d3a6b", secondary: "#a17fb0" },

  // Blues
  { name: "Ocean",    keywords: ["ocean", "sea", "marine", "nautical"], primary: "#1e6091", secondary: "#4a90c2" },
  { name: "Navy",     keywords: ["navy", "midnight blue", "indigo"], primary: "#1e3a5f", secondary: "#4a5d7a" },
  { name: "Sky",      keywords: ["sky", "azure", "cerulean"], primary: "#3b82f6", secondary: "#93c5fd" },
  { name: "Cobalt",   keywords: ["cobalt", "royal blue", "electric blue"], primary: "#1e40af", secondary: "#60a5fa" },
  { name: "Denim",    keywords: ["denim", "steel blue"], primary: "#4682b4", secondary: "#9bbad9" },

  // Greens / teals
  { name: "Forest",   keywords: ["forest", "pine", "evergreen", "moss"], primary: "#2d5a3d", secondary: "#7fb069" },
  { name: "Sage",     keywords: ["sage", "olive", "fern"], primary: "#87a96b", secondary: "#c6d5b0" },
  { name: "Emerald",  keywords: ["emerald", "jade"], primary: "#10b981", secondary: "#6ee7b7" },
  { name: "Mint",     keywords: ["mint", "spearmint"], primary: "#6fcf97", secondary: "#b8e8c8" },
  { name: "Teal",     keywords: ["teal", "aqua", "seafoam", "turquoise"], primary: "#2a9d8f", secondary: "#a8dadc" },
  { name: "Lime",     keywords: ["lime", "chartreuse", "neon green"], primary: "#84cc16", secondary: "#bef264" },

  // Neutrals / achromatic
  { name: "Charcoal", keywords: ["charcoal", "slate", "graphite", "gunmetal"], primary: "#3a3a3a", secondary: "#6b6b6b" },
  { name: "Silver",   keywords: ["silver", "platinum", "pewter"], primary: "#9ca3af", secondary: "#d1d5db" },
  { name: "Black",    keywords: ["black", "onyx", "jet", "obsidian"], primary: "#0f0f0f", secondary: "#3a3a3a" },
  { name: "White",    keywords: ["white", "snow"], primary: "#ffffff", secondary: "#f3f4f6" },

  // Specialty / mood
  { name: "Neon",     keywords: ["neon", "cyberpunk"], primary: "#ff2dff", secondary: "#00fff0" },
  { name: "Pastel",   keywords: ["pastel"], primary: "#fbb1bd", secondary: "#a2d2ff" },
  { name: "Earth",    keywords: ["earth", "earth tone", "earth tones"], primary: "#9c6644", secondary: "#ddb892" },
  { name: "Autumn",   keywords: ["autumn", "fall", "harvest"], primary: "#bc6c25", secondary: "#dda15e" },
  { name: "Spring",   keywords: ["spring", "fresh"], primary: "#70d6ff", secondary: "#e9ff70" },
  { name: "Winter",   keywords: ["winter", "frost", "glacial", "icy"], primary: "#4a7ba6", secondary: "#c0d6e8" },
  { name: "Tropical", keywords: ["tropical"], primary: "#06a77d", secondary: "#f6ae2d" },
  { name: "Monochrome", keywords: ["monochrome", "grayscale"], primary: "#1f2937", secondary: "#9ca3af" },
];

export interface DetectedColor {
  name: string;
  primary: string;
  secondary: string;
  /** When defined, `color.background.gradient` should be set to this string. */
  gradient?: string;
  /** Human-readable summary for the UI chip. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Modifier vocabulary — abstract qualities like "warm", "bright", "muted"
// that don't name a specific color but tweak the palette. Exported so the
// LLM prompt builder can mirror them in its constraint block.
// ---------------------------------------------------------------------------

export interface ColorModifier {
  /** Multiplier applied to HSL saturation. 1 = no change. */
  satMul?: number;
  /** Multiplier applied to HSL lightness. 1 = no change. */
  lightMul?: number;
  /** Fallback color library entry names when only the modifier is present. */
  familyHint?: string[];
  /** Hue range (deg) — surfaced to the LLM, not used for adjustments. */
  hueRange?: [number, number];
}

export const MODIFIERS: Record<string, ColorModifier> = {
  warm:    { hueRange: [10, 60],   familyHint: ["Sunset", "Amber", "Brown", "Coral", "Terracotta", "Orange"] },
  cool:    { hueRange: [180, 260], familyHint: ["Sky", "Ocean", "Teal", "Sage", "Mint"] },
  bright:  { satMul: 1.35, lightMul: 1.05, familyHint: ["Orange", "Sky", "Pink"] },
  vibrant: { satMul: 1.4, familyHint: ["Magenta", "Orange", "Lime"] },
  muted:   { satMul: 0.55 },
  soft:    { satMul: 0.7, lightMul: 1.1 },
  bold:    { satMul: 1.2, lightMul: 0.92 },
  dark:    { lightMul: 0.7 },
  light:   { lightMul: 1.25 },
  pastel:  { satMul: 0.5, lightMul: 1.3, familyHint: ["Pastel", "Lavender", "Mint"] },
  earthy:  { familyHint: ["Brown", "Earth", "Sage", "Forest", "Autumn", "Terracotta"] },
  fresh:   { familyHint: ["Spring", "Mint", "Sky", "Lime"] },
  moody:   { satMul: 0.8, lightMul: 0.65 },
  saturated: { satMul: 1.4 },
};

// Word forms that should also be picked up (kept separate so the canonical
// names above stay clean for the LLM prompt).
const MODIFIER_ALIASES: Record<string, string> = {
  warmth: "warm",
  cooler: "cool",
  brighter: "bright",
  darker: "dark",
  lighter: "light",
  softer: "soft",
  bolder: "bold",
  mutedish: "muted",
};

// ---------------------------------------------------------------------------
// Hex + HSL helpers
// ---------------------------------------------------------------------------

const HEX_RE = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i;

function expandHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return "#" + h.split("").map((c) => c + c).join("").toLowerCase();
  }
  return "#" + h.toLowerCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = expandHex(hex).slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return [
    hue2rgb(p, q, hk + 1 / 3) * 255,
    hue2rgb(p, q, hk) * 255,
    hue2rgb(p, q, hk - 1 / 3) * 255,
  ];
}

/** Apply a modifier's S/L multipliers to a hex color. */
export function adjustHsl(hex: string, mods: { satMul?: number; lightMul?: number }): string {
  if (!mods.satMul && !mods.lightMul) return expandHex(hex);
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const s2 = Math.max(0, Math.min(1, s * (mods.satMul ?? 1)));
  const l2 = Math.max(0, Math.min(1, l * (mods.lightMul ?? 1)));
  const [r2, g2, b2] = hslToRgb(h, s2, l2);
  return rgbToHex(r2, g2, b2);
}

/** Lighten by an absolute amount of HSL lightness (0..1). Used to derive a
 *  secondary from a user-supplied hex. */
function lightenAbs(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const l2 = Math.max(0, Math.min(1, l + amount));
  const [r2, g2, b2] = hslToRgb(h, s, l2);
  return rgbToHex(r2, g2, b2);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function detectModifiers(prompt: string): { name: string; mod: ColorModifier }[] {
  const words = tokenize(prompt);
  const found: { name: string; mod: ColorModifier }[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const canonical = MODIFIERS[w] ? w : MODIFIER_ALIASES[w];
    if (canonical && !seen.has(canonical)) {
      found.push({ name: canonical, mod: MODIFIERS[canonical] });
      seen.add(canonical);
    }
  }
  return found;
}

/** Combine multiple modifiers — multiplicative for sat/light, last-wins
 *  for familyHint/hueRange. */
function combineModifiers(mods: { name: string; mod: ColorModifier }[]): ColorModifier {
  const out: ColorModifier = {};
  let satMul = 1;
  let lightMul = 1;
  let touchedSat = false;
  let touchedLight = false;
  for (const { mod } of mods) {
    if (mod.satMul !== undefined) { satMul *= mod.satMul; touchedSat = true; }
    if (mod.lightMul !== undefined) { lightMul *= mod.lightMul; touchedLight = true; }
    if (mod.familyHint) out.familyHint = mod.familyHint;
    if (mod.hueRange) out.hueRange = mod.hueRange;
  }
  if (touchedSat) out.satMul = satMul;
  if (touchedLight) out.lightMul = lightMul;
  return out;
}

function findEntryByName(name: string): ColorEntry | undefined {
  return COLOR_LIBRARY.find((e) => e.name.toLowerCase() === name.toLowerCase());
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Scan the prompt for color keywords. Returns up to two matches, ordered by
 * first appearance. Multi-word keywords ("earth tones") are checked against
 * the full string; single-word keywords require a full word match.
 */
function detectColors(prompt: string): { entry: ColorEntry; index: number }[] {
  const words = tokenize(prompt);
  const lower = prompt.toLowerCase();
  const hits: { entry: ColorEntry; index: number }[] = [];
  const seen = new Set<string>();

  for (const entry of COLOR_LIBRARY) {
    let earliest = -1;
    for (const kw of entry.keywords) {
      let idx = -1;
      if (kw.includes(" ")) {
        idx = lower.indexOf(kw);
      } else {
        const wi = words.indexOf(kw);
        if (wi >= 0) {
          // Reconstruct approximate character index by summing previous words.
          idx = lower.indexOf(kw);
        }
      }
      if (idx >= 0 && (earliest === -1 || idx < earliest)) earliest = idx;
    }
    if (earliest >= 0 && !seen.has(entry.name)) {
      hits.push({ entry, index: earliest });
      seen.add(entry.name);
    }
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.slice(0, 2);
}

/**
 * Pick a color (and optional gradient) from the prompt. Returns null when
 * nothing matches.
 *
 * Resolution order:
 *   1. Hex code (`#rrggbb` or `#rgb`) — wins outright.
 *   2. Concrete color keyword(s) — possibly tinted by modifiers ("muted ocean").
 *   3. Modifier-only ("warm", "bright") — falls back to a familyHint default.
 *
 * Gradient intent ("ocean to sunset", "<x> to <y>", "fade", "blend",
 * "gradient") still applies when two concrete colors are present.
 */
export function pickColorFromPrompt(prompt: string | null | undefined): DetectedColor | null {
  if (!prompt || !prompt.trim()) return null;

  // 1. Direct hex — short-circuits everything.
  const hexMatch = prompt.match(HEX_RE);
  if (hexMatch) {
    const primary = expandHex(hexMatch[0]);
    const secondary = lightenAbs(primary, 0.15);
    return {
      name: primary.toUpperCase(),
      primary,
      secondary,
      summary: primary.toUpperCase(),
    };
  }

  const modifiers = detectModifiers(prompt);
  const combined = combineModifiers(modifiers);
  const modifierLabel = modifiers.map((m) => titleCase(m.name)).join(" ");
  const modifierWords = new Set(modifiers.map((m) => m.name.toLowerCase()));

  // Drop color hits whose name overlaps with a detected modifier (e.g.
  // "pastel" is both a modifier and a catalog entry — without this guard
  // "pastel pink" matches Pastel as the color and Pink gets ignored).
  const hits = detectColors(prompt).filter(
    (h) => !modifierWords.has(h.entry.name.toLowerCase()),
  );

  // 3. Modifier-only path — nothing concrete, but we know the user wants e.g.
  // "warm" or "bright". Pick a default from the modifier's familyHint.
  if (hits.length === 0) {
    if (!combined.familyHint || combined.familyHint.length === 0) return null;
    let entry: ColorEntry | undefined;
    for (const name of combined.familyHint) {
      entry = findEntryByName(name);
      if (entry) break;
    }
    if (!entry) return null;
    const primary = adjustHsl(entry.primary, combined);
    const secondary = adjustHsl(entry.secondary, combined);
    const summary = modifierLabel ? `${modifierLabel} ${entry.name}` : entry.name;
    return { name: summary, primary, secondary, summary };
  }

  const lower = prompt.toLowerCase();
  const wantsGradient =
    hits.length === 2 &&
    (lower.includes("gradient") ||
      lower.includes("fade") ||
      lower.includes("blend") ||
      /\b\w+\s+to\s+\w+/.test(lower));

  const a = hits[0].entry;
  if (wantsGradient) {
    const b = hits[1].entry;
    const aPrimary = adjustHsl(a.primary, combined);
    const bPrimary = adjustHsl(b.primary, combined);
    return {
      name: `${a.name} → ${b.name}`,
      primary: aPrimary,
      secondary: bPrimary,
      gradient: `linear-gradient(135deg, ${aPrimary}, ${bPrimary})`,
      summary: modifierLabel
        ? `${modifierLabel} ${a.name} → ${b.name} gradient`
        : `${a.name} → ${b.name} gradient`,
    };
  }

  const primary = adjustHsl(a.primary, combined);
  const secondary = adjustHsl(a.secondary, combined);
  const summary = modifierLabel ? `${modifierLabel} ${a.name}` : a.name;
  return {
    name: summary,
    primary,
    secondary,
    summary,
  };
}
