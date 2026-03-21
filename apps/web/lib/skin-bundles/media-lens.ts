/**
 * Token bundle for the "Wild Lens" skin (media-lens).
 * Deep forest green gradient with vivid emerald accents, Inter w700 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 32 (node 1:13674)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const mediaLensTokens: SkinTokens = {
  id: SkinId.MediaLens,
  name: "Wild Lens",
  description: "Dark editorial with bold red serif energy",

  color: {
    background: {
      default: "#004F3B",
      elevated: "#005E47",
      hero: "#004F3B",
      surface: "#003D2E",
      gradient: "linear-gradient(180deg, #004F3B 0%, #022F2E 100%)",
    },
    border: { subtle: "rgba(0, 212, 146, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6EE7B7",
    },
    accent: { primary: "#00D492", secondary: "#00BC7D" },
    accentHover: "#00E69E",
    semantic: {
      success: "#00D492",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#00D492",
      actionReflect: "#00BC7D",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "700", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "700", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "700", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "700", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0 0 12px rgba(0, 212, 146, 0.2)",
    md: "0 0 24px rgba(0, 212, 146, 0.3)",
    lg: "0 0 48px rgba(0, 212, 146, 0.4)",
  },

  motion: {
    transition: { duration: "200ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0 0 24px rgba(0, 212, 146, 0.15)",
      border: "1px solid rgba(0, 212, 146, 0.2)",
    },
    chip:  { background: "rgba(0, 212, 146, 0.12)", text: "#00D492", radius: "9999px" },
    badge: { info: { background: "rgba(0, 212, 146, 0.12)", text: "#00D492" } },
    progress: {
      track:  "rgba(0, 212, 146, 0.15)",
      fill:   "linear-gradient(90deg, #00BC7D 0%, #00BBA7 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(0, 212, 146, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#004F3B",
        activeChapter: "rgba(0, 212, 146, 0.08)",
        divider:       "rgba(0, 212, 146, 0.2)",
      },
      overlay: {
        titleCard:  { background: "rgba(0, 47, 46, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#00D492",
    },
  },
};
