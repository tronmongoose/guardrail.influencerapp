/**
 * Token bundle for the "Sheet Music" skin (creative-sheet-music).
 * Cream-white with indigo accent, Georgia serif typography, clean flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 9 (node 1:3521)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "Georgia, 'Times New Roman', serif";

export const creativeSheetMusicTokens: SkinTokens = {
  id: SkinId.CreativeSheetMusic,
  name: "Sheet Music",
  description: "Clean staves and musical precision",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#EEF2FF",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
    },
    border: { subtle: "#D1D5DC" },
    text: {
      primary: "#1E2939",
      secondary: "#4A5565",
    },
    accent: { primary: "#432DD7", secondary: "#6366F1" },
    accentHover: "#3522B0",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#432DD7",
      actionReflect: "#6366F1",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "600", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "600", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "600", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "600", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.75" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.6" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.4" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
    lg: "0px 8px 10px -6px rgba(0,0,0,0.1), 0px 20px 25px -5px rgba(0,0,0,0.1)",
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
      radius: "4px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
      border: "1px solid #D1D5DC",
    },
    chip:  { background: "#EEF2FF", text: "#432DD7", radius: "4px" },
    badge: { info: { background: "#EEF2FF", text: "#432DD7" } },
    progress: {
      track:  "#E5E7EB",
      fill:   "#432DD7",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #D1D5DC" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(67, 45, 215, 0.08)",
        divider:       "#D1D5DC",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#1E2939" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#432DD7",
    },
  },
};
