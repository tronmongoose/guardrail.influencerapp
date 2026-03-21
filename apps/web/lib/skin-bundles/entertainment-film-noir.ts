/**
 * Token bundle for the "Film Noir" skin (entertainment-film-noir).
 * Near-black charcoal with white high-contrast palette, Georgia serif typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 25 (node 1:10581)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "Georgia, 'Times New Roman', serif";

export const entertainmentFilmNoirTokens: SkinTokens = {
  id: SkinId.EntertainmentFilmNoir,
  name: "Film Noir",
  description: "Dark cinematic drama with a pink spotlight",

  color: {
    background: {
      default: "#09090B",
      elevated: "#18181B",
      hero: "#000000",
      surface: "#27272A",
    },
    border: { subtle: "#364153" },
    text: {
      primary: "#FFFFFF",
      secondary: "#99A1AF",
    },
    accent: { primary: "#E5E7EB", secondary: "#99A1AF" },
    accentHover: "#FFFFFF",
    semantic: {
      success: "#4CAF7D",
      warning: "#FFDF20",
      error:   "#FF4757",
      actionDo:      "#E5E7EB",
      actionReflect: "#99A1AF",
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
    sm: "0px 1px 2px rgba(0,0,0,0.5), 0px 1px 3px rgba(0,0,0,0.5)",
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
      border: "1px solid #364153",
    },
    chip:  { background: "#27272A", text: "#E5E7EB", radius: "4px" },
    badge: { info: { background: "#27272A", text: "#E5E7EB" } },
    progress: {
      track:  "#27272A",
      fill:   "#E5E7EB",
      radius: "2px",
    },
    video: { frame: { radius: "4px", border: "1px solid #364153" } },
    viewer: {
      chapterRail: {
        background:    "#09090B",
        activeChapter: "rgba(229, 231, 235, 0.08)",
        divider:       "#364153",
      },
      overlay: {
        titleCard:  { background: "rgba(9, 9, 11, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 400 },
      },
      controlsTint: "#E5E7EB",
    },
  },
};
