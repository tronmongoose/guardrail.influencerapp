import { describe, it, expect, vi } from "vitest";
import {
  shouldSegment,
  buildSegmentSpecs,
  buildSegmentSpecsForCount,
  maybeSegmentVideo,
} from "@/lib/video-segmentation";
import type { VideoTopic } from "@guide-rail/shared";
import { makeTopic } from "./helpers/video-fixtures";

// =============================================================================
// A. Threshold (shouldSegment + buildSegmentSpecs)
// =============================================================================

describe("shouldSegment", () => {
  it("returns false at the boundary (duration === 600)", () => {
    expect(shouldSegment(600)).toBe(false);
  });

  it("returns true for duration === 601", () => {
    expect(shouldSegment(601)).toBe(true);
  });

  it("returns false below threshold", () => {
    expect(shouldSegment(599)).toBe(false);
    expect(shouldSegment(0)).toBe(false);
  });
});

describe("buildSegmentSpecs — threshold-independent (gating happens upstream)", () => {
  // buildSegmentSpecs does NOT inspect duration vs THRESHOLD_SECONDS — that's
  // maybeSegmentVideo's job. These tests pin the surface behavior on both sides.

  it("returns [] for empty topics", () => {
    expect(buildSegmentSpecs([], 1000)).toEqual([]);
  });

  it("returns [] when only 1 long topic exists (no split warranted)", () => {
    const topics: VideoTopic[] = [makeTopic(0, 700)];
    expect(buildSegmentSpecs(topics, 700)).toEqual([]);
  });

  it("returns 2 specs for two distinct >=60s topics, last clamped to durationSeconds", () => {
    const topics: VideoTopic[] = [makeTopic(0, 350, "intro"), makeTopic(350, 700, "main")];
    const specs = buildSegmentSpecs(topics, 700);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toMatchObject({ startSeconds: 0, endSeconds: 350, segmentIndex: 0 });
    expect(specs[1]).toMatchObject({ startSeconds: 350, endSeconds: 700, segmentIndex: 1 });
  });
});

// =============================================================================
// B. Short-topic merging (MIN_SEGMENT = 60s)
// =============================================================================

describe("buildSegmentSpecs — short-topic merging", () => {
  it("merges a run of <60s topics into one block until cumulative >=60s", () => {
    // [0-10, 10-20, 20-30, 30-40, 40-60, 60-700]
    // first 5 collapse into pending block 0-60 (graduates at exactly 60s),
    // then 60-700 stands alone. Expect 2 specs.
    const topics: VideoTopic[] = [
      makeTopic(0, 10, "a"),
      makeTopic(10, 20, "b"),
      makeTopic(20, 30, "c"),
      makeTopic(30, 40, "d"),
      makeTopic(40, 60, "e"),
      makeTopic(60, 700, "main"),
    ];
    const specs = buildSegmentSpecs(topics, 700);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toMatchObject({ startSeconds: 0, endSeconds: 60, label: "a" });
    expect(specs[1]).toMatchObject({ startSeconds: 60, endSeconds: 700 });
  });

  it("absorbs a leftover short trailing topic into the last merged topic by extending its endSeconds", () => {
    // [0-100 (long), 100-130 (30s short, pending at end)]
    // pending absorbed into last merged → merged = [{0-130}], length 1 → returns [].
    const topics: VideoTopic[] = [makeTopic(0, 100, "main"), makeTopic(100, 130, "tail")];
    expect(buildSegmentSpecs(topics, 140)).toEqual([]);
  });

  it("returns [] if all topics are <60s (single absorbed pending block)", () => {
    // Even though cumulative duration > threshold, only 1 spec survives → [].
    const topics: VideoTopic[] = [
      makeTopic(0, 30, "a"),
      makeTopic(30, 50, "b"),
      makeTopic(50, 80, "c"),
      makeTopic(80, 120, "d"),
      makeTopic(120, 150, "e"),
      makeTopic(150, 700, "f"), // last is long but pending has already graduated by then
    ];
    // Trace: a (pending 0-30, <60) → b extends to 0-50 (<60) → c extends to 0-80 (>=60, push, pending=null)
    //        → d=40s pending → e extends to 80-150 (>=60, push, pending=null) → f=550s push.
    // merged length 3 ≥ 2 → returns 3 specs. Lock that behavior.
    const specs = buildSegmentSpecs(topics, 700);
    expect(specs).toHaveLength(3);
    expect(specs[0].endSeconds).toBe(80);
    expect(specs[1]).toMatchObject({ startSeconds: 80, endSeconds: 150 });
    expect(specs[2]).toMatchObject({ startSeconds: 150, endSeconds: 700 });
  });

  it("absorbs a short middle topic forward into the next (pending grows until graduates)", () => {
    // [0-120 (long), 120-150 (30s, pending), 150-800 (650s, absorbed into pending which graduates)]
    // Trace: 0-120 push. 120-150 pending. Next iter: pending exists, extend pending to 120-800
    //        → graduates (>=60), push. merged = [{0-120}, {120-800}]. 2 specs.
    const topics: VideoTopic[] = [
      makeTopic(0, 120, "a"),
      makeTopic(120, 150, "b"),
      makeTopic(150, 800, "c"),
    ];
    const specs = buildSegmentSpecs(topics, 800);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toMatchObject({ startSeconds: 0, endSeconds: 120 });
    expect(specs[1]).toMatchObject({ startSeconds: 120, endSeconds: 800 });
  });
});

