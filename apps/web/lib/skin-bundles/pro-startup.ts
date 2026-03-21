/**
 * Token bundle for the "Startup Garage" skin (pro-startup).
 * Deep navy dark with electric blue-to-cyan gradient, Inter w700 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 36 (node 1:15444)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proStartupTokens: SkinTokens = {
  id: SkinId.ProStartup,
  name: "Startup Garage",
  description: "Lean and launch-ready energy",

  color: {
    background: {
      default: "#101828",
      elevated: "#1D2939",
      hero: "#101828",
      surface: "#182032",
      gradient: "linear-gradient(90deg, #2B7FFF 0%, #00B8DB 100%)",
    },
    border: { subtle: "rgba(43, 127, 255, 0.25)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#98A2B3",
    },
    accent: { primary: "#2B7FFF", secondary: "#00B8DB" },
    accentHover: "#3D8FFF",
    semantic: {
      success: "#4CAF7D",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#2B7FFF",
      actionReflect: "#00B8DB",
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

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 12px rgba(43, 127, 255, 0.2)",
    md: "0 0 24px rgba(43, 127, 255, 0.3)",
    lg: "0 0 48px rgba(43, 127, 255, 0.4)",
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
      radius: "12px",
      shadow: "0 0 24px rgba(43, 127, 255, 0.15)",
      border: "1px solid rgba(43, 127, 255, 0.25)",
    },
    chip:  { background: "rgba(43, 127, 255, 0.12)", text: "#2B7FFF", radius: "9999px" },
    badge: { info: { background: "rgba(43, 127, 255, 0.12)", text: "#2B7FFF" } },
    progress: {
      track:  "rgba(43, 127, 255, 0.15)",
      fill:   "linear-gradient(90deg, #2B7FFF 0%, #00B8DB 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(43, 127, 255, 0.25)" } },
    viewer: {
      chapterRail: {
        background:    "#101828",
        activeChapter: "rgba(43, 127, 255, 0.08)",
        divider:       "rgba(43, 127, 255, 0.2)",
      },
      overlay: {
        titleCard:  { background: "rgba(16, 24, 40, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 200 },
      },
      controlsTint: "#2B7FFF",
    },
  },
};
