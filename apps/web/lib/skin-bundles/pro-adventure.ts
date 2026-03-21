/**
 * Token bundle for the "Adventure Camp" skin (pro-adventure).
 * Rich forest green gradient with vivid lime-green accents, Inter w700 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 44 (node 1:18984)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const proAdventureTokens: SkinTokens = {
  id: SkinId.ProAdventure,
  name: "Adventure Camp",
  description: "Trail-ready greens and rugged warmth",

  color: {
    background: {
      default: "#0D542B",
      elevated: "#155634",
      hero: "#0D542B",
      surface: "#092B1A",
      gradient: "linear-gradient(180deg, #0D542B 0%, #002C22 100%)",
    },
    border: { subtle: "rgba(5, 223, 114, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#86EFAC",
    },
    accent: { primary: "#05DF72", secondary: "#00C950" },
    accentHover: "#00F07A",
    semantic: {
      success: "#00C950",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#05DF72",
      actionReflect: "#00C950",
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
    sm: "0 0 12px rgba(5, 223, 114, 0.2)",
    md: "0 0 24px rgba(5, 223, 114, 0.3)",
    lg: "0 0 48px rgba(5, 223, 114, 0.4)",
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
      shadow: "0 0 24px rgba(5, 223, 114, 0.15)",
      border: "1px solid rgba(5, 223, 114, 0.2)",
    },
    chip:  { background: "rgba(5, 223, 114, 0.12)", text: "#05DF72", radius: "9999px" },
    badge: { info: { background: "rgba(5, 223, 114, 0.12)", text: "#05DF72" } },
    progress: {
      track:  "rgba(5, 223, 114, 0.15)",
      fill:   "linear-gradient(90deg, #00C950 0%, #00BC7D 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(5, 223, 114, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#0D542B",
        activeChapter: "rgba(5, 223, 114, 0.08)",
        divider:       "rgba(5, 223, 114, 0.2)",
      },
      overlay: {
        titleCard:  { background: "rgba(9, 43, 26, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#05DF72",
    },
  },
};
