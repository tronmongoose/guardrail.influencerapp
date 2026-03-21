/**
 * Skin catalog — source of truth for skin identity and category membership.
 *
 * This is separate from token bundles (registry.ts). A skin can appear in
 * the catalog before its token bundle is built. Until a bundle is registered,
 * getSkinTokens() falls back to the "default" skin tokens automatically.
 *
 * To add a fully-implemented skin later:
 *   1. Create apps/web/lib/skin-bundles/{id}.ts with the SkinTokens bundle
 *   2. Register it in registry.ts SKIN_TOKENS
 *   3. Add its id to SkinId and SkinIdSchema in packages/shared/src/skin-tokens.ts
 *   4. The catalog entry below already exists — no change needed here
 */

export interface SkinCatalogEntry {
  id: string;
  name: string;
  /** One-line tagline shown in the picker */
  description: string;
  /** Must match a SkinCategoryDef.id */
  category: string;
}

export interface SkinCategoryDef {
  id: string;
  /** Displayed in the picker header (typically ALL CAPS) */
  label: string;
  skins: SkinCatalogEntry[];
}

// ---------------------------------------------------------------------------
// Category + skin definitions
// ---------------------------------------------------------------------------
// Counts per screenshot: Classic(5) Design(5) Entertainment(5) Education(5)
//   Lifestyle(7) Creative(5) Activity(5) Music(3) Professional(10) = 50

