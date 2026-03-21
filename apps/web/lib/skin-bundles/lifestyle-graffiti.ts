/**
 * Token bundle for the "Urban Graffiti" skin (lifestyle-graffiti).
 * Deep navy dark with sunrise orange-to-red accent, Inter w900 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 15 (node 1:6167)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const lifestyleGraffitiTokens: SkinTokens = {
  id: SkinId.LifestyleGraffiti,
  name: "Urban Graffiti",
  description: "Bold city energy in vivid teal and blue",

  color: {
    background: {
      default: "#101828",
      elevated: "#1D2939",
      hero: "#101828",
      surface: "#182032",
      gradient: "linear-gradient(90deg, #FF6900 0%, #FB2C36 100%)",
    },
    border: { subtle: "rgba(255, 105, 0, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#98A2B3",
    },
    accent: { primary: "#FF6900", secondary: "#FB2C36" },
    accentHover: "#FF7A1A",
    semantic: {
      success: "#4CAF7D",
      warning: "#FF6900",
      error:   "#FF4757",
      actionDo:      "#FF6900",
      actionReflect: "#FB2C36",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "900", lineHeight: "1.0" },
      xl:      { font: FONT, size: "48px", weight: "900", lineHeight: "1.1" },
      lg:      { font: FONT, size: "30px", weight: "900", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "900", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "900", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0 0 12px rgba(255, 105, 0, 0.15)",
    md: "0 0 24px rgba(255, 105, 0, 0.25)",
    lg: "0 0 48px rgba(255, 105, 0, 0.35)",
  },

  motion: {
    transition: { duration: "300ms", easing: "ease-in-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0 0 24px rgba(255, 105, 0, 0.15)",
      border: "1px solid rgba(255, 105, 0, 0.2)",
    },
    chip:  { background: "rgba(255, 105, 0, 0.12)", text: "#FF6900", radius: "9999px" },
    badge: { info: { background: "rgba(255, 105, 0, 0.12)", text: "#FF6900" } },
    progress: {
      track:  "rgba(255, 105, 0, 0.15)",
      fill:   "linear-gradient(90deg, #FF6900 0%, #FB2C36 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(255, 105, 0, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#101828",
        activeChapter: "rgba(255, 105, 0, 0.08)",
        divider:       "rgba(255, 105, 0, 0.2)",
      },
      overlay: {
        titleCard:  { background: "rgba(16, 24, 40, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#FF6900",
    },
  },
};
