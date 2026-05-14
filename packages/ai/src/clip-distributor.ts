/**
 * Clip Distributor — deterministic video-to-lesson assignment.
 *
 * Pre-computes which topic clips from which videos go to which lessons,
 * then formats the plan for injection into the LLM prompt.
 * Also provides post-validation to repair LLM output that deviates from the plan.
 */

import type { ContentDigest, EnrichedContentDigest } from "./llm-adapter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicClip {
  videoId: string;
  videoTitle: string;
  topicLabel: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  subtopics?: string[];
}

export interface LessonAssignment {
  lessonIndex: number;         // 0-based
  weekNumber: number;          // 1-based
  sessionIndex: number;        // 0 or 1 within a week
  clips: TopicClip[];
  totalDurationSeconds: number;
}

export interface DistributionPlan {
  lessons: LessonAssignment[];
  totalClips: number;
  totalDurationSeconds: number;
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** If auto-fixable, the corrected draft (same shape as ProgramDraft) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fixedDraft?: any;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CLIP_DURATION_SECONDS = 30;
const MAX_CLIPS_PER_LESSON = 6;
const TARGET_LESSON_MIN_SECONDS = 5 * 60;   // 5 min
const TARGET_LESSON_MAX_SECONDS = 15 * 60;  // 15 min
const DEFAULT_VIDEO_DURATION = 600;          // 10 min fallback

// A video gets considered for splitting if it exceeds this duration. Below
// this floor, even a multi-topic video collapses to one full-video clip
// (a 4-minute tool demo isn't worth slicing).
const MIN_DURATION_FOR_SPLIT_SECONDS = 5 * 60;

// Time-based fallback target window: when a long video's Gemini topics aren't
// thematically distinct (Jaccard ≥ 0.3), we still slice it by time so it
// doesn't land in one lesson as a single full-video clip. Aim for 5–10 min
// chunks, snapping each cut to the nearest topic boundary within ±60s.
const TARGET_CHUNK_MIN_SECONDS = 5 * 60;
const TARGET_CHUNK_MAX_SECONDS = 10 * 60;
const SNAP_WINDOW_SECONDS = 60;
const ADAPTIVE_SNAP_CEILING_SECONDS = 240;
const ADAPTIVE_SNAP_FRACTION = 0.35;
const MAX_TIME_SLICES = 8;

/**
 * Snap-window sizing for time-based slicing. A fixed 60s window is fine for
 * 5-min chunks but too tight when a long single-topic video gets cut into
 * just 2 slices — the nearest segment boundary can sit >100s from the
 * arithmetic mid (observed: 132s on upper-body-workout fixture). Scale the
 * window with the slice spacing so longer slices tolerate longer snaps,
 * capped at 240s to keep cuts within reach of their ideal location.
 */
function adaptiveSnapWindow(idealSpacing: number): number {
  return Math.min(
    ADAPTIVE_SNAP_CEILING_SECONDS,
    Math.max(SNAP_WINDOW_SECONDS, Math.round(idealSpacing * ADAPTIVE_SNAP_FRACTION)),
  );
}

function chooseChunkCount(duration: number, topicCount: number): number {
  const minCount = Math.max(1, Math.ceil(duration / TARGET_CHUNK_MAX_SECONDS));
  const maxCount = Math.max(1, Math.floor(duration / TARGET_CHUNK_MIN_SECONDS));
  // If Gemini's topic count fits in the [minCount, maxCount] window, prefer it
  // — it gives the LLM clean topic-aligned breaks. Otherwise default to fewer,
  // longer chunks (less fragmentation for the learner).
  if (topicCount >= minCount && topicCount <= maxCount) {
    return Math.min(MAX_TIME_SLICES, topicCount);
  }
  return Math.min(MAX_TIME_SLICES, minCount);
}

function timeBasedSlices(
  duration: number,
  topics: { label: string; startSeconds: number; endSeconds: number }[],
  count: number,
  segments?: { startSeconds: number; endSeconds: number }[],
): { startSeconds: number; endSeconds: number; label: string }[] {
  if (count <= 1 || duration <= 0) {
    return [{ startSeconds: 0, endSeconds: duration, label: topics[0]?.label ?? "Part 1" }];
  }

  // Snap candidates: topic endSeconds + segment endSeconds, deduped. When a
  // long video has only one broad topic (no thematic distinctness) the topic
  // boundaries alone yield no candidates and we'd cut at arithmetic midpoints,
  // straddling — or worse, splitting — Gemini segments. Including segments
  // gives the snapper finer-grained candidates so cuts land at real
  // exercise/topic transitions instead of mid-segment.
  const candidateSet = new Set<number>();
  for (const t of topics) {
    if (t.endSeconds > 0 && t.endSeconds < duration) candidateSet.add(t.endSeconds);
  }
  for (const s of segments ?? []) {
    if (s.endSeconds > 0 && s.endSeconds < duration) candidateSet.add(s.endSeconds);
  }
  const boundaries = Array.from(candidateSet);

  const idealBreaks: number[] = [];
  for (let i = 1; i < count; i++) {
    idealBreaks.push((duration * i) / count);
  }

  const snapWindow = adaptiveSnapWindow(duration / count);

  const used = new Set<number>();
  const resolved: number[] = [];
  for (const ideal of idealBreaks) {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const b of boundaries) {
      if (used.has(b)) continue;
      const dist = Math.abs(b - ideal);
      if (dist <= snapWindow && dist < bestDist) {
        best = b;
        bestDist = dist;
      }
    }
    if (best !== null) {
      used.add(best);
      resolved.push(best);
    } else {
      resolved.push(Math.round(ideal));
    }
  }
  resolved.sort((a, b) => a - b);

