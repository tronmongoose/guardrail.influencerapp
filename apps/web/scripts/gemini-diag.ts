/**
 * gemini-diag — diagnose a YouTube video's Gemini analysis response.
 *
 * Mirrors what analyzeVideoWithGemini does in packages/ai/src/gemini-video-
 * analyzer.ts, but logs the full raw response (including finishReason,
 * safetyRatings, citationMetadata) instead of just the text. The production
 * analyzer raises "Gemini returned empty response" when text is missing —
 * that error doesn't tell us *why* it was empty. This script does.
 *
 * Usage:
 *   pnpm tsx apps/web/scripts/gemini-diag.ts <youtubeId>
 *
 * Writes: tests/qa-fixtures/corpus/<id>.gemini-diag.json  (full raw response)
 *
 * Required env: GOOGLE_AI_API_KEY
 */

import * as fs from "fs";
import * as path from "path";
import { getGeminiVideoModel, GEMINI_API_BASE } from "@guide-rail/ai";

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

const FIXTURE_DIR = path.resolve(__dirname, "..", "..", "..", "tests", "qa-fixtures", "corpus");

const SIMPLE_PROMPT = "Briefly describe what this video is about in 2-3 sentences. Return JSON: { summary: string, durationSeconds: number }.";

async function main() {
  const ytId = process.argv[2];
  if (!ytId) {
    console.error("Usage: pnpm tsx apps/web/scripts/gemini-diag.ts <youtubeId>");
    process.exit(1);
  }
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_AI_API_KEY not set");
    process.exit(1);
  }

  const model = getGeminiVideoModel();
  const youtubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
  console.info(`[diag] video=${ytId} model=${model} url=${youtubeUrl}`);

  // Use a deliberately simple prompt to isolate the question: is the YouTube
  // URL itself processable, or is the failure tied to the long structured
  // prompt? If a 2-sentence summary fails the same way, the issue isn't the
  // prompt.
  const body = {
    contents: [{
      parts: [
        { fileData: { fileUri: youtubeUrl } },
        { text: SIMPLE_PROMPT },
      ],
    }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };

  const t0 = Date.now();
  const res = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;
  console.info(`[diag] http status=${res.status} elapsed=${elapsed}ms`);

  const rawText = await res.text();
  let data: unknown;
  try { data = JSON.parse(rawText); } catch { data = { _parseFailed: true, raw: rawText }; }

  const out = {
    _meta: {
      videoId: ytId,
      model,
      httpStatus: res.status,
      elapsedMs: elapsed,
      at: new Date().toISOString(),
      prompt: SIMPLE_PROMPT,
    },
    response: data,
  };

  // Surface the things we care about
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const candidates = d?.candidates ?? [];
  console.info(`[diag] candidates=${candidates.length}`);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const text = c?.content?.parts?.[0]?.text ?? "(no text)";
    console.info(`[diag] candidate[${i}] finishReason=${c?.finishReason ?? "?"} avgLogprobs=${c?.avgLogprobs ?? "?"}`);
    console.info(`[diag]   text length=${text.length}, preview="${String(text).slice(0, 200)}"`);
    if (c?.safetyRatings) console.info(`[diag]   safetyRatings=${JSON.stringify(c.safetyRatings)}`);
    if (c?.citationMetadata) console.info(`[diag]   citationMetadata present`);
  }
  if (d?.promptFeedback) console.info(`[diag] promptFeedback=${JSON.stringify(d.promptFeedback)}`);
  if (d?.usageMetadata) console.info(`[diag] usage=${JSON.stringify(d.usageMetadata)}`);
  if (d?.error) console.info(`[diag] error=${JSON.stringify(d.error)}`);

  if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const outPath = path.join(FIXTURE_DIR, `${ytId}.gemini-diag.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.info(`[diag] wrote ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
