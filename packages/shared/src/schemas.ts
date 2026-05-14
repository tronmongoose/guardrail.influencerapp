import { z } from "zod";

// --- Enums ---

export const ActionTypeSchema = z.enum(["watch", "read", "do", "reflect"]);

export const PacingModeSchema = z.enum([
  "drip_by_week",      // Weekly release: content unlocks on a time-based schedule
  "unlock_on_complete", // Staged: next session/week unlocks after completing the current one
]);

// --- Action ---

export const ActionSchema = z.object({
  id: z.string().optional(), // set by DB on persist
  title: z.string().min(1).max(200),
  type: ActionTypeSchema,
  instructions: z.string().max(2000).optional(),
  reflectionPrompt: z.string().max(1000).optional(),
  youtubeVideoId: z.string().optional(), // references YouTubeVideo
  orderIndex: z.number().int().min(0),
});

// --- Session ---

export const SessionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  keyTakeaways: z.array(z.string().max(200)).max(5).optional(), // 2-3 key takeaway bullets
  orderIndex: z.number().int().min(0),
  actions: z.array(ActionSchema).min(1),
  // Optional scene-based lesson data (populated when VideoAnalysis is available)
  clips: z.array(z.lazy(() => SessionClipSchema)).optional(),
  overlays: z.array(z.lazy(() => SessionOverlaySchema)).optional(),
});

// --- Week ---

export const WeekSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  weekNumber: z.number().int().min(1),
  sessions: z.array(SessionSchema).min(1),
});

// --- Program Draft JSON (full structure) ---

export const ProgramDraftSchema = z.object({
  programId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  pacingMode: PacingModeSchema,
  durationWeeks: z.number().int().min(1).max(52),
  weeks: z.array(WeekSchema).min(1),
});

// --- YouTube URL parsing ---

export const YouTubeUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const u = new URL(url);
        return (
          (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
          u.searchParams.has("v")
        ) || (u.hostname === "youtu.be" && u.pathname.length > 1);
      } catch {
        return false;
      }
    },
    { message: "Must be a valid YouTube URL" }
  );

// --- Cluster result (used between AI stages) ---

export const ClusterGroupSchema = z.object({
  clusterId: z.number().int().min(0),
  label: z.string(),
  videoIds: z.array(z.string()),
  summary: z.string().optional(),
});

export const ClusterResultSchema = z.object({
  programId: z.string(),
  clusters: z.array(ClusterGroupSchema),
});

// --- Program Status ---

export const ProgramStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

// --- Program List Item (for /api/programs response) ---

export const ProgramListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().nullable(),
  status: ProgramStatusSchema,
  published: z.boolean(),
  durationWeeks: z.number().int(),
  priceInCents: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  _count: z.object({
    videos: z.number().int(),
    weeks: z.number().int(),
  }),
});

export const ProgramListResponseSchema = z.array(ProgramListItemSchema);

// --- Composite Session (multi-clip playlist) ---

export const TransitionTypeSchema = z.enum(["NONE", "FADE", "CROSSFADE", "SLIDE_LEFT"]);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const OverlayTypeSchema = z.enum([
  "TITLE_CARD",
  "CHAPTER_TITLE",
  "KEY_POINTS",
  "LOWER_THIRD",
  "CTA",
  "OUTRO",
]);
export type OverlayType = z.infer<typeof OverlayTypeSchema>;

export const OverlayPositionSchema = z.enum(["CENTER", "BOTTOM", "TOP", "LOWER_THIRD"]);
export type OverlayPosition = z.infer<typeof OverlayPositionSchema>;

export const SessionClipSchema = z.object({
  id: z.string().optional(),
  youtubeVideoId: z.string(),
  startSeconds: z.number().min(0).optional(),
  endSeconds: z.number().min(0).optional(),
  orderIndex: z.number().int().min(0),
  transitionType: TransitionTypeSchema.default("NONE"),
  transitionDurationMs: z.number().int().min(0).max(5000).default(500),
  chapterTitle: z.string().max(200).optional(),
  chapterDescription: z.string().max(500).optional(),
});
export type SessionClipInput = z.infer<typeof SessionClipSchema>;

export const SessionOverlaySchema = z.object({
  id: z.string().optional(),
  type: OverlayTypeSchema,
  content: z.record(z.unknown()),
  clipOrderIndex: z.number().int().min(0).optional(),
  triggerAtSeconds: z.number().min(0).optional(),
  durationMs: z.number().int().min(0).max(60000).default(5000),
  position: OverlayPositionSchema.default("CENTER"),
  orderIndex: z.number().int().min(0),
});
export type SessionOverlayInput = z.infer<typeof SessionOverlaySchema>;

export const CompositeSessionSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  thumbnailUrl: z.string().url().optional(),
  autoAdvance: z.boolean().default(true),
  clips: z.array(SessionClipSchema).min(1),
  overlays: z.array(SessionOverlaySchema).default([]),
});
export type CompositeSessionInput = z.infer<typeof CompositeSessionSchema>;

// --- Video Analysis (Gemini-generated structured analysis) ---

// Gemini frequently returns `null` for fields it couldn't infer (e.g.,
// speakerName on a segment where no speaker is identifiable). Treating those
// as schema violations rejects the entire analysis — catastrophic for an
// optional, low-stakes field. Every optional field below uses `.nullish()`
// so we accept both `null` and `undefined`. Consumers already handle both via
// `?? []` and equality checks.
export const TimestampedSegmentSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  text: z.string(),
  topic: z.string().nullish(),
  speakerName: z.string().nullish(),
});
export type TimestampedSegment = z.infer<typeof TimestampedSegmentSchema>;

export const VideoTopicSchema = z.object({
  label: z.string(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  subtopics: z.array(z.string()).nullish(),
});
export type VideoTopic = z.infer<typeof VideoTopicSchema>;

export const VideoKeyMomentSchema = z.object({
  timestampSeconds: z.number().min(0),
  description: z.string(),
  significance: z.enum(["high", "medium", "low"]).nullish(),
  type: z.enum(["insight", "example", "exercise", "transition", "summary"]).nullish(),
});
export type VideoKeyMoment = z.infer<typeof VideoKeyMomentSchema>;

export const VideoPersonSchema = z.object({
  name: z.string(),
  role: z.string().nullish(),
});
export type VideoPerson = z.infer<typeof VideoPersonSchema>;

export const VideoAnalysisOutputSchema = z.object({
  summary: z.string(),
  fullTranscript: z.string().nullish(),
  segments: z.array(TimestampedSegmentSchema),
  topics: z.array(VideoTopicSchema),
  keyMoments: z.array(VideoKeyMomentSchema).nullish(),
  people: z.array(VideoPersonSchema).nullish(),
  durationSeconds: z.number().nullish(),
});
export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisOutputSchema>;
