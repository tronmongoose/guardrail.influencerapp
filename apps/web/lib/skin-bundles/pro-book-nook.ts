/**
 * Token bundle for the "Book Nook" skin (pro-book-nook).
 * Warm cream #FFFBEB with deep amber-orange gradient, Georgia serif labels, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 43 (node 1:18540)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT_HEADING = "'Inter', system-ui, sans-serif";
const FONT_LABEL   = "Georgia, 'Times New Roman', serif";

export const proBookNookTokens: SkinTokens = {
  id: SkinId.ProBookNook,
  name: "Book Nook",
  description: "Warm amber pages for curated knowledge",

  color: {
    background: {
      default: "#FFFBEB",
      elevated: "#FEF3C6",
      hero: "#FFFBEB",
      surface: "#F9FAFB",
    },
    border: { subtle: "#FDE68A" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#BB4D00", secondary: "#973C00" },
    accentHover: "#CA5500",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#BB4D00",
      actionReflect: "#973C00",
    },
  },

  text: {
    heading: {
      display: { font: FONT_HEADING, size: "72px", weight: "700", lineHeight: "1.1" },
      xl:      { font: FONT_HEADING, size: "48px", weight: "700", lineHeight: "1.15" },
      lg:      { font: FONT_HEADING, size: "30px", weight: "700", lineHeight: "1.2" },
      md:      { font: FONT_HEADING, size: "24px", weight: "700", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT_HEADING, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT_HEADING, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT_LABEL, size: "12px", weight: "400", lineHeight: "1.33" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },

  motion: {
    transition: { duration: "250ms", easing: "ease-in-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "4px" },
      secondary: { variant: "outline", radius: "4px" },
    },
    card: {
      radius: "8px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
      border: "1px solid #FDE68A",
    },
    chip:  { background: "#FEF3C6", text: "#BB4D00", radius: "4px" },
    badge: { info: { background: "#FEF3C6", text: "#BB4D00" } },
    progress: {
      track:  "#FDE68A",
      fill:   "linear-gradient(135deg, #BB4D00 0%, #7B3306 100%)",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #FDE68A" } },
    viewer: {
      chapterRail: {
        background:    "#FFFBEB",
        activeChapter: "rgba(187, 77, 0, 0.06)",
        divider:       "#FDE68A",
      },
      overlay: {
        titleCard:  { background: "rgba(255, 251, 235, 0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#BB4D00",
    },
  },
};
