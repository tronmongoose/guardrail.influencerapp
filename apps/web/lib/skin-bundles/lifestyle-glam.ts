/**
 * Token bundle for the "Glam Studio" skin (lifestyle-glam).
 * White with pink-to-rose gradient accents, Inter w700 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 13 (node 1:5285)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const lifestyleGlamTokens: SkinTokens = {
  id: SkinId.LifestyleGlam,
  name: "Glam Studio",
  description: "Runway-ready dark glamour",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#FFF1F2",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(135deg, #FDF2F8 0%, #FFE4E6 100%)",
    },
    border: { subtle: "#FBCFE8" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#EC003F", secondary: "#F6339A" },
    accentHover: "#FF2056",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#EC003F",
      actionReflect: "#F6339A",
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
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.33" },
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
      border: "1px solid #FBCFE8",
    },
    chip:  { background: "#FFF1F2", text: "#EC003F", radius: "9999px" },
    badge: { info: { background: "#FFF1F2", text: "#EC003F" } },
    progress: {
      track:  "#FCE7F3",
      fill:   "linear-gradient(90deg, #EC003F 0%, #F6339A 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #FBCFE8" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(236, 0, 63, 0.06)",
        divider:       "#FBCFE8",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#EC003F",
    },
  },
};
