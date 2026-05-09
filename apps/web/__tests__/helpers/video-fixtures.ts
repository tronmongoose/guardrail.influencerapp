import type { EnrichedContentDigest, ContentDigest } from "@guide-rail/ai";
import type { VideoTopic } from "@guide-rail/shared";

export function makeTopic(
  startSeconds: number,
  endSeconds: number,
  label?: string,
): VideoTopic {
  return {
    label: label ?? `Topic ${startSeconds}-${endSeconds}`,
    startSeconds,
    endSeconds,
  };
}

export function makeEnrichedDigest(args: {
  contentId: string;
  contentTitle?: string;
  durationSeconds: number;
  topics: VideoTopic[];
}): EnrichedContentDigest {
  const { contentId, contentTitle, durationSeconds, topics } = args;
  return {
    contentId,
    contentTitle: contentTitle ?? `Video ${contentId}`,
    contentType: "video",
    keyConcepts: topics.map((t) => t.label),
    skillsIntroduced: [],
    memorableExamples: [],
    difficultyLevel: "intermediate",
    summary: `Video ${contentId}`,
    segments: topics.map((t) => ({
      startSeconds: t.startSeconds,
      endSeconds: t.endSeconds,
      text: `text for ${t.label}`,
      topic: t.label,
    })),
    topics,
    keyMoments: [],
    durationSeconds,
  };
}

export function makeBasicDigest(
  contentId: string,
  contentTitle?: string,
): ContentDigest {
  return {
    contentId,
    contentTitle: contentTitle ?? `Video ${contentId}`,
    contentType: "video",
    keyConcepts: [contentTitle ?? contentId],
    skillsIntroduced: [],
    memorableExamples: [],
    difficultyLevel: "intermediate",
    summary: `Basic ${contentId}`,
  };
}

// Mulberry32: deterministic, good distribution, tiny.
// Source seed prints on failure so a flaky case can be replayed.
export function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Generate a non-decreasing topic timeline that fills [0, duration].
// Used by splitting fuzz to produce well-formed Gemini-shaped inputs.
export function randomContiguousTopics(
  rng: () => number,
  durationSeconds: number,
  count: number,
): VideoTopic[] {
  if (count <= 0 || durationSeconds <= 0) return [];
  // Pick (count - 1) cut points in (0, duration), sort, and use as boundaries.
  const cuts = new Set<number>();
  while (cuts.size < count - 1) {
    cuts.add(randInt(rng, 1, durationSeconds - 1));
  }
  const sorted = [0, ...[...cuts].sort((a, b) => a - b), durationSeconds];
  const topics: VideoTopic[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    topics.push({
      label: `t${i}-${sorted[i]}-${sorted[i + 1]}`,
      startSeconds: sorted[i],
      endSeconds: sorted[i + 1],
    });
  }
  return topics;
}
