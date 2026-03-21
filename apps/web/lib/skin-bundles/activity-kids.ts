/**
 * Token bundle for the "Kids Playground" skin (activity-kids).
 * White with vibrant multi-color blue-to-green-to-gold gradient, Inter w900 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 23 (node 1:9702)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const activityKidsTokens: SkinTokens = {
  id: SkinId.ActivityKids,
  name: "Kids Playground",
  description: "Bright and cheerful for young learners",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#F0F9FF",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #2B7FFF 0%, #00C950 50%, #F0B100 100%)",
    },
    border: { subtle: "#BFDBFE" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#155DFC", secondary: "#00C950" },
    accentHover: "#2B7FFF",
    semantic: {
      success: "#00C950",
      warning: "#F0B100",
      error:   "#DC2626",
      actionDo:      "#155DFC",
      actionReflect: "#00C950",
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
      md: { font: FONT, size: "16px", weight: "600", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "900", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "12px", lg: "24px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },

  motion: {
    transition: { duration: "300ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "12px" },
      secondary: { variant: "outline",  radius: "12px" },
    },
    card: {
      radius: "24px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #BFDBFE",
    },
    chip:  { background: "#DBEAFE", text: "#155DFC", radius: "9999px" },
    badge: { info: { background: "#DBEAFE", text: "#155DFC" } },
    progress: {
      track:  "#DBEAFE",
      fill:   "linear-gradient(90deg, #2B7FFF 0%, #00C950 50%, #F0B100 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "12px", border: "1px solid #BFDBFE" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(21, 93, 252, 0.06)",
        divider:       "#BFDBFE",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#155DFC",
    },
  },
};
