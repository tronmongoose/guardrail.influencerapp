/**
 * Token bundle for the "Luxury Lounge" skin (pro-luxury).
 * Warm cream white with pure gold gradient, Inter w600 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 40 (node 1:17217)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proLuxuryTokens: SkinTokens = {
  id: SkinId.ProLuxury,
  name: "Luxury Lounge",
  description: "Premium warm gold on cream for discerning creators",

  color: {
    background: {
      default: "#FFFBEB",
      elevated: "#FEF3C6",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(135deg, #FFFBEB 0%, #FEFCE8 100%)",
    },
    border: { subtle: "#FDE68A" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#A65F00", secondary: "#D08700" },
    accentHover: "#B87300",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#A65F00",
      actionReflect: "#D08700",
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
      sm: { font: FONT, size: "12px", weight: "600", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },

  motion: {
    transition: { duration: "300ms", easing: "ease-in-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #FDE68A",
    },
    chip:  { background: "#FEF3C6", text: "#A65F00", radius: "9999px" },
    badge: { info: { background: "#FEF3C6", text: "#A65F00" } },
    progress: {
      track:  "#FDE68A",
      fill:   "linear-gradient(90deg, #D08700 0%, #E17100 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #FDE68A" } },
    viewer: {
      chapterRail: {
        background:    "#FFFBEB",
        activeChapter: "rgba(166, 95, 0, 0.06)",
        divider:       "#FDE68A",
      },
      overlay: {
        titleCard:  { background: "rgba(255, 251, 235, 0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#A65F00",
    },
  },
};
