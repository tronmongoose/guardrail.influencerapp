/**
 * Token bundle for the "Culinary Kitchen" skin (activity-culinary).
 * White with vivid red-to-orange gradient, Inter w700 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 21 (node 1:8814)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const activityCulinaryTokens: SkinTokens = {
  id: SkinId.ActivityCulinary,
  name: "Culinary Kitchen",
  description: "Chef's warmth in vivid saffron and spice",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#FFF7ED",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #FB2C36 0%, #FF6900 100%)",
    },
    border: { subtle: "#FFD6A8" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#E7000B", secondary: "#FF6900" },
    accentHover: "#F50009",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#E7000B",
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
    transition: { duration: "150ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #FFD6A8",
    },
    chip:  { background: "#FEF2F2", text: "#E7000B", radius: "9999px" },
    badge: { info: { background: "#FEF2F2", text: "#E7000B" } },
    progress: {
      track:  "#FFEDD4",
      fill:   "linear-gradient(90deg, #FB2C36 0%, #FF6900 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #FFD6A8" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(231, 0, 11, 0.06)",
        divider:       "#FFD6A8",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 200 },
      },
      controlsTint: "#E7000B",
    },
  },
};
