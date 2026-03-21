/**
 * Token bundle for the "Studio" skin (classic-studio).
 * Off-white surfaces with warm burnt-orange accent, Inter typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 3 (node 1:877)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const classicStudioTokens: SkinTokens = {
  id: SkinId.ClassicStudio,
  name: "Studio",
  description: "Creative workspace with a focused palette",

  color: {
    background: {
      default: "#FAFAFA",
      elevated: "#FFFFFF",
      hero: "#FAFAFA",
      surface: "#F4F4F4",
      gradient: "linear-gradient(90deg, #BB4D00 0%, #E56000 100%)",
    },
    border: { subtle: "#E5E5E5" },
    text: {
      primary: "#171717",
      secondary: "#525252",
    },
    accent: { primary: "#BB4D00", secondary: "#E56000" },
    accentHover: "#D45800",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error: "#EF4444",
      actionDo: "#BB4D00",
      actionReflect: "#E56000",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "300", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "700", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "700", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "700", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.75" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "500", lineHeight: "1.4" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.08), 0px 1px 3px 0px rgba(0,0,0,0.08)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.08), 0px 10px 15px -3px rgba(0,0,0,0.08)",
    lg: "0px 8px 10px -6px rgba(0,0,0,0.1), 0px 20px 25px -5px rgba(0,0,0,0.1)",
  },

  motion: {
    transition: { duration: "250ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "8px" },
      secondary: { variant: "outline", radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.08), 0px 10px 15px -3px rgba(0,0,0,0.08)",
      border: "1px solid #E5E5E5",
    },
    chip:  { background: "#FFF7ED", text: "#BB4D00", radius: "9999px" },
    badge: { info: { background: "#FFF7ED", text: "#BB4D00" } },
    progress: {
      track:  "#FFE4CC",
      fill:   "#BB4D00",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #E5E5E5" } },
    viewer: {
      chapterRail: {
        background:    "#FAFAFA",
        activeChapter: "rgba(187, 77, 0, 0.08)",
        divider:       "#E5E5E5",
      },
      overlay: {
        titleCard:  { background: "rgba(250, 250, 250, 0.95)", text: "#171717" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#BB4D00",
    },
  },
};
