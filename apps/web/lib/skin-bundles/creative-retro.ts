/**
 * Token bundle for the "Retro Arcade" skin (creative-retro).
 * Pure black with neon magenta + cyan accents, heavy uppercase typography, vivid glow effects.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 7 (node 1:2639)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const creativeRetroTokens: SkinTokens = {
  id: SkinId.CreativeRetro,
  name: "Retro Arcade",
  description: "Pixel nostalgia and neon glow",

  color: {
    background: {
      default: "#030712",
      elevated: "#0D1117",
      hero: "#030712",
      surface: "#050712",
      gradient: "linear-gradient(135deg, #030712 0%, #1A003D 50%, #003D2A 100%)",
    },
    border: { subtle: "rgba(225, 42, 251, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#53EAFD",
    },
    accent: { primary: "#E12AFB", secondary: "#00D3F3" },
    accentHover: "#EE5CFC",
    semantic: {
      success: "#53EAFD",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#E12AFB",
      actionReflect: "#00D3F3",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "900", lineHeight: "1.0" },
      xl:      { font: FONT, size: "48px", weight: "900", lineHeight: "1.1" },
      lg:      { font: FONT, size: "30px", weight: "900", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "900", lineHeight: "1.2" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "900", lineHeight: "1.4" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 12px rgba(217, 70, 239, 0.2)",
    md: "0 0 30px rgba(217, 70, 239, 0.4)",
    lg: "0 0 60px rgba(217, 70, 239, 0.5)",
  },

  motion: {
    transition: { duration: "300ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0 0 30px rgba(217, 70, 239, 0.25)",
      border: "1px solid rgba(225, 42, 251, 0.3)",
    },
    chip:  { background: "rgba(225, 42, 251, 0.1)", text: "#E12AFB", radius: "9999px" },
    badge: { info: { background: "rgba(225, 42, 251, 0.1)", text: "#E12AFB" } },
    progress: {
      track:  "rgba(225, 42, 251, 0.15)",
      fill:   "linear-gradient(90deg, #E12AFB 0%, #00D3F3 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(225, 42, 251, 0.3)" } },
    viewer: {
      chapterRail: {
        background:    "#030712",
        activeChapter: "rgba(225, 42, 251, 0.12)",
        divider:       "#00D3F3",
      },
      overlay: {
        titleCard:  { background: "rgba(3, 7, 18, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 400 },
      },
      controlsTint: "#E12AFB",
    },
  },
};
