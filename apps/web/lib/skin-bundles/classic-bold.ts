/**
 * Token bundle for the "Bold" skin (classic-bold).
 * Pure black surfaces with yellow-to-red gradient accents, refined typography, large radii.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 5 (node 1:1766)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const classicBoldTokens: SkinTokens = {
  id: SkinId.ClassicBold,
  name: "Bold",
  description: "High contrast, strong typographic presence",

  color: {
    background: {
      default: "#000000",
      elevated: "#1A1A1A",
      hero: "#000000",
      surface: "#0D0D0D",
      gradient: "linear-gradient(135deg, #FDC700 0%, #E7000B 50%, #000000 100%)",
    },
    border: { subtle: "#2A2A2A" },
    text: {
      primary: "#FFFFFF",
      secondary: "#D1D5DC",
    },
    accent: { primary: "#FDC700", secondary: "#E7000B" },
    accentHover: "#FFD740",
    semantic: {
      success: "#22C55E",
      warning: "#FDC700",
      error:   "#E7000B",
      actionDo:      "#FDC700",
      actionReflect: "#E7000B",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "900", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "900", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "900", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "900", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "500", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "500", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.4" },
    },
  },

  radius: { sm: "8px", md: "16px", lg: "24px" },

  shadow: {
    sm: "0px 4px 6px -4px rgba(253, 199, 0, 0.25), 0px 10px 15px -3px rgba(253, 199, 0, 0.2)",
    md: "0px 8px 10px -6px rgba(253, 199, 0, 0.35), 0px 20px 25px -5px rgba(253, 199, 0, 0.3)",
    lg: "0px 20px 25px -5px rgba(253, 199, 0, 0.45), 0px 40px 50px -12px rgba(253, 199, 0, 0.3)",
  },

  motion: {
    transition: { duration: "300ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "9999px" },
      secondary: { variant: "soft",     radius: "9999px" },
    },
    card: {
      radius: "20px",
      shadow: "0px 8px 10px -6px rgba(253, 199, 0, 0.25), 0px 20px 25px -5px rgba(253, 199, 0, 0.2)",
      border: "1px solid #2A2A2A",
    },
    chip:  { background: "#1A1A1A", text: "#FDC700", radius: "9999px" },
    badge: { info: { background: "#1A1A1A", text: "#FDC700" } },
    progress: {
      track:  "#1A1A1A",
      fill:   "linear-gradient(90deg, #FDC700 0%, #E7000B 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "16px", border: "1px solid #2A2A2A" } },
    viewer: {
      chapterRail: {
        background:    "#000000",
        activeChapter: "rgba(253, 199, 0, 0.08)",
        divider:       "#2A2A2A",
      },
      overlay: {
        titleCard:  { background: "rgba(0, 0, 0, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 400 },
      },
      controlsTint: "#FDC700",
    },
  },
};
