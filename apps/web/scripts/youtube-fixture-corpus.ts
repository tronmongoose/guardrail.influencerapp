/**
 * YouTube fixture harness — calls the AI package functions directly to stress-
 * test the content brain (Gemini segmentation → digest extraction → clip
 * distribution → curriculum gen) WITHOUT touching the running app's route,
 * DB, or Mux infrastructure.
 *
 * Why this script exists: the route's generate-async orchestrator is Mux-only.
 * YouTube URLs cannot reach Gemini through the route. But the AI package's
 * analyzeVideoWithGemini(youtubeId, ...) function is fully wired and produces
 * identical-shape VideoAnalysisOutput to the Mux path. This script bypasses
 * the route to use it. See plan: ok-we-re-getting-close-wild-spark.md.
 *
 * Fixtures persist to tests/qa-fixtures/corpus/. The script is resumable —
 * if <id>.video-analysis.json already exists it's skipped. Per-video failures
 * are isolated.
 *
 * Usage:
 *   pnpm tsx apps/web/scripts/youtube-fixture-corpus.ts list
 *     → print corpus summary, no API calls
 *
 *   pnpm tsx apps/web/scripts/youtube-fixture-corpus.ts analyze [videoId]
 *     → analyze one video (if id given) or all verified videos (no id),
 *       writing <id>.video-analysis.json fixtures
 *
 *   pnpm tsx apps/web/scripts/youtube-fixture-corpus.ts assemble [programName]
 *     → for one program (if name given) or all programs (no name):
 *       build digests, distribution plan, and draft from cached analyses.
 *       Skips if any video's analysis fixture is missing.
 *
 *   pnpm tsx apps/web/scripts/youtube-fixture-corpus.ts full
 *     → analyze all + assemble all (one-shot batch).
 *
 * Required env: GOOGLE_AI_API_KEY (for analyze), LLM_PROVIDER + provider key
 * (for assemble — extractContentDigests and generateProgramDraft call the LLM).
 * Without LLM_PROVIDER set, both default to stub mode (safe, deterministic).
 */

import {
  analyzeVideoWithGemini,
  extractContentDigests,
  distributeClipsToLessons,
  generateProgramDraft,
  validateAndFixClipDistribution,
  type EnrichedContentDigest,
  type ContentDigest,
} from "@guide-rail/ai";
import type { VideoAnalysisOutput } from "@guide-rail/shared";
import * as fs from "fs";
import * as path from "path";
import { CORPUS_VIDEOS, CORPUS_PROGRAMS, type CorpusVideo } from "./corpus-config";

// ── Env loading ────────────────────────────────────────────────────────────
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

// ── Paths ──────────────────────────────────────────────────────────────────
const FIXTURE_DIR = path.resolve(__dirname, "..", "..", "..", "tests", "qa-fixtures", "corpus");

function ensureFixtureDir() {
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }
}

function fixturePath(name: string): string {
  return path.join(FIXTURE_DIR, name);
}

function writeJson(name: string, data: unknown) {
  ensureFixtureDir();
  fs.writeFileSync(fixturePath(name), JSON.stringify(data, null, 2));
}

