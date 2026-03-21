/**
 * Token bundle for the "Sports Arena" skin (activity-sports).
 * Deep navy dark with vivid red-to-orange gradient, Inter w900 ultra-bold typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 22 (node 1:9258)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const activitySportsTokens: SkinTokens = {
  id: SkinId.ActivitySports,
  name: "Sports Arena",
  description: "Championship red for competitive energy",

  color: {
    background: {
      default: "#101828",
      elevated: "#1D2939",
      hero: "#101828",
      surface: "#182032",
      gradient: "linear-gradient(90deg, #FB2C36 0%, #FF6900 100%)",
    },
    border: { subtle: "rgba(251, 44, 54, 0.25)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#98A2B3",
    },
    accent: { primary: "#FB2C36", secondary: "#FF6900" },
    accentHover: "#FF3E4A",
    semantic: {
      success: "#4CAF7D",
      warning: "#FF6900",
      error:   "#FF4757",
      actionDo:      "#FB2C36",
      actionReflect: "#FF6900",
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

  radius: { sm: "8px", md: "16px", lg: "24px" },

  shadow: {
    sm: "0 0 12px rgba(251, 44, 54, 0.2)",
    md: "0 0 24px rgba(251, 44, 54, 0.3)",
    lg: "0 0 48px rgba(251, 44, 54, 0.4)",
  },

  motion: {
    transition: { duration: "200ms", easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "16px" },
      secondary: { variant: "solid",    radius: "16px" },
    },
    card: {
      radius: "24px",
      shadow: "0 0 24px rgba(251, 44, 54, 0.15)",
      border: "1px solid rgba(251, 44, 54, 0.25)",
    },
    chip:  { background: "rgba(251, 44, 54, 0.12)", text: "#FB2C36", radius: "9999px" },
    badge: { info: { background: "rgba(251, 44, 54, 0.12)", text: "#FB2C36" } },
    progress: {
      track:  "rgba(251, 44, 54, 0.15)",
      fill:   "linear-gradient(90deg, #FB2C36 0%, #FF6900 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "16px", border: "1px solid rgba(251, 44, 54, 0.25)" } },
    viewer: {
      chapterRail: {
        background:    "#101828",
        activeChapter: "rgba(251, 44, 54, 0.08)",
        divider:       "rgba(251, 44, 54, 0.2)",
      },
      overlay: {
        titleCard:  { background: "rgba(16, 24, 40, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#FB2C36",
    },
  },
};
