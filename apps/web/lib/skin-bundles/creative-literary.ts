/**
 * Token bundle for the "Literary Classic" skin (creative-literary).
 * Warm cream canvas with monospace typography and terminal-green accents.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 10 (node 1:3959)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

export const creativeLiteraryTokens: SkinTokens = {
  id: SkinId.CreativeLiterary,
  name: "Literary Classic",
  description: "Paper whites and ink-black typography",

  color: {
    background: {
      default: "#FFFBEB",
      elevated: "#FFFFFF",
      hero: "#FFFBEB",
      surface: "#FEF9C3",
      gradient: "linear-gradient(135deg, #FFFBEB 0%, #FEF9C3 100%)",
    },
    border: { subtle: "#E7E5E4" },
    text: {
      primary: "#1C1917",
      secondary: "#57534E",
    },
    accent: { primary: "#15803D", secondary: "#2563EB" },
    accentHover: "#166534",
    semantic: {
      success: "#15803D",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#15803D",
      actionReflect: "#2563EB",
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
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.4" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.08), 0px 1px 3px 0px rgba(0,0,0,0.08)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
    lg: "0px 8px 10px -6px rgba(0,0,0,0.1), 0px 20px 25px -5px rgba(0,0,0,0.1)",
  },

  motion: {
    transition: { duration: "200ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "4px" },
      secondary: { variant: "outline", radius: "4px" },
    },
    card: {
      radius: "4px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
      border: "1px solid #E7E5E4",
    },
    chip:  { background: "#DCFCE7", text: "#15803D", radius: "4px" },
    badge: { info: { background: "#DCFCE7", text: "#15803D" } },
    progress: {
      track:  "#FEF9C3",
      fill:   "#15803D",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #E7E5E4" } },
    viewer: {
      chapterRail: {
        background:    "#FFFBEB",
        activeChapter: "rgba(21, 128, 61, 0.08)",
        divider:       "#E7E5E4",
      },
      overlay: {
        titleCard:  { background: "rgba(255, 251, 235, 0.96)", text: "#1C1917" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#15803D",
    },
  },
};
