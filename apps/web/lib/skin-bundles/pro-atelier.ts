/**
 * Token bundle for the "Atelier" skin (pro-atelier).
 * Warm stone white with vivid purple gradient, Georgia serif w600 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 35 (node 1:15000)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "Georgia, 'Times New Roman', serif";

export const proAtelierTokens: SkinTokens = {
  id: SkinId.ProAtelier,
  name: "Atelier",
  description: "Artist's warmth with bold violet and serif grace",

  color: {
    background: {
      default: "#FAFAF9",
      elevated: "#F5F5F4",
      hero: "#FAFAF9",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #7F22FE 0%, #981AFA 100%)",
    },
    border: { subtle: "#E7E5E4" },
    text: {
      primary: "#292524",
      secondary: "#79716B",
    },
    accent: { primary: "#7008E7", secondary: "#981AFA" },
    accentHover: "#8B1CF5",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#7008E7",
      actionReflect: "#981AFA",
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
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "400", lineHeight: "1.33" },
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
      primary:   { variant: "gradient", radius: "4px" },
      secondary: { variant: "outline",  radius: "4px" },
    },
    card: {
      radius: "8px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
      border: "1px solid #E7E5E4",
    },
    chip:  { background: "#FAF5FF", text: "#7008E7", radius: "4px" },
    badge: { info: { background: "#FAF5FF", text: "#7008E7" } },
    progress: {
      track:  "#E7E5E4",
      fill:   "linear-gradient(90deg, #7F22FE 0%, #981AFA 100%)",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #E7E5E4" } },
    viewer: {
      chapterRail: {
        background:    "#FAFAF9",
        activeChapter: "rgba(112, 8, 231, 0.06)",
        divider:       "#E7E5E4",
      },
      overlay: {
        titleCard:  { background: "rgba(250, 250, 249, 0.96)", text: "#292524" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#7008E7",
    },
  },
};
