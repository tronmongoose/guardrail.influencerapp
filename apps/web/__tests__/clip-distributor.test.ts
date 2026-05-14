import { describe, it, expect } from "vitest";
import {
  distributeClipsToLessons,
  validateAndFixClipDistribution,
  formatDistributionPlanForPrompt,
} from "@guide-rail/ai";
import type { EnrichedContentDigest, ContentDigest } from "@guide-rail/ai";

// Helper to create an EnrichedContentDigest with topics
function makeEnrichedDigest(
  id: string,
  title: string,
  topics: { label: string; startSeconds: number; endSeconds: number }[],
  durationSeconds?: number,
): EnrichedContentDigest {
  return {
    contentId: id,
    contentTitle: title,
    contentType: "video",
    keyConcepts: topics.map((t) => t.label),
    skillsIntroduced: [],
    memorableExamples: [],
    difficultyLevel: "intermediate",
    summary: `Video about ${title}`,
    segments: topics.map((t) => ({
      startSeconds: t.startSeconds,
      endSeconds: t.endSeconds,
      text: `Segment text for ${t.label}`,
      topic: t.label,
    })),
    topics: topics.map((t) => ({
      label: t.label,
      startSeconds: t.startSeconds,
      endSeconds: t.endSeconds,
    })),
    keyMoments: [],
    durationSeconds: durationSeconds ?? topics[topics.length - 1]?.endSeconds ?? 600,
  };
}

function makeBasicDigest(id: string, title: string): ContentDigest {
  return {
    contentId: id,
    contentTitle: title,
    contentType: "video",
    keyConcepts: [title],
    skillsIntroduced: [],
    memorableExamples: [],
    difficultyLevel: "intermediate",
    summary: `Video about ${title}`,
  };
}

