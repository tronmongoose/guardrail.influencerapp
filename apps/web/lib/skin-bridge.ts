/**
 * Bridge between the legacy Skin interface and the new SkinTokens system.
 *
 * Provides bidirectional conversion so existing preview components keep working
 * while new code can use the richer token set.
 */

import type { Skin } from "./skins";
import type { SkinTokens, SkinId } from "@guide-rail/shared";

/** Default typography shared across all auto-converted skins */
const DEFAULT_TYPOGRAPHY: SkinTokens["text"] = {
  heading: {
    display: { font: "inherit", size: "2.25rem", weight: "700", lineHeight: "1.1" },
    xl: { font: "inherit", size: "1.875rem", weight: "700", lineHeight: "1.2" },
    lg: { font: "inherit", size: "1.25rem", weight: "600", lineHeight: "1.3" },
    md: { font: "inherit", size: "1rem", weight: "600", lineHeight: "1.4" },
  },
  body: {
    md: { font: "inherit", size: "1rem", weight: "400", lineHeight: "1.6" },
    sm: { font: "inherit", size: "0.875rem", weight: "400", lineHeight: "1.5" },
  },
  label: {
    sm: { font: "inherit", size: "0.75rem", weight: "500", lineHeight: "1.4" },
  },
};

/**
 * Convert a legacy Skin to a full SkinTokens bundle.
 * Fills in typography, shadows, and semantic colors with sensible defaults.
 *
 * @deprecated Prefer using the pre-built token bundles from `lib/skin-bundles/registry`
 * instead of converting legacy skins at runtime. This function auto-fills generic defaults
 * for typography and semantic colors, whereas the bundles have curated values per skin.
 */
export function skinToTokens(skin: Skin): SkinTokens {
  const isRounded = skin.videoFrame === "rounded";
  const radiusTokens = {
    sm: isRounded ? "4px" : "2px",
    md: isRounded ? "8px" : "4px",
    lg: isRounded ? "16px" : "4px",
  };

  return {
    id: skin.id as SkinId,
    name: skin.name,
    description: skin.description,
    color: {
      background: {
        default: skin.colors.bg,
        elevated: skin.colors.bgSecondary,
        hero: skin.colors.bg,
        surface: skin.colors.bgSecondary,
      },
      border: { subtle: skin.colors.border },
      text: {
        primary: skin.colors.text,
        secondary: skin.colors.textMuted,
      },
      accent: { primary: skin.colors.accent, secondary: skin.colors.accentHover },
      accentHover: skin.colors.accentHover,
      semantic: {
        success: "#22c55e",
        warning: "#eab308",
        error: "#ef4444",
        actionDo: "#eab308",
        actionReflect: "#ec4899",
      },
    },
    text: DEFAULT_TYPOGRAPHY,
    radius: radiusTokens,
    shadow: {
      sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
      md: skin.cardStyle === "elevated"
        ? "0 4px 6px -1px rgba(0,0,0,0.1)"
        : "none",
      lg: "0 25px 50px -12px rgba(0,0,0,0.25)",
    },
    motion: {
      transition: { duration: "300ms", easing: "ease-out" },
    },
    component: {
      button: {
        primary: {
          variant: skin.buttonStyle,
          radius: isRounded ? "9999px" : radiusTokens.md,
        },
        secondary: {
          variant: "outline",
          radius: radiusTokens.md,
        },
      },
      card: {
        radius: radiusTokens.md,
        shadow: skin.cardStyle === "elevated"
          ? "0 4px 6px -1px rgba(0,0,0,0.1)"
          : "none",
        border: `1px solid ${skin.colors.border}`,
      },
      chip: {
        background: skin.colors.accent + "20",
        text: skin.colors.accent,
        radius: isRounded ? "9999px" : radiusTokens.sm,
      },
      badge: {
        info: {
          background: skin.colors.accent + "10",
          text: skin.colors.accent,
        },
      },
      progress: {
        track: skin.colors.bgSecondary,
        fill: skin.colors.accent,
        radius: radiusTokens.sm,
      },
      video: {
        frame: {
          radius: isRounded ? radiusTokens.lg : radiusTokens.sm,
          border: `1px solid ${skin.colors.border}`,
        },
      },
      viewer: {
        chapterRail: {
          background: skin.colors.bgSecondary,
          activeChapter: skin.colors.accent + "15",
          divider: skin.colors.border,
        },
        overlay: {
          titleCard: {
            background: skin.colors.bg + "dd",
            text: skin.colors.text,
          },
          transition: {
            style: "FADE",
            durationMs: 500,
          },
        },
        controlsTint: skin.colors.accent,
      },
    },
  };
}

