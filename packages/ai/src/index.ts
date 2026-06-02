// Embeddings + clustering are no longer used by the generation pipeline
// but are still consumed by the auto-structure endpoint.
export { getEmbeddings } from "./hf-embeddings";
export { clusterEmbeddings } from "./clustering";

export { generateProgramDraft, extractContentDigests } from "./llm-adapter";
export type { ContentDigest, EnrichedContentDigest } from "./llm-adapter";
export { generateWithStub, generateStubContentDigest } from "./llm-stub";
export { transcribeAudio } from "./whisper";
export type { TranscribeOptions, TranscribeResult } from "./whisper";

// Gemini video analysis — kept available for future re-enable of multimodal analysis
export { analyzeVideoWithGemini, analyzeUploadedVideoWithGemini } from "./gemini-video-analyzer";

// Clip distribution — deterministic video-to-lesson assignment
export { distributeClipsToLessons, validateAndFixClipDistribution, validateDraftQuality, formatDistributionPlanForPrompt } from "./clip-distributor";
export type { TopicClip, LessonAssignment, DistributionPlan } from "./clip-distributor";

// Smart lesson-count presets for the wizard
export { computeSmartPresets, computeGuardrailedLessonCount } from "./lesson-presets";
export type { VideoInfo, LessonPreset } from "./lesson-presets";

// AI model constants — single source of truth for model IDs
export {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_VIDEO_MODEL,
  DEFAULT_GEMINI_ANALYSIS_TIMEOUT_MS,
  GEMINI_API_BASE,
  getGeminiTextModel,
  getGeminiVideoModel,
  getGeminiAnalysisTimeoutMs,
} from "./constants";
