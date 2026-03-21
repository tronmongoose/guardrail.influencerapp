/**
 * Token bundle for the "Pulse Performance" skin (media-pulse).
 * Deep slate with vibrant orange-to-amber gradient, Inter w700 typography, warm glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 33 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const mediaPulseTokens: SkinTokens = {
  id: SkinId.MediaPulse,
  name: "Pulse Performance",
  description: "Live-event energy with dynamic color",

  color: {
    background: {
      default: "#0F0A00",
      elevated: "#1A1000",
      hero: "#0F0A00",
      surface: "#150D00",
      gradient: "linear-gradient(135deg, #0F0A00 0%, #2D1A00 100%)",
    },
    border: { subtle: "rgba(251, 146, 60, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#FCD34D",
    },
    accent: { primary: "#FB923C", secondary: "#F59E0B" },
    accentHover: "#FCA55A",
    semantic: {
      success: "#4CAF7D",
      warning: "#F59E0B",
      error:   "#FF4757",
      actionDo:      "#FB923C",
      actionReflect: "#F59E0B",
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
    sm: "0 0 12px rgba(251, 146, 60, 0.2)",
    md: "0 0 25px rgba(251, 146, 60, 0.35)",
    lg: "0 0 50px rgba(251, 146, 60, 0.5)",
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
      shadow: "0 0 20px rgba(251, 146, 60, 0.15)",
      border: "1px solid rgba(251, 146, 60, 0.2)",
    },
    chip:  { background: "rgba(251, 146, 60, 0.1)", text: "#FB923C", radius: "9999px" },
    badge: { info: { background: "rgba(251, 146, 60, 0.1)", text: "#FB923C" } },
    progress: {
      track:  "rgba(251, 146, 60, 0.15)",
      fill:   "linear-gradient(90deg, #FB923C 0%, #F59E0B 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(251, 146, 60, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#0F0A00",
        activeChapter: "rgba(251, 146, 60, 0.08)",
        divider:       "rgba(251, 146, 60, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(15, 10, 0, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#FB923C",
    },
  },
};
