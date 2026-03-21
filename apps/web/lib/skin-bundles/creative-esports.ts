/**
 * Token bundle for the "Esports" skin (creative-esports).
 * Deep indigo-black with electric yellow-to-orange gradient, heavy w800 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 12 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const creativeEsportsTokens: SkinTokens = {
  id: SkinId.CreativeEsports,
  name: "Esports",
  description: "Immersive dark with RGB accents",

  color: {
    background: {
      default: "#0A0A1A",
      elevated: "#12122A",
      hero: "#0A0A1A",
      surface: "#060614",
      gradient: "linear-gradient(135deg, #0A0A1A 0%, #1A0A3A 50%, #0A1A3A 100%)",
    },
    border: { subtle: "rgba(100, 180, 255, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#8EC5FF",
    },
    accent: { primary: "#64B4FF", secondary: "#A855F7" },
    accentHover: "#82C8FF",
    semantic: {
      success: "#22C55E",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#64B4FF",
      actionReflect: "#A855F7",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "800", lineHeight: "1.0" },
      xl:      { font: FONT, size: "48px", weight: "800", lineHeight: "1.1" },
      lg:      { font: FONT, size: "30px", weight: "800", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "800", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "800", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 12px rgba(100, 180, 255, 0.2)",
    md: "0 0 25px rgba(100, 180, 255, 0.35)",
    lg: "0 0 50px rgba(100, 180, 255, 0.5)",
  },

  motion: {
    transition: { duration: "200ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0 0 25px rgba(100, 180, 255, 0.2)",
      border: "1px solid rgba(100, 180, 255, 0.2)",
    },
    chip:  { background: "rgba(100, 180, 255, 0.1)", text: "#64B4FF", radius: "9999px" },
    badge: { info: { background: "rgba(100, 180, 255, 0.1)", text: "#64B4FF" } },
    progress: {
      track:  "rgba(100, 180, 255, 0.15)",
      fill:   "linear-gradient(90deg, #64B4FF 0%, #A855F7 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(100, 180, 255, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#0A0A1A",
        activeChapter: "rgba(100, 180, 255, 0.1)",
        divider:       "rgba(100, 180, 255, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(10, 10, 26, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#64B4FF",
    },
  },
};