export const SKIN_CATEGORIES: SkinCategoryDef[] = [
  {
    id: "classic",
    label: "CLASSIC",
    skins: [
      { id: "default",        name: "Dark Neon",      description: "Bold and modern with vibrant accents", category: "classic" },
      { id: "classic-slate",  name: "Slate",          description: "Timeless dark slate with clean lines", category: "classic" },
      { id: "classic-ivory",  name: "Ivory",          description: "Soft cream tones with warm contrast",  category: "classic" },
      { id: "classic-mono",   name: "Monochrome",     description: "Pure black and white, no distraction", category: "classic" },
      { id: "classic-carbon", name: "Carbon",         description: "Deep charcoal with metallic accents",  category: "classic" },
    ],
  },
  {
    id: "design",
    label: "DESIGN",
    skins: [
      { id: "design-bauhaus",   name: "Bauhaus",      description: "Geometric shapes, primary palette",    category: "design" },
      { id: "design-swiss",     name: "Swiss",        description: "Grid-based clarity and precision",     category: "design" },
      { id: "design-material",  name: "Material",     description: "Depth, shadow, and familiar motion",   category: "design" },
      { id: "design-brutalist", name: "Brutalist",    description: "Raw, bold, unapologetically loud",     category: "design" },
      { id: "design-pastel",    name: "Pastel Studio", description: "Soft hues for creative work",         category: "design" },
    ],
  },
  {
    id: "entertainment",
    label: "ENTERTAINMENT",
    skins: [
      { id: "entertainment-cinema",  name: "Cinema",      description: "Dark theater with gold highlights", category: "entertainment" },
      { id: "entertainment-arcade",  name: "Arcade",      description: "Retro pixels and neon glow",        category: "entertainment" },
      { id: "entertainment-podcast", name: "Podcast",     description: "Clean audio-first layout",          category: "entertainment" },
      { id: "entertainment-sports",  name: "Sports",      description: "High energy, bold scoreboards",     category: "entertainment" },
      { id: "entertainment-gaming",  name: "Gaming",      description: "Immersive dark with RGB accents",   category: "entertainment" },
    ],
  },
  {
    id: "education",
    label: "EDUCATION",
    skins: [
      { id: "warm",               name: "Warm & Friendly",   description: "Inviting and approachable",         category: "education" },
      { id: "education-notebook", name: "Notebook",          description: "Paper whites and pencil grays",     category: "education" },
      { id: "education-campus",   name: "Campus",            description: "Traditional with a modern twist",   category: "education" },
      { id: "education-chalk",    name: "Chalkboard",        description: "Classic green board energy",        category: "education" },
      { id: "education-bright",   name: "Bright Class",      description: "Cheerful and engaging for learners",category: "education" },
    ],
  },
  {
    id: "lifestyle",
    label: "LIFESTYLE",
    skins: [
      { id: "minimal",              name: "Minimal Zen",     description: "Clean and distraction-free",        category: "lifestyle" },
      { id: "lifestyle-wellness",   name: "Wellness",        description: "Calm greens and earthy tones",      category: "lifestyle" },
      { id: "lifestyle-fitness",    name: "Fitness",         description: "High-contrast, energetic palette",  category: "lifestyle" },
      { id: "lifestyle-boho",       name: "Boho",            description: "Warm terracotta and natural textures",category: "lifestyle" },
      { id: "lifestyle-coastal",    name: "Coastal",         description: "Ocean blues and sandy neutrals",    category: "lifestyle" },
      { id: "lifestyle-nordic",     name: "Nordic",          description: "Cool whites, pine, and minimalism", category: "lifestyle" },
      { id: "lifestyle-luxe",       name: "Luxe",            description: "Rich navy and gold, elevated feel", category: "lifestyle" },
    ],
  },
  {
    id: "creative",
    label: "CREATIVE",
    skins: [
      { id: "creative-studio",   name: "Studio",    description: "Artist workspace, focused palette",   category: "creative" },
      { id: "creative-gradient", name: "Gradient",  description: "Fluid color transitions and depth",   category: "creative" },
      { id: "creative-ink",      name: "Ink",       description: "Bold strokes on a white canvas",      category: "creative" },
      { id: "creative-neon",     name: "Neon Pop",  description: "Vivid and electrifying color pops",   category: "creative" },
      { id: "creative-earth",    name: "Earth",     description: "Grounded tones from nature's palette",category: "creative" },
    ],
  },
  {
    id: "activity",
    label: "ACTIVITY",
    skins: [
      { id: "activity-outdoor",  name: "Outdoor",   description: "Trail-ready greens and sky blues",    category: "activity" },
      { id: "activity-gym",      name: "Gym",       description: "Iron and steel, no-frills intensity", category: "activity" },
      { id: "activity-yoga",     name: "Yoga",      description: "Soft purples and mindful whitespace", category: "activity" },
      { id: "activity-run",      name: "Run",       description: "Speed and motion, vivid orange",      category: "activity" },
      { id: "activity-swim",     name: "Swim",      description: "Aqua blues and cool chlorine tones",  category: "activity" },
    ],
  },
  {
    id: "music",
    label: "MUSIC",
    skins: [
      { id: "music-vinyl",   name: "Vinyl",   description: "Warm analog warmth on dark wax",         category: "music" },
      { id: "music-stage",   name: "Stage",   description: "Spotlight drama with deep shadows",       category: "music" },
      { id: "music-studio",  name: "Studio",  description: "Professional recording booth aesthetic",  category: "music" },
    ],
  },
  {
    id: "professional",
    label: "PROFESSIONAL",
    skins: [
      { id: "professional",          name: "Clean Professional", description: "Sleek and corporate-friendly",           category: "professional" },
      { id: "professional-midnight", name: "Midnight",           description: "Executive dark with subtle luxury",       category: "professional" },
      { id: "professional-azure",    name: "Azure",              description: "Trustworthy blue, boardroom ready",       category: "professional" },
      { id: "professional-sage",     name: "Sage",               description: "Calm green-grey for thoughtful leaders",  category: "professional" },
      { id: "professional-obsidian", name: "Obsidian",           description: "Premium black with sharp contrast",       category: "professional" },
      { id: "professional-linen",    name: "Linen",              description: "Warm neutral, approachable authority",    category: "professional" },
      { id: "professional-crimson",  name: "Crimson",            description: "Bold red for high-impact brands",         category: "professional" },
      { id: "professional-slate",    name: "Slate Pro",          description: "Cool gray with structured precision",     category: "professional" },
      { id: "professional-forest",   name: "Forest",             description: "Deep green, grounded and credible",       category: "professional" },
      { id: "professional-sand",     name: "Sand",               description: "Light and airy with warm confidence",     category: "professional" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived exports
// ---------------------------------------------------------------------------

export const SKIN_CATALOG: SkinCatalogEntry[] = SKIN_CATEGORIES.flatMap(
  (cat) => cat.skins
);

const _catalogMap = new Map(SKIN_CATALOG.map((s) => [s.id, s]));

export function getSkinCatalogEntry(id: string): SkinCatalogEntry | undefined {
  return _catalogMap.get(id);
}
