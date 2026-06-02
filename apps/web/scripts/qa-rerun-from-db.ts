/**
 * qa-rerun-from-db — re-run the curriculum pipeline on existing DB programs
 * using the new prompt fixes, and judge the regenerated draft.
 *
 * Tests Fix A.1 (HARD BOUNDS clip-range prompt constraint) and the
 * validateAndFixClipDistribution wiring against real historical programs
 * without re-running Gemini (analyses come from the DB) and without writing
 * back to the DB. Safe on shared Neon connection.
 *
 * Re-uses the persisted VideoAnalysis rows, so:
 *   - No Gemini calls — analyses already exist in DB
 *   - One extractContentDigests LLM call per program
 *   - One generateProgramDraft LLM call per program (this is where Fix A.1
 *     takes effect)
 *   - One Anthropic judge call per program
 *
 * Results land in tests/qa-results/db-rerun-<timestamp>/<name>/ matching the
 * existing qa-judge output format for direct comparison with historical runs.
 *
 * Usage:
 *   pnpm -F web exec tsx scripts/qa-rerun-from-db.ts                       → all fixtures
 *   pnpm -F web exec tsx scripts/qa-rerun-from-db.ts --fixture <name>      → one fixture
 *   pnpm -F web exec tsx scripts/qa-rerun-from-db.ts --programId <id>      → ad-hoc programId
 *   pnpm -F web exec tsx scripts/qa-rerun-from-db.ts --prod                → use prod DB
 *
 * Required env: LLM_PROVIDER + provider key, ANTHROPIC_API_KEY (for judge),
 *               DATABASE_URL (loaded from .env.local or .env.production.local).
 */

import { PrismaClient } from "@prisma/client";
import {
  extractContentDigests,
  distributeClipsToLessons,
  generateProgramDraft,
  validateAndFixClipDistribution,
  type EnrichedContentDigest,
} from "@guide-rail/ai";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "qa-fixtures");
const RESULTS_DIR = path.join(REPO_ROOT, "tests", "qa-results");
const JUDGE_PROMPT_PATH = path.join(REPO_ROOT, "tests", "qa-judge-prompt.md");
const APPS_WEB_DIR = path.join(REPO_ROOT, "apps", "web");
const JUDGE_MODEL = process.env.QA_JUDGE_MODEL || "claude-opus-4-7";

function loadEnvFile(filePath: string, opts: { override?: boolean } = {}) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (opts.override || !process.env[key]) process.env[key] = value;
  }
}

const PROD_ENV_FILE = path.join(APPS_WEB_DIR, ".env.production.local");
if (process.argv.includes("--prod")) {
  if (!fs.existsSync(PROD_ENV_FILE)) {
    console.error(`--prod given but ${PROD_ENV_FILE} not found.\nRun: cd apps/web && vercel env pull .env.production.local --environment=production`);
    process.exit(1);
  }
  loadEnvFile(PROD_ENV_FILE, { override: true });
}
loadEnvFile(path.join(APPS_WEB_DIR, ".env"));
loadEnvFile(path.join(APPS_WEB_DIR, ".env.local"));

const _dbHost = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "<unset>";
console.log(`[qa-rerun] DATABASE_URL host: ${_dbHost}`);

type Fixture = { name: string; programId: string; notes?: string };

function parseArgs(): { fixture?: string; programId?: string; name?: string; prod: boolean } {
  const args = process.argv.slice(2);
  let fixture: string | undefined;
  let programId: string | undefined;
  let name: string | undefined;
  let prod = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fixture") fixture = args[++i];
    else if (args[i] === "--programId" || args[i] === "--program-id") programId = args[++i];
    else if (args[i] === "--name") name = args[++i];
    else if (args[i] === "--prod") prod = true;
  }
  return { fixture, programId, name, prod };
}

async function loadFixtures(name?: string): Promise<Fixture[]> {
  if (!fs.existsSync(FIXTURES_DIR)) throw new Error(`Fixtures directory missing: ${FIXTURES_DIR}`);
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  const all: Fixture[] = files.map((f) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), "utf-8")));
  if (!name) return all;
  const match = all.find((f) => f.name === name);
  if (!match) throw new Error(`Fixture "${name}" not found. Available: ${all.map((f) => f.name).join(", ")}`);
  return [match];
}

// Build EnrichedContentDigest[] from DB program + persisted VideoAnalysis.
// Mirrors the in-route shape at generate-async/route.ts:572-668.
type ProgramWithVideos = Awaited<ReturnType<typeof loadProgram>>;

