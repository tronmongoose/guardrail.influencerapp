/**
 * qa-judge-corpus — judge sibling for the YouTube fixture harness.
 *
 * Mirrors qa-judge.ts (same prompt at tests/qa-judge-prompt.md, same
 * `---JSON---` delimiter, same tests/qa-results/<timestamp>/<name>/ layout)
 * so judgements stay comparable to prior runs. The difference: this reads
 * JSON fixtures from tests/qa-fixtures/corpus/ instead of pulling from the
 * Prisma DB.
 *
 * Inputs per program:
 *   tests/qa-fixtures/corpus/program-<name>.draft.json   — ProgramDraft
 *   tests/qa-fixtures/corpus/<videoId>.video-analysis.json — VideoAnalysisOutput
 *
 * Output per program:
 *   tests/qa-results/<timestamp>/<name>/{inputs.json,judgement.md,scores.json}
 *
 * Usage:
 *   pnpm tsx apps/web/scripts/qa-judge-corpus.ts                        → all programs
 *   pnpm tsx apps/web/scripts/qa-judge-corpus.ts --name dance-tutorial-bundle
 */

import * as fs from "fs";
import * as path from "path";
import { CORPUS_PROGRAMS, CORPUS_VIDEOS, type CorpusProgram } from "./corpus-config";

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
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE_DIR = path.join(REPO_ROOT, "tests", "qa-fixtures", "corpus");
const RESULTS_DIR = path.join(REPO_ROOT, "tests", "qa-results");
const JUDGE_PROMPT_PATH = path.join(REPO_ROOT, "tests", "qa-judge-prompt.md");

const JUDGE_MODEL = process.env.QA_JUDGE_MODEL || "claude-opus-4-7";

// ── Types ──────────────────────────────────────────────────────────────────
type VideoAnalysis = {
  summary: string;
  fullTranscript?: string | null;
  segments: unknown;
  topics: unknown;
  keyMoments?: unknown;
  people?: unknown;
  durationSeconds?: number | null;
};

type AnalysisFixture = {
  _meta: { videoId: string; displayTitle: string; tier: string };
  analysis: VideoAnalysis;
};

type DraftFixture = {
  _meta: { program: string; provider: string };
  draft: {
    programId: string;
    title: string;
    description?: string;
    durationWeeks: number;
    weeks: Array<{
      weekNumber: number;
      title: string;
      summary?: string;
      sessions: Array<{
        title: string;
        summary?: string;
        orderIndex: number;
        actions: Array<{ type: string; title: string }>;
        clips?: Array<{
          youtubeVideoId: string;
          startSeconds?: number;
          endSeconds?: number;
          chapterTitle?: string;
        }>;
      }>;
    }>;
  };
};

