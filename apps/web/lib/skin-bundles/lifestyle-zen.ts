/**
 * Token bundle for the "Zen Garden" skin (lifestyle-zen).
 * Warm stone white with forest green accent, Inter w300 ultralight typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 16 (node 1:6611)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const lifestyleZenTokens: SkinTokens = {
  id: SkinId.LifestyleZen,
  name: "Zen Garden",
  description: "Calm neutrals and mindful whitespace",

  color: {
    background: {
      default: "#FAFAF9",
      elevated: "#F5F5F4",
      hero: "#FAFAF9",
      surface: "#F9FAFB",
      gradient: "linear-gradient(135deg, #44403B 0%, #016630 100%)",
    },
    border: { subtle: "#E7E5E4" },
    text: {
      primary: "#292524",
      secondary: "#79716B",
    },
    accent: { primary: "#008236", secondary: "#016630" },
    accentHover: "#009940",
    semantic: {
      success: "#008236",
      warning: "#D97706",
      error:   "#DC2626",
      actionDo:      "#008236",
      actionReflect: "#016630",
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
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.62" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "300", lineHeight: "1.33" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },

  motion: {
    transition: { duration: "200ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "4px" },
      secondary: { variant: "outline", radius: "4px" },
    },
    card: {
      radius: "8px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
      border: "1px solid #E7E5E4",
    },
    chip:  { background: "#F5F5F4", text: "#008236", radius: "4px" },
    badge: { info: { background: "#F5F5F4", text: "#008236" } },
    progress: {
      track:  "#E7E5E4",
      fill:   "#008236",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #E7E5E4" } },
    viewer: {
      chapterRail: {
        background:    "#FAFAF9",
        activeChapter: "rgba(0, 130, 54, 0.06)",
        divider:       "#E7E5E4",
      },
      overlay: {
        titleCard:  { background: "rgba(250, 250, 249, 0.96)", text: "#292524" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#008236",
    },
  },
};
