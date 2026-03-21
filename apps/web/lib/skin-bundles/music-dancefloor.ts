/**
 * Token bundle for the "Dancefloor" skin (music-dancefloor).
 * Deep purple-black with electric blue-to-cyan gradient, Inter w700 typography, electric glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 29 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const musicDancefloorTokens: SkinTokens = {
  id: SkinId.MusicDancefloor,
  name: "Dancefloor",
  description: "Warm amber lights on a dark dance floor",

  color: {
    background: {
      default: "#0C0018",
      elevated: "#160028",
      hero: "#060010",
      surface: "#100020",
      gradient: "linear-gradient(135deg, #0C0018 0%, #00102A 100%)",
    },
    border: { subtle: "rgba(56, 189, 248, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#7DD3FC",
    },
    accent: { primary: "#38BDF8", secondary: "#818CF8" },
    accentHover: "#56CCF8",
    semantic: {
      success: "#22D3EE",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#38BDF8",
      actionReflect: "#818CF8",
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
    sm: "0 0 12px rgba(56, 189, 248, 0.2)",
    md: "0 0 30px rgba(56, 189, 248, 0.35)",
    lg: "0 0 70px rgba(56, 189, 248, 0.5)",
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
      shadow: "0 0 25px rgba(56, 189, 248, 0.2)",
      border: "1px solid rgba(56, 189, 248, 0.2)",
    },
    chip:  { background: "rgba(56, 189, 248, 0.1)", text: "#38BDF8", radius: "9999px" },
    badge: { info: { background: "rgba(56, 189, 248, 0.1)", text: "#38BDF8" } },
    progress: {
      track:  "rgba(56, 189, 248, 0.15)",
      fill:   "linear-gradient(90deg, #38BDF8 0%, #818CF8 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(56, 189, 248, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#0C0018",
        activeChapter: "rgba(56, 189, 248, 0.08)",
        divider:       "rgba(56, 189, 248, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(12, 0, 24, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#38BDF8",
    },
  },
};
