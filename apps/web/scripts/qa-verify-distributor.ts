/**
 * Quick verification: load a program's videos + Gemini analyses from the QA DB
 * and run the clip distributor directly. Prints the proposed clip boundaries
 * so we can confirm the segment-snap fix landed at the right cuts before
 * spending an LLM round-trip.
 *
 * Usage: pnpm tsx apps/web/scripts/qa-verify-distributor.ts <programId> [lessons]
 */

import { PrismaClient } from "@prisma/client";
import {
  distributeClipsToLessons,
  type EnrichedContentDigest,
} from "@guide-rail/ai";
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvFile(path.resolve(__dirname, "..", ".env"));
loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const prisma = new PrismaClient();

async function main() {
  const programId = process.argv[2];
  const lessonCount = parseInt(process.argv[3] ?? "4", 10);
  if (!programId) {
    console.error("Usage: pnpm tsx apps/web/scripts/qa-verify-distributor.ts <programId> [lessons]");
    process.exit(1);
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { videos: { include: { analysis: true } } },
  });
  if (!program) {
    console.error(`Program ${programId} not found`);
    process.exit(1);
  }

  // Build enriched digests from persisted Gemini analyses. Matches the shape
  // the route hands to the distributor at apps/web/app/api/programs/[id]/generate-async/route.ts.
  const enriched: EnrichedContentDigest[] = program.videos
    .filter((v) => v.analysis)
    .map((v) => {
      const a = v.analysis!;
      return {
        contentId: v.id,
        contentTitle: v.title,
        contentType: "video" as const,
        keyConcepts: [v.title],
        skillsIntroduced: [],
        memorableExamples: [],
        difficultyLevel: "intermediate",
        summary: a.summary,
        segments: a.segments as { startSeconds: number; endSeconds: number; text: string; topic?: string }[],
        topics: a.topics as { label: string; startSeconds: number; endSeconds: number; subtopics?: string[] }[],
        keyMoments: (a.keyMoments as { timestampSeconds: number; description: string; significance?: string; type?: string }[]) || [],
        durationSeconds: a.durationSeconds ?? 0,
      };
    });

  console.log(`Program: ${program.title} (${enriched.length} videos with analysis)`);
  console.log(`Target lesson count: ${lessonCount}\n`);

  const plan = distributeClipsToLessons(enriched, [], lessonCount);

  console.log(`=== DISTRIBUTION PLAN ===`);
  console.log(`Total clips: ${plan.totalClips}`);
  console.log(`Total duration: ${Math.round(plan.totalDurationSeconds / 60)}min\n`);

  for (const lesson of plan.lessons) {
    console.log(`Lesson ${lesson.lessonIndex + 1}:`);
    for (const c of lesson.clips) {
      const v = program.videos.find((x) => x.id === c.videoId);
      const title = v?.title ?? c.videoTitle;
      console.log(`  clip: "${title.slice(0, 50)}" ${c.startSeconds}-${c.endSeconds}s (${Math.round(c.durationSeconds)}s) — "${c.topicLabel}"`);
    }
  }

  if (plan.warnings.length > 0) {
    console.log(`\n=== WARNINGS ===`);
    for (const w of plan.warnings) console.log(`  ${w}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
