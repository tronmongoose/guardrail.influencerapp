/**
 * Token bundle for the "Cinematographer" skin (media-film).
 * Near-black #09090B with vivid red accent, Georgia serif typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 31 (node 1:13230)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "Georgia, 'Times New Roman', serif";

export const mediaFilmTokens: SkinTokens = {
  id: SkinId.MediaFilm,
  name: "Cinematographer",
  description: "Deep navy dark with electric blue storytelling",

  color: {
    background: {
      default: "#09090B",
      elevated: "#18181B",
      hero: "#000000",
      surface: "#141416",
    },
    border: { subtle: "rgba(251, 44, 54, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#6A7282",
    },
    accent: { primary: "#FB2C36", secondary: "#E5E7EB" },
    accentHover: "#FF3E4A",
    semantic: {
      success: "#4CAF7D",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#FB2C36",
      actionReflect: "#E5E7EB",
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
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.43" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "400", lineHeight: "1.33" },
    },
  },

  radius: { sm: "2px", md: "4px", lg: "8px" },

  shadow: {
    sm: "0px 1px 2px rgba(0,0,0,0.7), 0px 1px 3px rgba(0,0,0,0.7)",
    md: "0px 4px 6px rgba(0,0,0,0.6), 0px 10px 15px rgba(0,0,0,0.6)",
    lg: "0px 25px 50px -12px rgba(0,0,0,0.8)",
  },

  motion: {
    transition: { duration: "300ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "4px" },
      secondary: { variant: "outline", radius: "4px" },
    },
    card: {
      radius: "8px",
      shadow: "0px 4px 6px rgba(0,0,0,0.6), 0px 10px 15px rgba(0,0,0,0.6)",
      border: "1px solid rgba(251, 44, 54, 0.2)",
    },
    chip:  { background: "rgba(251, 44, 54, 0.1)", text: "#FB2C36", radius: "4px" },
    badge: { info: { background: "rgba(251, 44, 54, 0.1)", text: "#FB2C36" } },
    progress: {
      track:  "rgba(251, 44, 54, 0.15)",
      fill:   "#FB2C36",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid rgba(251, 44, 54, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#09090B",
        activeChapter: "rgba(251, 44, 54, 0.08)",
        divider:       "rgba(251, 44, 54, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(9, 9, 11, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 400 },
      },
      controlsTint: "#FB2C36",
    },
  },
};
