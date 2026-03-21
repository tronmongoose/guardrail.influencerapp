/**
 * Token bundle for the "Home Gym" skin (pro-home-gym).
 * Near-black #020618 with emerald green gradient, Inter w700 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 38 (node 1:16329)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proHomeGymTokens: SkinTokens = {
  id: SkinId.ProHomeGym,
  name: "Home Gym",
  description: "Dark athletic with emerald green energy",

  color: {
    background: {
      default: "#0F172B",
      elevated: "#1D293D",
      hero: "#0F172B",
      surface: "#182035",
      gradient: "linear-gradient(90deg, #00BC7D 0%, #00BBA7 100%)",
    },
    border: { subtle: "rgba(0, 188, 125, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#00BC7D", secondary: "#00BBA7" },
    accentHover: "#00D492",
    semantic: {
      success: "#00BC7D",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#00BC7D",
      actionReflect: "#00BBA7",
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

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0px 1px 2px rgba(0,0,0,0.7)",
    md: "0px 4px 6px rgba(0,0,0,0.6), 0 0 20px rgba(0, 188, 125, 0.15)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.8)",
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
      radius: "12px",
      shadow: "0px 4px 6px rgba(0,0,0,0.6)",
      border: "1px solid rgba(0, 188, 125, 0.2)",
    },
    chip:  { background: "rgba(0, 188, 125, 0.1)", text: "#00BC7D", radius: "9999px" },
    badge: { info: { background: "rgba(0, 188, 125, 0.1)", text: "#00BC7D" } },
    progress: {
      track:  "rgba(0, 188, 125, 0.15)",
      fill:   "linear-gradient(90deg, #00BC7D 0%, #00BBA7 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(0, 188, 125, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#0F172B",
        activeChapter: "rgba(0, 188, 125, 0.1)",
        divider:       "rgba(0, 188, 125, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(15, 23, 43, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#00BC7D",
    },
  },
};
