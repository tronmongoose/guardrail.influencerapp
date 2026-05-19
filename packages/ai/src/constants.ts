/**
 * AI model constants — single source of truth for all model IDs.
 *
 * Override at runtime via environment variables:
 *   GEMINI_VIDEO_MODEL — overrides DEFAULT_GEMINI_VIDEO_MODEL (multimodal video analysis)
 *   GEMINI_TEXT_MODEL  — overrides DEFAULT_GEMINI_TEXT_MODEL (curriculum + text generation)
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
