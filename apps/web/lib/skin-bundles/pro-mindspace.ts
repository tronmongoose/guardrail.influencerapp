/**
 * Token bundle for the "Mindspace" skin (pro-mindspace).
 * Deep navy #020618 with vivid red-to-pink gradient, Inter w700 typography, red glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 33 (node 1:14115)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proMindspaceTokens: SkinTokens = {
  id: SkinId.ProMindspace,
  name: "Mindspace",
  description: "Deep dark immersion for focused work",

  color: {
    background: {
      default: "#020618",
      elevated: "#0F172B",
      hero: "#020618",
      surface: "#0A0A0A",
      gradient: "linear-gradient(90deg, #FB2C36 0%, #F6339A 100%)",
    },
    border: { subtle: "rgba(251, 44, 54, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#FB2C36", secondary: "#F6339A" },
    accentHover: "#FF3E4A",
    semantic: {
      success: "#4CAF7D",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#FB2C36",
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
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0px 1px 2px rgba(0,0,0,0.8)",
    md: "0px 25px 50px -12px rgba(251, 44, 54, 0.3)",
    lg: "0px 25px 50px -12px rgba(251, 44, 54, 0.4)",
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
      radius: "16px",
      shadow: "0px 25px 50px -12px rgba(251, 44, 54, 0.2)",
      border: "1px solid rgba(251, 44, 54, 0.2)",
    },
    chip:  { background: "rgba(251, 44, 54, 0.1)", text: "#FB2C36", radius: "9999px" },
    badge: { info: { background: "rgba(251, 44, 54, 0.1)", text: "#FB2C36" } },
    progress: {
      track:  "rgba(251, 44, 54, 0.15)",
      fill:   "linear-gradient(90deg, #FB2C36 0%, #F6339A 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(251, 44, 54, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#020618",
        activeChapter: "rgba(251, 44, 54, 0.1)",
        divider:       "rgba(251, 44, 54, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(2, 6, 24, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#FB2C36",
    },
  },
};
