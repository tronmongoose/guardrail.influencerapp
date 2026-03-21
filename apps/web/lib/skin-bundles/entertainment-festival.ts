/**
 * Token bundle for the "Festival Lights" skin (entertainment-festival).
 * Deep black with vivid multi-color gradient accents, Inter w900 typography, neon glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 26 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const entertainmentFestivalTokens: SkinTokens = {
  id: SkinId.EntertainmentFestival,
  name: "Festival Lights",
  description: "High-contrast event poster with serif drama",

  color: {
    background: {
      default: "#040009",
      elevated: "#0A000F",
      hero: "#000000",
      surface: "#07000C",
      gradient: "linear-gradient(135deg, #FF006E 0%, #FB5607 25%, #FFBE0B 50%, #3A86FF 75%, #8338EC 100%)",
    },
    border: { subtle: "rgba(255, 0, 110, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#C0A8D8",
    },
    accent: { primary: "#FF006E", secondary: "#FFBE0B" },
    accentHover: "#FF3385",
    semantic: {
      success: "#06D6A0",
      warning: "#FFBE0B",
      error:   "#FF4757",
      actionDo:      "#FF006E",
      actionReflect: "#FFBE0B",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "900", lineHeight: "1.0" },
      xl:      { font: FONT, size: "48px", weight: "900", lineHeight: "1.1" },
      lg:      { font: FONT, size: "30px", weight: "900", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "900", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.5" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "900", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0 0 12px rgba(255, 0, 110, 0.2)",
    md: "0 0 30px rgba(255, 0, 110, 0.35)",
    lg: "0 0 60px rgba(255, 0, 110, 0.5)",
  },

  motion: {
    transition: { duration: "250ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0 0 25px rgba(255, 0, 110, 0.2)",
      border: "1px solid rgba(255, 0, 110, 0.25)",
    },
    chip:  { background: "rgba(255, 0, 110, 0.1)", text: "#FF006E", radius: "9999px" },
    badge: { info: { background: "rgba(255, 0, 110, 0.1)", text: "#FF006E" } },
    progress: {
      track:  "rgba(255, 0, 110, 0.15)",
      fill:   "linear-gradient(90deg, #FF006E 0%, #FB5607 33%, #FFBE0B 66%, #3A86FF 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(255, 0, 110, 0.25)" } },
    viewer: {
      chapterRail: {
        background:    "#040009",
        activeChapter: "rgba(255, 0, 110, 0.1)",
        divider:       "rgba(255, 0, 110, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(4, 0, 9, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 350 },
      },
      controlsTint: "#FF006E",
    },
  },
};
