/**
 * Token bundle for the "Soundwave" skin (music-soundwave).
 * Pure black with purple-to-pink gradient, Inter w700 typography, purple glows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 27 (node 1:11466)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const musicSoundwaveTokens: SkinTokens = {
  id: SkinId.MusicSoundwave,
  name: "Soundwave",
  description: "Music visualizer energy in gold and purple",

  color: {
    background: {
      default: "#000000",
      elevated: "#0A0A0A",
      hero: "#000000",
      surface: "#050505",
      gradient: "linear-gradient(90deg, #AD46FF 0%, #F6339A 100%)",
    },
    border: { subtle: "rgba(173, 70, 255, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#DAB2FF",
    },
    accent: { primary: "#AD46FF", secondary: "#F6339A" },
    accentHover: "#C27AFF",
    semantic: {
      success: "#4CAF7D",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#AD46FF",
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

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 20px rgba(168, 85, 247, 0.3)",
    md: "0 0 30px rgba(168, 85, 247, 0.6)",
    lg: "0 0 80px rgba(168, 85, 247, 0.6)",
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
      radius: "12px",
      shadow: "0 0 20px rgba(168, 85, 247, 0.3)",
      border: "1px solid rgba(173, 70, 255, 0.25)",
    },
    chip:  { background: "rgba(173, 70, 255, 0.1)", text: "#AD46FF", radius: "9999px" },
    badge: { info: { background: "rgba(173, 70, 255, 0.1)", text: "#AD46FF" } },
    progress: {
      track:  "rgba(173, 70, 255, 0.15)",
      fill:   "linear-gradient(90deg, #AD46FF 0%, #F6339A 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(173, 70, 255, 0.25)" } },
    viewer: {
      chapterRail: {
        background:    "#000000",
        activeChapter: "rgba(173, 70, 255, 0.1)",
        divider:       "rgba(173, 70, 255, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(0, 0, 0, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#AD46FF",
    },
  },
};