describe("distributeClipsToLessons", () => {
  it("distributes 3 videos x 3 topics across 6 lessons evenly", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Upper Body", [
        { label: "Warm-up", startSeconds: 0, endSeconds: 180 },
        { label: "Main drill", startSeconds: 180, endSeconds: 360 },
        { label: "Cool-down", startSeconds: 360, endSeconds: 540 },
      ], 540),
      makeEnrichedDigest("v2", "Core Work", [
        { label: "Core basics", startSeconds: 0, endSeconds: 200 },
        { label: "Plank series", startSeconds: 200, endSeconds: 400 },
        { label: "Advanced core", startSeconds: 400, endSeconds: 600 },
      ], 600),
      makeEnrichedDigest("v3", "Lower Body", [
        { label: "Squat form", startSeconds: 0, endSeconds: 150 },
        { label: "Lunge variations", startSeconds: 150, endSeconds: 300 },
        { label: "Cooldown stretch", startSeconds: 300, endSeconds: 480 },
      ], 480),
    ];

    const plan = distributeClipsToLessons(enriched, [], 6);

    // Should create exactly 6 lessons
    expect(plan.lessons).toHaveLength(6);

    // Every lesson should have at least 1 clip
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeGreaterThanOrEqual(1);
    }

    // All 3 videos should appear
    const usedVideoIds = new Set(
      plan.lessons.flatMap((l) => l.clips.map((c) => c.videoId)),
    );
    expect(usedVideoIds).toContain("v1");
    expect(usedVideoIds).toContain("v2");
    expect(usedVideoIds).toContain("v3");

    // Total clips should match total topics (9)
    expect(plan.totalClips).toBe(9);

    // No fill-related warnings — we have 9 clips for 6 lessons.
    for (const w of plan.warnings) {
      expect(w).not.toMatch(/splitting|duplicating/i);
    }

    // Core rule: no identical clip (same videoId + startSeconds + endSeconds)
    // may appear twice. Parts of the same video across adjacent lessons are OK.
    const clipKeys = plan.lessons.flatMap((l) =>
      l.clips.map((c) => `${c.videoId}:${c.startSeconds}:${c.endSeconds}`),
    );
    expect(new Set(clipKeys).size).toBe(clipKeys.length);
  });

  it("fills more lessons than clips by splitting parts, never duplicating full clips", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Short Video", [
        { label: "Only topic", startSeconds: 0, endSeconds: 300 },
      ], 300),
      makeEnrichedDigest("v2", "Another Short", [
        { label: "Single topic", startSeconds: 0, endSeconds: 240 },
      ], 240),
    ];

    const plan = distributeClipsToLessons(enriched, [], 5);

    // Should still create 5 lessons
    expect(plan.lessons).toHaveLength(5);

    // Every lesson should have at least 1 clip
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeGreaterThanOrEqual(1);
    }

    // Should have a splitting warning (new behavior — we split instead of duplicating)
    expect(plan.warnings.some((w) => w.includes("splitting"))).toBe(true);

    // No identical (videoId, startSeconds, endSeconds) tuple may appear in
    // more than one lesson. Parts of the same video are fine; exact dupes are not.
    const clipKeys = plan.lessons.flatMap((l) =>
      l.clips.map((c) => `${c.videoId}:${c.startSeconds}:${c.endSeconds}`),
    );
    const uniqueKeys = new Set(clipKeys);
    expect(uniqueKeys.size).toBe(clipKeys.length);
  });

  it("emergency-fill snaps cuts to nearest Gemini segment boundary within ±60s", () => {
    // Single 226s video, one topic spanning the whole video, four
    // finer-grained segments. With 2 lessons, the emergency-fill loop must
    // halve the only clip. Arithmetic midpoint is 113s, but the real
    // carbs→protein segment boundary at 143s is 30s away — inside the snap
    // window — so the cut should land at 143s, not 113s.
    const digest: EnrichedContentDigest = {
      contentId: "macros",
      contentTitle: "Macronutrients",
      contentType: "video",
      keyConcepts: ["macros"],
      skillsIntroduced: [],
      memorableExamples: [],
      difficultyLevel: "intermediate",
      summary: "...",
      segments: [
        { startSeconds: 0, endSeconds: 35, text: "intro", topic: "intro" },
        { startSeconds: 35, endSeconds: 143, text: "carbs", topic: "carbs" },
        { startSeconds: 143, endSeconds: 217, text: "protein", topic: "protein" },
        { startSeconds: 217, endSeconds: 226, text: "fats", topic: "fats" },
      ],
      topics: [{ label: "Macronutrients", startSeconds: 0, endSeconds: 226 }],
      keyMoments: [],
      durationSeconds: 226,
    };

    const plan = distributeClipsToLessons([digest], [], 2);

    expect(plan.lessons).toHaveLength(2);
    expect(plan.warnings.some((w) => w.includes("splitting"))).toBe(true);

    const firstClip = plan.lessons[0].clips[0];
    const secondClip = plan.lessons[1].clips[0];
    expect(firstClip.endSeconds).toBe(143);
    expect(secondClip.startSeconds).toBe(143);
  });

  it("emergency-fill falls back to arithmetic midpoint when no segment boundary lies within ±60s", () => {
    // Same shape but with the only viable segment boundary (200s) well outside
    // the ±60s window of the arithmetic midpoint (113s). The cut should fall
    // back to 113s.
    const digest: EnrichedContentDigest = {
      contentId: "vid",
      contentTitle: "Video",
      contentType: "video",
      keyConcepts: ["x"],
      skillsIntroduced: [],
      memorableExamples: [],
      difficultyLevel: "intermediate",
      summary: "...",
      segments: [
        { startSeconds: 0, endSeconds: 30, text: "a", topic: "a" },
        { startSeconds: 30, endSeconds: 200, text: "b", topic: "b" },
      ],
      topics: [{ label: "Topic", startSeconds: 0, endSeconds: 226 }],
      keyMoments: [],
      durationSeconds: 226,
    };

    const plan = distributeClipsToLessons([digest], [], 2);
    const firstClip = plan.lessons[0].clips[0];
    expect(firstClip.endSeconds).toBe(113);
  });

  it("handles many clips in few lessons by merging", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Long Video", [
        { label: "Topic A", startSeconds: 0, endSeconds: 120 },
        { label: "Topic B", startSeconds: 120, endSeconds: 240 },
        { label: "Topic C", startSeconds: 240, endSeconds: 360 },
        { label: "Topic D", startSeconds: 360, endSeconds: 480 },
        { label: "Topic E", startSeconds: 480, endSeconds: 600 },
        { label: "Topic F", startSeconds: 600, endSeconds: 720 },
        { label: "Topic G", startSeconds: 720, endSeconds: 840 },
      ], 840),
      makeEnrichedDigest("v2", "Another Long", [
        { label: "Topic 1", startSeconds: 0, endSeconds: 120 },
        { label: "Topic 2", startSeconds: 120, endSeconds: 240 },
        { label: "Topic 3", startSeconds: 240, endSeconds: 360 },
        { label: "Topic 4", startSeconds: 360, endSeconds: 480 },
        { label: "Topic 5", startSeconds: 480, endSeconds: 600 },
        { label: "Topic 6", startSeconds: 600, endSeconds: 720 },
        { label: "Topic 7", startSeconds: 720, endSeconds: 840 },
      ], 840),
    ];

    const plan = distributeClipsToLessons(enriched, [], 2);

    expect(plan.lessons).toHaveLength(2);

    // Each lesson should not exceed 6 clips
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeLessThanOrEqual(6);
    }

    // Both videos should appear
    const usedVideoIds = new Set(
      plan.lessons.flatMap((l) => l.clips.map((c) => c.videoId)),
    );
    expect(usedVideoIds).toContain("v1");
    expect(usedVideoIds).toContain("v2");
  });

  it("includes basic (non-enriched) video digests as full clips", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Enriched Video", [
        { label: "Topic A", startSeconds: 0, endSeconds: 300 },
        { label: "Topic B", startSeconds: 300, endSeconds: 600 },
      ], 600),
    ];
    const basic = [makeBasicDigest("v2", "Basic Video")];

    const plan = distributeClipsToLessons(enriched, basic, 3);

    expect(plan.lessons).toHaveLength(3);

    // Both videos should be assigned
    const usedVideoIds = new Set(
      plan.lessons.flatMap((l) => l.clips.map((c) => c.videoId)),
    );
    expect(usedVideoIds).toContain("v1");
    expect(usedVideoIds).toContain("v2");
  });

  it("handles single video across multiple lessons", () => {
    const enriched = [
      makeEnrichedDigest("v1", "One Big Video", [
        { label: "Intro", startSeconds: 0, endSeconds: 180 },
        { label: "Theory", startSeconds: 180, endSeconds: 360 },
        { label: "Practice", startSeconds: 360, endSeconds: 540 },
        { label: "Advanced", startSeconds: 540, endSeconds: 720 },
        { label: "Wrap-up", startSeconds: 720, endSeconds: 900 },
      ], 900),
    ];

    const plan = distributeClipsToLessons(enriched, [], 5);

    expect(plan.lessons).toHaveLength(5);

    // Each lesson should have exactly 1 clip (5 topics, 5 lessons)
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeGreaterThanOrEqual(1);
    }

    // All clips should reference v1
    const usedVideoIds = new Set(
      plan.lessons.flatMap((l) => l.clips.map((c) => c.videoId)),
    );
    expect(usedVideoIds.size).toBe(1);
    expect(usedVideoIds).toContain("v1");
  });

  it("drops zero-duration Gemini topics instead of emitting phantom clips", () => {
    // Simulates a Gemini analysis where one topic collapsed to a single
    // timestamp (e.g. 130s..130s). Previously the learner viewer rendered
    // this as a duplicate WATCH item pointing at the same source video.
    const enriched = [
      makeEnrichedDigest(
        "v1",
        "Topic A + Marker + Topic B",
        [
          { label: "Intro", startSeconds: 0, endSeconds: 120 },
          { label: "Marker (zero duration)", startSeconds: 130, endSeconds: 130 },
          { label: "Body", startSeconds: 200, endSeconds: 400 },
          { label: "Wrap", startSeconds: 400, endSeconds: 560 },
        ],
        560,
      ),
    ];

    const plan = distributeClipsToLessons(enriched, [], 3);

    for (const lesson of plan.lessons) {
      for (const clip of lesson.clips) {
        expect(clip.endSeconds).toBeGreaterThan(clip.startSeconds);
        expect(clip.durationSeconds).toBeGreaterThan(0);
      }
    }

    const hasMarkerClip = plan.lessons.some((l) =>
      l.clips.some((c) => c.startSeconds === 130 && c.endSeconds === 130),
    );
    expect(hasMarkerClip).toBe(false);
  });

  it("returns empty lessons with warning when no clips available", () => {
    const plan = distributeClipsToLessons([], [], 3);

    expect(plan.lessons).toHaveLength(3);
    expect(plan.totalClips).toBe(0);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("No clips");
  });
});