  const slices: { startSeconds: number; endSeconds: number; label: string }[] = [];
  let start = 0;
  for (let i = 0; i <= resolved.length; i++) {
    const end = i < resolved.length ? resolved[i] : duration;
    if (end <= start) continue; // safety against degenerate snapping
    const mid = (start + end) / 2;
    const covering = topics.find((t) => t.startSeconds <= mid && t.endSeconds >= mid);
    slices.push({ startSeconds: start, endSeconds: end, label: covering?.label ?? `Part ${slices.length + 1}` });
    start = end;
  }
  return slices;
}

function bigrams(text: string): Set<string> {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const result = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    result.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  // Fallback to unigrams for 1-word labels
  if (result.size === 0) for (const t of tokens) result.add(t);
  return result;
}

/**
 * Two topic labels count as "distinct subjects" when their bigram Jaccard
 * overlap is below 30%. Used to decide whether a long video genuinely covers
 * multiple topics or is just one topic narrated in stages.
 */
function topicsAreDistinct(a: string, b: string): boolean {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 || gb.size === 0) return true;
  let intersection = 0;
  for (const g of ga) if (gb.has(g)) intersection++;
  const union = ga.size + gb.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;
  return jaccard < 0.3;
}

/**
 * When the emergency-fill loop needs to halve a clip, prefer cutting at a
 * Gemini segment boundary near the arithmetic midpoint instead of bisecting
 * blindly. Only returns a snap point that leaves both halves at least
 * `minHalfDuration` seconds long; otherwise returns null so the caller falls
 * back to the arithmetic mid. Mirrors the snap behaviour of `timeBasedSlices`.
 */
