/**
 * Smart lesson-count presets for the program creation wizard.
 *
 * Middle preset = videoCount (1 lesson per video), scaled around it:
 *   Compact:  videoCount / 2  (group videos together)
 *   Natural:  videoCount      (1 lesson per video)
 *   Detailed: videoCount * 2  (split each video into 2)
 *
 * When Gemini analysis is available, the preset whose multiplier best
 * matches the average topics-per-video gets an "AI recommends" badge.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoInfo {
  durationSeconds?: number | null;
  topicCount?: number;
}

export interface LessonPreset {
  weeks: number;
  label: string;            // "Compact" | "Natural" | "Detailed"
  ratioNote: string;        // e.g. "~8 min/lesson" or "~2 videos/lesson"
  aiRecommended?: boolean;
}

// ---------------------------------------------------------------------------
// Constants (shared with clip-distributor)
// ---------------------------------------------------------------------------

const DEFAULT_VIDEO_DURATION = 600; // 10 min fallback
const MAX_WEEKS = 12;
const MIN_LESSONS = 1;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export function computeSmartPresets(
  videoCount: number,
  videos: VideoInfo[],
): LessonPreset[] {
  // No videos — static fallback
  if (videoCount === 0) {
    return [
      { weeks: 4, label: "Compact", ratioNote: "Focused sprint" },
      { weeks: 8, label: "Natural", ratioNote: "Most popular" },
      { weeks: 12, label: "Detailed", ratioNote: "Deep dive" },
    ];
  }

  // --- Compute preset week counts ---
  // All three presets are clamped to MAX_WEEKS so creators can't exceed the
  // 12-lesson universal cap. Strict ordering compact < natural < detailed
  // is preserved by reserving headroom (compact <= MAX-2, natural <= MAX-1).
  const compact = Math.max(2, Math.min(MAX_WEEKS - 2, Math.floor(videoCount / 2)));
  const natural = Math.max(compact + 1, Math.min(MAX_WEEKS - 1, videoCount));
  let detailed = Math.min(MAX_WEEKS, videoCount * 2);
  // Ensure strict ordering
  if (detailed <= natural) detailed = Math.min(MAX_WEEKS, natural + 1);

  const presets: [number, string][] = [
    [compact, "Compact"],
    [natural, "Natural"],
    [detailed, "Detailed"],
  ];

  // --- Duration info ---
  const analyzedVideos = videos.filter(
    (v) => v.durationSeconds != null && v.durationSeconds > 0,
  );
  const hasDuration = analyzedVideos.length > 0;

  let totalDurationSeconds: number;
  if (hasDuration) {
    const knownTotal = analyzedVideos.reduce(
      (sum, v) => sum + v.durationSeconds!,
      0,
    );
    const avgDuration = knownTotal / analyzedVideos.length;
    const unknownCount = videoCount - analyzedVideos.length;
    totalDurationSeconds = knownTotal + unknownCount * avgDuration;
  } else {
    totalDurationSeconds = videoCount * DEFAULT_VIDEO_DURATION;
  }

  // --- Topic info for AI badge ---
  const totalTopics = videos.reduce(
    (sum, v) => sum + (v.topicCount ?? 0),
    0,
  );
  const hasTopics = totalTopics > 0;
  const avgTopicsPerVideo = hasTopics ? totalTopics / videoCount : 0;

  // --- Build ratio notes ---
  const makeNote = (weekCount: number): string => {
    if (hasDuration) {
      const perLesson = Math.round(totalDurationSeconds / weekCount / 60);
      return `~${perLesson} min/lesson`;
    }
    const ratio = videoCount / weekCount;
    if (ratio >= 1) {
      return `~${ratio.toFixed(1)} videos/lesson`;
    }
    const inverse = weekCount / videoCount;
    return `~${inverse.toFixed(1)} lessons/video`;
  };

  // --- AI badge: match avg topics-per-video to the preset multiplier ---
  // Multipliers: compact=0.5x, natural=1x, detailed=2x
  const multipliers = [0.5, 1, 2];
  let aiRecommendedIndex: number | undefined;
  if (hasTopics) {
    let bestDist = Infinity;
    multipliers.forEach((m, i) => {
      const dist = Math.abs(avgTopicsPerVideo - m);
      if (dist < bestDist) {
        bestDist = dist;
        aiRecommendedIndex = i;
      }
    });
  }

  return presets.map(([weeks, label], i) => ({
    weeks,
    label,
    ratioNote: makeNote(weeks),
    ...(aiRecommendedIndex === i ? { aiRecommended: true } : {}),
  }));
}

// ---------------------------------------------------------------------------
// AI-decides lesson count (replaces the route's hardcoded 4–6 clamp)
// ---------------------------------------------------------------------------

/**
 * Pick a lesson count for the aiStructured generation path.
 *
 * Single video → segment by duration (under-5 → 1, 5–20 → 2–3, 20–45 → 3–5,
 * 45+ → 5–8). Multiple videos → key off average per-video duration (under-3min
 * avg merges pairs, 3–10min avg gives 1 per video, 10+ avg allows splitting).
 * Always clamped to [MIN_LESSONS, MAX_WEEKS] (1, 12).
 *
 * Topics intentionally not used here — within-lesson clip selection
 * (clip-distributor) is the right layer for topic-aware decisions.
 */
export function computeGuardrailedLessonCount(videos: VideoInfo[]): number {
  const count = videos.length;
  if (count === 0) return MIN_LESSONS;

  const durations = videos.map(
    (v) => v.durationSeconds ?? DEFAULT_VIDEO_DURATION,
  );
  const clamp = (n: number) => Math.max(MIN_LESSONS, Math.min(MAX_WEEKS, n));

  if (count === 1) {
    const d = durations[0];
    const minutes = d / 60;
    if (d < 300) return clamp(1);                                                  // <5 min
    if (d < 1200) return clamp(Math.max(2, Math.round(minutes / 8)));              // 5–20 min
    if (d < 2700) return clamp(Math.max(3, Math.min(5, Math.floor(minutes / 8)))); // 20–45 min
    return clamp(Math.max(5, Math.min(8, Math.floor(minutes / 8))));               // 45+ min
  }

  // Multi-video: average per-video duration drives the decision
  const avg = durations.reduce((a, b) => a + b, 0) / count;
  if (avg < 180) return clamp(Math.ceil(count / 2));   // tiny avg → merge pairs
  if (avg < 600) return clamp(count);                   // 3–10 min avg → 1 per video
  return clamp(Math.min(count * 2, MAX_WEEKS));         // 10+ min avg → split
}