// ---------------------------------------------------------------------------
// Regression: 20-min single video, non-distinct topics → both lessons must
// receive a clip. This is the bug from the screenshots — Lesson 2 was empty
// because all of Gemini's topics shared overlapping labels (Jaccard ≥ 0.3),
// so collectClips emitted ONE full-video clip and bin-packing left a gap.
// ---------------------------------------------------------------------------

describe("distributeClipsToLessons — time-based fallback for non-distinct topics", () => {
  it("slices a 20-min video into clips even when topic labels overlap (Jaccard ≥ 0.3)", () => {
    // All three labels share the bigram "training fundamentals" / "training",
    // so topicsAreDistinct returns false. Before the fix this collapsed to a
    // single full-video clip; now it slices by time.
    const enriched = [
      makeEnrichedDigest(
        "v1",
        "Liv Fitness",
        [
          { label: "training fundamentals overview", startSeconds: 0, endSeconds: 400 },
          { label: "training fundamentals progression", startSeconds: 400, endSeconds: 800 },
          { label: "training fundamentals integration", startSeconds: 800, endSeconds: 1200 },
        ],
        1200,
      ),
    ];
    const plan = distributeClipsToLessons(enriched, [], 2);

    expect(plan.lessons).toHaveLength(2);
    // Both lessons must have at least 1 clip (the regression assertion).
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeGreaterThanOrEqual(1);
    }
    // Total clip duration must equal the source video — no truncation.
    expect(plan.totalDurationSeconds).toBe(1200);
    // No identical clip range repeats across lessons.
    const keys = plan.lessons.flatMap((l) =>
      l.clips.map((c) => `${c.videoId}:${c.startSeconds}:${c.endSeconds}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("snaps time-based slice boundaries to nearby Gemini topic boundaries (±60s)", () => {
    // Three overlapping-label topics whose endSeconds sit close to the ideal
    // halfway cut for a 2-lesson split (600s). The slicer should snap the cut
    // to the topic boundary at 590, not use the raw 600.
    const enriched = [
      makeEnrichedDigest(
        "v1",
        "Beat making fundamentals",
        [
          { label: "beat fundamentals intro", startSeconds: 0, endSeconds: 590 },
          { label: "beat fundamentals advanced", startSeconds: 590, endSeconds: 1200 },
        ],
        1200,
      ),
    ];
    const plan = distributeClipsToLessons(enriched, [], 2);

    expect(plan.lessons).toHaveLength(2);
    const allBoundaries = plan.lessons.flatMap((l) =>
      l.clips.flatMap((c) => [c.startSeconds, c.endSeconds]),
    );
    // The 590s topic boundary should appear (snapped) somewhere in the cuts.
    expect(allBoundaries).toContain(590);
  });

  it("falls back to Gemini segment boundaries when topics are too coarse to provide snap candidates", () => {
    // 1500s video with a SINGLE big topic 0-1500 (no thematic distinctness),
    // but the underlying Gemini segments mark exercise transitions at 510,
    // 775, and 1024. Without segment-aware snapping, time-based slicing
    // would cut at arithmetic ~500 and ~1000, mid-segment. With segments
    // threaded into timeBasedSlices, the cuts must land at the segment
    // boundaries 510 and 1024.
    const digest: EnrichedContentDigest = {
      contentId: "v1",
      contentTitle: "Long single-topic workout",
      contentType: "video",
      keyConcepts: ["workout"],
      skillsIntroduced: [],
      memorableExamples: [],
      difficultyLevel: "intermediate",
      summary: "...",
      segments: [
        { startSeconds: 0, endSeconds: 258, text: "press", topic: "press" },
        { startSeconds: 258, endSeconds: 510, text: "cable fly", topic: "cable fly" },
        { startSeconds: 510, endSeconds: 775, text: "chest fly", topic: "chest fly" },
        { startSeconds: 775, endSeconds: 1024, text: "crossover", topic: "crossover" },
        { startSeconds: 1024, endSeconds: 1500, text: "triceps", topic: "triceps" },
      ],
      topics: [
        { label: "Full Workout", startSeconds: 0, endSeconds: 1500 },
      ],
      keyMoments: [],
      durationSeconds: 1500,
    };

    const plan = distributeClipsToLessons([digest], [], 3);

    const boundaries = plan.lessons.flatMap((l) =>
      l.clips.flatMap((c) => [c.startSeconds, c.endSeconds]),
    );
    // The arithmetic 3-way cuts would be ~500, ~1000. Segment boundaries
    // 510 and 1024 sit within the ±60s snap window and must win.
    expect(boundaries).toContain(510);
    expect(boundaries).toContain(1024);
    // And NO clip should end at the arithmetic 500 or 1000 — those were the
    // bug cases.
    expect(boundaries).not.toContain(500);
    expect(boundaries).not.toContain(1000);
  });

  it("preserves within-video source order when distributing across lessons", () => {
    // Repro of workout-like-a-champ scramble: a source video with 4 clips
    // (Press → Cable Fly → Chest Fly → Crossover) and one sibling video had
    // its clips placed in non-source order across lessons (observed
    // L1→L3→L3→L8 against actual source order). Cause was the
    // different-video-first swap pushing same-video clips past their own
    // later siblings. Fix: skip the swap when the displaced clip still has
    // later same-video siblings.
    const enriched = [
      makeEnrichedDigest(
        "v1",
        "Chest & Triceps",
        [
          { label: "Press", startSeconds: 0, endSeconds: 300 },
          { label: "Cable Fly", startSeconds: 300, endSeconds: 600 },
          { label: "Chest Fly", startSeconds: 600, endSeconds: 900 },
          { label: "Crossover", startSeconds: 900, endSeconds: 1200 },
        ],
        1200,
      ),
      makeEnrichedDigest(
        "v2",
        "Cardio",
        [{ label: "Run", startSeconds: 0, endSeconds: 600 }],
        600,
      ),
    ];
    const plan = distributeClipsToLessons(enriched, [], 5);

    // For each clip from v1, gather (sourceStart, lessonIdx). After sorting
    // by sourceStart, the lessonIdx sequence must be non-decreasing — i.e.,
    // the clip that comes first in the source video appears in an earlier
    // (or equal) lesson than the next.
    const v1Order: { start: number; lessonIdx: number }[] = [];
    for (const lesson of plan.lessons) {
      for (const clip of lesson.clips) {
        if (clip.videoId === "v1") {
          v1Order.push({ start: clip.startSeconds, lessonIdx: lesson.lessonIndex });
        }
      }
    }
    v1Order.sort((a, b) => a.start - b.start);
    for (let k = 1; k < v1Order.length; k++) {
      expect(v1Order[k].lessonIdx).toBeGreaterThanOrEqual(v1Order[k - 1].lessonIdx);
    }
  });

  it("uses an adaptive snap window proportional to slice spacing", () => {
    // Repro of the upper-body-workout case: 820s single-topic video being cut
    // into 2 slices. Arithmetic mid lands at 410s; the nearest Gemini segment
    // boundaries sit at 267 and 542 — 143s and 132s away. Under the legacy
    // fixed 60s snap window, neither qualifies and the cut straddles a
    // segment. With an adaptive window proportional to the 410s slice
    // spacing, the closer (132s) boundary wins.
    const digest: EnrichedContentDigest = {
      contentId: "v1",
      contentTitle: "Upper-body workout",
      contentType: "video",
      keyConcepts: ["workout"],
      skillsIntroduced: [],
      memorableExamples: [],
      difficultyLevel: "intermediate",
      summary: "...",
      segments: [
        { startSeconds: 0, endSeconds: 267, text: "warmup", topic: "warmup" },
        { startSeconds: 267, endSeconds: 542, text: "bench", topic: "bench press" },
        { startSeconds: 542, endSeconds: 820, text: "rows", topic: "rows" },
      ],
      topics: [{ label: "Full Upper-Body Workout", startSeconds: 0, endSeconds: 820 }],
      keyMoments: [],
      durationSeconds: 820,
    };

    const plan = distributeClipsToLessons([digest], [], 2);
    const boundaries = plan.lessons.flatMap((l) =>
      l.clips.flatMap((c) => [c.startSeconds, c.endSeconds]),
    );

    // 542 is 132s from the arithmetic 410 — outside the old 60s window,
    // inside the adaptive window. It must win over the arithmetic 410.
    expect(boundaries).toContain(542);
    expect(boundaries).not.toContain(410);
  });
});

// ---------------------------------------------------------------------------
// Basic digest duration preservation: the basic-digest path used to hardcode
// endSeconds = 600s, silently truncating any longer video. Now it honors the
// digest's durationSeconds field.
// ---------------------------------------------------------------------------

describe("distributeClipsToLessons — basic digest duration", () => {
  it("respects durationSeconds on basic digests instead of defaulting to 600s", () => {
    const basic = [
      {
        contentId: "v1",
        contentTitle: "Long video",
        contentType: "video" as const,
        keyConcepts: ["topic"],
        skillsIntroduced: [],
        memorableExamples: [],
        difficultyLevel: "intermediate",
        summary: "long",
        durationSeconds: 1200,
      },
    ];
    const plan = distributeClipsToLessons([], basic, 2);

    expect(plan.lessons).toHaveLength(2);
    // Total content duration matches the source — no truncation to 600s.
    expect(plan.totalDurationSeconds).toBe(1200);
    // Both lessons get a clip from the splitting fill path.
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("still falls back to 600s when durationSeconds is absent", () => {
    const basic = [
      {
        contentId: "v1",
        contentTitle: "Unknown duration",
        contentType: "video" as const,
        keyConcepts: ["topic"],
        skillsIntroduced: [],
        memorableExamples: [],
        difficultyLevel: "intermediate",
        summary: "unknown",
      },
    ];
    const plan = distributeClipsToLessons([], basic, 1);
    expect(plan.totalDurationSeconds).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// Lower MIN_DURATION_FOR_SPLIT_SECONDS (was 8 min, now 5 min): a 6-min
// multi-topic video should now split rather than collapse to one clip.
// ---------------------------------------------------------------------------

describe("distributeClipsToLessons — 5-min split threshold", () => {
  it("splits a 6-min video with two distinct topics", () => {
    const enriched = [
      makeEnrichedDigest(
        "v1",
        "Quick demo",
        [
          { label: "Setup", startSeconds: 0, endSeconds: 180 },
          { label: "Execution", startSeconds: 180, endSeconds: 360 },
        ],
        360,
      ),
    ];
    const plan = distributeClipsToLessons(enriched, [], 2);
    expect(plan.lessons).toHaveLength(2);
    // 2 distinct topics → 2 per-topic clips → 1 per lesson
    for (const lesson of plan.lessons) {
      expect(lesson.clips.length).toBeGreaterThanOrEqual(1);
    }
    expect(plan.totalClips).toBe(2);
  });
});

describe("formatDistributionPlanForPrompt", () => {
  it("formats a plan as readable text", () => {
    // Duration ≥ 480s and two distinct topic labels → distributor splits into
    // two clips (one per lesson) so the formatter shows both topic labels.
    const enriched = [
      makeEnrichedDigest("v1", "My Video", [
        { label: "Intro", startSeconds: 0, endSeconds: 300 },
        { label: "Main", startSeconds: 300, endSeconds: 600 },
      ], 600),
    ];
    const plan = distributeClipsToLessons(enriched, [], 2);
    const text = formatDistributionPlanForPrompt(plan);

    expect(text).toContain("VIDEO ASSIGNMENT PLAN (MANDATORY)");
    expect(text).toContain("Lesson 1");
    expect(text).toContain("Lesson 2");
    expect(text).toContain("My Video");
    expect(text).toContain("Intro");
    expect(text).toContain("Main");
    expect(text).toContain("MUST follow them exactly");
  });

  it("enumerates each Gemini segment when a clip spans more than one", () => {
    // Single 226s video, single topic spanning the whole video, four finer
    // segments. The distributor leaves it as one full-video clip (under
    // MIN_DURATION_FOR_SPLIT_SECONDS). The prompt-builder should expose all
    // four segments separately so the LLM knows there are four distinct
    // sub-topics to reflect in chapterTitle/summary.
    const digest: EnrichedContentDigest = {
      contentId: "macros",
      contentTitle: "Macronutrients",
      contentType: "video",
      keyConcepts: ["macros"],
      skillsIntroduced: [],
      memorableExamples: [],
      difficultyLevel: "intermediate",
      summary: "...",
      segments: [
        { startSeconds: 0, endSeconds: 35, text: "intro by Alexis Hawes about macronutrients", topic: "intro" },
        { startSeconds: 35, endSeconds: 143, text: "carbs are the body's preferred fuel source", topic: "carbs" },
        { startSeconds: 143, endSeconds: 217, text: "protein deficit is fiber not protein", topic: "protein" },
        { startSeconds: 217, endSeconds: 226, text: "fats are unsaturated and saturated", topic: "fats" },
      ],
      topics: [{ label: "Macronutrients", startSeconds: 0, endSeconds: 226 }],
      keyMoments: [],
      durationSeconds: 226,
    };

    const plan = distributeClipsToLessons([digest], [], 1);
    const text = formatDistributionPlanForPrompt(plan, [digest]);

    // Multi-segment header signals the count explicitly
    expect(text).toContain("4 segments");
    expect(text).toContain("MUST reflect all of them");
    // Each segment's text appears, with its own timestamp
    expect(text).toContain("[0:00-0:35]");
    expect(text).toContain("intro by Alexis Hawes");
    expect(text).toContain("[0:35-2:23]");
    expect(text).toContain("carbs are the body");
    expect(text).toContain("[2:23-3:37]");
    expect(text).toContain("protein deficit");
    expect(text).toContain("[3:37-3:46]");
    expect(text).toContain("fats are unsaturated");
  });

  it("falls back to single-line excerpt when only one segment overlaps", () => {
    const digest: EnrichedContentDigest = {
      contentId: "v1",
      contentTitle: "Single",
      contentType: "video",
      keyConcepts: ["x"],
      skillsIntroduced: [],
      memorableExamples: [],
      difficultyLevel: "intermediate",
      summary: "...",
      segments: [
        { startSeconds: 0, endSeconds: 240, text: "one continuous segment", topic: "one" },
      ],
      topics: [{ label: "One", startSeconds: 0, endSeconds: 240 }],
      keyMoments: [],
      durationSeconds: 240,
    };
    const plan = distributeClipsToLessons([digest], [], 1);
    const text = formatDistributionPlanForPrompt(plan, [digest]);
    expect(text).toContain('Transcript (0:00-4:00): "one continuous segment"');
    expect(text).not.toContain("segments;");
  });
});

describe("validateAndFixClipDistribution", () => {
  it("passes a valid draft", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Video 1", [
        { label: "Topic A", startSeconds: 0, endSeconds: 300 },
      ], 300),
    ];
    const plan = distributeClipsToLessons(enriched, [], 1);

    const draft = {
      weeks: [
        {
          weekNumber: 1,
          title: "Week 1",
          summary: "test",
          sessions: [
            {
              title: "Session 1",
              summary: "test",
              keyTakeaways: ["a"],
              orderIndex: 0,
              actions: [],
              clips: [
                { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 300, orderIndex: 0 },
              ],
              overlays: [
                { type: "TITLE_CARD", content: {}, position: "CENTER", durationMs: 4000, orderIndex: 0, triggerAtSeconds: 0 },
              ],
            },
          ],
        },
      ],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing videos and provides a fix", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Video 1", [
        { label: "Topic A", startSeconds: 0, endSeconds: 300 },
      ], 300),
      makeEnrichedDigest("v2", "Video 2", [
        { label: "Topic B", startSeconds: 0, endSeconds: 250 },
      ], 250),
    ];
    const plan = distributeClipsToLessons(enriched, [], 2);

    // Draft is missing v2 entirely
    const draft = {
      weeks: [
        {
          weekNumber: 1,
          title: "Week 1",
          summary: "test",
          sessions: [
            {
              title: "Session 1",
              summary: "test",
              keyTakeaways: ["a"],
              orderIndex: 0,
              actions: [],
              clips: [
                { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 300, orderIndex: 0 },
              ],
            },
          ],
        },
        {
          weekNumber: 2,
          title: "Week 2",
          summary: "test",
          sessions: [
            {
              title: "Session 2",
              summary: "test",
              keyTakeaways: ["b"],
              orderIndex: 0,
              actions: [],
              clips: [
                { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 300, orderIndex: 0 },
              ],
            },
          ],
        },
      ],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("v2"))).toBe(true);
    expect(result.fixedDraft).toBeDefined();

    // The fixed draft should have v2 in it
    const fixedVideoIds = new Set(
      result.fixedDraft!.weeks.flatMap((w: { sessions: { clips: { youtubeVideoId: string }[] }[] }) =>
        w.sessions.flatMap((s: { clips: { youtubeVideoId: string }[] }) =>
          (s.clips ?? []).map((c: { youtubeVideoId: string }) => c.youtubeVideoId),
        ),
      ),
    );
    expect(fixedVideoIds).toContain("v2");
  });

  it("detects sessions with no clips", () => {
    const enriched = [
      makeEnrichedDigest("v1", "Video 1", [
        { label: "Topic A", startSeconds: 0, endSeconds: 300 },
      ], 300),
    ];
    const plan = distributeClipsToLessons(enriched, [], 2);

    const draft = {
      weeks: [
        {
          weekNumber: 1,
          sessions: [
            { clips: [{ youtubeVideoId: "v1", startSeconds: 0, endSeconds: 300 }] },
          ],
        },
        {
          weekNumber: 2,
          sessions: [
            { clips: [] }, // Empty!
          ],
        },
      ],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no clips"))).toBe(true);
  });

  // ─── Coverage / overlap / drift checks (Ticket 86e1cgy5q) ───
  // These exercise the post-Ticket-#2 failure modes: the LLM is free to
  // subdivide a planned clip into multiple segment-aligned sub-clips, but
  // the union must stay within ±15s of the plan's range and the sub-clips
  // must not overlap or leave internal gaps.

  it("accepts a valid LLM subdivision of a single planned range", () => {
    // Plan has one clip 0-300; LLM split it into [0-150, 150-300]. No overlap,
    // no gap, union matches the plan. Should be considered valid and the
    // subdivision preserved.
    const enriched = [
      makeEnrichedDigest("v1", "Video 1", [
        { label: "Topic A", startSeconds: 0, endSeconds: 300 },
      ], 300),
    ];
    const plan = distributeClipsToLessons(enriched, [], 1);

    const draft = {
      weeks: [{
        weekNumber: 1,
        title: "Week 1",
        summary: "",
        sessions: [{
          title: "Session 1",
          summary: "",
          keyTakeaways: ["a"],
          orderIndex: 0,
          actions: [],
          clips: [
            { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 150, orderIndex: 0, chapterTitle: "First half" },
            { youtubeVideoId: "v1", startSeconds: 150, endSeconds: 300, orderIndex: 1, chapterTitle: "Second half" },
          ],
          overlays: [{ type: "TITLE_CARD", content: {}, position: "CENTER", durationMs: 4000, orderIndex: 0, triggerAtSeconds: 0 }],
        }],
      }],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects overlapping sub-clips and repairs to a single plan clip", () => {
    // Plan has one clip 0-300; LLM produced [0-225, 216-225] — clip #2 sits
    // inside clip #1 (the get-well-soon L1 failure mode).
    const enriched = [
      makeEnrichedDigest("v1", "Video 1", [
        { label: "Topic A", startSeconds: 0, endSeconds: 300 },
      ], 300),
    ];
    const plan = distributeClipsToLessons(enriched, [], 1);

    const draft = {
      weeks: [{
        weekNumber: 1,
        title: "Week 1",
        summary: "",
        sessions: [{
          title: "Session 1",
          summary: "",
          keyTakeaways: ["a"],
          orderIndex: 0,
          actions: [],
          clips: [
            { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 225, orderIndex: 0, chapterTitle: "Main" },
            { youtubeVideoId: "v1", startSeconds: 216, endSeconds: 225, orderIndex: 1, chapterTitle: "Tail" },
          ],
        }],
      }],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("drifted from plan"))).toBe(true);
    expect(result.fixedDraft).toBeDefined();
    const fixedClips = result.fixedDraft!.weeks[0].sessions[0].clips;
    expect(fixedClips).toHaveLength(1);
    expect(fixedClips[0].startSeconds).toBe(0);
    expect(fixedClips[0].endSeconds).toBe(300);
  });

  it("detects coverage gaps and repairs to the plan range", () => {
    // 250s video (below MIN_DURATION_FOR_SPLIT_SECONDS=300) → distributor
    // produces ONE clip 0-250. LLM persisted [0-80, 200-250] — leaves 80-200
    // unassigned (the upper-body-workout video1 failure mode in miniature).
    const enriched = [
      makeEnrichedDigest("v1", "Video 1", [
        { label: "Topic A", startSeconds: 0, endSeconds: 250 },
      ], 250),
    ];
    const plan = distributeClipsToLessons(enriched, [], 1);
    expect(plan.lessons[0].clips).toHaveLength(1); // sanity-check the setup

    const draft = {
      weeks: [{
        weekNumber: 1,
        title: "Week 1",
        summary: "",
        sessions: [{
          title: "Session 1",
          summary: "",
          keyTakeaways: ["a"],
          orderIndex: 0,
          actions: [],
          clips: [
            { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 80, orderIndex: 0, chapterTitle: "First" },
            { youtubeVideoId: "v1", startSeconds: 200, endSeconds: 250, orderIndex: 1, chapterTitle: "Third" },
          ],
        }],
      }],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("drifted from plan"))).toBe(true);
    const fixedClips = result.fixedDraft!.weeks[0].sessions[0].clips;
    expect(fixedClips).toHaveLength(1);
    expect(fixedClips[0].startSeconds).toBe(0);
    expect(fixedClips[0].endSeconds).toBe(250);
  });

  it("repairs only the broken (videoId, range) groups and keeps valid sub-clipping elsewhere", () => {
    // Plan has two clips in the same lesson, one per video.
    // LLM produces:
    //   - v1: valid 3-way subdivision [0-100, 100-200, 200-300] — should be preserved
    //   - v2: broken overlap [0-150, 100-200] — should be repaired to plan [0-200]
    // Distinct topic labels so the distributor doesn't merge clips.
    const enriched = [
      makeEnrichedDigest("v1", "Press Mechanics", [
        { label: "Press Mechanics", startSeconds: 0, endSeconds: 300 },
      ], 300),
      makeEnrichedDigest("v2", "Cable Crossover", [
        { label: "Cable Crossover", startSeconds: 0, endSeconds: 200 },
      ], 200),
    ];
    // 1 lesson, 2 videos → distributor assigns one clip per video to lesson 1.
    const plan = distributeClipsToLessons(enriched, [], 1);

    const draft = {
      weeks: [{
        weekNumber: 1,
        title: "Week 1",
        summary: "",
        sessions: [{
          title: "Session 1",
          summary: "",
          keyTakeaways: ["a"],
          orderIndex: 0,
          actions: [],
          clips: [
            // v1: clean 3-way subdivision of the 0-300 plan clip
            { youtubeVideoId: "v1", startSeconds: 0, endSeconds: 100, orderIndex: 0, chapterTitle: "Press setup" },
            { youtubeVideoId: "v1", startSeconds: 100, endSeconds: 200, orderIndex: 1, chapterTitle: "Press form" },
            { youtubeVideoId: "v1", startSeconds: 200, endSeconds: 300, orderIndex: 2, chapterTitle: "Press finish" },
            // v2: overlap on the 0-200 plan clip
            { youtubeVideoId: "v2", startSeconds: 0, endSeconds: 150, orderIndex: 3, chapterTitle: "Cross A" },
            { youtubeVideoId: "v2", startSeconds: 100, endSeconds: 200, orderIndex: 4, chapterTitle: "Cross B" },
          ],
        }],
      }],
    };

    const result = validateAndFixClipDistribution(draft, plan, enriched);
    expect(result.valid).toBe(false);
    // Only the v2 group should be flagged as drifted
    expect(result.errors.filter((e) => e.includes("drifted")).length).toBe(1);
    expect(result.errors.some((e) => e.includes("drifted"))).toBe(true);

    const fixedClips = result.fixedDraft!.weeks[0].sessions[0].clips;
    // v1 sub-clipping preserved (3 clips), v2 collapsed to single plan clip (1)
    const v1Clips = fixedClips.filter((c: { youtubeVideoId: string }) => c.youtubeVideoId === "v1");
    const v2Clips = fixedClips.filter((c: { youtubeVideoId: string }) => c.youtubeVideoId === "v2");
    expect(v1Clips).toHaveLength(3);
    expect(v1Clips.map((c: { startSeconds: number; endSeconds: number }) => [c.startSeconds, c.endSeconds]))
      .toEqual([[0, 100], [100, 200], [200, 300]]);
    expect(v1Clips.map((c: { chapterTitle?: string }) => c.chapterTitle))
      .toEqual(["Press setup", "Press form", "Press finish"]);
    expect(v2Clips).toHaveLength(1);
    expect([v2Clips[0].startSeconds, v2Clips[0].endSeconds]).toEqual([0, 200]);
  });
});
