/**
 * Token bundle for the "Minimal" skin (classic-minimal).
 * Light mode — crisp white surfaces, strong blue accent, clean minimal shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 2 (node 1:442)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const classicMinimalTokens: SkinTokens = {
  id: SkinId.ClassicMinimal,
  name: "Minimal",
  description: "Clean and distraction-free",

  color: {
    background: {
      default: "#FFFFFF",
      elevated: "#F3F4F6",
      hero: "#FFFFFF",
      surface: "#F9FAFB",
    },
    border: { subtle: "#E5E7EB" },
    text: {
      primary: "#0A0A0A",
      secondary: "#4A5565",
    },
    accent: { primary: "#155DFC", secondary: "#2B7FFF" },
    accentHover: "#1248CC",
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      error: "#DC2626",
      actionDo: "#155DFC",
      actionReflect: "#7C3AED",
    },
  },

  text: {
    heading: {
      display: { font: FONT, size: "72px", weight: "300", lineHeight: "1.1" },
      xl:      { font: FONT, size: "48px", weight: "700", lineHeight: "1.15" },
      lg:      { font: FONT, size: "30px", weight: "700", lineHeight: "1.2" },
      md:      { font: FONT, size: "24px", weight: "700", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "700", lineHeight: "1.4" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)",
    md: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
    lg: "0px 8px 10px -6px rgba(0,0,0,0.1), 0px 20px 25px -5px rgba(0,0,0,0.1)",
  },

  motion: {
    transition: { duration: "200ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "solid",   radius: "8px" },
      secondary: { variant: "outline", radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)",
      border: "1px solid #E5E7EB",
    },
    chip:  { background: "#EFF6FF", text: "#155DFC", radius: "9999px" },
    badge: { info: { background: "#EFF6FF", text: "#155DFC" } },
    progress: {
      track:  "#E5E7EB",
      fill:   "#155DFC",
      radius: "9999px",
    },
    video: { frame: { radius: "12px", border: "1px solid #E5E7EB" } },
    viewer: {
      chapterRail: {
        background:    "#F9FAFB",
        activeChapter: "rgba(21, 93, 252, 0.08)",
        divider:       "#E5E7EB",
      },
      overlay: {
        titleCard:  { background: "rgba(255,255,255,0.95)", text: "#0A0A0A" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#155DFC",
    },
  },
};
