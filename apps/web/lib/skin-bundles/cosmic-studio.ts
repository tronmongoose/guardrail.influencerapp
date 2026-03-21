/**
 * Token bundle for the "Cosmic Studio" skin (cosmic-studio).
 * Deep purple cosmos — vibrant gradient hero, violet-to-pink accents, clean dark surfaces.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 1 (node 0:1)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const cosmicStudioTokens: SkinTokens = {
  id: SkinId.CosmicStudio,
  name: "Cosmic Studio",
  description: "Space exploration — deep purple cosmos with magenta-to-pink gradient accents",

  color: {
    background: {
      default: "#1E1A4D",
      elevated: "#3C0366",
      hero: "#1E1A4D",
      surface: "#2D0350",
      gradient: "linear-gradient(135deg, #1E1A4D 0%, #3C0366 40%, #000000 100%)",
    },
    border: { subtle: "rgba(194, 122, 255, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#E9D4FF",
    },
    accent: { primary: "#C27AFF", secondary: "#F6339A" },
    accentHover: "#AD46FF",
    semantic: {
      success: "#4CAF7D",
      warning: "#EAB308",
      error: "#EF4444",
      actionDo: "#AD46FF",
      actionReflect: "#F6339A",
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
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.4" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 12px rgba(168, 85, 247, 0.15)",
    md: "0 0 24px rgba(168, 85, 247, 0.25)",
    lg: "0 0 48px rgba(168, 85, 247, 0.35)",
  },

  motion: {
    transition: { duration: "300ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0 0 24px rgba(168, 85, 247, 0.15)",
      border: "1px solid #59168B",
    },
    chip:  { background: "#3C0366", text: "#E9D4FF", radius: "9999px" },
    badge: { info: { background: "#3C0366", text: "#AD46FF" } },
    progress: {
      track:  "#3C0366",
      fill:   "linear-gradient(90deg, #AD46FF 0%, #F6339A 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #59168B" } },
    viewer: {
      chapterRail: {
        background:    "#1E1A4D",
        activeChapter: "rgba(173, 70, 255, 0.1)",
        divider:       "#F6339A",
      },
      overlay: {
        titleCard:  { background: "rgba(30, 26, 77, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 500 },
      },
      controlsTint: "#AD46FF",
    },
  },
};
