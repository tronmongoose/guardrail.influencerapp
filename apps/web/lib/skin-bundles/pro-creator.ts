/**
 * Token bundle for the "Creator Desk" skin (pro-creator).
 * White with deep vivid purple gradient, Inter w600 labels, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 39 (node 1:16773)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proCreatorTokens: SkinTokens = {
  id: SkinId.ProCreator,
  name: "Creator Desk",
  description: "Creative workspace in deep vivid violet",

  color: {
    background: {
      default: "#F8FAFC",
      elevated: "#F5F3FF",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #8E51FF 0%, #AD46FF 100%)",
    },
    border: { subtle: "#EDE9FE" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#7F22FE", secondary: "#8E51FF" },
    accentHover: "#9333EA",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#7F22FE",
      actionReflect: "#8E51FF",
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
    transition: { duration: "250ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #EDE9FE",
    },
    chip:  { background: "#FAF5FF", text: "#7F22FE", radius: "9999px" },
    badge: { info: { background: "#FAF5FF", text: "#7F22FE" } },
    progress: {
      track:  "#EDE9FE",
      fill:   "linear-gradient(90deg, #8E51FF 0%, #AD46FF 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #EDE9FE" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(127, 34, 254, 0.06)",
        divider:       "#EDE9FE",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#7F22FE",
    },
  },
};
