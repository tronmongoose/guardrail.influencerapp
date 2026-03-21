/**
 * Token bundle for the "DIY Workshop" skin (activity-workshop).
 * Warm white with vivid orange-to-amber gradient, Inter w700 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 20 (node 1:8370)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const activityWorkshopTokens: SkinTokens = {
  id: SkinId.ActivityWorkshop,
  name: "DIY Workshop",
  description: "Electric build energy in neon cyan",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#FFF7ED",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #F54900 0%, #E17100 100%)",
    },
    border: { subtle: "#FED7AA" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#CA3500", secondary: "#F54900" },
    accentHover: "#E03C00",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#CA3500",
      actionReflect: "#F54900",
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
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.25)",
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
      radius: "16px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #FED7AA",
    },
    chip:  { background: "#FFF7ED", text: "#CA3500", radius: "9999px" },
    badge: { info: { background: "#FFF7ED", text: "#CA3500" } },
    progress: {
      track:  "#FFEDD5",
      fill:   "linear-gradient(90deg, #F54900 0%, #E17100 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #FED7AA" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(202, 53, 0, 0.06)",
        divider:       "#FED7AA",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#CA3500",
    },
  },
};
