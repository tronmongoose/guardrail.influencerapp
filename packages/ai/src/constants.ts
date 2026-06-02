/**
 * AI model constants — single source of truth for all model IDs.
 *
 * Override at runtime via environment variables:
 *   GEMINI_VIDEO_MODEL — overrides DEFAULT_GEMINI_VIDEO_MODEL (multimodal video analysis)
 *   GEMINI_TEXT_MODEL  — overrides DEFAULT_GEMINI_TEXT_MODEL (curriculum + text generation)
 *   GEMINI_ANALYSIS_TIMEOUT_MS — overrides the base analysis timeout (ms).
 *     The resolver also adds duration-tiered headroom — see
 *     getGeminiAnalysisTimeoutMs() below.
 */

/** Default Gemini model for multimodal video analysis (Files API + YouTube direct) */
export const DEFAULT_GEMINI_VIDEO_MODEL = "gemini-3.1-pro-preview";

/** Default Gemini model for text generation (curriculum, content extraction, skin generation) */
export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-3-flash-preview";

/** Gemini API base URL */
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Resolve the Gemini video model from env or fallback to default */
export function getGeminiVideoModel(): string {
  return process.env.GEMINI_VIDEO_MODEL || DEFAULT_GEMINI_VIDEO_MODEL;
}

/** Resolve the Gemini text model from env or fallback to default */
export function getGeminiTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL || DEFAULT_GEMINI_TEXT_MODEL;
}

/**
 * Base Gemini analysis timeout (ms). The 300_000 default was hardcoded;
 * 4/30 corpus videos hit it on 30+min content (qa-results 2026-05-31).
 */
export const DEFAULT_GEMINI_ANALYSIS_TIMEOUT_MS = 300_000;

/**
 * Resolve the Gemini analysis timeout with duration-tiered headroom.
 * Tiers (empirically chosen from corpus run 2026-05-31):
 *   < 10 min  → base
 *   10–30 min → base + 120s
 *   ≥ 30 min  → base + 300s
 *
 * The env override (GEMINI_ANALYSIS_TIMEOUT_MS) sets the base; tiers stack
 * on top so a 600_000 override on a 35-min video gives 900_000 wall time.
 */
export function getGeminiAnalysisTimeoutMs(videoDurationSeconds?: number): number {
  const envBase = process.env.GEMINI_ANALYSIS_TIMEOUT_MS;
  const base = envBase ? parseInt(envBase, 10) : DEFAULT_GEMINI_ANALYSIS_TIMEOUT_MS;
  if (!Number.isFinite(base) || base <= 0) return DEFAULT_GEMINI_ANALYSIS_TIMEOUT_MS;
  if (!videoDurationSeconds || videoDurationSeconds <= 0) return base;
  if (videoDurationSeconds >= 30 * 60) return base + 300_000;
  if (videoDurationSeconds >= 10 * 60) return base + 120_000;
  return base;
}