function findSegmentSnapForSplit(
  arithmeticMid: number,
  clipStart: number,
  clipEnd: number,
  segments: { startSeconds: number; endSeconds: number }[] | undefined,
  windowSec: number,
  minHalfDuration: number,
): number | null {
  if (!segments || segments.length === 0) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const seg of segments) {
    const candidate = seg.endSeconds;
    if (candidate <= clipStart || candidate >= clipEnd) continue;
    if (candidate - clipStart < minHalfDuration) continue;
    if (clipEnd - candidate < minHalfDuration) continue;
    const dist = Math.abs(candidate - arithmeticMid);
    if (dist <= windowSec && dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Distribution Algorithm
// ---------------------------------------------------------------------------

/**
 * Build a flat list of topic clips from enriched and basic digests.
 *
 * Default is ONE clip per video. A video only contributes multiple clips
 * when its duration exceeds MIN_DURATION_FOR_SPLIT_SECONDS AND it has ≥2
 * topics whose labels are thematically distinct (see topicsAreDistinct).
 *
 * This prevents the "11 lessons from 5 short videos" pathology where every
 * Gemini topic became its own lesson.
 */
function collectClips(
  enrichedDigests: EnrichedContentDigest[],
  basicDigests: ContentDigest[],
): TopicClip[] {
  const clips: TopicClip[] = [];

  for (const digest of enrichedDigests) {
    const fullDuration = digest.durationSeconds ?? DEFAULT_VIDEO_DURATION;
    const topics = digest.topics ?? [];
    const hasMultipleTopics = topics.length >= 2;
    const longEnoughToSplit = fullDuration >= MIN_DURATION_FOR_SPLIT_SECONDS;

    // Check if the video's topics are thematically distinct enough to warrant
    // splitting. We compare every pair; if all pairs are distinct, we split.
    let shouldSplit = false;
    if (hasMultipleTopics && longEnoughToSplit) {
      shouldSplit = topics.every((t, i) =>
        topics.slice(i + 1).every((u) => topicsAreDistinct(t.label, u.label)),
      );
    }

    if (shouldSplit) {
      for (const topic of topics) {
        const dur = topic.endSeconds - topic.startSeconds;
        // Reject zero- and negative-duration topics. Gemini occasionally
        // returns topics where endSeconds === startSeconds (a stamped "marker"
        // rather than a range); persisting these creates phantom clips the
        // learner sees as a duplicate WATCH item.
        if (dur <= 0) continue;
        if (dur < MIN_CLIP_DURATION_SECONDS) continue;
        clips.push({
          videoId: digest.contentId,
          videoTitle: digest.contentTitle,
          topicLabel: topic.label,
          startSeconds: topic.startSeconds,
          endSeconds: topic.endSeconds,
          durationSeconds: dur,
          subtopics: topic.subtopics,
        });
      }
      // Guard: if every topic was too short, fall through to the time-based
      // / full-video paths below.
      if (clips.filter((c) => c.videoId === digest.contentId).length > 0) continue;
    }

    // Time-based fallback: a long video whose topics aren't all-distinct (or
    // that has only one broad topic) still gets sliced into 5–10 min chunks
    // so it can be distributed across lessons. Without this, a 20-min video
    // collapsed to a single full-video clip and downstream lessons ended up
    // empty when bin-packing couldn't split that single clip cleanly.
    if (longEnoughToSplit) {
      const chunkCount = chooseChunkCount(fullDuration, topics.length);
      if (chunkCount > 1) {
        const slices = timeBasedSlices(fullDuration, topics, chunkCount, digest.segments);
        for (const slice of slices) {
          const dur = slice.endSeconds - slice.startSeconds;
          if (dur < MIN_CLIP_DURATION_SECONDS) continue;
          clips.push({
            videoId: digest.contentId,
            videoTitle: digest.contentTitle,
            topicLabel: slice.label,
            startSeconds: slice.startSeconds,
            endSeconds: slice.endSeconds,
            durationSeconds: dur,
            subtopics: topics.length > 0 ? topics.map((t) => t.label) : undefined,
          });
        }
        if (clips.filter((c) => c.videoId === digest.contentId).length > 0) continue;
      }
    }

    // Default path: one full-video clip. Preserve topic labels as subtopics so
    // the LLM and downstream UI can still see the chapter structure.
    if (fullDuration > 0) {
      clips.push({
        videoId: digest.contentId,
        videoTitle: digest.contentTitle,
        topicLabel: topics[0]?.label ?? digest.contentTitle,
        startSeconds: 0,
        endSeconds: fullDuration,
        durationSeconds: fullDuration,
        subtopics: topics.length > 0 ? topics.map((t) => t.label) : undefined,
      });
    }
  }

  // Track videoIds already represented so basic digests don't duplicate
  // videos that enriched digests already contributed (in full or as parts).
  const enrichedVideoIds = new Set(clips.map((c) => c.videoId));

  for (const digest of basicDigests) {
    if (digest.contentType !== "video") continue;
    if (enrichedVideoIds.has(digest.contentId)) continue;
    // Use the actual video duration when available — otherwise the basic
    // digest fallback silently truncates a 20-min video to 10 min.
    const fullDuration = digest.durationSeconds ?? DEFAULT_VIDEO_DURATION;
    clips.push({
      videoId: digest.contentId,
      videoTitle: digest.contentTitle,
      topicLabel: digest.contentTitle,
      startSeconds: 0,
      endSeconds: fullDuration,
      durationSeconds: fullDuration,
    });
  }

  return clips;
}

/**
 * Distribute collected clips across lessons using greedy bin-packing.
 *
 * Hard constraints:
 *   - Every lesson gets >= 1 clip
 *   - Every video appears in at least 1 lesson
 *   - No lesson exceeds MAX_CLIPS_PER_LESSON clips
 */
export function distributeClipsToLessons(
  enrichedDigests: EnrichedContentDigest[],
  basicDigests: ContentDigest[],
  durationWeeks: number,
  sessionsPerWeek: number = 1,
): DistributionPlan {
  const totalLessons = durationWeeks * sessionsPerWeek;
  const warnings: string[] = [];

  let clips = collectClips(enrichedDigests, basicDigests);

  if (clips.length === 0) {
    warnings.push("No clips could be extracted from any video");
    return {
      lessons: Array.from({ length: totalLessons }, (_, i) => ({
        lessonIndex: i,
        weekNumber: Math.floor(i / sessionsPerWeek) + 1,
        sessionIndex: i % sessionsPerWeek,
        clips: [],
        totalDurationSeconds: 0,
      })),
      totalClips: 0,
      totalDurationSeconds: 0,
      warnings,
    };
  }

  // If fewer clips than lessons, split the longest clips into parts.
  // Never shallow-clone a clip — the same (videoId, startSeconds, endSeconds)
  // must never appear twice. Splitting creates parts of the same video, which
  // IS allowed; duplicating the full clip is not.
  if (clips.length < totalLessons) {
    warnings.push(
      `Only ${clips.length} topic clip(s) for ${totalLessons} lessons — splitting longest clips into parts to fill`,
    );
    let safetyIterations = totalLessons * 4; // guard against pathological inputs
    while (clips.length < totalLessons && safetyIterations-- > 0) {
      // Pick the longest clip that can still be halved above MIN_CLIP_DURATION
      clips.sort((a, b) => b.durationSeconds - a.durationSeconds);
      const source = clips[0];
      if (source.durationSeconds < MIN_CLIP_DURATION_SECONDS * 2) {
        // No clip is long enough to split further — stop filling.
        // Downstream code will handle short lesson counts gracefully.
        warnings.push(
          `Cannot fill ${totalLessons - clips.length} more lesson(s) without duplicating a full clip; stopping fill`,
        );
        break;
      }
      const arithmeticMid = source.startSeconds + Math.floor(source.durationSeconds / 2);
      const sourceDigest = enrichedDigests.find((d) => d.contentId === source.videoId);
      const snapped = findSegmentSnapForSplit(
        arithmeticMid,
        source.startSeconds,
        source.endSeconds,
        sourceDigest?.segments as { startSeconds: number; endSeconds: number }[] | undefined,
        SNAP_WINDOW_SECONDS,
        MIN_CLIP_DURATION_SECONDS,
      );
      const mid = snapped !== null ? snapped : arithmeticMid;
      const firstDur = mid - source.startSeconds;
      const secondDur = source.endSeconds - mid;
      // Refuse to emit a zero-duration part. If either half collapses, leave
      // the source clip alone and stop filling rather than creating a phantom
      // clip that the learner will see as a blank WATCH item.
      if (firstDur <= 0 || secondDur <= 0) {
        warnings.push(
          `Cannot split "${source.topicLabel}" without producing a zero-duration part; stopping fill`,
        );
        break;
      }
      const firstHalf: TopicClip = {
        ...source,
        endSeconds: mid,
        durationSeconds: firstDur,
      };
      const secondHalf: TopicClip = {
        ...source,
        topicLabel: source.topicLabel.includes("(part")
          ? source.topicLabel
          : `${source.topicLabel} (part 2)`,
        startSeconds: mid,
        durationSeconds: secondDur,
      };
      clips[0] = firstHalf;
      clips.push(secondHalf);
    }
  }

  // If way too many clips per lesson, merge adjacent same-video topics
  if (clips.length > totalLessons * MAX_CLIPS_PER_LESSON) {
    clips = mergeAdjacentClips(clips, totalLessons * MAX_CLIPS_PER_LESSON);
    warnings.push("Merged adjacent topics to fit within clip-per-lesson limits");
  }

  const totalDuration = clips.reduce((sum, c) => sum + c.durationSeconds, 0);
  const rawTarget = totalDuration / totalLessons;
  // Don't clamp — use the actual average so we distribute evenly regardless of clip durations
  const targetPerLesson = rawTarget > 0 ? rawTarget : TARGET_LESSON_MIN_SECONDS;

  // Greedy bin-packing
  const lessons: LessonAssignment[] = Array.from({ length: totalLessons }, (_, i) => ({
    lessonIndex: i,
    weekNumber: Math.floor(i / sessionsPerWeek) + 1,
    sessionIndex: i % sessionsPerWeek,
    clips: [] as TopicClip[],
    totalDurationSeconds: 0,
  }));

  let currentLesson = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const lesson = lessons[currentLesson];
    lesson.clips.push(clip);
    lesson.totalDurationSeconds += clip.durationSeconds;

    // Decide whether to advance to next lesson
    const remainingClips = clips.length - (i + 1);
    const remainingLessons = totalLessons - (currentLesson + 1);

    if (currentLesson >= totalLessons - 1) continue; // already on last lesson

    // MUST advance: exactly enough clips left for remaining lessons (1 per lesson)
    const mustAdvance = remainingClips > 0 && remainingClips === remainingLessons;

    // SHOULD advance: duration target met or clip count at limit
    const shouldAdvance =
      remainingClips >= remainingLessons && // enough clips left
      (lesson.totalDurationSeconds >= targetPerLesson ||
        lesson.clips.length >= MAX_CLIPS_PER_LESSON);

    if (mustAdvance || shouldAdvance) {
      // Different-video-first preference: the next lesson should not open
      // with the same source video that dominated this one. If the next
      // clip in the queue shares a videoId with the clip we just placed,
      // swap it forward with the first clip from a different video.
      //
      // GUARD: the swap pushes clips[nextIdx] *back* past clips[swapIdx].
      // If clips[nextIdx] has more same-video siblings later in the queue,
      // pushing it back would also push it past those siblings — breaking
      // the source-video sequence within its own video. Only swap when the
      // displaced clip has no later same-video siblings.
      const nextIdx = i + 1;
      if (nextIdx < clips.length && clips[nextIdx].videoId === clip.videoId) {
        const displacedVideoId = clips[nextIdx].videoId;
        let hasLaterSibling = false;
        for (let j = nextIdx + 1; j < clips.length; j++) {
          if (clips[j].videoId === displacedVideoId) {
            hasLaterSibling = true;
            break;
          }
        }
        if (!hasLaterSibling) {
          let swapIdx = -1;
          for (let j = nextIdx + 1; j < clips.length; j++) {
            if (clips[j].videoId !== clip.videoId) {
              swapIdx = j;
              break;
            }
          }
          if (swapIdx !== -1) {
            [clips[nextIdx], clips[swapIdx]] = [clips[swapIdx], clips[nextIdx]];
          }
        }
      }
      currentLesson++;
    }
  }

  // Post-pass: rebalance any lesson that exceeds MAX_CLIPS_PER_LESSON
  // by moving excess clips backwards to the previous lesson (if it has room)
  for (let l = lessons.length - 1; l > 0; l--) {
    while (lessons[l].clips.length > MAX_CLIPS_PER_LESSON) {
      const prev = lessons[l - 1];
      if (prev.clips.length >= MAX_CLIPS_PER_LESSON) break; // no room
      // Move the first clip from this lesson to the end of the previous lesson
      const moved = lessons[l].clips.shift()!;
      lessons[l].totalDurationSeconds -= moved.durationSeconds;
      prev.clips.push(moved);
      prev.totalDurationSeconds += moved.durationSeconds;
    }
  }

  // Ensure every video appears at least once
  const videoIds = new Set([
    ...enrichedDigests.map((d) => d.contentId),
    ...basicDigests.filter((d) => d.contentType === "video").map((d) => d.contentId),
  ]);
  const assignedVideoIds = new Set(
    lessons.flatMap((l) => l.clips.map((c) => c.videoId)),
  );
  for (const vid of videoIds) {
    if (!assignedVideoIds.has(vid)) {
      // Find the enriched digest for this video
      const digest = enrichedDigests.find((d) => d.contentId === vid);
      const title = digest?.contentTitle ?? "Untitled";
      const dur = digest?.durationSeconds ?? DEFAULT_VIDEO_DURATION;

      // Add to the lesson with the least total duration
      const leastLoaded = lessons.reduce((min, l) =>
        l.totalDurationSeconds < min.totalDurationSeconds ? l : min,
      );
      leastLoaded.clips.push({
        videoId: vid,
        videoTitle: title,
        topicLabel: title,
        startSeconds: 0,
        endSeconds: dur,
        durationSeconds: dur,
      });
      leastLoaded.totalDurationSeconds += dur;
      warnings.push(`Video "${title}" had no clips assigned — added full clip to lesson ${leastLoaded.lessonIndex + 1}`);
    }
  }

  // Final safety: no identical clip (same videoId + startSeconds + endSeconds)
  // may appear in more than one lesson. Parts of the same video are fine
  // (different time ranges); exact duplicates are not. Also drop any clip
  // whose range collapsed to zero duration anywhere upstream.
  const seenClipKeys = new Set<string>();
  for (const lesson of lessons) {
    const unique: TopicClip[] = [];
    for (const clip of lesson.clips) {
      if (clip.endSeconds <= clip.startSeconds || clip.durationSeconds <= 0) {
        warnings.push(
          `Dropped zero-duration clip "${clip.videoTitle}" (${clip.startSeconds}s-${clip.endSeconds}s) from lesson ${lesson.lessonIndex + 1}`,
        );
        continue;
      }
      const key = `${clip.videoId}:${clip.startSeconds}:${clip.endSeconds}`;
      if (seenClipKeys.has(key)) {
        warnings.push(
          `Removed duplicate clip "${clip.videoTitle}" (${clip.startSeconds}s-${clip.endSeconds}s) from lesson ${lesson.lessonIndex + 1}`,
        );
        lesson.totalDurationSeconds -= clip.durationSeconds;
        continue;
      }
      seenClipKeys.add(key);
      unique.push(clip);
    }
    lesson.clips = unique;
  }

  // Final guarantee: every lesson must have ≥1 clip when any clips exist.
  // Empty lessons reach the LLM and become sessions with no SessionClip rows
  // — which the editor renders as the "Upload video" widget. Steal a clip
  // from the most-loaded lesson so each session has at least something.
  const totalClipsAfterDedup = lessons.reduce((sum, l) => sum + l.clips.length, 0);
  if (totalClipsAfterDedup > 0) {
    for (let l = 0; l < lessons.length; l++) {
      if (lessons[l].clips.length > 0) continue;
      const candidates = lessons
        .map((lesson, idx) => ({ lesson, idx }))
        .filter((c) => c.idx !== l && c.lesson.clips.length > 1)
        .sort((a, b) => b.lesson.clips.length - a.lesson.clips.length);
      if (candidates.length === 0) {
        warnings.push(
          `Lesson ${l + 1} ended up empty and no other lesson has spare clips`,
        );
        continue;
      }
      const source = candidates[0].lesson;
      const moved = source.clips.pop()!;
      source.totalDurationSeconds -= moved.durationSeconds;
      lessons[l].clips.push(moved);
      lessons[l].totalDurationSeconds += moved.durationSeconds;
      warnings.push(
        `Lesson ${l + 1} was empty — moved "${moved.topicLabel}" from lesson ${candidates[0].idx + 1}`,
      );
    }
  }

  return {
    lessons,
    totalClips: lessons.reduce((sum, l) => sum + l.clips.length, 0),
    totalDurationSeconds: lessons.reduce((sum, l) => sum + l.totalDurationSeconds, 0),
    warnings,
  };
}

/**
 * Merge adjacent clips from the same video to reduce total clip count.
 */
function mergeAdjacentClips(clips: TopicClip[], maxTotal: number): TopicClip[] {
  if (clips.length <= maxTotal) return clips;

  const merged: TopicClip[] = [];
  let current: TopicClip | null = null;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (
      current &&
      current.videoId === clip.videoId &&
      clip.startSeconds <= current.endSeconds + 5 // allow 5s gap
    ) {
      // Merge into current
      const prev: TopicClip = current!;
      current = {
        videoId: prev.videoId,
        videoTitle: prev.videoTitle,
        topicLabel: `${prev.topicLabel} + ${clip.topicLabel}`,
        startSeconds: prev.startSeconds,
        endSeconds: clip.endSeconds,
        durationSeconds: clip.endSeconds - prev.startSeconds,
        subtopics: [
          ...(prev.subtopics ?? []),
          ...(clip.subtopics ?? []),
        ],
      };
    } else {
      if (current) merged.push(current);
      current = { ...clip };
    }

    // Stop merging once we're under the limit
    const remaining = clips.length - (i + 1);
    if (merged.length + 1 + remaining <= maxTotal && current) {
      merged.push(current);
      current = null;
      // Push remaining as-is
      merged.push(...clips.slice(i + 1));
      return merged;
    }
  }

  if (current) merged.push(current);
  return merged;
}

