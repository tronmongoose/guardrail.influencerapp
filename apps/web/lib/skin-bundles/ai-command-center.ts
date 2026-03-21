/**
 * Token bundle for the "AI Command Center" skin (ai-command-center).
 * Deep navy #020618 with neon green #05DF72, Inter headings + Menlo labels, green glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 45 (node 1:19425)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT_BODY  = "'Inter', system-ui, sans-serif";
const FONT_LABEL = "Menlo, 'Courier New', monospace";

export const aiCommandCenterTokens: SkinTokens = {
  id: SkinId.AiCommandCenter,
  name: "AI Command Center",
  description: "Terminal-grade dark with neon green intelligence",

  color: {
    background: {
      default: "#020618",
      elevated: "#0F172B",
      hero: "#000000",
      surface: "#0A0A0A",
    },
    border: { subtle: "rgba(5, 223, 114, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#05DF72", secondary: "#00C950" },
    accentHover: "#00F07A",
    semantic: {
      success: "#05DF72",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#05DF72",
      actionReflect: "#00C950",
    },
  },

  text: {
    heading: {
      display: { font: FONT_BODY, size: "72px", weight: "700", lineHeight: "1.1" },
      xl:      { font: FONT_BODY, size: "48px", weight: "700", lineHeight: "1.15" },
      lg:      { font: FONT_BODY, size: "30px", weight: "700", lineHeight: "1.2" },
      md:      { font: FONT_BODY, size: "24px", weight: "700", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT_BODY, size: "16px", weight: "400", lineHeight: "1.5" },
      sm: { font: FONT_BODY, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT_LABEL, size: "12px", weight: "400", lineHeight: "1.33" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0 0 20px rgba(34, 197, 94, 0.2)",
    md: "0 0 30px rgba(34, 197, 94, 0.3)",
    lg: "0 0 80px rgba(34, 197, 94, 0.6)",
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
      radius: "8px",
      shadow: "0 0 25px rgba(34, 197, 94, 0.2)",
      border: "1px solid rgba(5, 223, 114, 0.2)",
    },
    chip:  { background: "rgba(5, 223, 114, 0.1)", text: "#05DF72", radius: "4px" },
    badge: { info: { background: "rgba(5, 223, 114, 0.1)", text: "#05DF72" } },
    progress: {
      track:  "rgba(5, 223, 114, 0.15)",
      fill:   "#05DF72",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid rgba(5, 223, 114, 0.3)" } },
    viewer: {
      chapterRail: {
        background:    "#020618",
        activeChapter: "rgba(5, 223, 114, 0.08)",
        divider:       "rgba(5, 223, 114, 0.2)",
      },
      overlay: {
        titleCard:  { background: "rgba(2, 6, 24, 0.97)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 150 },
      },
      controlsTint: "#05DF72",
    },
  },
};
