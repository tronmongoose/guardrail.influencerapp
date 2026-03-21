/**
 * Token bundle for the "Street Fitness Park" skin (pro-street-fitness).
 * Near-black #09090B with vivid gold-to-orange gradient, Inter w900 labels.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 41 (node 1:17658)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proStreetFitnessTokens: SkinTokens = {
  id: SkinId.ProStreetFitness,
  name: "Street Fitness Park",
  description: "Urban dark with vivid gold calisthenics energy",

  color: {
    background: {
      default: "#27272A",
      elevated: "#3F3F46",
      hero: "#18181B",
      surface: "#1C1C1F",
      gradient: "linear-gradient(90deg, #FDC700 0%, #FF6900 100%)",
    },
    border: { subtle: "rgba(253, 199, 0, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#FDC700", secondary: "#FF6900" },
    accentHover: "#FFD020",
    semantic: {
      success: "#4CAF7D",
      warning: "#FDC700",
      error:   "#FF4757",
      actionDo:      "#FDC700",
      actionReflect: "#FF6900",
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
      sm: { font: FONT, size: "12px", weight: "900", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 12px rgba(253, 199, 0, 0.2)",
    md: "0 0 25px rgba(253, 199, 0, 0.35)",
    lg: "0 0 50px rgba(253, 199, 0, 0.5)",
  },

  motion: {
    transition: { duration: "150ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0 0 20px rgba(253, 199, 0, 0.15)",
      border: "1px solid rgba(253, 199, 0, 0.2)",
    },
    chip:  { background: "rgba(253, 199, 0, 0.1)", text: "#FDC700", radius: "9999px" },
    badge: { info: { background: "rgba(253, 199, 0, 0.1)", text: "#FDC700" } },
    progress: {
      track:  "rgba(253, 199, 0, 0.15)",
      fill:   "linear-gradient(90deg, #FDC700 0%, #FF6900 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(253, 199, 0, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#27272A",
        activeChapter: "rgba(253, 199, 0, 0.1)",
        divider:       "rgba(253, 199, 0, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(39, 39, 42, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 200 },
      },
      controlsTint: "#FDC700",
    },
  },
};
