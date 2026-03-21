/**
 * Token bundle for the "Mind Mapping" skin (pro-mind-map).
 * White with electric blue-to-cyan gradient, Inter w600 labels, light blue surfaces.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 42 (node 1:18102)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proMindMapTokens: SkinTokens = {
  id: SkinId.ProMindMap,
  name: "Mind Mapping",
  description: "Clarity in cool blue for structured thinking",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#EFF6FF",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #2B7FFF 0%, #00B8DB 100%)",
    },
    border: { subtle: "#DBEAFE" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#155DFC", secondary: "#2B7FFF" },
    accentHover: "#2B7FFF",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#155DFC",
      actionReflect: "#2B7FFF",
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
    transition: { duration: "200ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #DBEAFE",
    },
    chip:  { background: "#EFF6FF", text: "#155DFC", radius: "9999px" },
    badge: { info: { background: "#EFF6FF", text: "#155DFC" } },
    progress: {
      track:  "#DBEAFE",
      fill:   "linear-gradient(90deg, #2B7FFF 0%, #00B8DB 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #DBEAFE" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(21, 93, 252, 0.06)",
        divider:       "#DBEAFE",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#155DFC",
    },
  },
};
