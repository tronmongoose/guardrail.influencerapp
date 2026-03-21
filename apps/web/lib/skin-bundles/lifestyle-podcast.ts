/**
 * Token bundle for the "Podcast Booth" skin (lifestyle-podcast).
 * Rich slate with electric coral-red accent, Inter w700 typography, flat shadows.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 18 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const lifestylePodcastTokens: SkinTokens = {
  id: SkinId.LifestylePodcast,
  name: "Podcast Booth",
  description: "On-air teal energy for live creators",

  color: {
    background: {
      default: "#18181B",
      elevated: "#27272A",
      hero: "#09090B",
      surface: "#1C1C1F",
      gradient: "linear-gradient(135deg, #18181B 0%, #3F0000 100%)",
    },
    border: { subtle: "rgba(239, 68, 68, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#A1A1AA",
    },
    accent: { primary: "#EF4444", secondary: "#F97316" },
    accentHover: "#F87171",
    semantic: {
      success: "#22C55E",
      warning: "#F97316",
      error:   "#EF4444",
      actionDo:      "#EF4444",
      actionReflect: "#F97316",
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
    sm: "0 0 12px rgba(239, 68, 68, 0.15)",
    md: "0 0 25px rgba(239, 68, 68, 0.25)",
    lg: "0 0 50px rgba(239, 68, 68, 0.35)",
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
      radius: "12px",
      shadow: "0 0 20px rgba(239, 68, 68, 0.15)",
      border: "1px solid rgba(239, 68, 68, 0.2)",
    },
    chip:  { background: "rgba(239, 68, 68, 0.1)", text: "#EF4444", radius: "9999px" },
    badge: { info: { background: "rgba(239, 68, 68, 0.1)", text: "#EF4444" } },
    progress: {
      track:  "rgba(239, 68, 68, 0.15)",
      fill:   "linear-gradient(90deg, #EF4444 0%, #F97316 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" } },
    viewer: {
      chapterRail: {
        background:    "#18181B",
        activeChapter: "rgba(239, 68, 68, 0.08)",
        divider:       "rgba(239, 68, 68, 0.15)",
      },
      overlay: {
        titleCard:  { background: "rgba(24, 24, 27, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 250 },
      },
      controlsTint: "#EF4444",
    },
  },
};