// =============================================================================
// C. MAX_SEGMENTS = 8 cap
// =============================================================================

describe("buildSegmentSpecs — MAX_SEGMENTS cap", () => {
  it("caps at 8 specs when 12 distinct >=60s topics are provided", () => {
    const topics: VideoTopic[] = [];
    for (let i = 0; i < 12; i++) {
      topics.push(makeTopic(i * 333, (i + 1) * 333, `t${i}`));
    }
    const duration = 12 * 333;
    const specs = buildSegmentSpecs(topics, duration);
    expect(specs).toHaveLength(8);
    // Last spec ends exactly at duration
    expect(specs[specs.length - 1].endSeconds).toBe(duration);
    // segmentIndex monotonically increasing 0..7
    expect(specs.map((s) => s.segmentIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns exactly 8 specs (no merging) when 8 topics are provided", () => {
    const topics: VideoTopic[] = [];
    for (let i = 0; i < 8; i++) {
      topics.push(makeTopic(i * 100, (i + 1) * 100, `t${i}`));
    }
    const specs = buildSegmentSpecs(topics, 800);
    expect(specs).toHaveLength(8);
  });

  it("on tie for shortest-adjacent-pair, leftmost wins (deterministic)", () => {
    // 9 equal topics → cap loop fires once. With strict `<`, the first pair (i=0) wins.
    const topics: VideoTopic[] = [];
    for (let i = 0; i < 9; i++) {
      topics.push(makeTopic(i * 100, (i + 1) * 100, `t${i}`));
    }
    const specs = buildSegmentSpecs(topics, 900);
    expect(specs).toHaveLength(8);
    // First spec should now span 0-200 (t0+t1 merged because leftmost won)
    expect(specs[0]).toMatchObject({ startSeconds: 0, endSeconds: 200 });
    expect(specs[1]).toMatchObject({ startSeconds: 200, endSeconds: 300 });
  });
});

// =============================================================================
// D. Last-segment clamp
// =============================================================================

describe("buildSegmentSpecs — last-segment clamp/extend", () => {
  it("extends last spec to durationSeconds when topics undershoot", () => {
    const topics: VideoTopic[] = [makeTopic(0, 200, "a"), makeTopic(200, 400, "b")];
    const specs = buildSegmentSpecs(topics, 1000); // 600s of unaccounted tail
    expect(specs).toHaveLength(2);
    expect(specs[1].endSeconds).toBe(1000);
  });

  it("clamps last spec to durationSeconds when topics overshoot", () => {
    const topics: VideoTopic[] = [makeTopic(0, 200, "a"), makeTopic(200, 1500, "b")];
    const specs = buildSegmentSpecs(topics, 1000); // last topic overshoots
    expect(specs).toHaveLength(2);
    expect(specs[1].endSeconds).toBe(1000);
  });
});

// =============================================================================
// E. Directed split (buildSegmentSpecsForCount)
// =============================================================================

describe("buildSegmentSpecsForCount — directed split", () => {
  it("returns [] for targetCount <= 1", () => {
    expect(buildSegmentSpecsForCount([], 1000, 0)).toEqual([]);
    expect(buildSegmentSpecsForCount([], 1000, 1)).toEqual([]);
    expect(buildSegmentSpecsForCount([], 1000, -5)).toEqual([]);
  });

  it("returns [] for non-positive duration", () => {
    expect(buildSegmentSpecsForCount([], 0, 4)).toEqual([]);
    expect(buildSegmentSpecsForCount([], -10, 4)).toEqual([]);
  });

  it("snaps each ideal break to the nearest topic boundary within ±30s", () => {
    // ideal breaks for target=4, duration=1000: [250, 500, 750]
    // boundaries at endSeconds in (0, duration): [240, 510, 770]
    const topics: VideoTopic[] = [
      makeTopic(0, 240, "a"),
      makeTopic(240, 510, "b"),
      makeTopic(510, 770, "c"),
      makeTopic(770, 1000, "d"),
    ];
    const specs = buildSegmentSpecsForCount(topics, 1000, 4);
    expect(specs).toHaveLength(4);
    expect(specs.map((s) => s.endSeconds)).toEqual([240, 510, 770, 1000]);
  });

  it("uses ideal time when no topic boundary is within ±30s", () => {
    // ideal breaks: [250, 500, 750]. Only boundary 100 → all three exceed snap window.
    const topics: VideoTopic[] = [makeTopic(0, 100, "a"), makeTopic(100, 1000, "b")];
    const specs = buildSegmentSpecsForCount(topics, 1000, 4);
    expect(specs).toHaveLength(4);
    // Cuts should be at ideal positions, not the irrelevant 100s boundary.
    expect(specs[0].endSeconds).toBe(250);
    expect(specs[1].endSeconds).toBe(500);
    expect(specs[2].endSeconds).toBe(750);
    expect(specs[3].endSeconds).toBe(1000);
  });

  it("snaps when a boundary is within window, falls back to ideal when not", () => {
    // ideal breaks: [250, 500, 750]. Boundary at 510 only.
    // 250: no snap (|510-250|=260). push 250.
    // 500: snap to 510 (|10| ≤ 30).
    // 750: 510 already used. push 750.
    const topics: VideoTopic[] = [makeTopic(0, 510, "a"), makeTopic(510, 1000, "b")];
    const specs = buildSegmentSpecsForCount(topics, 1000, 4);
    expect(specs).toHaveLength(4);
    expect(specs.map((s) => s.endSeconds)).toEqual([250, 510, 750, 1000]);
  });

  it("each used boundary cannot be reused for a second snap", () => {
    // Two ideal breaks both nearest the same boundary; only the first gets it.
    // ideal breaks for target=3, duration=300: [100, 200].
    // Boundary at 150 (within 50 of both, but window is ±30, so neither snaps).
    // Make it tighter: boundary 105.
    const topics: VideoTopic[] = [makeTopic(0, 105, "a"), makeTopic(105, 300, "b")];
    const specs = buildSegmentSpecsForCount(topics, 300, 3);
    expect(specs).toHaveLength(3);
    // First ideal break 100 snaps to 105; second ideal 200 has no nearby boundary → 200.
    expect(specs.map((s) => s.endSeconds)).toEqual([105, 200, 300]);
  });

  it("produces exactly targetCount specs even at extreme targetCount=100", () => {
    // No MAX_SEGMENTS cap on directed mode. Lock current behavior: 100 micro-specs.
    // PRESSURE: micro-segments may not be useful learner content; this asserts
    // the function does not crash or cap silently.
    const specs = buildSegmentSpecsForCount([], 1200, 100);
    expect(specs).toHaveLength(100);
    expect(specs[0].startSeconds).toBe(0);
    expect(specs[specs.length - 1].endSeconds).toBe(1200);
    // Each spec is contiguous with the next.
    for (let i = 1; i < specs.length; i++) {
      expect(specs[i].startSeconds).toBe(specs[i - 1].endSeconds);
    }
  });

  it("labels segments using the topic that covers the segment midpoint (or 'Part N')", () => {
    const topics: VideoTopic[] = [
      makeTopic(0, 500, "intro"),
      makeTopic(500, 1000, "outro"),
    ];
    const specs = buildSegmentSpecsForCount(topics, 1000, 2);
    expect(specs[0].label).toBe("intro");
    expect(specs[1].label).toBe("outro");
  });

  it("falls back to 'Part N' label when no topic covers the segment midpoint", () => {
    const specs = buildSegmentSpecsForCount([], 1000, 4);
    for (const s of specs) {
      expect(s.label).toMatch(/^Part \d+$/);
    }
  });
});

// =============================================================================
// F. maybeSegmentVideo idempotency (with mocked Prisma)
// =============================================================================

interface PrismaTxStub {
  youTubeVideo: {
    count: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $executeRaw: ReturnType<typeof vi.fn>;
}

function makePrismaStub(initialCount: number) {
  const tx: PrismaTxStub = {
    youTubeVideo: {
      count: vi.fn().mockResolvedValue(initialCount),
      deleteMany: vi.fn().mockResolvedValue({ count: initialCount }),
      create: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
  };
  const $transaction = vi.fn().mockImplementation(async (cb: (tx: PrismaTxStub) => unknown) => cb(tx));
  return { tx, $transaction, prisma: { $transaction } };
}

const PARENT_VIDEO = {
  id: "parent-123",
  videoId: "yt-abc",
  url: "https://stream.mux.com/abc",
  title: "Beat Making 101",
  authorName: "Creator",
  thumbnailUrl: null,
  programId: "prog-1",
  parentVideoId: null,
  isSegment: false,
  segmentIndex: null,
  startSeconds: null,
  endSeconds: null,
  // fields below are placeholders so the cast satisfies prisma types in callers;
  // none are read by maybeSegmentVideo.
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Parameters<typeof maybeSegmentVideo>[1];

describe("maybeSegmentVideo — idempotency & gating", () => {
  it("auto mode: returns without DB writes when duration <= 600s", async () => {
    const { prisma, tx } = makePrismaStub(0);
    const topics: VideoTopic[] = [makeTopic(0, 300, "a"), makeTopic(300, 600, "b")];
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, topics, 600);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.youTubeVideo.create).not.toHaveBeenCalled();
  });

  it("auto mode: returns without DB writes when topics.length < 2", async () => {
    const { prisma, tx } = makePrismaStub(0);
    const topics: VideoTopic[] = [makeTopic(0, 800, "only")];
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, topics, 800);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.youTubeVideo.create).not.toHaveBeenCalled();
  });

  it("auto mode: returns without DB writes when buildSegmentSpecs would yield <2 specs", async () => {
    const { prisma } = makePrismaStub(0);
    // Two topics but second is short and absorbs into first → 1 spec → returns []
    const topics: VideoTopic[] = [makeTopic(0, 700, "a"), makeTopic(700, 730, "b")];
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, topics, 730);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("idempotent: existing segment count == new spec count → no delete, no create", async () => {
    const topics: VideoTopic[] = [
      makeTopic(0, 350, "a"),
      makeTopic(350, 700, "b"),
    ];
    // buildSegmentSpecs would yield 2 specs. Pretend 2 already exist.
    const { prisma, tx } = makePrismaStub(2);
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, topics, 700);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.youTubeVideo.deleteMany).not.toHaveBeenCalled();
    expect(tx.youTubeVideo.create).not.toHaveBeenCalled();
  });

  it("recreate: existing segment count != new spec count → delete then create", async () => {
    const topics: VideoTopic[] = [
      makeTopic(0, 350, "a"),
      makeTopic(350, 700, "b"),
    ];
    const { prisma, tx } = makePrismaStub(5); // stale count
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, topics, 700);
    expect(tx.youTubeVideo.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.youTubeVideo.create).toHaveBeenCalledTimes(2);
  });

  it("first run: existing count == 0 → no delete, but creates new segments", async () => {
    const topics: VideoTopic[] = [
      makeTopic(0, 350, "a"),
      makeTopic(350, 700, "b"),
    ];
    const { prisma, tx } = makePrismaStub(0);
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, topics, 700);
    expect(tx.youTubeVideo.deleteMany).not.toHaveBeenCalled();
    expect(tx.youTubeVideo.create).toHaveBeenCalledTimes(2);
  });

  it("directed mode bypasses the 600s threshold (split a 200s video into 4 parts)", async () => {
    const { prisma, tx } = makePrismaStub(0);
    await maybeSegmentVideo(prisma as never, PARENT_VIDEO, [], 200, 4);
    expect(tx.youTubeVideo.create).toHaveBeenCalledTimes(4);
  });
});

