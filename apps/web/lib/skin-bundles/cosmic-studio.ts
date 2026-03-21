/**
 * Complete token bundle for the "Cosmic Studio" skin.
 *
 * Space exploration — deep indigo cosmos with violet-to-pink gradient accents.
 */

import { SkinId } from "@guide-rail/shared";
import type { SkinTokens } from "@guide-rail/shared";

const FONT = "'Inter', system-ui, sans-serif";

export const cosmicStudioTokens: SkinTokens = {
  id: SkinId.CosmicStudio,
  name: "Cosmic Studio",
  description: "Space exploration — deep indigo cosmos with violet-to-pink gradient accents",

  color: {
    background: {
      default: "#1E1A4D",
      elevated: "#3C0366",
      hero: "#1E1A4D",
      surface: "#59168B",
      gradient: "linear-gradient(180deg, #1E1A4D 0%, #3C0366 40%, #000000 100%)",
    },
    border: { subtle: "rgba(194, 122, 255, 0.2)" },
    text: {
      primary: "#FFFFFF",
      secondary: "#E9D4FF",
    },
    accent: { primary: "#AD46FF", secondary: "#F6339A" },
    accentHover: "#FB64B6",
    semantic: {
      success: "#4CAF7D",
      warning: "#eab308",
      error: "#ef4444",
      actionDo: "#AD46FF",
      actionReflect: "#F6339A",
    },
  },

  text: {
    heading: {
      // JSON heading.display → display (72px)
      display: { font: FONT, size: "72px", weight: "700", lineHeight: "1.1" },
      // JSON heading.lg (48px) → xl slot
      xl: { font: FONT, size: "48px", weight: "700", lineHeight: "1.15" },
      // JSON heading.md (32px) → lg slot
      lg: { font: FONT, size: "32px", weight: "600", lineHeight: "1.2" },
      // JSON heading.sm (20px) → md slot
      md: { font: FONT, size: "20px", weight: "600", lineHeight: "1.3" },
    },
    body: {
      md: { font: FONT, size: "16px", weight: "400", lineHeight: "1.6" },
      sm: { font: FONT, size: "14px", weight: "400", lineHeight: "1.5" },
    },
    label: {
      sm: { font: FONT, size: "11px", weight: "600", lineHeight: "1.4" },
    },
  },

  radius: { sm: "4px", md: "8px", lg: "12px" },

  shadow: {
    sm: "0 0 12px rgba(173, 70, 255, 0.15)",
    md: "0 0 24px rgba(173, 70, 255, 0.25)",
    lg: "0 0 48px rgba(173, 70, 255, 0.35)",
  },

  motion: {
    transition: { duration: "300ms", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  },

  component: {
    button: {
      // Full gradient: linear-gradient(135deg, #AD46FF 0%, #F6339A 100%)
      // Applied by components reading color.accent.primary/secondary
      primary: { variant: "gradient", radius: "8px" },
      secondary: { variant: "outline", radius: "8px" },
    },
    card: {
      radius: "12px",
      shadow: "0 0 24px rgba(173, 70, 255, 0.15)",
      border: "1px solid #59168B",
    },
    chip: { background: "#3C0366", text: "#E9D4FF", radius: "9999px" },
    badge: { info: { background: "#3C0366", text: "#AD46FF" } },
    progress: {
      track: "#3C0366",
      // Gradient fill — interface fill: string accepts CSS gradient strings
      fill: "linear-gradient(90deg, #AD46FF 0%, #F6339A 100%)",
      radius: "9999px",
    },
    video: { frame: { radius: "8px", border: "1px solid #59168B" } },
    viewer: {
      chapterRail: {
        background: "#1E1A4D",
        activeChapter: "rgba(173, 70, 255, 0.1)",
        divider: "#F6339A",
      },
      overlay: {
        titleCard: { background: "rgba(30, 26, 77, 0.95)", text: "#FFFFFF" },
        transition: { style: "FADE", durationMs: 500 },
      },
      controlsTint: "#AD46FF",
    },
  },
};
