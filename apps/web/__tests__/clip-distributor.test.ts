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
});
