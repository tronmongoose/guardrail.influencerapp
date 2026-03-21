/**
 * Token bundle for the "Chalkboard" skin (creative-chalkboard).
 * Slate-navy paper with yellow/gold highlights, Georgia serif typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 8 (node 1:3077)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "Georgia, 'Times New Roman', serif";

export const creativeChalkboardTokens: SkinTokens = {
  id: SkinId.CreativeChalkboard,
  name: "Chalkboard",
  description: "Classic green board energy",

  color: {
    background: {
      default: "#1D293D",
      elevated: "#243347",
      hero: "#1D293D",
      surface: "#182235",
    },
    border: { subtle: "#45556C" },
    text: {
      primary: "#FEF9C2",
      secondary: "#A0B0C8",
    },
    accent: { primary: "#FFF085", secondary: "#FEE685" },
    accentHover: "#FFF9A0",
    semantic: {
      success: "#4CAF7D",
      warning: "#FFF085",
      error:   "#EF4444",
      actionDo:      "#FFF085",
      actionReflect: "#FEE685",
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
    sm: "0px 1px 2px rgba(0,0,0,0.4), 0px 1px 3px rgba(0,0,0,0.4)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.5), 0px 10px 15px -3px rgba(0,0,0,0.5)",
    lg: "0px 8px 10px -6px rgba(0,0,0,0.6), 0px 20px 25px -5px rgba(0,0,0,0.6)",
  },

  motion: {
    transition: { duration: "300ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "4px" },
      secondary: { variant: "outline", radius: "4px" },
    },
    card: {
      radius: "4px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.5), 0px 10px 15px -3px rgba(0,0,0,0.5)",
      border: "1px solid #45556C",
    },
    chip:  { background: "#1D293D", text: "#FFF085", radius: "4px" },
    badge: { info: { background: "#1D293D", text: "#FFF085" } },
    progress: {
      track:  "#314158",
      fill:   "#FFF085",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #45556C" } },
    viewer: {
      chapterRail: {
        background:    "#1D293D",
        activeChapter: "rgba(255, 240, 133, 0.1)",
        divider:       "#45556C",
      },
      overlay: {
        titleCard:  { background: "rgba(29, 41, 61, 0.95)", text: "#FEF9C2" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#FFF085",
    },
  },
};