function readJsonIfExists<T>(name: string): T | null {
  const p = fixturePath(name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const verifiedVideos = (): CorpusVideo[] => CORPUS_VIDEOS.filter((v) => v.verified && v.id);

function analysisName(videoId: string): string {
  return `${videoId}.video-analysis.json`;
}

function programArtifactName(programName: string, kind: "digests" | "distribution-plan" | "draft"): string {
  return `program-${programName}.${kind}.json`;
}

// ── Phase 1: analyze a single YouTube video ────────────────────────────────
async function analyzeOne(v: CorpusVideo, force = false): Promise<{ id: string; ok: boolean; reason?: string; topicCount?: number; durationSeconds?: number }> {
  if (!v.id) return { id: "(empty)", ok: false, reason: "no id (top-up slot)" };

  const out = analysisName(v.id);
  if (!force && fs.existsSync(fixturePath(out))) {
    return { id: v.id, ok: true, reason: "cached" };
  }

  const started = Date.now();
  console.info(`[analyze] ▶ ${v.id} — "${v.title}" (${v.tier})`);

  try {
    const analysis = await analyzeVideoWithGemini(v.id, v.title);
    writeJson(out, {
      _meta: {
        videoId: v.id,
        displayTitle: v.title,
        tier: v.tier,
        shapes: v.shapes,
        source: v.source,
        analyzedAt: new Date().toISOString(),
        elapsedMs: Date.now() - started,
      },
      analysis,
    });
    const topicCount = analysis.topics?.length ?? 0;
    const durationSeconds = analysis.durationSeconds ?? 0;
    console.info(`[analyze] ✓ ${v.id} — topics=${topicCount} duration=${durationSeconds}s segments=${analysis.segments?.length ?? 0} ${Date.now() - started}ms`);
    return { id: v.id, ok: true, topicCount, durationSeconds };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[analyze] ✗ ${v.id} — ${msg}`);
    writeJson(`${v.id}.error.json`, { videoId: v.id, error: msg, at: new Date().toISOString() });
    return { id: v.id, ok: false, reason: msg };
  }
}

// ── Phase 2: build EnrichedContentDigest from a cached analysis ────────────
// Mirrors the route's digest construction at generate-async/route.ts:572+.
function buildEnrichedFromAnalysis(v: CorpusVideo, analysis: VideoAnalysisOutput, basic: ContentDigest): EnrichedContentDigest {
  // VideoAnalysisOutput uses nullable optionals (`string | null | undefined`);
  // EnrichedContentDigest expects plain optionals (`string | undefined`). The
  // shapes are structurally compatible — coerce via unknown to match the same
  // pattern used by qa-verify-distributor.ts:71-73.
  return {
    ...basic,
    contentId: v.id,
    contentTitle: v.title,
    contentType: "video",
    summary: analysis.summary ?? basic.summary,
    segments: analysis.segments as unknown as EnrichedContentDigest["segments"],
    topics: analysis.topics as unknown as EnrichedContentDigest["topics"],
    keyMoments: (analysis.keyMoments ?? []) as unknown as EnrichedContentDigest["keyMoments"],
    durationSeconds: analysis.durationSeconds ?? 0,
  };
}

// ── Phase 3: assemble a program from cached analyses ───────────────────────
async function assembleProgram(programName: string): Promise<{ ok: boolean; reason?: string }> {
  const program = CORPUS_PROGRAMS.find((p) => p.name === programName);
  if (!program) return { ok: false, reason: `program not found: ${programName}` };

  console.info(`\n[assemble] ▶ program="${program.name}" videos=${program.videoIds.length} lessons=${program.lessonCount}`);
  console.info(`[assemble]   stresses: ${program.stresses}`);

  // Load every video's cached analysis. Bail if any missing — the harness
  // is intentionally strict here so missing analyses can't silently degrade
  // the draft.
  type Loaded = { v: CorpusVideo; analysis: VideoAnalysisOutput };
  const loaded: Loaded[] = [];
  for (const vid of program.videoIds) {
    const v = CORPUS_VIDEOS.find((x) => x.id === vid);
    if (!v) return { ok: false, reason: `video ${vid} not in CORPUS_VIDEOS` };
    const cached = readJsonIfExists<{ analysis: VideoAnalysisOutput }>(analysisName(vid));
    if (!cached?.analysis) return { ok: false, reason: `missing analysis fixture for ${vid} — run analyze first` };
    loaded.push({ v, analysis: cached.analysis });
  }

  // Pass 1: extractContentDigests on the full transcripts. Mirrors route flow.
  const provider = process.env.LLM_PROVIDER || "stub";
  console.info(`[assemble]   extracting digests (provider=${provider})`);
  const digestItems = loaded.map(({ v, analysis }) => ({
    contentId: v.id,
    contentTitle: v.title,
    text: analysis.fullTranscript ?? null,
    contentType: "video" as const,
  }));
  const basics = await extractContentDigests(digestItems);
  writeJson(programArtifactName(program.name, "digests"), { _meta: { program: program.name, provider }, digests: basics });

  // Pass 2: merge into EnrichedContentDigest using each video's analysis topics.
  const enriched: EnrichedContentDigest[] = loaded.map(({ v, analysis }, i) =>
    buildEnrichedFromAnalysis(v, analysis, basics[i]),
  );

  // Pass 3: clip distribution.
  console.info(`[assemble]   distributing clips → ${program.lessonCount} lessons`);
  const plan = distributeClipsToLessons(enriched, [], program.lessonCount);
  writeJson(programArtifactName(program.name, "distribution-plan"), {
    _meta: { program: program.name, lessonCount: program.lessonCount },
    plan,
  });
  console.info(`[assemble]   plan: totalClips=${plan.totalClips} totalDuration=${Math.round(plan.totalDurationSeconds / 60)}min warnings=${plan.warnings.length}`);
  for (const w of plan.warnings) console.info(`[assemble]     warning: ${w}`);

  // Pass 4: curriculum-gen.
  const allContentIds = enriched.map((d) => d.contentId);
  const allContentTitles = enriched.map((d) => d.contentTitle);
  const allContentTranscripts = loaded.map(({ analysis }) => analysis.fullTranscript ?? "");
  const allContentTypes: ("video" | "document")[] = enriched.map(() => "video");

  console.info(`[assemble]   generating program draft`);
  const draft = await generateProgramDraft({
    programId: `corpus-${program.name}`,
    programTitle: program.title,
    programDescription: program.description,
    targetTransformation: program.targetTransformation,
    vibePrompt: program.vibePrompt,
    durationWeeks: program.lessonCount,
    clusters: [{
      clusterId: 0,
      contentIds: allContentIds,
      contentTitles: allContentTitles,
      contentTranscripts: allContentTranscripts,
      contentTypes: allContentTypes,
      summary: `Corpus assemblage: ${program.name}`,
    }],
    contentDigests: enriched,
    hasVideoAnalysis: true,
    clipDistributionPlan: plan,
    aiStructured: false,
  });
  // Mirror production: route.ts:885–918 calls validateAndFixClipDistribution
  // after the LLM and FAILS THE JOB if no auto-fix is available (or if the
  // repaired draft fails re-validation). Without mirroring those throws, the
  // harness writes a broken draft to disk and the judge scores something
  // production would have rejected — see fireship-coding-shorts run 2026-05-31.
  const clipValidation = validateAndFixClipDistribution(draft, plan, enriched);
  let finalDraft = draft;
  let validationOutcome: "passed" | "repaired" | "failed" = "passed";
  let failureReason: string | undefined;

  if (!clipValidation.valid) {
    console.info(`[assemble]   clip validation failed: ${clipValidation.errors.length} error(s)`);
    if (clipValidation.fixedDraft) {
      // Route also re-runs ProgramDraftSchema.safeParse on the fixed draft
      // and throws if that fails (lines 904–909). We do the same in spirit
      // by trusting the validator's repair output and surfacing it.
      finalDraft = clipValidation.fixedDraft;
      validationOutcome = "repaired";
      console.info(`[assemble]   applied programmatic clip fixes`);
    } else {
      validationOutcome = "failed";
      failureReason = `Clip distribution validation failed and no auto-fix available: ${clipValidation.errors.join("; ")}`;
      console.warn(`[assemble]   ✗ ${failureReason}`);
    }
  }

  if (validationOutcome === "failed") {
    // Write a .failure.json artifact instead of persisting the broken draft.
    // The judge harness should skip programs that have a .failure.json.
    writeJson(programArtifactName(program.name, "draft").replace(".draft.json", ".failure.json"), {
      _meta: {
        program: program.name,
        provider,
        failedAt: new Date().toISOString(),
        clipValidation: { valid: false, errors: clipValidation.errors },
      },
      reason: failureReason,
      rawDraft: draft,
    });
    console.info(`[assemble] ✗ program="${program.name}" failed validation — wrote .failure.json`);
    return { ok: false, reason: failureReason };
  }

  writeJson(programArtifactName(program.name, "draft"), {
    _meta: {
      program: program.name,
      provider,
      clipValidation: { valid: clipValidation.valid, errors: clipValidation.errors, outcome: validationOutcome },
    },
    draft: finalDraft,
  });
  console.info(`[assemble] ✓ program="${program.name}" lessons=${finalDraft.weeks?.length ?? 0}`);

  return { ok: true };
}

// ── CLI ────────────────────────────────────────────────────────────────────
function printCorpusList() {
  const byTier = CORPUS_VIDEOS.reduce<Record<string, CorpusVideo[]>>((acc, v) => {
    (acc[v.tier] ??= []).push(v);
    return acc;
  }, {});
  console.info("\n=== CORPUS VIDEOS ===");
  for (const tier of ["lt-8min", "5-8min", "8-20min", "gt-20min"] as const) {
    const items = byTier[tier] ?? [];
    const verifiedCount = items.filter((v) => v.verified && v.id).length;
    console.info(`\n${tier} (${verifiedCount}/${items.length} verified):`);
    for (const v of items) {
      const mark = v.verified && v.id ? "✓" : "·";
      const idStr = v.id || "(top-up)";
      console.info(`  ${mark} ${idStr.padEnd(12)} ${v.shapes.join("+").padEnd(28)} ${v.title}`);
    }
  }
  console.info("\n=== PROGRAM ASSEMBLAGES ===");
  for (const p of CORPUS_PROGRAMS) {
    console.info(`\n${p.name} (${p.videoIds.length} videos, ${p.lessonCount} lessons)`);
    console.info(`  ${p.description}`);
    console.info(`  stresses: ${p.stresses}`);
  }
  const v = verifiedVideos();
  console.info(`\n=== READINESS ===`);
  console.info(`Verified videos: ${v.length} / ${CORPUS_VIDEOS.length}`);
  console.info(`Top-up slots remaining: ${CORPUS_VIDEOS.length - v.length}`);
}

async function runAnalyzeAll() {
  ensureFixtureDir();
  const targets = verifiedVideos();
  console.info(`\n[analyze] starting batch — ${targets.length} verified video(s)`);
  let ok = 0, fail = 0, cached = 0;
  for (const v of targets) {
    const r = await analyzeOne(v);
    if (r.ok && r.reason === "cached") cached++;
    else if (r.ok) ok++;
    else fail++;
  }
  console.info(`\n[analyze] batch complete — ok=${ok} cached=${cached} fail=${fail}`);
}

// Find videos that have a .error.json fixture and re-run analysis on them.
// Useful when Gemini returned an empty response on the first pass (a known
// transient mode — gemini-diag confirmed the same video succeeds with a
// simpler prompt). The 5-second delay between calls gives Gemini room to
// avoid whatever per-request state caused the first call to bail.
async function runAnalyzeRetry(maxAttempts = 2) {
  ensureFixtureDir();
  const errorFiles = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".error.json"));
  if (errorFiles.length === 0) {
    console.info(`[retry] no .error.json files — nothing to retry`);
    return;
  }
  const targets: CorpusVideo[] = [];
  for (const f of errorFiles) {
    const id = f.replace(".error.json", "");
    const v = CORPUS_VIDEOS.find((x) => x.id === id);
    if (v) targets.push(v);
  }
  console.info(`\n[retry] retrying ${targets.length} previously-failed video(s) (maxAttempts=${maxAttempts})`);
  let ok = 0, fail = 0;
  for (const v of targets) {
    let success = false;
    for (let attempt = 1; attempt <= maxAttempts && !success; attempt++) {
      if (attempt > 1) {
        const delayMs = 5_000 + Math.random() * 3_000; // 5–8s jittered
        console.info(`[retry]   attempt ${attempt}/${maxAttempts} for ${v.id} after ${Math.round(delayMs)}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
      const r = await analyzeOne(v, true);
      if (r.ok && r.reason !== "cached") {
        success = true;
        // Clean up the stale error file now that we have a successful analysis.
        try { fs.unlinkSync(fixturePath(`${v.id}.error.json`)); } catch { /* ignore */ }
      }
    }
    if (success) ok++; else fail++;
  }
  console.info(`\n[retry] batch complete — ok=${ok} fail=${fail}`);
}

async function runAssembleAll() {
  let ok = 0, fail = 0;
  for (const p of CORPUS_PROGRAMS) {
    try {
      const r = await assembleProgram(p.name);
      if (r.ok) ok++; else { fail++; console.error(`[assemble] skipped ${p.name}: ${r.reason}`); }
    } catch (err) {
      // Isolate per-program failures so one LLM glitch (truncated JSON, repair
      // AbortError, etc.) doesn't kill the whole batch.
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[assemble] threw on ${p.name}: ${msg}`);
    }
  }
  console.info(`\n[assemble] batch complete — ok=${ok} fail=${fail}`);
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  if (!cmd || cmd === "list") {
    printCorpusList();
    return;
  }
  if (cmd === "analyze") {
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("[analyze] GOOGLE_AI_API_KEY not set — would only produce stub analyses. Aborting.");
      process.exit(1);
    }
    if (arg) {
      const v = CORPUS_VIDEOS.find((x) => x.id === arg);
      if (!v) { console.error(`video ${arg} not in CORPUS_VIDEOS`); process.exit(1); }
      await analyzeOne(v, true);
    } else {
      await runAnalyzeAll();
    }
    return;
  }
  if (cmd === "assemble") {
    if (arg) {
      const r = await assembleProgram(arg);
      if (!r.ok) { console.error(r.reason); process.exit(1); }
    } else {
      await runAssembleAll();
    }
    return;
  }
  if (cmd === "analyze-retry") {
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("[retry] GOOGLE_AI_API_KEY not set — aborting.");
      process.exit(1);
    }
    await runAnalyzeRetry();
    return;
  }
  if (cmd === "full") {
    await runAnalyzeAll();
    await runAssembleAll();
    return;
  }
  console.error(`Unknown command: ${cmd}`);
  console.error(`Usage: pnpm tsx apps/web/scripts/youtube-fixture-corpus.ts <list|analyze [id]|analyze-retry|assemble [name]|full>`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