async function loadProgram(prisma: PrismaClient, programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      videos: { include: { analysis: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!program) throw new Error(`Program ${programId} not found`);
  return program;
}

function buildEnrichedFromProgram(program: NonNullable<ProgramWithVideos>): EnrichedContentDigest[] {
  return program.videos
    .filter((v) => v.analysis && !v.isSegment)
    .map((v) => {
      const a = v.analysis!;
      const title = v.title ?? "Untitled";
      return {
        contentId: v.id,
        contentTitle: title,
        contentType: "video" as const,
        keyConcepts: [title],
        skillsIntroduced: [],
        memorableExamples: [],
        difficultyLevel: "intermediate",
        summary: a.summary,
        segments: a.segments as unknown as EnrichedContentDigest["segments"],
        topics: a.topics as unknown as EnrichedContentDigest["topics"],
        keyMoments: (a.keyMoments ?? []) as unknown as EnrichedContentDigest["keyMoments"],
        durationSeconds: a.durationSeconds ?? 0,
      };
    });
}

async function callAnthropicJudge(judgePrompt: string, inputs: object): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const userMessage = `## Source Material — VideoAnalysis Payload(s)
\`\`\`json
${JSON.stringify((inputs as { videoAnalyses: unknown }).videoAnalyses, null, 2)}
\`\`\`

## Generated Curriculum
\`\`\`json
${JSON.stringify((inputs as { curriculum: unknown }).curriculum, null, 2)}
\`\`\`
`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 8192,
      system: judgePrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { content: { text: string }[] };
  return data.content[0].text;
}

function splitJudgeOutput(raw: string): { markdown: string; scoresJson: string } {
  const delim = "---JSON---";
  const idx = raw.indexOf(delim);
  if (idx === -1) throw new Error(`Judge output missing required "${delim}" delimiter. Raw output:\n${raw.slice(0, 500)}...`);
  const markdown = raw.slice(0, idx).trim();
  let scoresJson = raw.slice(idx + delim.length).trim();
  scoresJson = scoresJson.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return { markdown, scoresJson };
}

function timestampDir(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function runOne(prisma: PrismaClient, fixture: Fixture, runDir: string): Promise<{ ok: boolean; reason?: string; overall?: number; pass?: boolean; clipValidationOutcome?: string }> {
  console.log(`\n=== ${fixture.name} (programId=${fixture.programId}) ===`);
  const program = await loadProgram(prisma, fixture.programId);

  const enriched = buildEnrichedFromProgram(program);
  if (enriched.length === 0) {
    return { ok: false, reason: "No videos with VideoAnalysis — nothing to regenerate" };
  }
  console.log(`  ${enriched.length} videos with analysis, durationWeeks=${program.durationWeeks}`);

  const provider = process.env.LLM_PROVIDER || "stub";
  console.log(`  re-extracting digests (provider=${provider})`);
  const digestItems = enriched.map((v) => {
    const a = program.videos.find((pv) => pv.id === v.contentId)?.analysis;
    return {
      contentId: v.contentId,
      contentTitle: v.contentTitle,
      text: a?.fullTranscript ?? null,
      contentType: "video" as const,
    };
  });
  const basics = await extractContentDigests(digestItems);

  // Re-merge enriched fields (topics, segments, keyMoments, summary, durationSeconds)
  // onto the freshly-extracted basics — same merge the route does at lines 572-619.
  const finalEnriched: EnrichedContentDigest[] = enriched.map((e, i) => ({
    ...basics[i],
    contentId: e.contentId,
    contentTitle: e.contentTitle,
    contentType: "video",
    summary: e.summary ?? basics[i].summary,
    segments: e.segments,
    topics: e.topics,
    keyMoments: e.keyMoments,
    durationSeconds: e.durationSeconds,
  }));

  const lessonCount = program.durationWeeks;
  console.log(`  distributing clips → ${lessonCount} lessons`);
  const plan = distributeClipsToLessons(finalEnriched, [], lessonCount);
  console.log(`  plan: totalClips=${plan.totalClips}, totalDuration=${Math.round(plan.totalDurationSeconds / 60)}min, warnings=${plan.warnings.length}`);

  console.log(`  generating program draft (Fix A.1 prompt change is exercised here)`);
  const draft = await generateProgramDraft({
    programId: `db-rerun-${fixture.name}`,
    programTitle: program.title,
    programDescription: program.description ?? undefined,
    outcomeStatement: program.outcomeStatement ?? undefined,
    targetAudience: program.targetAudience ?? undefined,
    targetTransformation: program.targetTransformation ?? undefined,
    vibePrompt: program.vibePrompt ?? undefined,
    durationWeeks: lessonCount,
    clusters: [{
      clusterId: 0,
      contentIds: finalEnriched.map((d) => d.contentId),
      contentTitles: finalEnriched.map((d) => d.contentTitle),
      contentTranscripts: digestItems.map((d) => d.text ?? ""),
      contentTypes: finalEnriched.map(() => "video" as const),
      summary: `DB rerun: ${fixture.name}`,
    }],
    contentDigests: finalEnriched,
    hasVideoAnalysis: true,
    clipDistributionPlan: plan,
    aiStructured: program.aiStructured,
  });

  // Mirror the route's validation and repair behavior.
  const clipValidation = validateAndFixClipDistribution(draft, plan, finalEnriched);
  let finalDraft = draft;
  let clipValidationOutcome: "passed" | "repaired" | "failed" = "passed";
  if (!clipValidation.valid) {
    console.log(`  clip validation failed: ${clipValidation.errors.length} error(s)`);
    if (clipValidation.fixedDraft) {
      finalDraft = clipValidation.fixedDraft;
      clipValidationOutcome = "repaired";
      console.log(`  applied programmatic clip fixes`);
    } else {
      clipValidationOutcome = "failed";
      return {
        ok: false,
        reason: `Clip distribution validation failed and no auto-fix available: ${clipValidation.errors.join("; ")}`,
        clipValidationOutcome,
      };
    }
  } else {
    console.log(`  clip validation passed (no LLM hallucination)`);
  }

  // Build judge inputs in the same shape qa-judge.ts uses.
  const videoAnalyses = program.videos.filter((v) => v.analysis && !v.isSegment).map((v) => ({
    videoId: v.id,
    title: v.title,
    summary: v.analysis!.summary,
    fullTranscript: v.analysis!.fullTranscript,
    segments: v.analysis!.segments,
    topics: v.analysis!.topics,
    keyMoments: v.analysis!.keyMoments,
    people: v.analysis!.people,
    durationSeconds: v.analysis!.durationSeconds,
  }));
  const curriculum = {
    programTitle: finalDraft.title,
    programDescription: finalDraft.description,
    targetTransformation: program.targetTransformation,
    lessons: finalDraft.weeks.map((w) => ({
      lessonNumber: w.weekNumber,
      title: w.title,
      summary: w.summary,
      sessions: w.sessions.map((s) => ({
        title: s.title,
        summary: s.summary,
        steps: s.actions.map((a) => ({ type: a.type, title: a.title })),
        clips: (s.clips ?? []).map((c) => ({
          videoId: c.youtubeVideoId,
          startSeconds: c.startSeconds,
          endSeconds: c.endSeconds,
          chapterTitle: c.chapterTitle,
        })),
      })),
    })),
  };
  const inputs = { videoAnalyses, curriculum };

  const fixtureDir = path.join(runDir, fixture.name);
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, "inputs.json"), JSON.stringify(inputs, null, 2));
  fs.writeFileSync(path.join(fixtureDir, "regenerated-draft.json"), JSON.stringify({
    _meta: { fixtureName: fixture.name, programId: fixture.programId, clipValidationOutcome, regeneratedAt: new Date().toISOString() },
    draft: finalDraft,
  }, null, 2));

  const judgePrompt = fs.readFileSync(JUDGE_PROMPT_PATH, "utf-8");
  console.log(`  calling judge: ${JUDGE_MODEL}`);
  const t0 = Date.now();
  const raw = await callAnthropicJudge(judgePrompt, inputs);
  console.log(`  judge returned in ${Math.round((Date.now() - t0) / 1000)}s`);

  const { markdown, scoresJson } = splitJudgeOutput(raw);
  fs.writeFileSync(path.join(fixtureDir, "judgement.md"), markdown + "\n");
  fs.writeFileSync(path.join(fixtureDir, "scores.json"), scoresJson + "\n");

  let parsed: { overall?: number; pass?: boolean } = {};
  try {
    parsed = JSON.parse(scoresJson);
  } catch {
    console.warn(`  WARNING: scores.json is not valid JSON — wrote raw output`);
  }
  console.log(`  overall=${parsed.overall ?? "?"} pass=${parsed.pass ?? "?"} clipValidation=${clipValidationOutcome} -> ${fixtureDir}`);
  return { ok: true, overall: parsed.overall, pass: parsed.pass, clipValidationOutcome };
}

