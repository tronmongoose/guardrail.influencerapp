/**
 * Skin catalog — source of truth for skin identity and category membership.
 *
 * This is separate from token bundles (registry.ts). A skin can appear in
 * the catalog before its token bundle is built. Until a bundle is registered,
 * getSkinTokens() falls back to the "classic-minimal" skin tokens automatically.
 *
 * To add a fully-implemented skin later:
 *   1. Create apps/web/lib/skin-bundles/{id}.ts with the SkinTokens bundle
 *   2. Register it in registry.ts SKIN_TOKENS
 *   3. Add its id to SkinId and SkinIdSchema in packages/shared/src/skin-tokens.ts
 *   4. The catalog entry below already exists — no change needed here
 *
 * Page → ID mapping (Figma file key: P94190iyrjqLvtprXiLTKY):
 *   Page  1      → cosmic-studio  (Figma page 1; catalogued as page 34 in the PROFESSIONAL block)
 *   Pages 2–6   → CLASSIC
 *   Pages 7–12  → CREATIVE
 *   Pages 13–18 → LIFESTYLE
 *   Pages 19–24 → ACTIVITY
 *   Pages 25–26 → ENTERTAINMENT
 *   Pages 27–29 → MUSIC
 *   Pages 30–33 → MEDIA
 *   Pages 34–46 → PROFESSIONAL  (cosmic-studio at 34, then pages 35–46)
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
  /** Heroicons-style SVG path(s) for the category icon (24x24 viewBox, stroke) */
  icon: string;
  skins: SkinCatalogEntry[];
}

// ---------------------------------------------------------------------------
// Category + skin definitions
// ---------------------------------------------------------------------------

