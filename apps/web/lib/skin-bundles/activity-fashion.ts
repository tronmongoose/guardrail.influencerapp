/**
 * Token bundle for the "Fashion Runway" skin (activity-fashion).
 * Warm champagne ivory with rich gold-to-rose gradient, Inter w700 typography.
 * Source: Figma file P94190iyrjqLvtprXiLTKY, Page 24 (node TBD — placeholder until fetched)
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const activityFashionTokens: SkinTokens = {
  id: SkinId.ActivityFashion,
  name: "Fashion Runway",
  description: "Runway-bold rainbow energy",

  color: {
    background: {
      default: "#FAF8F5",
      elevated: "#FFFFFF",
      hero: "#FAF8F5",
      surface: "#F5F0EA",
      gradient: "linear-gradient(135deg, #FAF8F5 0%, #F5E6D3 50%, #FDE7F0 100%)",
    },
    border: { subtle: "#E8D9C8" },
    text: {
      primary: "#1A1208",
      secondary: "#6B5744",
    },
    accent: { primary: "#C8860A", secondary: "#E6487A" },
    accentHover: "#B07308",
    semantic: {
      success: "#16A34A",
      warning: "#C8860A",
      error:   "#DC2626",
      actionDo:      "#C8860A",
      actionReflect: "#E6487A",
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
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "12px", weight: "600", lineHeight: "1.33" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "16px" },

  shadow: {
    sm: "0px 1px 3px rgba(200, 134, 10, 0.08), 0px 1px 2px rgba(200, 134, 10, 0.06)",
    md: "0px 4px 8px rgba(200, 134, 10, 0.1), 0px 2px 4px rgba(200, 134, 10, 0.06)",
    lg: "0px 12px 24px rgba(200, 134, 10, 0.12), 0px 6px 12px rgba(200, 134, 10, 0.08)",
  },

  motion: {
    transition: { duration: "300ms", easing: "ease-out" },
  },

  component: {
    button: {
      primary:   { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline",  radius: "8px" },
    },
    card: {
      radius: "16px",
      shadow: "0px 4px 8px rgba(200, 134, 10, 0.08), 0px 2px 4px rgba(200, 134, 10, 0.04)",
      border: "1px solid #E8D9C8",
    },
    chip:  { background: "#F5E6D3", text: "#C8860A", radius: "9999px" },
    badge: { info: { background: "#F5E6D3", text: "#C8860A" } },
    progress: {
      track:  "#E8D9C8",
      fill:   "linear-gradient(90deg, #C8860A 0%, #E6487A 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #E8D9C8" } },
    viewer: {
      chapterRail: {
        background:    "#FAF8F5",
        activeChapter: "rgba(200, 134, 10, 0.06)",
        divider:       "#E8D9C8",
      },
      overlay: {
        titleCard:  { background: "rgba(250, 248, 245, 0.96)", text: "#1A1208" },
        transition: { style: "FADE", durationMs: 300 },
      },
      controlsTint: "#C8860A",
    },
  },
};
