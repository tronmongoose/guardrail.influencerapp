import { describe, it, expect } from "vitest";
import {
  computeGuardrailedLessonCount,
  computeSmartPresets,
} from "@guide-rail/ai";
import type { VideoInfo } from "@guide-rail/ai";

const v = (durationSeconds: number): VideoInfo => ({ durationSeconds });

describe("computeGuardrailedLessonCount", () => {
  describe("zero videos", () => {
    it("returns the floor (1) when no videos provided", () => {
      expect(computeGuardrailedLessonCount([])).toBe(1);
    });
  });

  describe("single video", () => {
    it("returns 1 lesson for a video under 5 min", () => {
      expect(computeGuardrailedLessonCount([v(240)])).toBe(1); // 4 min
      expect(computeGuardrailedLessonCount([v(299)])).toBe(1); // 4:59
    });

    it("returns 2-3 lessons for a 5-20 min video, target ~8 min/lesson", () => {
      expect(computeGuardrailedLessonCount([v(300)])).toBe(2);  // 5 min  → max(2, round(0.625)) = 2
      expect(computeGuardrailedLessonCount([v(720)])).toBe(2);  // 12 min → max(2, round(1.5)) = 2
      expect(computeGuardrailedLessonCount([v(960)])).toBe(2);  // 16 min → max(2, round(2)) = 2
      expect(computeGuardrailedLessonCount([v(1200)])).toBe(3); // 20 min → max(2, round(2.5)) = 3 (the example case)
    });

    it("returns 3-5 lessons for a 20-45 min video", () => {
      expect(computeGuardrailedLessonCount([v(1500)])).toBe(3); // 25 min → floor(3.125) = 3
      expect(computeGuardrailedLessonCount([v(1800)])).toBe(3); // 30 min → floor(3.75) = 3
      expect(computeGuardrailedLessonCount([v(2400)])).toBe(5); // 40 min → floor(5) = 5
      expect(computeGuardrailedLessonCount([v(2699)])).toBe(5); // 44:59 → floor(5.62) = 5
    });

    it("returns 5-8 lessons for 45+ min video, capped at 8", () => {
      expect(computeGuardrailedLessonCount([v(2700)])).toBe(5); // 45 min → floor(5.625) = 5
      expect(computeGuardrailedLessonCount([v(3600)])).toBe(7); // 60 min → floor(7.5) = 7
      expect(computeGuardrailedLessonCount([v(5400)])).toBe(8); // 90 min → floor(11.25) clamped to 8
      expect(computeGuardrailedLessonCount([v(36000)])).toBe(8); // 600 min → still 8
    });
  });

  describe("multiple videos", () => {
    it("merges pairs when avg duration is under 3 min", () => {
      // 20 × 2-min videos → ceil(20/2) = 10
      const tiny = Array.from({ length: 20 }, () => v(120));
      expect(computeGuardrailedLessonCount(tiny)).toBe(10);
      // 5 × 1-min videos → ceil(5/2) = 3
      expect(computeGuardrailedLessonCount(Array.from({ length: 5 }, () => v(60)))).toBe(3);
    });

    it("returns 1 lesson per video when avg is in the 3-10 min sweet spot", () => {
      // 5 × 5-min videos
      expect(computeGuardrailedLessonCount(Array.from({ length: 5 }, () => v(300)))).toBe(5);
      // 8 × 8-min videos
      expect(computeGuardrailedLessonCount(Array.from({ length: 8 }, () => v(480)))).toBe(8);
    });

    it("allows splitting (count * 2) when avg is 10+ min", () => {
      // 3 × 20-min videos (the user's flowchart case) → min(6, 12) = 6
      expect(computeGuardrailedLessonCount(Array.from({ length: 3 }, () => v(1200)))).toBe(6);
      // 2 × 30-min videos → min(4, 12) = 4
      expect(computeGuardrailedLessonCount(Array.from({ length: 2 }, () => v(1800)))).toBe(4);
    });
  });

  describe("hard guardrails", () => {
    it("never exceeds 12 lessons", () => {
      // 100 × 30-min videos → would be 200 without clamp
      const many = Array.from({ length: 100 }, () => v(1800));
      expect(computeGuardrailedLessonCount(many)).toBe(12);
    });

    it("never returns less than 1", () => {
      expect(computeGuardrailedLessonCount([])).toBeGreaterThanOrEqual(1);
      expect(computeGuardrailedLessonCount([v(0)])).toBeGreaterThanOrEqual(1);
    });

    it("uses DEFAULT_VIDEO_DURATION fallback when durationSeconds is missing/null", () => {
      // 1 video, no duration → falls back to 600s (10 min) → 5-20 min branch → 2 lessons
      expect(computeGuardrailedLessonCount([{ durationSeconds: null }])).toBe(2);
      expect(computeGuardrailedLessonCount([{}])).toBe(2);
    });
  });
});

describe("computeSmartPresets — 12-cap", () => {
  it("caps Detailed at 12 even when videoCount * 2 would exceed it", () => {
    // 13 videos: detailed would be 26 without the cap
    const presets = computeSmartPresets(13, []);
    const detailed = presets.find((p) => p.label === "Detailed")!;
    expect(detailed.weeks).toBeLessThanOrEqual(12);
  });

  it("clamps Natural so it never exceeds Detailed under the new cap", () => {
    // 20 videos: natural would be 20 unclamped, breaking ordering
    const presets = computeSmartPresets(20, []);
    const compact = presets.find((p) => p.label === "Compact")!;
    const natural = presets.find((p) => p.label === "Natural")!;
    const detailed = presets.find((p) => p.label === "Detailed")!;
    expect(compact.weeks).toBeLessThan(natural.weeks);
    expect(natural.weeks).toBeLessThan(detailed.weeks);
    expect(detailed.weeks).toBeLessThanOrEqual(12);
  });

  it("preserves strict ordering for small videoCount (no regression)", () => {
    const presets = computeSmartPresets(5, []);
    const [compact, natural, detailed] = presets.map((p) => p.weeks);
    expect(compact).toBeLessThan(natural);
    expect(natural).toBeLessThan(detailed);
  });
});
