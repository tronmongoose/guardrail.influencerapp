/**
 * One-off: print the clip layout for a given program ID. Shows which source
 * video each clip came from, the time range, and any title/chapter naming.
 * Useful for answering "what got split?" without spinning up the UI.
 *
 * Usage: pnpm tsx apps/web/scripts/inspect-program-clips.ts <programId>
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
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
  if (!programId) {
    console.error("Usage: pnpm tsx apps/web/scripts/inspect-program-clips.ts <programId>");
    process.exit(1);
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          sessions: {
            orderBy: { orderIndex: "asc" },
            include: {
              compositeSession: {
                include: {
                  clips: {
                    orderBy: { orderIndex: "asc" },
                    include: { youtubeVideo: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) {
    console.error(`Program ${programId} not found`);
    process.exit(1);
  }

  console.log(`Program: ${program.title}\n`);

  const fmt = (s: number | null | undefined) =>
    s == null ? "?" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // Group by source video so split parts are obvious
  const bySource: Record<
    string,
    { title: string | null; clips: { lesson: number; range: string; chapter: string | null; rangeSeconds: [number, number] }[] }
  > = {};

  for (const w of program.weeks) {
    for (const s of w.sessions) {
      const clips = s.compositeSession?.clips ?? [];
      for (const c of clips) {
        const src = c.youtubeVideoId;
        if (!bySource[src]) {
          bySource[src] = { title: c.youtubeVideo?.title ?? null, clips: [] };
        }
        bySource[src].clips.push({
          lesson: w.weekNumber,
          range: `${fmt(c.startSeconds)}–${fmt(c.endSeconds)}`,
          chapter: c.chapterTitle,
          rangeSeconds: [c.startSeconds ?? 0, c.endSeconds ?? 0],
        });
      }
    }
  }

  for (const [, info] of Object.entries(bySource)) {
    console.log(`### Source: "${info.title}"`);
    // sort by start time so split parts show in source order
    info.clips.sort((a, b) => a.rangeSeconds[0] - b.rangeSeconds[0]);
    for (const c of info.clips) {
      console.log(`  L${c.lesson}  ${c.range}  ${c.chapter ?? "(no chapter title)"}`);
    }
    console.log();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
