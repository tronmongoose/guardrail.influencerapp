import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "qa-fixtures");
const RESULTS_DIR = path.join(REPO_ROOT, "tests", "qa-results");
const JUDGE_PROMPT_PATH = path.join(REPO_ROOT, "tests", "qa-judge-prompt.md");
const APPS_WEB_DIR = path.join(REPO_ROOT, "apps", "web");

const JUDGE_MODEL = process.env.QA_JUDGE_MODEL || "claude-opus-4-7";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
// --prod loads .env.production.local FIRST so its values stick (loadEnvFile
// only sets a key if not already set). Use this to point the judge at the
// prod Neon DB without committing fixture files for every prod program.
// Generated via: cd apps/web && vercel env pull .env.production.local --environment=production
const PROD_ENV_FILE = path.join(APPS_WEB_DIR, ".env.production.local");
if (process.argv.includes("--prod")) {
  if (!fs.existsSync(PROD_ENV_FILE)) {
    console.error(
      `--prod given but ${PROD_ENV_FILE} not found.\n` +
        `Run: cd apps/web && vercel env pull .env.production.local --environment=production`,
    );
    process.exit(1);
  }
  loadEnvFile(PROD_ENV_FILE);
}
loadEnvFile(path.join(APPS_WEB_DIR, ".env"));
loadEnvFile(path.join(APPS_WEB_DIR, ".env.local"));

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
  if (!fs.existsSync(FIXTURES_DIR)) {
    throw new Error(`Fixtures directory missing: ${FIXTURES_DIR}`);
  }
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  const all: Fixture[] = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), "utf-8")),
  );
  if (!name) return all;
  const match = all.find((f) => f.name === name);
  if (!match) {
    throw new Error(
      `Fixture "${name}" not found. Available: ${all.map((f) => f.name).join(", ")}`,
    );
  }
  return [match];
}

async function buildJudgeInputs(prisma: PrismaClient, programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      videos: { include: { analysis: true } },
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          sessions: {
            orderBy: { orderIndex: "asc" },
            include: {
              actions: { orderBy: { orderIndex: "asc" } },
              compositeSession: {
                include: { clips: { orderBy: { orderIndex: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!program) throw new Error(`Program ${programId} not found`);

  const videoAnalyses = program.videos
    .filter((v) => v.analysis)
    .map((v) => ({
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
    programTitle: program.title,
    programDescription: program.description,
    targetTransformation: program.targetTransformation,
    lessons: program.weeks.map((w) => ({
      lessonNumber: w.weekNumber,
      title: w.title,
      summary: w.summary,
      sessions: w.sessions.map((s) => ({
        title: s.title,
        summary: s.summary,
        steps: s.actions.map((a) => ({ type: a.type, title: a.title })),
        clips:
          s.compositeSession?.clips.map((c) => ({
            videoId: c.youtubeVideoId,
            startSeconds: c.startSeconds,
            endSeconds: c.endSeconds,
            chapterTitle: c.chapterTitle,
          })) || [],
      })),
    })),
  };

  return { videoAnalyses, curriculum };
}

async function callAnthropicJudge(
  judgePrompt: string,
  inputs: object,
): Promise<string> {
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

function splitJudgeOutput(raw: string): {
  markdown: string;
  scoresJson: string;
} {
  const delim = "---JSON---";
  const idx = raw.indexOf(delim);
  if (idx === -1) {
    throw new Error(
      `Judge output missing required "${delim}" delimiter. Raw output:\n${raw.slice(0, 500)}...`,
    );
  }
  const markdown = raw.slice(0, idx).trim();
  let scoresJson = raw.slice(idx + delim.length).trim();
  // Strip ```json fences if present
  scoresJson = scoresJson.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return { markdown, scoresJson };
}

function timestampDir(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function runOne(prisma: PrismaClient, fixture: Fixture, runDir: string) {
  console.log(`\n=== ${fixture.name} (programId=${fixture.programId}) ===`);
  const inputs = await buildJudgeInputs(prisma, fixture.programId);
  console.log(
    `  videos=${inputs.videoAnalyses.length} lessons=${inputs.curriculum.lessons.length}`,
  );

  const fixtureDir = path.join(runDir, fixture.name);
  fs.mkdirSync(fixtureDir, { recursive: true });

  fs.writeFileSync(
    path.join(fixtureDir, "inputs.json"),
    JSON.stringify(inputs, null, 2),
  );

  const judgePrompt = fs.readFileSync(JUDGE_PROMPT_PATH, "utf-8");
  console.log(`  calling judge: ${JUDGE_MODEL} ...`);
  const t0 = Date.now();
  const raw = await callAnthropicJudge(judgePrompt, inputs);
  console.log(`  judge returned in ${Math.round((Date.now() - t0) / 1000)}s`);

  const { markdown, scoresJson } = splitJudgeOutput(raw);
  fs.writeFileSync(path.join(fixtureDir, "judgement.md"), markdown + "\n");
  fs.writeFileSync(path.join(fixtureDir, "scores.json"), scoresJson + "\n");

  let parsed: { overall?: number; pass?: boolean } = {};
  try {
    parsed = JSON.parse(scoresJson);
  } catch (err) {
    console.warn(`  WARNING: scores.json is not valid JSON — wrote raw output`);
  }
  console.log(
    `  overall=${parsed.overall ?? "?"} pass=${parsed.pass ?? "?"} -> ${fixtureDir}`,
  );
}

async function main() {
  const { fixture, programId, name, prod } = parseArgs();

  // --programId is the ad-hoc path: judge a single program by ID without
  // needing a fixture file. Pairs naturally with --prod to run against prod.
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

  const runDir = path.join(RESULTS_DIR, timestampDir());
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Run dir: ${runDir}`);
  console.log(`Judge model: ${JUDGE_MODEL}${prod ? " (against prod DB)" : ""}`);

  const prisma = new PrismaClient();
  try {
    for (const f of fixtures) {
      await runOne(prisma, f, runDir);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