// ---------------------------------------------------------------------------
// Prompt Formatter
// ---------------------------------------------------------------------------

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/**
 * Per-clip transcript excerpt rendering — exposes the underlying Gemini
 * segment structure so the LLM can ground its chapterTitle/summary in *all*
 * sub-topics inside a clip, not just whatever happened to appear in the first
 * 600 characters of a flat concatenation. Each overlapping segment is
 * returned separately so the prompt-builder can render them as a labeled
 * list, making sub-topic count and timestamps explicit to the model.
 */
const TRANSCRIPT_TOTAL_BUDGET_CHARS = 1800;
const TRANSCRIPT_PER_SEGMENT_MAX_CHARS = 400;
const TRANSCRIPT_PER_SEGMENT_MIN_CHARS = 80;

interface TranscriptSegmentExcerpt {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

function buildTranscriptExcerpts(
  videoId: string,
  clipStart: number,
  clipEnd: number,
  enrichedDigests: EnrichedContentDigest[] | undefined,
): TranscriptSegmentExcerpt[] {
  if (!enrichedDigests || enrichedDigests.length === 0) return [];
  const digest = enrichedDigests.find((d) => d.contentId === videoId);
  if (!digest || !digest.segments || digest.segments.length === 0) return [];
  // A segment overlaps the clip if any part of its [start, end] intersects
  // [clipStart, clipEnd]. Strict containment is too restrictive — Gemini's
  // segment boundaries rarely line up exactly with our chunk cuts.
  const overlapping = digest.segments.filter(
    (s) => s.endSeconds > clipStart && s.startSeconds < clipEnd,
  );
  if (overlapping.length === 0) return [];

  // Distribute the total budget evenly across segments, clamped per-segment.
  const perSegment = Math.min(
    TRANSCRIPT_PER_SEGMENT_MAX_CHARS,
    Math.max(
      TRANSCRIPT_PER_SEGMENT_MIN_CHARS,
      Math.floor(TRANSCRIPT_TOTAL_BUDGET_CHARS / overlapping.length),
    ),
  );

  const result: TranscriptSegmentExcerpt[] = [];
  for (const seg of overlapping) {
    const cleaned = (seg.text ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const snippet =
      cleaned.length <= perSegment
        ? cleaned
        : cleaned.slice(0, perSegment - 1).trimEnd() + "…";
    result.push({
      startSeconds: seg.startSeconds,
      endSeconds: seg.endSeconds,
      text: snippet,
    });
  }
  return result;
}

/**
 * Format the distribution plan as a text block for injection into the LLM prompt.
 *
 * When enrichedDigests are provided, each clip line is followed by a
 * timestamped transcript excerpt drawn from Gemini's per-segment data — this
 * lets the LLM ground chapterTitle generation in the actual content of each
 * time range instead of guessing from the flat full transcript.
 */
export function formatDistributionPlanForPrompt(
  plan: DistributionPlan,
  enrichedDigests?: EnrichedContentDigest[],
): string {
  const lines: string[] = [
    `═══ VIDEO ASSIGNMENT PLAN (MANDATORY) ═══`,
    `The following clip assignments have been pre-computed. You MUST follow them exactly.`,
    `Do NOT reassign, omit, or add video clips beyond this plan.`,
    `Your job is to write great titles, summaries, takeaways, DO/REFLECT actions, and overlay details for each lesson — but the video clips are fixed.`,
    `For each clip, base its chapterTitle and chapterDescription on the timestamped transcript excerpts below it. When a clip lists multiple segments, your chapterTitle and summary MUST reflect every segment — do not name only the first one or two. Never ground titles in the source video title or in adjacent clips.`,
    ``,
  ];

  for (const lesson of plan.lessons) {
    lines.push(`Lesson ${lesson.lessonIndex + 1} (Session ${lesson.sessionIndex + 1}):`);

    for (let i = 0; i < lesson.clips.length; i++) {
      const clip = lesson.clips[i];
      lines.push(
        `  Clip ${i + 1}: Video "${clip.videoTitle}" (ID: ${clip.videoId}) @ ${formatTime(clip.startSeconds)}-${formatTime(clip.endSeconds)} — "${clip.topicLabel}"`,
      );
      const excerpts = buildTranscriptExcerpts(
        clip.videoId,
        clip.startSeconds,
        clip.endSeconds,
        enrichedDigests,
      );
      if (excerpts.length === 1) {
        lines.push(
          `    Transcript (${formatTime(clip.startSeconds)}-${formatTime(clip.endSeconds)}): "${excerpts[0].text}"`,
        );
      } else if (excerpts.length > 1) {
        lines.push(
          `    Transcript (${formatTime(clip.startSeconds)}-${formatTime(clip.endSeconds)}) — ${excerpts.length} segments; chapterTitle and summary MUST reflect all of them:`,
        );
        for (const ex of excerpts) {
          lines.push(
            `      [${formatTime(ex.startSeconds)}-${formatTime(ex.endSeconds)}] "${ex.text}"`,
          );
        }
      }
    }

    lines.push(`  Total: ${formatTime(lesson.totalDurationSeconds)}`);
    lines.push(``);
  }

  lines.push(`═══ END VIDEO ASSIGNMENT PLAN ═══`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Post-Validation
// ---------------------------------------------------------------------------

/**
 * Tolerance (seconds) when comparing LLM-generated clip ranges to the
 * distributor's planned ranges. The LLM is allowed to snap to nearby segment
 * boundaries within this window without being flagged as drift.
 */
const CLIP_COVERAGE_TOL_SECONDS = 15;

/**
 * Decide whether an array of LLM clips is a legitimate subdivision of a single
 * planned clip range: clips must be ordered, non-overlapping, internally
 * gap-free, and their union must match `[rangeStart, rangeEnd]` within
 * `tolSeconds`. Used to preserve LLM sub-clipping (the Ticket #2 win) only
 * when it actually honours the distributor plan.
 */
function isValidSubdivision(
  clips: { startSeconds: number; endSeconds: number }[],
  rangeStart: number,
  rangeEnd: number,
  tolSeconds: number,
): boolean {
  if (clips.length === 0) return false;
  const sorted = [...clips].sort((a, b) => a.startSeconds - b.startSeconds);
  // Boundaries must match the plan within tolerance
  if (Math.abs(sorted[0].startSeconds - rangeStart) > tolSeconds) return false;
  if (
    Math.abs(sorted[sorted.length - 1].endSeconds - rangeEnd) > tolSeconds
  ) {
    return false;
  }
  // No overlap and no internal gaps between consecutive clips
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startSeconds - sorted[i - 1].endSeconds;
    if (gap < -tolSeconds) return false; // overlap
    if (gap > tolSeconds) return false; // gap
  }
  return true;
}

/**
 * Validate that an LLM-generated draft follows the distribution plan.
 * If deviations are found, programmatically repair the clips.
 */
export function validateAndFixClipDistribution(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: any,
  plan: DistributionPlan,
  enrichedDigests: EnrichedContentDigest[],
): ValidationResult {
  const errors: string[] = [];
  const validVideoIds = new Set([
    ...enrichedDigests.map((d) => d.contentId),
    ...plan.lessons.flatMap((l) => l.clips.map((c) => c.videoId)),
  ]);

  // Build duration lookup
  const durationMap = new Map<string, number>();
  for (const d of enrichedDigests) {
    if (d.durationSeconds) durationMap.set(d.contentId, d.durationSeconds);
  }

  // Flatten all sessions from the draft in order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draftSessions: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const week of (draft.weeks ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const session of (week.sessions ?? [])) {
      draftSessions.push(session);
    }
  }

  // Check 1: All plan videos are referenced somewhere in the draft
  const planVideoIds = new Set(plan.lessons.flatMap((l) => l.clips.map((c) => c.videoId)));
  const draftVideoIds = new Set(
    draftSessions.flatMap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => (s.clips ?? []).map((c: any) => c.youtubeVideoId),
    ),
  );
  for (const vid of planVideoIds) {
    if (!draftVideoIds.has(vid)) {
      errors.push(`Video ${vid} from plan is missing in draft`);
    }
  }