/**
 * Convert SkinTokens back to legacy Skin for backward compatibility.
 * Allows new token bundles to work with existing preview components.
 */
export function tokensToSkin(tokens: SkinTokens): Skin {
  const isRounded = parseInt(tokens.component.video.frame.radius) >= 12;
  return {
    id: tokens.id,
    name: tokens.name,
    description: tokens.description,
    colors: {
      bg: tokens.color.background.default,
      bgSecondary: tokens.color.background.elevated,
      text: tokens.color.text.primary,
      textMuted: tokens.color.text.secondary,
      accent: tokens.color.accent.primary,
      accentHover: tokens.color.accentHover,
      border: tokens.color.border.subtle,
    },
    videoFrame: isRounded ? "rounded" : "sharp",
    buttonStyle: tokens.component.button.primary.variant,
    cardStyle: tokens.shadow.md === "none" ? "flat"
      : tokens.shadow.md.includes("rgba") ? "elevated"
      : "bordered",
  };
}

/**
 * Generate CSS custom properties from SkinTokens.
 * Emits both legacy --skin-* vars and new --token-* vars for gradual migration.
 */
export function getTokenCSSVars(tokens: SkinTokens): Record<string, string> {
  return {
    // Legacy CSS var names (backward compatible with getSkinCSSVars)
    "--skin-bg": tokens.color.background.default,
    "--skin-bg-secondary": tokens.color.background.elevated,
    "--skin-text": tokens.color.text.primary,
    "--skin-text-muted": tokens.color.text.secondary,
    "--skin-accent": tokens.color.accent.primary,
    "--skin-accent-hover": tokens.color.accentHover,
    "--skin-border": tokens.color.border.subtle,

    // --- Color tokens ---
    "--token-color-bg-default": tokens.color.background.default,
    "--token-color-bg-elevated": tokens.color.background.elevated,
    "--token-color-bg-hero": tokens.color.background.hero,
    "--token-color-bg-surface": tokens.color.background.surface,
    ...(tokens.color.background.gradient
      ? { "--token-color-bg-gradient": tokens.color.background.gradient }
      : {}),
    "--token-color-border-subtle": tokens.color.border.subtle,
    "--token-color-text-primary": tokens.color.text.primary,
    "--token-color-text-secondary": tokens.color.text.secondary,
    "--token-color-accent": tokens.color.accent.primary,
    "--token-color-accent-secondary": tokens.color.accent.secondary,
    "--token-color-accent-hover": tokens.color.accentHover,
    "--token-color-semantic-success": tokens.color.semantic.success,
    "--token-color-semantic-warning": tokens.color.semantic.warning,
    "--token-color-semantic-error": tokens.color.semantic.error,
    "--token-color-semantic-action-do": tokens.color.semantic.actionDo,
    "--token-color-semantic-action-reflect": tokens.color.semantic.actionReflect,

    // --- Motion tokens ---
    "--token-motion-duration": tokens.motion.transition.duration,
    "--token-motion-easing": tokens.motion.transition.easing,

    // --- Radius & shadow tokens ---
    "--token-radius-sm": tokens.radius.sm,
    "--token-radius-md": tokens.radius.md,
    "--token-radius-lg": tokens.radius.lg,
    "--token-shadow-sm": tokens.shadow.sm,
    "--token-shadow-md": tokens.shadow.md,
    "--token-shadow-lg": tokens.shadow.lg,

    // --- Typography tokens ---
    "--token-text-heading-display-font": tokens.text.heading.display.font,
    "--token-text-heading-display-size": tokens.text.heading.display.size,
    "--token-text-heading-display-weight": tokens.text.heading.display.weight,
    "--token-text-heading-display-line-height": tokens.text.heading.display.lineHeight,
    "--token-text-heading-xl-font": tokens.text.heading.xl.font,
    "--token-text-heading-xl-size": tokens.text.heading.xl.size,
    "--token-text-heading-xl-weight": tokens.text.heading.xl.weight,
    "--token-text-heading-xl-line-height": tokens.text.heading.xl.lineHeight,
    "--token-text-heading-lg-font": tokens.text.heading.lg.font,
    "--token-text-heading-lg-size": tokens.text.heading.lg.size,
    "--token-text-heading-lg-weight": tokens.text.heading.lg.weight,
    "--token-text-heading-lg-line-height": tokens.text.heading.lg.lineHeight,
    "--token-text-heading-md-font": tokens.text.heading.md.font,
    "--token-text-heading-md-size": tokens.text.heading.md.size,
    "--token-text-heading-md-weight": tokens.text.heading.md.weight,
    "--token-text-heading-md-line-height": tokens.text.heading.md.lineHeight,
    "--token-text-body-md-font": tokens.text.body.md.font,
    "--token-text-body-md-size": tokens.text.body.md.size,
    "--token-text-body-md-weight": tokens.text.body.md.weight,
    "--token-text-body-md-line-height": tokens.text.body.md.lineHeight,
    "--token-text-body-sm-font": tokens.text.body.sm.font,
    "--token-text-body-sm-size": tokens.text.body.sm.size,
    "--token-text-body-sm-weight": tokens.text.body.sm.weight,
    "--token-text-body-sm-line-height": tokens.text.body.sm.lineHeight,
    "--token-text-label-sm-font": tokens.text.label.sm.font,
    "--token-text-label-sm-size": tokens.text.label.sm.size,
    "--token-text-label-sm-weight": tokens.text.label.sm.weight,
    "--token-text-label-sm-line-height": tokens.text.label.sm.lineHeight,

    // --- Component tokens ---
    "--token-comp-btn-primary-variant": tokens.component.button.primary.variant,
    "--token-comp-btn-primary-radius": tokens.component.button.primary.radius,
    "--token-comp-btn-secondary-variant": tokens.component.button.secondary.variant,
    "--token-comp-btn-secondary-radius": tokens.component.button.secondary.radius,
    "--token-comp-card-radius": tokens.component.card.radius,
    "--token-comp-card-shadow": tokens.component.card.shadow,
    "--token-comp-card-border": tokens.component.card.border,
    "--token-comp-chip-bg": tokens.component.chip.background,
    "--token-comp-chip-text": tokens.component.chip.text,
    "--token-comp-chip-radius": tokens.component.chip.radius,
    "--token-comp-badge-info-bg": tokens.component.badge.info.background,
    "--token-comp-badge-info-text": tokens.component.badge.info.text,
    "--token-comp-progress-track": tokens.component.progress.track,
    "--token-comp-progress-fill": tokens.component.progress.fill,
    "--token-comp-progress-radius": tokens.component.progress.radius,
    "--token-comp-video-radius": tokens.component.video.frame.radius,
    "--token-comp-video-border": tokens.component.video.frame.border,

    // --- Viewer tokens ---
    "--token-comp-viewer-rail-bg": tokens.component.viewer.chapterRail.background,
    "--token-comp-viewer-rail-active": tokens.component.viewer.chapterRail.activeChapter,
    "--token-comp-viewer-rail-divider": tokens.component.viewer.chapterRail.divider,
    "--token-comp-viewer-overlay-bg": tokens.component.viewer.overlay.titleCard.background,
    "--token-comp-viewer-overlay-text": tokens.component.viewer.overlay.titleCard.text,
    "--token-comp-viewer-controls-tint": tokens.component.viewer.controlsTint,
  };
}
