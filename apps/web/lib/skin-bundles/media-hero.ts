/**
 * Token bundle for the "Hero Mode" skin (media-hero).
 * Deep navy #0F172B with electric blue gradient, Inter w900 typography, blue glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 30 (node 1:12789)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const mediaHeroTokens: SkinTokens = {
  id: SkinId.MediaHero,
  name: "Hero Mode",
  description: "Cinematic deep purple with neon pink power",

  color: {
    background: {
      default: "#0F172B",
      elevated: "#162456",
      hero: "#0F172B",
      surface: "#0C1428",
      gradient: "linear-gradient(135deg, #0F172B 0%, #162456 100%)",
    },
    border: { subtle: "rgba(43, 127, 255, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#2B7FFF", secondary: "#00B8DB" },
    accentHover: "#51A2FF",
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

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0px 1px 2px rgba(0,0,0,0.8)",
    md: "0px 25px 50px -12px rgba(43, 127, 255, 0.3)",
    lg: "0px 25px 50px -12px rgba(43, 127, 255, 0.4)",
  },

  motion: {
    transition: { duration: "250ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0px 25px 50px -12px rgba(43, 127, 255, 0.25)",
      border: "1px solid rgba(43, 127, 255, 0.2)",
    },
    chip:  { background: "rgba(43, 127, 255, 0.1)", text: "#2B7FFF", radius: "9999px" },
    badge: { info: { background: "rgba(43, 127, 255, 0.1)", text: "#2B7FFF" } },
    progress: {
      track:  "rgba(43, 127, 255, 0.15)",
      fill:   "linear-gradient(90deg, #2B7FFF 0%, #00B8DB 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(43, 127, 255, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#0F172B",
        activeChapter: "rgba(43, 127, 255, 0.1)",
        divider:       "rgba(43, 127, 255, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(15, 23, 43, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#2B7FFF",
    },
  },
};
