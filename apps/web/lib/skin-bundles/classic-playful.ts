/**
 * Token bundle for the "Playful" skin (classic-playful).
 * Soft pastel gradient (lavender → blush → butter) with deep purple-pink accents, heavy typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 4 (node 1:1321)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const classicPlayfulTokens: SkinTokens = {
  id: SkinId.ClassicPlayful,
  name: "Playful",
  description: "Bright and energetic with fun accents",

  color: {
    background: {
      default: "#F3E8FF",
      elevated: "#FFFFFF",
      hero: "#F3E8FF",
      surface: "#FDF4FF",
      gradient: "linear-gradient(135deg, #F3E8FF 0%, #FDF2F8 50%, #FEF9C2 100%)",
    },
    border: { subtle: "#E9D4FF" },
    text: {
      primary: "#1E2939",
      secondary: "#364153",
    },
    accent: { primary: "#9810FA", secondary: "#E6007A" },
    accentHover: "#7C0CC8",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#9810FA",
      actionReflect: "#E6007A",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "900", lineHeight: "1.0" },
      xl:      { font: FONT, size: "48px", weight: "900", lineHeight: "1.1" },
      lg:      { font: FONT, size: "30px", weight: "900", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "900", lineHeight: "1.2" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "700", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "700", lineHeight: "1.4" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "900", lineHeight: "1.3" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0px 4px 6px -4px rgba(152, 16, 250, 0.15), 0px 10px 15px -3px rgba(152, 16, 250, 0.1)",
    md: "0px 8px 10px -6px rgba(152, 16, 250, 0.25), 0px 20px 25px -5px rgba(152, 16, 250, 0.2)",
    lg: "0px 20px 25px -5px rgba(152, 16, 250, 0.35), 0px 40px 50px -12px rgba(152, 16, 250, 0.25)",
  },

  motion: {
    transition: { duration: "150ms", easing: "linear" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "4px" },
      secondary: { variant: "outline",  radius: "4px" },
    },
    card: {
      radius: "4px",
      shadow: "0px 8px 10px -6px rgba(152, 16, 250, 0.2), 0px 20px 25px -5px rgba(152, 16, 250, 0.15)",
      border: "1px solid #E9D4FF",
    },
    chip:  { background: "#F3E8FF", text: "#9810FA", radius: "4px" },
    badge: { info: { background: "#F3E8FF", text: "#9810FA" } },
    progress: {
      track:  "#F3E8FF",
      fill:   "linear-gradient(90deg, #9810FA 0%, #E6007A 100%)",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #E9D4FF" } },
    viewer: {
      chapterRail: {
        background:    "#F3E8FF",
        activeChapter: "rgba(152, 16, 250, 0.08)",
        divider:       "#E9D4FF",
      },
      overlay: {
        titleCard:  { background: "rgba(243, 232, 255, 0.95)", text: "#1E2939" },
        transition: { style: "NONE", durationMs: 150 },
      },
      controlsTint: "#9810FA",
    },
  },
};
