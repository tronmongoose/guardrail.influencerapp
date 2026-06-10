/**
 * Script A — Real end-to-end upload + generate-async run against the
 * deployed app. Replicates the wizard flow without the browser.
 *
 * Usage:
 *   pnpm tsx apps/web/scripts/bulk-mux-upload.ts <videos-dir> \
 *     [--limit 2] [--concurrency 2] [--base-url https://app.journeyline.ai] [--prod]
 *
 * Defaults to --limit 2 to keep first runs cheap. The full 21-file
 * concurrency stress run is v2 — bump --limit and --concurrency after step-2
 * bugs are fixed.
 *
 * The test program is titled TEST-UPLOAD-<ISO_TS> so cleanup-test-program.ts
 * can find it.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { loadEnv, logDbHost } from "./_lib/env";
import { createApiClient } from "./_lib/api-client";

const ARGS = process.argv.slice(2);
function arg(name: string, fallback?: string): string | undefined {
  const i = ARGS.indexOf(name);
  if (i === -1) return fallback;
  return ARGS[i + 1];
}
const FLAG = (name: string) => ARGS.includes(name);

loadEnv({ prod: FLAG("--prod") });
logDbHost("bulk-mux-upload");

// Positional args: skip --flag tokens and the value of known value-bearing flags.
const VALUE_FLAGS = new Set(["--limit", "--concurrency", "--base-url"]);
const positional: string[] = [];
for (let i = 0; i < ARGS.length; i++) {
  const a = ARGS[i];
  if (VALUE_FLAGS.has(a)) {
    i++; // skip the value
    continue;
  }
  if (a.startsWith("--")) continue;
  positional.push(a);
}
const VIDEOS_DIR = positional[0];
const LIMIT = Number(arg("--limit", "2"));
const CONCURRENCY = Number(arg("--concurrency", "2"));
const BASE_URL = arg("--base-url") ?? "https://app.journeyline.ai";

if (!VIDEOS_DIR) {
  console.error("Usage: pnpm tsx apps/web/scripts/bulk-mux-upload.ts <videos-dir> [--limit N] [--concurrency N] [--base-url URL]");
  process.exit(1);
}
const resolvedDir = path.resolve(VIDEOS_DIR.replace(/^~/, process.env.HOME ?? "~"));
if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
  console.error(`Not a directory: ${resolvedDir}`);
  process.exit(1);
}

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

function mimeForFile(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

function isoStampForTitle(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

type Program = { id: string; title: string };
type CreatedVideo = { id: string; muxUploadId: string };
type UploadSummary = {
  file: string;
  uploadId: string;
  videoId: string;
  bytesUploaded: number;
  uploadOk: boolean;
  error?: string;
  finalMuxStatus?: string | null;
  finalMuxPlaybackId?: string | null;
};

const prisma = new PrismaClient();
const api = createApiClient({ baseUrl: BASE_URL });

async function uploadOne(programId: string, filePath: string): Promise<UploadSummary> {
  const fileName = path.basename(filePath);
  const summary: UploadSummary = {
    file: fileName,
    uploadId: "",
    videoId: "",
    bytesUploaded: 0,
    uploadOk: false,
  };
  try {
    // 2a. Get a Mux upload URL
    const { uploadId, uploadUrl } = await api.post<{ uploadId: string; uploadUrl: string }>(
      "/api/mux/upload-url",
      {},
    );
    summary.uploadId = uploadId;

    // 2b. Create the YouTubeVideo sentinel row BEFORE PUT so generate-async can see it
    const video = await api.post<{ id: string }>(`/api/programs/${programId}/videos`, {
      source: "mux-upload",
      muxUploadId: uploadId,
      title: fileName,
    });
    summary.videoId = video.id;

    // 2c. PUT raw bytes to Mux
    const bytes = await fs.promises.readFile(filePath);
    summary.bytesUploaded = bytes.length;
    await api.putBytes(uploadUrl, bytes, mimeForFile(fileName));
    summary.uploadOk = true;
    return summary;
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
    return summary;
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await task(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function pollGenerationJob(programId: string, timeoutMs: number): Promise<{
  finalStatus: string;
  stage: string | null;
  progress: number;
  error: string | null;
}> {
  const start = Date.now();
  let lastPrinted = "";
  while (Date.now() - start < timeoutMs) {
    const status = await api.get<{
      jobId: string;
      status: string;
      stage: string | null;
      progress: number;
      error: string | null;
      isStale: boolean;
      steps?: Array<{ stage: string; status: string; durationMs: number | null; note?: string }>;
    }>(`/api/programs/${programId}/generate-async/status`);

    const stepsTail = (status.steps ?? []).slice(-3).map(
      (s) => `${s.stage}(${s.status}${s.durationMs != null ? ` ${s.durationMs}ms` : ""})${s.note ? ` "${s.note.slice(0, 40)}"` : ""}`,
    ).join(" → ");
    const line = `[${Math.round((Date.now() - start) / 1000)}s] ${status.status} stage=${status.stage} progress=${status.progress}% ${stepsTail ? `| steps: ${stepsTail}` : ""}`;
    if (line !== lastPrinted) {
      console.log(line);
      lastPrinted = line;
    }
    if (status.status === "COMPLETED" || status.status === "FAILED") {
      return {
        finalStatus: status.status,
        stage: status.stage,
        progress: status.progress,
        error: status.error,
      };
    }
    if (status.isStale) {
      console.warn("  ⚠ job marked stale by status endpoint");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { finalStatus: "TIMEOUT", stage: null, progress: 0, error: "client-side poll timeout" };
}

async function main() {
  console.log(`base=${BASE_URL} limit=${LIMIT} concurrency=${CONCURRENCY} dir=${resolvedDir}`);

  // List input files
  const files = fs
    .readdirSync(resolvedDir)
    .filter((f) => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(resolvedDir, f))
    .sort();
  if (files.length === 0) {
    console.error(`No videos with ${[...VIDEO_EXTS].join("/")} extensions in ${resolvedDir}`);
    process.exit(1);
  }
  const toUpload = files.slice(0, LIMIT);
  console.log(`Found ${files.length} videos, uploading ${toUpload.length}`);

  // 1. Create test program
  const created = await api.post<Program>("/api/programs/create");
  const title = `TEST-UPLOAD-${isoStampForTitle()}`;
  await api.patch<Program>(`/api/programs/${created.id}`, {
    title,
    vibePrompt: "test harness upload run",
    skinId: "classic-minimal",
    durationWeeks: 2, // ignored when aiStructured=true; route runs computeGuardrailedLessonCount instead
    pacingMode: "drip_by_week",
    aiStructured: true, // match the wizard default so test results reflect real creator runs
  });
  console.log(`Created program "${title}" id=${created.id}`);

  // 2. Upload videos with bounded concurrency
  const t0 = Date.now();
  const summaries = await runWithConcurrency(toUpload, CONCURRENCY, async (filePath, idx) => {
    console.log(`[${idx + 1}/${toUpload.length}] uploading ${path.basename(filePath)}`);
    const r = await uploadOne(created.id, filePath);
    console.log(
      `[${idx + 1}/${toUpload.length}] ${r.uploadOk ? "✓" : "✗"} ${r.file} uploadId=${r.uploadId.slice(0, 12)} ${r.error ? `err=${r.error.slice(0, 80)}` : ""}`,
    );
    return r;
  });
  console.log(`Uploads finished in ${Math.round((Date.now() - t0) / 1000)}s`);

  if (summaries.every((s) => !s.uploadOk)) {
    console.error("All uploads failed — not triggering generate-async.");
    process.exit(1);
  }

  // 3. Kick off generation
  console.log(`POST /api/programs/${created.id}/generate-async`);
  await api.post(`/api/programs/${created.id}/generate-async`, {});
  console.log("Polling status (5s interval, 20 min timeout)...");
  const finalJob = await pollGenerationJob(created.id, 20 * 60_000);
  console.log(`Job finished: ${JSON.stringify(finalJob)}`);

  // 4. Final per-video state via direct DB read (more authoritative than API surface)
  const finalVideos = await prisma.youTubeVideo.findMany({
    where: { programId: created.id },
    select: {
      id: true,
      title: true,
      muxUploadId: true,
      muxStatus: true,
      muxPlaybackId: true,
      muxStaticRenditionReadyAt: true,
      analysis: { select: { id: true, durationSeconds: true } },
    },
  });
  console.log("\n=== Per-video summary ===");
  for (const v of finalVideos) {
    const matched = summaries.find((s) => s.uploadId === v.muxUploadId);
    console.log(
      JSON.stringify({
        file: matched?.file ?? v.title,
        bytes: matched?.bytesUploaded ?? null,
        uploadOk: matched?.uploadOk ?? null,
        muxStatus: v.muxStatus,
        playbackId: v.muxPlaybackId?.slice(0, 12) ?? null,
        staticRenditionReady: !!v.muxStaticRenditionReadyAt,
        hasAnalysis: !!v.analysis,
        durationSeconds: v.analysis?.durationSeconds ?? null,
      }),
    );
  }

  console.log(`\nProgram id: ${created.id}`);
  console.log(`Program title: ${title}`);
  console.log(`Cleanup: pnpm tsx apps/web/scripts/cleanup-test-program.ts --program-id ${created.id} --dry-run`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
