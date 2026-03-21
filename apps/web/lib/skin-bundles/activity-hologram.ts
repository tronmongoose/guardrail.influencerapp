/**
 * Token bundle for the "Futuristic Hologram" skin (activity-hologram).
 * Pure black with electric cyan-to-blue gradient, Inter w700, intense cyan glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 19 (node 1:7932)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const activityHologramTokens: SkinTokens = {
  id: SkinId.ActivityHologram,
  name: "Futuristic Hologram",
  description: "Sci-fi dark with neon orange energy",

  color: {
    background: {
      default: "#000000",
      elevated: "#0A0A0A",
      hero: "#000000",
      surface: "#050505",
      gradient: "linear-gradient(90deg, #00D3F3 0%, #2B7FFF 100%)",
    },
    border: { subtle: "rgba(0, 211, 243, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#8EC5FF",
    },
    accent: { primary: "#00D3F3", secondary: "#2B7FFF" },
    accentHover: "#22D3EE",
    semantic: {
      success: "#00D3F3",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#00D3F3",
      actionReflect: "#2B7FFF",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "700", lineHeight: "1.0" },
      xl:      { font: FONT, size: "48px", weight: "700", lineHeight: "1.1" },
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
    sm: "0 0 20px rgba(34, 211, 238, 0.2)",
    md: "0 0 30px rgba(34, 211, 238, 0.3)",
    lg: "0 0 80px rgba(34, 211, 238, 0.6)",
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
      shadow: "0 0 25px rgba(34, 211, 238, 0.2)",
      border: "1px solid rgba(0, 211, 243, 0.25)",
    },
    chip:  { background: "rgba(0, 211, 243, 0.1)", text: "#00D3F3", radius: "9999px" },
    badge: { info: { background: "rgba(0, 211, 243, 0.1)", text: "#00D3F3" } },
    progress: {
      track:  "rgba(0, 211, 243, 0.15)",
      fill:   "linear-gradient(90deg, #00D3F3 0%, #2B7FFF 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(0, 211, 243, 0.25)" } },
    viewer: {
      chapterRail: {
        background:    "#000000",
        activeChapter: "rgba(0, 211, 243, 0.1)",
        divider:       "rgba(0, 211, 243, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(0, 0, 0, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#00D3F3",
    },
  },
};