export const SKIN_CATEGORIES: SkinCategoryDef[] = [
  {
    id: "classic",
    label: "CLASSIC",
    // Framed rectangle — timeless, structured layout
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm4 3h8M8 12h8M8 16h4",
    skins: [
      { id: "classic-minimal",  name: "Minimal",  description: "Clean and distraction-free", category: "classic" },
      { id: "classic-studio",   name: "Studio",   description: "Creative workspace with a focused palette", category: "classic" },
      { id: "classic-playful",  name: "Playful",  description: "Bright and energetic with fun accents", category: "classic" },
      { id: "classic-bold",     name: "Bold",     description: "High contrast, strong typographic presence", category: "classic" },
      { id: "classic-elegant",  name: "Elegant",  description: "Refined tones with a luxury feel", category: "classic" },
    ],
  },
  {
    id: "creative",
    label: "CREATIVE",
    // Sparkle / magic wand — creative energy
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    skins: [
      { id: "creative-retro",        name: "Retro Arcade",    description: "Pixel nostalgia and neon glow", category: "creative" },
      { id: "creative-chalkboard",   name: "Chalkboard",      description: "Classic green board energy", category: "creative" },
      { id: "creative-sheet-music",  name: "Sheet Music",     description: "Clean staves and musical precision", category: "creative" },
      { id: "creative-literary",     name: "Literary Classic", description: "Paper whites and ink-black typography", category: "creative" },
      { id: "creative-code",         name: "Code Terminal",   description: "Monospace precision on a dark canvas", category: "creative" },
      { id: "creative-esports",      name: "Esports",         description: "Immersive dark with RGB accents", category: "creative" },
    ],
  },
  {
    id: "lifestyle",
    label: "LIFESTYLE",
    // Leaf — nature, personal wellbeing
    icon: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 0c0 5.523-4.477 10-10 10",
    skins: [
      { id: "lifestyle-glam",       name: "Glam Studio",    description: "Glamorous tones for bold creators", category: "lifestyle" },
      { id: "lifestyle-wanderlust", name: "Wanderlust",     description: "Travel-inspired earth and sky tones", category: "lifestyle" },
      { id: "lifestyle-graffiti",   name: "Urban Graffiti", description: "Street-art energy with vivid pops", category: "lifestyle" },
      { id: "lifestyle-zen",        name: "Zen Garden",     description: "Calm neutrals and mindful whitespace", category: "lifestyle" },
      { id: "lifestyle-science",    name: "Science Lab",    description: "Clean precision with a technical edge", category: "lifestyle" },
      { id: "lifestyle-podcast",    name: "Podcast Booth",  description: "Warm audio-first aesthetic", category: "lifestyle" },
    ],
  },
  {
    id: "activity",
    label: "ACTIVITY",
    // Lightning bolt — high energy, movement
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    skins: [
      { id: "activity-hologram",  name: "Futuristic Hologram", description: "Sci-fi blues and electric accents", category: "activity" },
      { id: "activity-workshop",  name: "DIY Workshop",        description: "Rugged and hands-on utility palette", category: "activity" },
      { id: "activity-culinary",  name: "Culinary Kitchen",    description: "Warm spice tones for food creators", category: "activity" },
      { id: "activity-sports",    name: "Sports Arena",        description: "High energy, bold scoreboards", category: "activity" },
      { id: "activity-kids",      name: "Kids Playground",     description: "Bright and cheerful for young learners", category: "activity" },
      { id: "activity-fashion",   name: "Fashion Runway",      description: "Sleek monochrome with editorial flair", category: "activity" },
    ],
  },
  {
    id: "entertainment",
    label: "ENTERTAINMENT",
    // Film clapperboard
    icon: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z",
    skins: [
      { id: "entertainment-film-noir", name: "Film Noir",      description: "Dark theater with dramatic shadows", category: "entertainment" },
      { id: "entertainment-festival",  name: "Festival Lights", description: "Vibrant celebration with vivid color", category: "entertainment" },
    ],
  },
  {
    id: "music",
    label: "MUSIC",
    // Musical note
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
    skins: [
      { id: "music-soundwave",  name: "Soundwave",  description: "Audio-inspired waves and deep bass tones", category: "music" },
      { id: "music-backstage",  name: "Backstage",  description: "Spotlight drama with deep shadows", category: "music" },
      { id: "music-dancefloor", name: "Dancefloor", description: "Pulsing neon and club-ready energy", category: "music" },
    ],
  },
  {
    id: "media",
    label: "MEDIA",
    // Camera
    icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm10 4a3 3 0 11-6 0 3 3 0 016 0z",
    skins: [
      { id: "media-hero",  name: "Hero Mode",        description: "Bold full-bleed storytelling", category: "media" },
      { id: "media-film",  name: "Cinematographer",  description: "Cinematic depth and filmic color grading", category: "media" },
      { id: "media-lens",  name: "Wild Lens",        description: "Vivid photography with high contrast", category: "media" },
      { id: "media-pulse", name: "Pulse Performance", description: "Live-event energy with dynamic color", category: "media" },
    ],
  },
  {
    id: "professional",
    label: "PROFESSIONAL",
    // Briefcase
    icon: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zm-8 9a2 2 0 110-4 2 2 0 010 4zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2",
    skins: [
      { id: "cosmic-studio",      name: "Cosmic Studio",       description: "Space exploration — deep purple cosmos with magenta-to-pink gradient accents", category: "professional" },
      { id: "pro-mindspace",      name: "Mindspace",           description: "Calm focus for knowledge workers", category: "professional" },
      { id: "pro-atelier",        name: "Atelier",             description: "Artisan craft with a refined palette", category: "professional" },
      { id: "pro-startup",        name: "Startup Garage",      description: "Lean and launch-ready energy", category: "professional" },
      { id: "pro-wellness",       name: "Wellness Sanctuary",  description: "Calm greens and earthy tones", category: "professional" },
      { id: "pro-home-gym",       name: "Home Gym",            description: "Iron and steel, no-frills intensity", category: "professional" },
      { id: "pro-creator",        name: "Creator Desk",        description: "Warm workspace tones for digital makers", category: "professional" },
      { id: "pro-luxury",         name: "Luxury Lounge",       description: "Rich navy and gold, elevated feel", category: "professional" },
      { id: "pro-street-fitness", name: "Street Fitness Park", description: "Urban outdoor energy with bold contrast", category: "professional" },
      { id: "pro-mind-map",       name: "Mind Mapping",        description: "Connected ideas on a clean canvas", category: "professional" },
      { id: "pro-book-nook",      name: "Book Nook",           description: "Warm paper tones for deep readers", category: "professional" },
      { id: "pro-adventure",      name: "Adventure Camp",      description: "Trail-ready greens and rugged warmth", category: "professional" },
      { id: "ai-command-center",  name: "AI Command Center",   description: "Tech control — deep navy terminal aesthetic with neon green accent and monospace typography", category: "professional" },
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
