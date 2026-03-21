/**
 * Token bundle for the "Elegant" skin (classic-elegant).
 * Warm ivory canvas, rich antique-gold accent, refined light-weight typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 6 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const classicElegantTokens: SkinTokens = {
  id: SkinId.ClassicElegant,
  name: "Elegant",
  description: "Refined tones with a luxury feel",

  color: {
    background: {
      default: "#FFFDF7",
      elevated: "#FFFFFF",
      hero: "#FFFDF7",
      surface: "#FAF7EF",
      gradient: "linear-gradient(135deg, #FFFDF7 0%, #F5EDD8 100%)",
    },
    border: { subtle: "#E8DFC8" },
    text: {
      primary: "#1C1917",
      secondary: "#57534E",
    },
    accent: { primary: "#92680A", secondary: "#C89B3C" },
    accentHover: "#7A560A",
    semantic: {
      success: "#15803D",
      warning: "#92680A",
      error:   "#B91C1C",
      actionDo:      "#92680A",
      actionReflect: "#C89B3C",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "300", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "300", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "400", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "400", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.75" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.6" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "500", lineHeight: "1.4" },
    },
  },

  radius: { sm: "2px", md: "6px", lg: "12px" },

  shadow: {
    sm: "0px 1px 3px rgba(146, 104, 10, 0.08), 0px 1px 2px rgba(146, 104, 10, 0.06)",
    md: "0px 4px 8px rgba(146, 104, 10, 0.10), 0px 2px 4px rgba(146, 104, 10, 0.06)",
    lg: "0px 12px 24px rgba(146, 104, 10, 0.12), 0px 6px 12px rgba(146, 104, 10, 0.08)",
  },

  motion: {
    transition: { duration: "350ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "6px" },
      secondary: { variant: "outline", radius: "6px" },
    },
    card: {
      radius: "8px",
      shadow: "0px 4px 8px rgba(146, 104, 10, 0.08), 0px 2px 4px rgba(146, 104, 10, 0.04)",
      border: "1px solid #E8DFC8",
    },
    chip:  { background: "#F5EDD8", text: "#92680A", radius: "4px" },
    badge: { info: { background: "#F5EDD8", text: "#92680A" } },
    progress: {
      track:  "#E8DFC8",
      fill:   "linear-gradient(90deg, #92680A 0%, #C89B3C 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "6px", border: "1px solid #E8DFC8" } },
    viewer: {
      chapterRail: {
        background:    "#FFFDF7",
        activeChapter: "rgba(146, 104, 10, 0.06)",
        divider:       "#E8DFC8",
      },
      overlay: {
        titleCard:  { background: "rgba(255, 253, 247, 0.96)", text: "#1C1917" },
        transition: { style: "FADE", durationMs: 400 },
      },
      controlsTint: "#92680A",
    },
  },
};