// ── Build judge inputs from JSON fixtures ──────────────────────────────────
// Mirrors qa-judge.ts buildJudgeInputs (lines 165-218) but reads JSON.
function buildJudgeInputs(program: CorpusProgram, draft: DraftFixture["draft"]): {
  videoAnalyses: Array<Record<string, unknown>>;
  curriculum: Record<string, unknown>;
} {
  const videoAnalyses: Array<Record<string, unknown>> = [];
  for (const videoId of program.videoIds) {
    const fixturePath = path.join(FIXTURE_DIR, `${videoId}.video-analysis.json`);
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Missing analysis fixture: ${fixturePath}`);
    }
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as AnalysisFixture;
    const v = CORPUS_VIDEOS.find((x) => x.id === videoId);
    videoAnalyses.push({
      videoId,
      title: v?.title ?? fixture._meta.displayTitle,
      summary: fixture.analysis.summary,
      fullTranscript: fixture.analysis.fullTranscript,
      segments: fixture.analysis.segments,
      topics: fixture.analysis.topics,
      keyMoments: fixture.analysis.keyMoments,
      people: fixture.analysis.people,
      durationSeconds: fixture.analysis.durationSeconds,
    });
  }

  const curriculum = {
    programTitle: draft.title,
    programDescription: draft.description,
    targetTransformation: program.targetTransformation,
    lessons: draft.weeks.map((w) => ({
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

  return { videoAnalyses, curriculum };
}

// ── Anthropic judge call (lifted from qa-judge.ts) ─────────────────────────
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
  if (idx === -1) {
    throw new Error(`Judge output missing required "${delim}" delimiter. Raw output:\n${raw.slice(0, 500)}...`);
  }
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

// ── Run one program ────────────────────────────────────────────────────────
async function runOne(program: CorpusProgram, runDir: string): Promise<{ ok: boolean; reason?: string; overall?: number; pass?: boolean }> {
  const draftPath = path.join(FIXTURE_DIR, `program-${program.name}.draft.json`);
  if (!fs.existsSync(draftPath)) {
    return { ok: false, reason: `draft fixture missing: ${draftPath} — run assemble first` };
  }
  const draftFixture = JSON.parse(fs.readFileSync(draftPath, "utf-8")) as DraftFixture;

  console.log(`\n=== ${program.name} (videos=${program.videoIds.length} lessons=${program.lessonCount}) ===`);

  let inputs;
  try {
    inputs = buildJudgeInputs(program, draftFixture.draft);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }

  const fixtureDir = path.join(runDir, program.name);
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, "inputs.json"), JSON.stringify(inputs, null, 2));

  const judgePrompt = fs.readFileSync(JUDGE_PROMPT_PATH, "utf-8");
  console.log(`  calling judge: ${JUDGE_MODEL} ...`);
  const t0 = Date.now();
  let raw: string;
  try {
    raw = await callAnthropicJudge(judgePrompt, inputs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fs.writeFileSync(path.join(fixtureDir, "error.txt"), msg + "\n");
    return { ok: false, reason: msg };
  }
  console.log(`  judge returned in ${Math.round((Date.now() - t0) / 1000)}s`);

  let parsed: { overall?: number; pass?: boolean } = {};
  try {
    const { markdown, scoresJson } = splitJudgeOutput(raw);
    fs.writeFileSync(path.join(fixtureDir, "judgement.md"), markdown + "\n");
    fs.writeFileSync(path.join(fixtureDir, "scores.json"), scoresJson + "\n");
    try {
      parsed = JSON.parse(scoresJson);
    } catch {
      console.warn(`  WARNING: scores.json is not valid JSON — wrote raw output`);
    }
  } catch (err) {
    // Judge returned without the delimiter — write raw and continue.
    fs.writeFileSync(path.join(fixtureDir, "raw.txt"), raw + "\n");
    return { ok: false, reason: err instanceof Error ? err.message : String(err), overall: parsed.overall, pass: parsed.pass };
  }

  console.log(`  overall=${parsed.overall ?? "?"} pass=${parsed.pass ?? "?"} -> ${fixtureDir}`);
  return { ok: true, overall: parsed.overall, pass: parsed.pass };
}

// ── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(): { name?: string } {
  const args = process.argv.slice(2);
  let name: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name") name = args[++i];
  }
  return { name };
}

async function main() {
  const { name } = parseArgs();

  const programs = name
    ? CORPUS_PROGRAMS.filter((p) => p.name === name)
    : CORPUS_PROGRAMS;

  if (programs.length === 0) {
    console.error(`No programs to run${name ? ` matching --name ${name}` : ""}`);
    console.error(`Available: ${CORPUS_PROGRAMS.map((p) => p.name).join(", ")}`);
    process.exit(1);
  }

  if (!fs.existsSync(JUDGE_PROMPT_PATH)) {
    console.error(`Judge prompt missing: ${JUDGE_PROMPT_PATH}`);
    process.exit(1);
  }

  const runDir = path.join(RESULTS_DIR, `corpus-${timestampDir()}`);
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Run dir: ${runDir}`);
  console.log(`Judge model: ${JUDGE_MODEL}`);
  console.log(`Programs to judge: ${programs.length}`);

  const results: Array<{ name: string; ok: boolean; reason?: string; overall?: number; pass?: boolean }> = [];
  for (const program of programs) {
    const r = await runOne(program, runDir);
    results.push({ name: program.name, ...r });
  }

  console.log(`\n=== SUMMARY ===`);
  let ok = 0, fail = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ✓ ${r.name.padEnd(30)} overall=${r.overall ?? "?"} pass=${r.pass ?? "?"}`);
    } else {
      fail++;
      console.log(`  ✗ ${r.name.padEnd(30)} ${r.reason}`);
    }
  }
  console.log(`Total: ok=${ok} fail=${fail}`);

  // Persist a summary at the run-dir root for easier scanning.
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify({ runAt: new Date().toISOString(), results }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
