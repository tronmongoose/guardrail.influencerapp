/**
 * Token bundle for the "Wellness Sanctuary" skin (pro-wellness).
 * White with emerald-to-teal gradient, Inter w300 ultralight typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 37 (node 1:15888)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proWellnessTokens: SkinTokens = {
  id: SkinId.ProWellness,
  name: "Wellness Sanctuary",
  description: "Breathe easy in verdant green serenity",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#F0FDFA",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
      gradient: "linear-gradient(90deg, #00D492 0%, #00BBA7 100%)",
    },
    border: { subtle: "#CBFBF1" },
    text: {
      primary: "#101828",
      secondary: "#4A5565",
    },
    accent: { primary: "#009966", secondary: "#00BC7D" },
    accentHover: "#00B377",
    semantic: {
      success: "#009966",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#009966",
      actionReflect: "#00BC7D",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "300", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "300", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "300", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "300", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "500", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "12px", lg: "20px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },

  motion: {
    transition: { duration: "300ms", easing: "ease-in-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "12px" },
      secondary: { variant: "outline",  radius: "12px" },
    },
    card: {
      radius: "20px",
      shadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
      border: "1px solid #CBFBF1",
    },
    chip:  { background: "#F0FDFA", text: "#009966", radius: "9999px" },
    badge: { info: { background: "#F0FDFA", text: "#009966" } },
    progress: {
      track:  "#CBFBF1",
      fill:   "linear-gradient(90deg, #00D492 0%, #00BBA7 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "12px", border: "1px solid #CBFBF1" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(0, 153, 102, 0.06)",
        divider:       "#CBFBF1",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.96)", text: "#101828" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#009966",
    },
  },
};
