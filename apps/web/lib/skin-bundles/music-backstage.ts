/**
 * Token bundle for the "Backstage" skin (music-backstage).
 * Near-black #18181B with vivid amber-to-gold gradient, Inter w700 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 28 (node 1:11904)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const musicBackstageTokens: SkinTokens = {
  id: SkinId.MusicBackstage,
  name: "Backstage",
  description: "Concert dark with violet and magenta",

  color: {
    background: {
      default: "#18181B",
      elevated: "#09090B",
      hero: "#000000",
      surface: "#1C1C1F",
      gradient: "linear-gradient(90deg, #FE9A00 0%, #F0B100 100%)",
    },
    border: { subtle: "rgba(254, 154, 0, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#FE9A00", secondary: "#F0B100" },
    accentHover: "#FFA31A",
    semantic: {
      success: "#4CAF7D",
      warning: "#F0B100",
      error:   "#FF4757",
      actionDo:      "#FE9A00",
      actionReflect: "#F0B100",
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
    sm: "0 0 12px rgba(254, 154, 0, 0.2)",
    md: "0 0 25px rgba(254, 154, 0, 0.35)",
    lg: "0 0 50px rgba(254, 154, 0, 0.5)",
  },

  motion: {
    transition: { duration: "200ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0 0 20px rgba(254, 154, 0, 0.2)",
      border: "1px solid rgba(254, 154, 0, 0.2)",
    },
    chip:  { background: "rgba(254, 154, 0, 0.1)", text: "#FE9A00", radius: "9999px" },
    badge: { info: { background: "rgba(254, 154, 0, 0.1)", text: "#FE9A00" } },
    progress: {
      track:  "rgba(254, 154, 0, 0.15)",
      fill:   "linear-gradient(90deg, #FE9A00 0%, #F0B100 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(254, 154, 0, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#18181B",
        activeChapter: "rgba(254, 154, 0, 0.1)",
        divider:       "rgba(254, 154, 0, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(24, 24, 27, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#FE9A00",
    },
  },
};
