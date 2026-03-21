/**
 * Token bundle for the "Wanderlust" skin (lifestyle-wanderlust).
 * White with blue-to-teal gradient accents, Inter w600 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 14 (node 1:5726)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const lifestyleWanderlustTokens: SkinTokens = {
  id: SkinId.LifestyleWanderlust,
  name: "Wanderlust",
  description: "Rose-tinted adventure and discovery",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#F0FDFA",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(135deg, #EFF6FF 0%, #F0FDFA 100%)",
    },
    border: { subtle: "#CBFBF1" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#009689", secondary: "#2B7FFF" },
    accentHover: "#00BBA7",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#009689",
      actionReflect: "#2B7FFF",
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
      border: "1px solid #CBFBF1",
    },
    chip:  { background: "#F0FDFA", text: "#009689", radius: "9999px" },
    badge: { info: { background: "#F0FDFA", text: "#009689" } },
    progress: {
      track:  "#CBFBF1",
      fill:   "linear-gradient(90deg, #2B7FFF 0%, #00BBA7 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #CBFBF1" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(0, 150, 137, 0.08)",
        divider:       "#CBFBF1",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#009689",
    },
  },
};