  // Check 2: All sessions have at least 1 clip
  for (let i = 0; i < draftSessions.length; i++) {
    const session = draftSessions[i];
    if (!session.clips || session.clips.length === 0) {
      errors.push(`Session ${i + 1} has no clips`);
    }
  }

  // Check 3: No hallucinated video IDs
  for (let i = 0; i < draftSessions.length; i++) {
    const session = draftSessions[i];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const clip of (session.clips ?? [])) {
      if (!validVideoIds.has(clip.youtubeVideoId)) {
        errors.push(`Session ${i + 1} has hallucinated video ID: ${clip.youtubeVideoId}`);
      }
    }
  }

  // Check 4: Timestamps within bounds
  for (let i = 0; i < draftSessions.length; i++) {
    const session = draftSessions[i];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const clip of (session.clips ?? [])) {
      const dur = durationMap.get(clip.youtubeVideoId);
      if (dur && clip.endSeconds > dur + 5) { // 5s tolerance
        errors.push(
          `Session ${i + 1} clip for video ${clip.youtubeVideoId} has endSeconds=${clip.endSeconds} exceeding duration=${dur}`,
        );
      }
    }
  }

  // Check 6: Per-(session, planned-range) clip coverage and non-overlap.
  // The LLM may subdivide a planned clip into multiple sub-clips along Gemini
  // segment boundaries (Ticket #2 encourages this), but the resulting sub-clips
  // must (a) not overlap each other, (b) leave no internal gaps, and (c) have
  // their union match the planned range within CLIP_COVERAGE_TOL_SECONDS. This
  // catches the post-Ticket-#2 drift classes: overlap, coverage gap, and
  // mid-segment straddle.
  for (let i = 0; i < draftSessions.length; i++) {
    if (i >= plan.lessons.length) break;
    const session = draftSessions[i];
    const planLesson = plan.lessons[i];

    for (const planClip of planLesson.clips) {
      if (planClip.endSeconds <= planClip.startSeconds) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const llmClipsForRange = ((session.clips ?? []) as any[]).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) =>
          c.youtubeVideoId === planClip.videoId &&
          typeof c.startSeconds === "number" &&
          typeof c.endSeconds === "number" &&
          c.endSeconds > c.startSeconds &&
          c.startSeconds >= planClip.startSeconds - CLIP_COVERAGE_TOL_SECONDS &&
          c.endSeconds <= planClip.endSeconds + CLIP_COVERAGE_TOL_SECONDS,
      );

      if (
        !isValidSubdivision(
          llmClipsForRange,
          planClip.startSeconds,
          planClip.endSeconds,
          CLIP_COVERAGE_TOL_SECONDS,
        )
      ) {
        const llmDesc = llmClipsForRange.length === 0
          ? "no LLM clips found in range"
          : llmClipsForRange
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((c: any) => `${c.startSeconds}-${c.endSeconds}`)
              .join(", ");
        errors.push(
          `Session ${i + 1} clip subdivision for video ${planClip.videoId.slice(-6)} ` +
            `(planned ${planClip.startSeconds}-${planClip.endSeconds}) ` +
            `drifted from plan: ${llmDesc}`,
        );
      }
    }
  }

  // Check 5: Structural match — week/session layout must match the plan
  const expectedWeekNumbers = [...new Set(plan.lessons.map((l) => l.weekNumber))].sort((a, b) => a - b);
  const expectedWeekCount = expectedWeekNumbers.length;
  let structuralMismatch = false;

  if ((draft.weeks ?? []).length !== expectedWeekCount) {
    errors.push(
      `Structural mismatch: plan has ${expectedWeekCount} lessons but draft has ${(draft.weeks ?? []).length} weeks`,
    );
    structuralMismatch = true;
  } else {
    for (let w = 0; w < expectedWeekCount; w++) {
      const expectedSessions = plan.lessons.filter((l) => l.weekNumber === expectedWeekNumbers[w]).length;
      const actualSessions = (draft.weeks[w]?.sessions ?? []).length;
      if (actualSessions !== expectedSessions) {
        errors.push(
          `Structural mismatch: lesson ${w + 1} should have ${expectedSessions} session(s) but has ${actualSessions}`,
        );
        structuralMismatch = true;
      }
    }
  }

  if (errors.length === 0) {
    return { valid: true, errors: [] };
  }

  // Auto-fix: if structural mismatch, restructure the draft to match the plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fixedDraft: any;

  if (structuralMismatch) {
    // Flatten all sessions from the draft, preserving their content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flatSessions: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const week of (draft.weeks ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const session of (week.sessions ?? [])) {
        flatSessions.push(JSON.parse(JSON.stringify(session)));
      }
    }

    // Build the correct week/session structure from the plan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newWeeks: any[] = [];
    let sessionIdx = 0;

    for (const weekNum of expectedWeekNumbers) {
      const lessonsForWeek = plan.lessons.filter((l) => l.weekNumber === weekNum);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessions: any[] = [];

      for (let s = 0; s < lessonsForWeek.length; s++) {
        // Reuse the corresponding flat session if available, otherwise create a stub
        const source = sessionIdx < flatSessions.length
          ? flatSessions[sessionIdx]
          : { title: `Session ${s + 1}`, summary: "", keyTakeaways: [], orderIndex: s, actions: [] };
        source.orderIndex = s;
        sessions.push(source);
        sessionIdx++;
      }

      // Find the original week data for title/summary if it existed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const origWeek = (draft.weeks ?? []).find((w: any) => w.weekNumber === weekNum);
      newWeeks.push({
        title: origWeek?.title ?? `Lesson ${weekNum}`,
        summary: origWeek?.summary ?? sessions[0]?.summary ?? "",
        weekNumber: weekNum,
        sessions,
      });
    }

    fixedDraft = JSON.parse(JSON.stringify(draft));
    fixedDraft.weeks = newWeeks;
    fixedDraft.durationWeeks = expectedWeekCount;
  } else {
    fixedDraft = JSON.parse(JSON.stringify(draft));
  }

  // Now fix clips in each session to match the plan
  let planLessonIdx = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const week of fixedDraft.weeks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const session of week.sessions) {
      if (planLessonIdx >= plan.lessons.length) break;

      const planLesson = plan.lessons[planLessonIdx];

      // Build replacement clips per planned clip. For each planned range we
      // either (a) preserve the LLM's segment-aligned sub-clipping when it's a
      // valid subdivision of the plan range, or (b) fall back to a single
      // clip matching the plan exactly. This keeps the Ticket #2 wins in
      // well-formed lessons and only resets the broken (videoId, range)
      // groups.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const llmClipsSnapshot: any[] = (session.clips ?? []) as any[];
      const usablePlanClips = planLesson.clips.filter(
        (c) => c.endSeconds > c.startSeconds,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newClips: any[] = [];
      let nextOrderIndex = 0;

      for (const planClip of usablePlanClips) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const llmClipsInRange = llmClipsSnapshot.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) =>
            c.youtubeVideoId === planClip.videoId &&
            typeof c.startSeconds === "number" &&
            typeof c.endSeconds === "number" &&
            c.endSeconds > c.startSeconds &&
            c.startSeconds >= planClip.startSeconds - CLIP_COVERAGE_TOL_SECONDS &&
            c.endSeconds <= planClip.endSeconds + CLIP_COVERAGE_TOL_SECONDS,
        );

        if (
          llmClipsInRange.length > 0 &&
          isValidSubdivision(
            llmClipsInRange,
            planClip.startSeconds,
            planClip.endSeconds,
            CLIP_COVERAGE_TOL_SECONDS,
          )
        ) {
          // Preserve the LLM's segment-aligned subdivision.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sorted = [...llmClipsInRange].sort(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any, b: any) => a.startSeconds - b.startSeconds,
          );
          for (const c of sorted) {
            newClips.push({
              youtubeVideoId: c.youtubeVideoId,
              startSeconds: c.startSeconds,
              endSeconds: c.endSeconds,
              orderIndex: nextOrderIndex,
              transitionType: nextOrderIndex === 0 ? "NONE" : "FADE",
              transitionDurationMs: c.transitionDurationMs ?? 500,
              chapterTitle: c.chapterTitle ?? planClip.topicLabel,
              chapterDescription:
                c.chapterDescription ?? planClip.subtopics?.join(", "),
            });
            nextOrderIndex++;
          }
        } else {
          // Fall back to a single clip matching the plan exactly.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingClip = llmClipsSnapshot.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c.youtubeVideoId === planClip.videoId,
          );
          newClips.push({
            youtubeVideoId: planClip.videoId,
            startSeconds: planClip.startSeconds,
            endSeconds: planClip.endSeconds,
            orderIndex: nextOrderIndex,
            transitionType: nextOrderIndex === 0 ? "NONE" : "FADE",
            transitionDurationMs: 500,
            chapterTitle: existingClip?.chapterTitle ?? planClip.topicLabel,
            chapterDescription:
              existingClip?.chapterDescription ?? planClip.subtopics?.join(", "),
          });
          nextOrderIndex++;
        }
      }

      session.clips = newClips;

      // Ensure overlays exist (at minimum a TITLE_CARD)
      if (!session.overlays || session.overlays.length === 0) {
        session.overlays = [
          {
            type: "TITLE_CARD",
            content: { title: session.title, subtitle: `Lesson ${week.weekNumber}` },
            position: "CENTER",
            durationMs: 4000,
            orderIndex: 0,
            triggerAtSeconds: 0,
          },
        ];
      }

      planLessonIdx++;
    }
  }

  return { valid: false, errors, fixedDraft };
}