async function main() {
  const { fixture, programId, name } = parseArgs();

  let fixtures: Fixture[];
  if (programId) {
    if (fixture) {
      console.error("Pass either --fixture or --programId, not both.");
      process.exit(1);
    }
    fixtures = [{ name: name ?? `adhoc-${programId.slice(-8)}`, programId }];
  } else {
    fixtures = await loadFixtures(fixture);
  }

  if (fixtures.length === 0) {
    console.error("No fixtures to run.");
    process.exit(1);
  }
  if (!fs.existsSync(JUDGE_PROMPT_PATH)) {
    console.error(`Judge prompt missing: ${JUDGE_PROMPT_PATH}`);
    process.exit(1);
  }

  const runDir = path.join(RESULTS_DIR, `db-rerun-${timestampDir()}`);
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Run dir: ${runDir}`);
  console.log(`Judge model: ${JUDGE_MODEL}`);
  console.log(`Fixtures to rerun: ${fixtures.length}`);

  const prisma = new PrismaClient();
  const results: Array<{ name: string; ok: boolean; reason?: string; overall?: number; pass?: boolean; clipValidationOutcome?: string }> = [];
  try {
    for (const f of fixtures) {
      try {
        const r = await runOne(prisma, f, runDir);
        results.push({ name: f.name, ...r });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✗ ${f.name}: ${msg}`);
        results.push({ name: f.name, ok: false, reason: msg });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n=== SUMMARY ===`);
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✓ ${r.name.padEnd(30)} overall=${r.overall ?? "?"} pass=${r.pass ?? "?"} clipValidation=${r.clipValidationOutcome ?? "?"}`);
    } else {
      console.log(`  ✗ ${r.name.padEnd(30)} ${r.reason}`);
    }
  }
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify({ runAt: new Date().toISOString(), results }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