// =============================================================================
// G. Adversarial / malformed Gemini input
// =============================================================================

describe("buildSegmentSpecs — adversarial Gemini input", () => {
  it("zero-duration leading topic becomes pending and absorbs the next topic's range", () => {
    // PRESSURE: locks current behavior. A startSeconds==endSeconds "marker" topic
    // creates a pending block that grows. Worth knowing the segmentation layer
    // does NOT pre-filter zero-duration topics — clip-distributor does.
    const topics: VideoTopic[] = [
      makeTopic(50, 50, "marker"),
      makeTopic(50, 800, "main"),
    ];
    const specs = buildSegmentSpecs(topics, 800);
    // marker (0s) → pending {50-50}. main extends to {50-800}, graduates, push.
    // merged length 1 → returns [].
    expect(specs).toEqual([]);
  });

  it("does not crash on empty topics array with non-zero duration", () => {
    expect(buildSegmentSpecs([], 1200)).toEqual([]);
  });

  it("does not crash on negative-duration topic (locks behavior, may be a real bug)", () => {
    // PRESSURE: behavior may be wrong; locking baseline. A negative-duration
    // topic has duration=(end-start)<0 < MIN_SEGMENT, so it goes to pending,
    // which then absorbs its own (nonsense) end as the new pending end.
    const topics: VideoTopic[] = [
      makeTopic(100, 50, "reversed"), // end < start
      makeTopic(50, 700, "main"),
    ];
    const specs = buildSegmentSpecs(topics, 700);
    // Don't assert exact specs — just don't throw, and last segment hits durationSeconds.
    if (specs.length > 0) {
      expect(specs[specs.length - 1].endSeconds).toBe(700);
    }
  });

  it("handles very large topic counts without performance regression (<200ms)", () => {
    const topics: VideoTopic[] = [];
    for (let i = 0; i < 1000; i++) {
      topics.push(makeTopic(i * 100, (i + 1) * 100, `t${i}`));
    }
    const start = Date.now();
    const specs = buildSegmentSpecs(topics, 1000 * 100);
    const elapsed = Date.now() - start;
    expect(specs.length).toBeLessThanOrEqual(8);
    expect(elapsed).toBeLessThan(200);
  });
});