/**
 * Post-LLM curriculum-quality checks. Returns warnings (not errors) so callers
 * can log them without blocking the draft. Enforces the reviewer's rules:
 *   - Lesson titles must not be blank or bare "Lesson N"
 *   - Each session has exactly one REFLECT action
 *   - Each reflectionPrompt is a question (ends with "?")
 *   - Each DO action title starts with an imperative verb (no "Practice:" / "Understand…")
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateDraftQuality(draft: any): string[] {
  const warnings: string[] = [];
  // Common weak lead-ins that aren't imperative verbs
  const weakDoPrefix = /^\s*(practice|understand|learn|adopt|remember|know|recognize)\b/i;
  const bareLessonTitle = /^\s*lesson\s*\d+\s*:?\s*$/i;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const week of (draft?.weeks ?? [])) {
    const weekNum = week.weekNumber ?? "?";
    const title: string = typeof week.title === "string" ? week.title : "";
    if (!title.trim() || bareLessonTitle.test(title)) {
      warnings.push(`Lesson ${weekNum}: title is blank or missing content ("${title}")`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const session of (week.sessions ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actions: any[] = session.actions ?? [];
      const reflects = actions.filter((a) => {
        const t = String(a?.type ?? "").toLowerCase();
        return t === "reflect";
      });
      if (reflects.length !== 1) {
        warnings.push(
          `Lesson ${weekNum} / session "${session.title ?? ""}": expected exactly 1 REFLECT action, got ${reflects.length}`,
        );
      }
      for (const r of reflects) {
        const prompt = String(r.reflectionPrompt ?? "").trim();
        if (!prompt.endsWith("?")) {
          warnings.push(
            `Lesson ${weekNum}: reflectionPrompt does not end with "?" ("${prompt.slice(0, 60)}…")`,
          );
        }
      }

      const dos = actions.filter((a) => String(a?.type ?? "").toLowerCase() === "do");
      for (const d of dos) {
        const t = String(d.title ?? "").trim();
        if (!t) {
          warnings.push(`Lesson ${weekNum}: DO action has no title`);
          continue;
        }
        if (weakDoPrefix.test(t)) {
          warnings.push(
            `Lesson ${weekNum}: DO title "${t}" starts with a weak/concept verb (should be an imperative physical action)`,
          );
        }
      }
    }
  }
  return warnings;
}
