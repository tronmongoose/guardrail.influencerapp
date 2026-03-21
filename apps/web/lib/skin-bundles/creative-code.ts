/**
 * Token bundle for the "Code Terminal" skin (creative-code).
 * Pure black with bright neon green accents, Menlo monospace typography, green glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 11 (node 1:4403)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "Menlo, 'Courier New', monospace";

export const creativeCodeTokens: SkinTokens = {
  id: SkinId.CreativeCode,
  name: "Code Terminal",
  description: "Monospace precision on a warm canvas",

  color: {
    background: {
      default: "#000000",
      elevated: "#0A0A0A",
      hero: "#000000",
      surface: "#050505",
    },
    border: { subtle: "#0D542B" },
    text: {
      primary: "#7BF1A8",
      secondary: "#05DF72",
    },
    accent: { primary: "#05DF72", secondary: "#7BF1A8" },
    accentHover: "#00FF80",
    semantic: {
      success: "#7BF1A8",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#05DF72",
      actionReflect: "#7BF1A8",
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
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.4" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.3" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0 0 12px rgba(34, 197, 94, 0.2)",
    md: "0 0 20px rgba(34, 197, 94, 0.35)",
    lg: "0 0 40px rgba(34, 197, 94, 0.5)",
  },

  motion: {
    transition: { duration: "150ms", easing: "linear" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "4px" },
      secondary: { variant: "outline", radius: "4px" },
    },
    card: {
      radius: "4px",
      shadow: "0 0 20px rgba(34, 197, 94, 0.2)",
      border: "1px solid #0D542B",
    },
    chip:  { background: "rgba(5, 223, 114, 0.1)", text: "#05DF72", radius: "4px" },
    badge: { info: { background: "rgba(5, 223, 114, 0.1)", text: "#05DF72" } },
    progress: {
      track:  "#0D542B",
      fill:   "#05DF72",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #0D542B" } },
    viewer: {
      chapterRail: {
        background:    "#000000",
        activeChapter: "rgba(5, 223, 114, 0.1)",
        divider:       "#0D542B",
      },
      overlay: {
        titleCard:  { background: "rgba(0, 0, 0, 0.95)", text: "#7BF1A8" },
        transition: { style: "NONE", durationMs: 150 },
      },
      controlsTint: "#05DF72",
    },
  },
};
