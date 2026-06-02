/**
 * LLM adapter — provider-agnostic wrapper for generating ProgramDraft JSON.
 *
 * Two-pass architecture:
 *   Pass 1 (extractContentDigests): Per-content-source extraction → structured digests
 *   Pass 2 (generateProgramDraft):  Curriculum design using rich digests
 *
 * Supports: "anthropic" | "openai" | "gemini" | "stub"
 * Configured via LLM_PROVIDER env var. Defaults to "stub" for local dev.
 */

import { ProgramDraftSchema } from "@guide-rail/shared";
import type { ProgramDraft } from "@guide-rail/shared";
import { generateWithStub, generateStubContentDigest } from "./llm-stub";
import { GEMINI_API_BASE, getGeminiTextModel } from "./constants";
import type { DistributionPlan } from "./clip-distributor";
import { formatDistributionPlanForPrompt } from "./clip-distributor";

export type LLMProvider = "anthropic" | "openai" | "gemini" | "stub";

const LLM_TIMEOUT_MS = 60_000; // 60s for content extraction
const GENERATION_TIMEOUT_MS = 600_000; // 10min for curriculum generation

// undici's default `headersTimeout` / `bodyTimeout` (300s) is overridden at
// the route-handler level via `setGlobalDispatcher` in
// apps/web/app/api/programs/[id]/generate-async/route.ts. Doing the override
// there (server-only) keeps undici out of the client bundle while
// guaranteeing the package is shipped with the serverless function.
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export interface ContentDigest {
  contentId: string;
  contentTitle: string;
  contentType: "video" | "document";
  keyConcepts: string[];
  skillsIntroduced: string[];
  memorableExamples: string[];
  difficultyLevel: string;
  summary: string;
  /**
   * Actual content duration in seconds. Required for videos that fall through
   * to the basic-digest path (no Gemini analysis) so the clip distributor
   * doesn't silently truncate them to DEFAULT_VIDEO_DURATION.
   */
  durationSeconds?: number | null;
}

/**
 * Enriched digest built from Gemini VideoAnalysis — includes timestamped data
 * for scene-based lesson generation.
 */
export interface EnrichedContentDigest extends ContentDigest {
  segments: { startSeconds: number; endSeconds: number; text: string; topic?: string }[];
  topics: { label: string; startSeconds: number; endSeconds: number; subtopics?: string[] }[];
  keyMoments: { timestampSeconds: number; description: string; significance?: string; type?: string }[];
  durationSeconds?: number;
}

interface GenerateInput {
  programId: string;
  programTitle: string;
  programDescription?: string;
  outcomeStatement?: string;
  targetAudience?: string;
  targetTransformation?: string;
  vibePrompt?: string;
  durationWeeks: number;
  clusters: {
    clusterId: number;
    contentIds: string[];
    contentTitles: string[];
    contentTranscripts?: string[];
    contentTypes?: ("video" | "document")[];
    summary?: string;
  }[];
  contentDigests?: ContentDigest[];
  /** When true, prompt requests scene-based output with clips/overlays */
  hasVideoAnalysis?: boolean;
  /** Pre-computed clip-to-lesson assignment plan */
  clipDistributionPlan?: DistributionPlan;
  /** When true, LLM determines the ideal lesson count instead of using durationWeeks exactly */
  aiStructured?: boolean;
}

const MAX_REPAIR_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Pass 1: Content Extraction
// ---------------------------------------------------------------------------

function buildExtractionPrompt(contentTitle: string, text: string, contentType: "video" | "document" = "video"): string {
  const sourceLabel = contentType === "video" ? "VIDEO" : "DOCUMENT";
  const textLabel = contentType === "video" ? "TRANSCRIPT" : "CONTENT";
  const truncated = text.slice(0, 8000);
  return `You are an expert content analyst. Analyze the following ${sourceLabel.toLowerCase()} and extract structured information about what it teaches.

${sourceLabel} TITLE: "${contentTitle}"

${textLabel}:
${truncated}${text.length > 8000 ? "..." : ""}

Extract the following information as JSON (no markdown, no code fences):
{
  "keyConcepts": ["3-5 key concepts, techniques, or ideas taught in this ${sourceLabel.toLowerCase()}"],
  "skillsIntroduced": ["specific skills, frameworks, or methodologies introduced"],
  "memorableExamples": ["notable examples, case studies, or stories used to illustrate points"],
  "difficultyLevel": "beginner | intermediate | advanced",
  "summary": "2-3 sentence summary of what this ${sourceLabel.toLowerCase()} teaches and its core message"
}

Be specific and concrete — reference actual content from the ${textLabel.toLowerCase()}, not generic descriptions.
Return ONLY the JSON object.`;
}

async function extractSingleDigest(
  contentId: string,
  contentTitle: string,
  text: string,
  contentType: "video" | "document",
  provider: LLMProvider,
): Promise<ContentDigest> {
  const prompt = buildExtractionPrompt(contentTitle, text, contentType);

  let raw: string;
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    }, LLM_TIMEOUT_MS);
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    raw = data.content[0].text;
  } else if (provider === "gemini") {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GOOGLE_AI_API_KEY not set");
    const model = getGeminiTextModel();
    const res = await fetchWithTimeout(
      `${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      },
      LLM_TIMEOUT_MS,
    );
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } else {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      }),
    }, LLM_TIMEOUT_MS);
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    raw = data.choices[0].message.content;
  }

  try {
    const json = extractJSON(raw);
    const parsed = JSON.parse(json);
    return {
      contentId,
      contentTitle,
      contentType,
      keyConcepts: parsed.keyConcepts ?? [],
      skillsIntroduced: parsed.skillsIntroduced ?? [],
      memorableExamples: parsed.memorableExamples ?? [],
      difficultyLevel: parsed.difficultyLevel ?? "intermediate",
      summary: parsed.summary ?? "",
    };
  } catch (err) {
    console.error(`[LLM] Failed to parse content digest for ${contentId}:`, err);
    return fallbackDigest(contentId, contentTitle, contentType);
  }
}

function fallbackDigest(contentId: string, contentTitle: string, contentType: "video" | "document" = "video"): ContentDigest {
  return {
    contentId,
    contentTitle,
    contentType,
    keyConcepts: [],
    skillsIntroduced: [],
    memorableExamples: [],
    difficultyLevel: "intermediate",
    summary: `Content from "${contentTitle}"`,
  };
}

/**
 * Pass 1: Extract structured content digests from each content source.
 * Parallelized with concurrency limit. Gracefully falls back per-item on failure.
 */
export async function extractContentDigests(
  items: { contentId: string; contentTitle: string; text: string | null; contentType?: "video" | "document" }[],
  onProgress?: (completed: number, total: number) => void,
): Promise<ContentDigest[]> {
  const provider = (process.env.LLM_PROVIDER || "stub") as LLMProvider;

  if (provider === "stub") {
    const digests = items.map((item) =>
      generateStubContentDigest(item.contentId, item.contentTitle, item.contentType ?? "video"),
    );
    onProgress?.(items.length, items.length);
    return digests;
  }

  const CONCURRENCY = 3;
  const digests: ContentDigest[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((item) => {
        const ct = item.contentType ?? "video";
        if (!item.text || item.text.length < 50) {
          return Promise.resolve(fallbackDigest(item.contentId, item.contentTitle, ct));
        }
        return extractSingleDigest(item.contentId, item.contentTitle, item.text, ct, provider);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        digests.push(result.value);
      } else {
        const item = batch[j];
        console.error(
          `[LLM] Content extraction failed for "${item.contentTitle}" (${item.contentId}, type=${item.contentType ?? "video"}):`,
          result.reason instanceof Error ? result.reason.message : result.reason,
        );
        digests.push(fallbackDigest(item.contentId, item.contentTitle, item.contentType ?? "video"));
      }
    }

    completed += batch.length;
    onProgress?.(completed, items.length);
  }

  return digests;
}

// ---------------------------------------------------------------------------
// Pass 2: Curriculum Generation
// ---------------------------------------------------------------------------

export async function generateProgramDraft(
  input: GenerateInput
): Promise<ProgramDraft> {
  const provider = (process.env.LLM_PROVIDER || "stub") as LLMProvider;

  // Log input summary (privacy-conscious - no full transcripts)
  const inputSummary = {
    programId: input.programId,
    programTitle: input.programTitle,
    durationWeeks: input.durationWeeks,
    totalContent: input.clusters.reduce((sum, c) => sum + c.contentIds.length, 0),
    clusterCount: input.clusters.length,
    hasOutcomeStatement: !!input.outcomeStatement,
    hasTargetAudience: !!input.targetAudience,
    hasTargetTransformation: !!input.targetTransformation,
    hasVibePrompt: !!input.vibePrompt,
    hasTranscripts: input.clusters.some(c => c.contentTranscripts?.some(t => t && t.length > 0)),
    hasContentDigests: !!input.contentDigests?.length,
    digestCount: input.contentDigests?.length ?? 0,
  };
  console.info(`[LLM] Generation request:`, JSON.stringify(inputSummary));
  console.info(`[LLM] Using provider: ${provider}`);

  // ── Diagnostic: log the full prompt being sent to the LLM ──
  const debugPrompt = buildPrompt(input);
  console.info(`[LLM] ═══ PROMPT (first 2000 chars) ═══`);
  console.info(debugPrompt.slice(0, 2000));
  if (debugPrompt.length > 2000) {
    console.info(`[LLM] ... (${debugPrompt.length} total chars, truncated in log)`);
  }
  console.info(`[LLM] ═══ END PROMPT PREVIEW ═══`);

  let raw: string;

  if (provider === "stub") {
    console.info("[LLM] Generating with stub (no API call)");
    return generateWithStub(input);
  } else if (provider === "anthropic") {
    const llmStart = Date.now();
    console.info("[LLM] Calling Anthropic API");
    try {
      raw = await callAnthropic(input);
      console.info(`[LLM] Anthropic returned after ${Math.round((Date.now() - llmStart) / 1000)}s, ${raw.length} chars`);
    } catch (err) {
      const elapsed = Math.round((Date.now() - llmStart) / 1000);
      const errName = err instanceof Error ? err.name : "unknown";
      const errMsg = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && "cause" in err ? String((err as { cause?: unknown }).cause) : "(no cause)";
      console.error(`[LLM] Anthropic call FAILED after ${elapsed}s — name=${errName} msg=${errMsg} cause=${cause}`);
      throw err;
    }
  } else if (provider === "gemini") {
    console.info("[LLM] Calling Gemini API");
    raw = await callGemini(input);
  } else if (provider === "openai") {
    console.info("[LLM] Calling OpenAI API");
    raw = await callOpenAI(input);
  } else {
    throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }

  console.info(`[LLM] Raw response length: ${raw.length} chars`);
  console.info(`[LLM] ═══ RESPONSE (first 1000 chars) ═══`);
  console.info(raw.slice(0, 1000));
  if (raw.length > 1000) {
    console.info(`[LLM] ... (${raw.length} total chars, truncated in log)`);
  }
  console.info(`[LLM] ═══ END RESPONSE PREVIEW ═══`);

  // Parse + validate + repair loop
  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    try {
      const json = extractJSON(raw);
      const parsed = JSON.parse(json);
      clipKeyTakeaways(parsed);
      const validated = ProgramDraftSchema.parse(parsed);

      // Log output summary
      console.info(`[LLM] Generated draft: ${validated.weeks.length} weeks, ${
        validated.weeks.reduce((sum, w) => sum + w.sessions.length, 0)
      } sessions, ${
        validated.weeks.reduce((sum, w) =>
          sum + w.sessions.reduce((s, sess) => s + sess.actions.length, 0), 0)
      } actions`);

      return validated;
    } catch (err) {
      console.error(`[LLM] Parse attempt ${attempt + 1} failed:`, err);
      if (attempt === MAX_REPAIR_ATTEMPTS) {
        throw new Error(
          `LLM output failed validation after ${MAX_REPAIR_ATTEMPTS} repair attempts: ${err}`
        );
      }
      // Attempt repair by re-calling with error context
      console.info(`[LLM] Attempting repair...`);
      raw = await repairJSON(raw, String(err), provider, input);
    }
  }

  throw new Error("Unreachable");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Trims keyTakeaways to the schema's 200-char cap so the LLM blowing past the
// limit doesn't fail validation. Mutates in place.
function clipKeyTakeaways(parsed: unknown): void {
  const weeks = (parsed as { weeks?: unknown[] })?.weeks;
  if (!Array.isArray(weeks)) return;
  for (const week of weeks) {
    const sessions = (week as { sessions?: unknown[] })?.sessions;
    if (!Array.isArray(sessions)) continue;
    for (const session of sessions) {
      const takeaways = (session as { keyTakeaways?: unknown[] })?.keyTakeaways;
      if (!Array.isArray(takeaways)) continue;
      for (let i = 0; i < takeaways.length; i++) {
        const t = takeaways[i];
        if (typeof t === "string" && t.length > 200) {
          takeaways[i] = t.slice(0, 197).trimEnd() + "…";
        }
      }
    }
  }
}

function extractJSON(text: string): string {
  // Try to find JSON block in markdown code fence or raw
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try raw JSON
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text;
}

function buildPrompt(input: GenerateInput): string {
  const useSceneMode = input.hasVideoAnalysis === true;

  // Build digest lookup
  const digestMap = new Map(
    (input.contentDigests ?? []).map((d) => [d.contentId, d]),
  );

  // Enriched digests carry per-segment timestamped transcripts from Gemini —
  // we thread them into the assignment plan formatter so the LLM can ground
  // each clip's chapterTitle in the actual content of that time range.
  const enrichedDigests = (input.contentDigests ?? []).filter(
    (d): d is EnrichedContentDigest =>
      "segments" in d && Array.isArray((d as EnrichedContentDigest).segments),
  );

  // Flatten all content items
  const allContent: { id: string; title: string; text?: string; clusterId: number; type: "video" | "document" }[] = [];
  for (const c of input.clusters) {
    for (let i = 0; i < c.contentIds.length; i++) {
      allContent.push({
        id: c.contentIds[i],
        title: c.contentTitles[i],
        text: c.contentTranscripts?.[i],
        clusterId: c.clusterId,
        type: c.contentTypes?.[i] ?? "video",
      });
    }
  }

  const videoCount = allContent.filter(c => c.type === "video").length;
  const docCount = allContent.filter(c => c.type === "document").length;
  const hasVideos = videoCount > 0;
  const hasDocs = docCount > 0;

  // Build content descriptions — always include transcript when available
  const contentDescriptions = allContent.map((item, i) => {
    const typeLabel = item.type === "video" ? "VIDEO" : "DOCUMENT";
    const digest = digestMap.get(item.id);

    // Always include transcript/text — this is the primary content signal for curriculum quality
    let transcriptSnippet = item.text && item.text.length > 0
      ? `\n   TRANSCRIPT (${item.text.length} chars):\n   ${item.text.slice(0, 4000)}${item.text.length > 4000 ? "..." : ""}`
      : `\n   TRANSCRIPT: [NOT AVAILABLE — video has not been transcribed yet]`;

    // Enriched digest with timestamps (from Gemini analysis)
    const enriched = digest as EnrichedContentDigest | undefined;

    // Safety net: if no transcript from cluster data, reconstruct from analysis segments
    if ((!item.text || item.text.length === 0) && enriched?.segments && enriched.segments.length > 0) {
      const segText = enriched.segments
        .map((s: { text?: string }) => s.text ?? "")
        .filter(Boolean)
        .join(" ");
      if (segText.length > 0) {
        transcriptSnippet = `\n   TRANSCRIPT (${segText.length} chars, from segments):\n   ${segText.slice(0, 4000)}${segText.length > 4000 ? "..." : ""}`;
      }
    }
    if (enriched?.topics && enriched.topics.length > 0) {
      const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      const durationStr = enriched.durationSeconds
        ? ` (Duration: ${formatTime(enriched.durationSeconds)})`
        : "";

      const topicLines = enriched.topics.map((t) =>
        `  - "${t.label}" (${formatTime(t.startSeconds)} - ${formatTime(t.endSeconds)})`
      ).join("\n");

      const momentLines = (enriched.keyMoments ?? []).slice(0, 6).map((m) =>
        `  - ${formatTime(m.timestampSeconds)} — ${m.description}${m.significance ? ` [${m.significance}]` : ""}`
      ).join("\n");

      return [
        `${i + 1}. [${typeLabel}] "${item.title}" (ID: ${item.id}, Cluster: ${item.clusterId})${durationStr}`,
        `   Summary: ${enriched.summary}`,
        `   Topics:`,
        topicLines,
        momentLines ? `   Key moments:\n${momentLines}` : "",
        `   Skills: ${enriched.skillsIntroduced.join(", ") || "N/A"}`,
        `   Difficulty: ${enriched.difficultyLevel}`,
        transcriptSnippet,
      ].filter(Boolean).join("\n");
    }

    // Basic digest (from LLM extraction)
    if (digest && digest.keyConcepts.length > 0) {
      return [
        `${i + 1}. [${typeLabel}] "${item.title}" (ID: ${item.id}, Cluster: ${item.clusterId})`,
        `   Summary: ${digest.summary}`,
        `   Key concepts: ${digest.keyConcepts.join(", ")}`,
        `   Skills introduced: ${digest.skillsIntroduced.join(", ") || "N/A"}`,
        `   Notable examples: ${digest.memorableExamples.join("; ") || "N/A"}`,
        `   Difficulty: ${digest.difficultyLevel}`,
        transcriptSnippet,
      ].join("\n");
    }

    // No digest at all — show transcript as the only context
    return `${i + 1}. [${typeLabel}] "${item.title}" (ID: ${item.id}, Cluster: ${item.clusterId})${transcriptSnippet}`;
  }).join("\n\n");

  const totalContent = allContent.length;
  const contentPerWeek = Math.max(1, Math.ceil(totalContent / input.durationWeeks));

  const contentSummaryParts: string[] = [];
  if (hasVideos) contentSummaryParts.push(`${videoCount} video(s)`);
  if (hasDocs) contentSummaryParts.push(`${docCount} document(s)`);
  const contentSummary = contentSummaryParts.join(" and ");

  const audienceContext = input.targetAudience
    ? `- Target Audience: ${input.targetAudience}`
    : "";
  const transformationContext = input.targetTransformation
    ? `- Target Transformation: ${input.targetTransformation}`
    : "";

  const vibeInstructions = input.vibePrompt
    ? `\nCREATOR'S STYLE GUIDE:
${input.vibePrompt}

Apply this style throughout all titles, descriptions, instructions, and reflection prompts.`
    : "";

  // Shared quality rules — prepended to both scene-based and classic prompts.
  // These override any conflicting defaults elsewhere in the prompt.
  const qualityRules = `
SOURCE DISCIPLINE (non-negotiable):
Every claim, technique, example, and takeaway in your output MUST be directly
supported by the transcripts below. Do not infer program details, add steps the
creator didn't mention, or invent outcomes. If the transcripts don't cover
something, do not include it.

HONOR SOURCE GENRE (non-negotiable):
Read what the clip actually IS, not what the program theme suggests it
should be. If the source content is one of these genres, the lesson MUST
reflect that genre — do not pretend the learner will acquire a teachable
skill from content that doesn't teach one.

- Announcement / preview / roadmap content (e.g. "here's what's coming in
  our new course") → the lesson is an EXPLORATION of what's coming, not a
  skill-build. Title and steps must say "explore" / "preview" / "decide
  whether this fits you" — not "master" / "learn to do X."
- Product reveal / collection unveiling (e.g. a beauty creator showing
  their makeup line) → the lesson is an UNVEILING / OVERVIEW, not a
  technique tutorial. Don't frame it as "design a performance look" when
  the source only displays the product.
- Promotional / sponsorship / podcast-plug segments embedded in otherwise
  instructional videos → do not write a lesson around these. If the
  assigned clip is mostly such content, frame the lesson honestly as
  "context about the creator" or similar, not as instruction.
- Personal reflection / opinion essays (e.g. "why I started this channel")
  → the lesson is REFLECTION on the creator's perspective, not skill
  acquisition. Steps invite the learner to reflect on their own
  experience, not to perform a technique.

You may write a strong, useful lesson for any of these genres — but only
by honestly framing what the source actually is. Pretending a preview is a
tutorial is the most common source-faithfulness failure mode and is
unacceptable.

LESSON ORDER RULE — workflow sequencing (non-negotiable):
Sequence lessons in the order a learner would encounter these skills in
their actual workflow. Foundational skills and creation steps come before
refinement and finishing steps. Mixing, mastering, polishing, and any
"finalize/export/publish" step always come LAST. Tool-specific lessons
come AFTER the skill those tools support (e.g. a lesson on "using Serum"
comes after the lesson on sound design; a lesson on "using Pro-Q" comes
after the lesson on EQ fundamentals).

How to combine this with upload order:
1. Start with the creator's upload order in AVAILABLE CONTENT SOURCES as
   your default hypothesis — creators often upload in the right order.
2. Then validate that order against the workflow principle above. If the
   upload order already flows create → shape → refine → finish, keep it.
3. If the upload order violates the workflow principle (e.g. a mixing
   lesson appears before a beat-making lesson, or a tool lesson appears
   before the underlying skill), reorder to follow the workflow. The
   workflow principle always wins over upload order on conflict.
4. When a VIDEO ASSIGNMENT PLAN is provided, its clip-to-lesson mapping
   is still mandatory — you are only ordering the lessons, not
   reassigning clips.

Do NOT reorder based on superficial title keywords like "intro",
"welcome", "overview", or "framework" — a lesson titled "Intro to mixing"
is still a mixing lesson and belongs at the end of a production workflow,
not the beginning.

Worked example (beat production, upload order was wrong):
  UPLOAD ORDER: Mix → Arrange → Beats → Bass → Sample
  CORRECTED:    Beats → Sample → Bass → Arrange → Mix
  (Drums/beats are the foundation; sampling and bass build on them;
  arrangement shapes the full track; mixing finalizes. This pattern
  generalizes: creation before shaping before finishing.)

WITHIN-VIDEO ORDER RULE — preserve source sequence (non-negotiable):
When multiple lessons draw clips from the SAME source video, those lessons
MUST appear in the program in the same order the clips appear in the
source video (earlier startSeconds → earlier lesson number). A creator who
filmed Press → Cable Fly → Chest Fly → Decline Crossover within one video
expects learners to experience those exercises in that order. Do not
scatter clips from one source video across non-adjacent lessons in
arbitrary order, even when the workflow-sequencing rule above might
suggest reshuffling. The creator's intra-video ordering is their
pedagogical signal.

This rule constrains the workflow-sequencing rule: workflow sequencing
applies BETWEEN source videos, while within-video order applies WITHIN a
source video. When in conflict (rare), source order wins for clips from
the same video.

LESSON TOPIC COHERENCE RULE:
- Each lesson must have a single governing concept. When distributing clips
  across lessons, only include clips whose content directly supports that
  lesson's core concept. Do not include clips from unrelated topics simply
  to balance lesson duration. A shorter, coherent lesson is always better
  than a longer lesson that mixes distinct concepts (e.g. combining a
  macronutrient-ratio concept with a vegetarian-protein concept and a
  tool/Sifter demo into one lesson is wrong — those are three lessons).

LESSON TITLE RULES:
- Titles must describe what the learner will DO or UNDERSTAND after the lesson.
- Name the outcome, not the topic.
- Bad: "Protein Optimization" / "Macronutrient Balance" / "Introduction"
- Good: "Hit your protein target at every meal, not just dinner"
- Good: "Build a midlife-friendly grocery list in under 10 minutes"

LESSON TITLE ↔ CLIP CONTENT ALIGNMENT (highest-priority rule, non-negotiable):
When a VIDEO ASSIGNMENT PLAN is provided, the lesson's title MUST describe
what actually happens in the clips ASSIGNED to that lesson, derived from the
clip's transcript excerpts in the plan. Do NOT title a lesson based on the
program's overall theme if that theme doesn't match the assigned clip content.

- If Lesson 1 is assigned a clip about "hand-pulling Biang Biang noodles,"
  its title cannot be "Mise en Place Fundamentals" or "Kitchen Organization."
  The title must be about hand-pulling noodles.
- If Lesson 3 is assigned a clip from a video's INTRO segment (knives,
  measuring cups), the title must describe that intro — not a downstream
  technique that the assigned clip doesn't cover.
- Read the timestamped transcript excerpts under each lesson's clips. The
  title MUST come from what's in those excerpts, not from the program title,
  not from the source video's title, not from your guess.
- Title-clip mismatch is the #1 failure mode and is unacceptable.

STEP/ACTION RULES:
- Every action must be something the learner physically does, decides, or writes.
- Restatements of concepts are NOT actions.
- Bad: "Adopt the 40/30/30 ratio." / "Understand why protein matters."
- Good: "Log everything you eat today in a macro tracker — don't change anything
  yet, just find your current baseline."
- Action titles must start with an imperative verb ("Track…", "List…", "Try…", "Write…").
- Every action's \`instructions\` field MUST contain 2-3 numbered sub-steps.
  Each sub-step must name a specific concept, number, term, or tool from the
  transcript — not a generic category.
- Bad (too vague): "Identify your current symptoms"
- Good (specific, numbered): "1. Write the three midlife symptoms the video
  names that you've experienced this month. 2. Circle the one most disruptive
  to your sleep. 3. Note one concrete change you could try this week."
- This rule applies equally to conceptual lessons and tool/procedure lessons.
  Conceptual content is not an excuse for vague steps.

LESSON SCAFFOLDING RULE (non-negotiable):
A lesson with only one DO + one REFLECT is too sparse and fails the learner.
Every lesson MUST contain at least 3 actions arranged as a scaffold around
the WATCH step (the clips themselves):

- A PRE-WATCH or SETUP action that primes the learner before they watch —
  e.g. "Set up your notebook and these three columns…", "Lay out the
  ingredients the chef will use: X, Y, Z so you can follow along", "Note
  the bar's gauge before you start — you'll come back to it after."
  Action type: \`do\` (the learner physically prepares something) or
  \`read\` (concise on-page primer the learner reads before the WATCH).
- A MAIN PRACTICE action AFTER the WATCH where the learner actually
  performs the technique, replicates the step, or applies the concept.
  Action type: \`do\`. This is the heart of the lesson.
- A REFLECT action as the final step (per the REFLECT RULE).

You may add additional DO actions between WATCH and REFLECT when the
content genuinely supports a multi-step practice (e.g. drill 1, drill 2,
then reflect). You may substitute a READ for one of the DOs when the
content is concept-heavy and the learner truly does need a short reading
before they can perform.

What's NOT acceptable:
- A single bare DO action that just says "Try the technique from the
  video" with no setup before it.
- Two actions total (1 DO + 1 REFLECT) — this is the skinny-lesson
  failure mode flagged by the judge as the #1 step-flow problem.
- Filler scaffolding that adds no real preparation or practice (e.g. a
  PRE-WATCH that just says "Read the lesson title.").

The bar: a learner reading just the actions (without the title) should
be able to tell exactly what to set up, what to practice, and what to
reflect on. If your action list doesn't support that, add the missing
scaffolding step.

REFLECT RULE:
- Each lesson MUST include EXACTLY ONE REFLECT action.
- \`reflectionPrompt\` must be an open-ended question answered in the learner's
  own words. Not a fact to recall. Not a yes/no. Must end with "?".
- The reflectionPrompt MUST name at least one specific concept, term, number,
  or example from THIS lesson — never a generic category.
- Good: "Which of your current breakfasts actually fits the 40/30/30 ratio,
  and what would you have to change about the ones that don't?"
- Bad (generic): "Reflect on your midlife perspective." / "What did you learn
  about nutrition?"
- Bad (closed): "What is the 40/30/30 ratio?" / "Do you eat enough protein?"
`;

  // ── Scene-based prompt (with clips/overlays) ──
  if (useSceneMode) {
    const hasPlan = !!input.clipDistributionPlan && input.clipDistributionPlan.lessons.length > 0;
    const planBlock = hasPlan
      ? `\n${formatDistributionPlanForPrompt(input.clipDistributionPlan!, enrichedDigests)}\n`
      : "";

    const distributionRule = hasPlan
      ? `2. Follow the VIDEO ASSIGNMENT PLAN exactly — clip assignments are pre-computed and mandatory. Do NOT change youtubeVideoId, startSeconds, or endSeconds values. You may only add chapterTitle, chapterDescription, transitionType, and overlay details. EVERY chapterTitle and chapterDescription MUST describe what actually happens in that clip's timestamped transcript excerpt — never the source video's title, never an adjacent clip's content, never a guess. **NEVER UNDERSELL**: if the clip range spans multiple distinct exercises, topics, sub-topics, or segments in the source, the chapterTitle MUST name them all (or summarize them collectively — e.g., "Press, Cable Fly, Chest Fly, and Decline Crossover" or "All four chest exercises"). It is wrong to title a multi-topic clip after only its first topic. The chapterDescription must enumerate every distinct activity inside the clip's time range — anything visible in the transcript excerpts is in-scope and must be reflected.`
      : `2. Distribute content logically across all ${input.durationWeeks} lessons (~${contentPerWeek} source(s) per lesson)`;

    // When a distribution plan exists, it already pre-computed the correct lesson count.
    // Override aiStructured flexibility — the plan's structure is mandatory.
    const planWeekCount = hasPlan
      ? new Set(input.clipDistributionPlan!.lessons.map((l) => l.weekNumber)).size
      : 0;

    // Duration instruction depends on whether user chose a specific count or let AI decide
    // BUT if a distribution plan exists, always enforce the plan's structure
    const durationInstruction = hasPlan
      ? `- Duration: EXACTLY ${planWeekCount} lessons with 1 session each, matching the pre-computed video assignment plan below.`
      : input.aiStructured
        ? `- Duration: EXACTLY ${input.durationWeeks} lessons of 3-8 minutes of clip content each. Use the natural topic breaks in the source videos to choose lesson boundaries, but the total lesson count is fixed at ${input.durationWeeks}.`
        : `- Duration: EXACTLY ${input.durationWeeks} lessons (you MUST create ${input.durationWeeks} lessons)`;

    const weekCountRule = hasPlan
      ? `1. Generate EXACTLY ${planWeekCount} lessons (weekNumber 1 through ${planWeekCount}) with EXACTLY 1 session per lesson — this matches the VIDEO ASSIGNMENT PLAN. Do NOT merge lessons or create multiple sessions per lesson.`
      : input.aiStructured
        ? `1. Generate EXACTLY ${input.durationWeeks} lessons (weekNumber 1 through ${input.durationWeeks}) with EXACTLY 1 session per lesson. Each lesson must have 3-8 minutes of clip content. Use natural topic breaks to choose boundaries, but the lesson count is fixed.`
        : `1. Generate EXACTLY ${input.durationWeeks} lessons (weekNumber 1 through ${input.durationWeeks})`;

    const taskInstruction = hasPlan
      ? `Create a ${planWeekCount}-lesson scene-based program. Each lesson has exactly 1 session — a curated playlist of video clips from the source material, with transitions and overlays.`
      : input.aiStructured
        ? `Create a scene-based program with the ideal number of lessons for this content. Each session is a curated playlist of video clips from the source material, with transitions and overlays.`
        : `Create a ${input.durationWeeks}-lesson scene-based program. Each session is a curated playlist of video clips from the source material, with transitions and overlays.`;

    const durationWeeksOutput = hasPlan
      ? `${planWeekCount}`
      : input.aiStructured
        ? `"<number of lessons you chose>"`
        : `${input.durationWeeks}`;

    return `You are an expert curriculum designer creating a scene-based learning program with video clips, transitions, and overlays.
${qualityRules}
PROGRAM CONTEXT:
- Title: "${input.programTitle}"
${durationInstruction}
- Content available: ${contentSummary}
${input.programDescription ? `- Description: ${input.programDescription}` : ""}
${audienceContext}
${transformationContext}
${input.outcomeStatement ? `- Outcome Statement: ${input.outcomeStatement}` : ""}
${vibeInstructions}

AVAILABLE CONTENT SOURCES (with timestamped topic data):
${contentDescriptions}
${planBlock}
YOUR TASK:
${taskInstruction}

LESSON SHAPING RULES:
- Target 8-15 minutes of clip content per session
- Minimum clip length: 30 seconds
- Maximum 6 clips per session
- Prefer contiguous clips from the same source video
- Use startSeconds/endSeconds from the topic timestamps to create focused clips
- Each session starts with a TITLE_CARD overlay
- Add KEY_POINTS overlay after major topic transitions
- Use FADE transition between clips from different videos, NONE for contiguous clips from the same video
- Progressive complexity: foundational → applied → integration across lessons

CRITICAL REQUIREMENTS:
${weekCountRule}
${distributionRule}
3. Each lesson needs an outcome-oriented title (see LESSON TITLE RULES above) and a clear theme building toward the transformation
4. Each session MUST include keyTakeaways (2-3 items, each ≤ 200 characters) drawn directly from the transcripts
5. Each session MUST include a "clips" array with video clip segments
6. Each session MUST include an "overlays" array (at minimum a TITLE_CARD)
7. Each session MUST include actions: at least one DO action (imperative verb, physical activity) and EXACTLY ONE REFLECT action whose \`reflectionPrompt\` ends with "?" and is open-ended
${hasVideos ? `8. Use exact youtubeVideoId values from the content sources above` : ""}

OUTPUT FORMAT (JSON only, no markdown):
{
  "programId": "${input.programId}",
  "title": "${input.programTitle}",
  "description": "Compelling 1-2 sentence description",
  "pacingMode": "drip_by_week",
  "durationWeeks": ${durationWeeksOutput},
  "weeks": [
    {
      "title": "[Outcome-oriented title — what the learner can do after this lesson]",
      "summary": "What learners achieve in this lesson",
      "weekNumber": 1,
      "sessions": [
        {
          "title": "Session title",
          "summary": "Session focus",
          "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
          "orderIndex": 0,
          "clips": [
            {
              "youtubeVideoId": "[exact video record ID]",
              "startSeconds": 0,
              "endSeconds": 180,
              "orderIndex": 0,
              "transitionType": "NONE",
              "transitionDurationMs": 500,
              "chapterTitle": "Introduction to the concept",
              "chapterDescription": "Brief description of what this clip covers"
            },
            {
              "youtubeVideoId": "[exact video record ID]",
              "startSeconds": 180,
              "endSeconds": 420,
              "orderIndex": 1,
              "transitionType": "FADE",
              "transitionDurationMs": 500,
              "chapterTitle": "Deep dive",
              "chapterDescription": "Exploring the technique in detail"
            }
          ],
          "overlays": [
            {
              "type": "TITLE_CARD",
              "content": { "title": "Session title", "subtitle": "Lesson 1" },
              "position": "CENTER",
              "durationMs": 4000,
              "orderIndex": 0,
              "triggerAtSeconds": 0
            },
            {
              "type": "KEY_POINTS",
              "content": { "points": ["Key point 1", "Key point 2"] },
              "clipOrderIndex": 1,
              "position": "BOTTOM",
              "durationMs": 6000,
              "orderIndex": 1,
              "triggerAtSeconds": 5
            }
          ],
          "actions": [
            {
              "title": "[Imperative verb] [specific, physical activity]",
              "type": "do",
              "instructions": "2-3 numbered sub-steps, each naming a specific concept/term/number/tool from the transcript (e.g. '1. ... 2. ... 3. ...'). No generic steps.",
              "orderIndex": 0
            },
            {
              "title": "Reflect on [specific concept from this lesson]",
              "type": "reflect",
              "instructions": "Context for the reflection",
              "reflectionPrompt": "[Open-ended question the learner answers in their own words, ending with '?']",
              "orderIndex": 1
            }
          ]
        }
      ]
    }
  ]
}

OVERLAY TYPES:
- TITLE_CARD: { title, subtitle } — shown at session start, position CENTER
- KEY_POINTS: { points: string[] } — shown after topic transitions, position BOTTOM
- CHAPTER_TITLE: { title } — shown at clip boundaries, position LOWER_THIRD
- CTA: { text, action? } — call to action, position BOTTOM
- OUTRO: { text } — end of session, position CENTER

TRANSITION TYPES: NONE, FADE, CROSSFADE, SLIDE_LEFT

QUALITY GUIDELINES:
- Create focused clips around specific topics, NOT "watch the whole video" actions
- Use topic timestamps to pick the most valuable segments
- Key moments marked [high] significance are the best candidates for clips
- Build complexity progressively across lessons
- DO exercises must reference real techniques from the clips (see STEP/ACTION RULES above)
- REFLECT prompts must be open-ended questions grounded in clip content (see REFLECT RULE above)
- Final week should synthesize and prepare for real-world application`;
  }

  // ── Classic prompt (flat actions, no clips) ──
  const hasPlanClassic = !!input.clipDistributionPlan && input.clipDistributionPlan.lessons.length > 0;
  const classicPlanBlock = hasPlanClassic
    ? `\n${formatDistributionPlanForPrompt(input.clipDistributionPlan!, enrichedDigests)}\n`
    : "";

  const actionInstructions = [];
  if (hasVideos) {
    actionInstructions.push(`  * WATCH action(s) — for VIDEO content, reference videos by their exact ID in the youtubeVideoId field`);
  }
  if (hasDocs) {
    actionInstructions.push(`  * READ action(s) — for DOCUMENT content, create reading assignments that reference the document's key points`);
  }
  actionInstructions.push(`  * DO action — a physical activity the learner performs (imperative verb in the title, e.g. "Track…", "List…", "Try…"). Must be grounded in the transcript, not a concept restatement.`);
  actionInstructions.push(`  * REFLECT action (EXACTLY ONE per lesson) — reflectionPrompt is an open-ended question ending with "?", answered in the learner's own words (not yes/no, not a fact to recall).`);

  const actionExamples = [];
  if (hasVideos) {
    actionExamples.push(`            {
              "title": "Watch: [Video title]",
              "type": "watch",
              "instructions": "Specific guidance on what to focus on while watching",
              "youtubeVideoId": "[exact video ID from above]",
              "orderIndex": 0
            }`);
  }
  if (hasDocs) {
    actionExamples.push(`            {
              "title": "Read: [Document title or section]",
              "type": "read",
              "instructions": "Key sections to focus on and what to look for",
              "orderIndex": ${hasVideos ? 1 : 0}
            }`);
  }
  actionExamples.push(`            {
              "title": "[Imperative verb] [specific physical activity]",
              "type": "do",
              "instructions": "2-3 numbered sub-steps, each naming a specific concept/term/number/tool from the transcript (e.g. '1. ... 2. ... 3. ...'). No generic steps.",
              "orderIndex": ${actionExamples.length}
            }`);
  actionExamples.push(`            {
              "title": "Reflect on [specific concept from this lesson]",
              "type": "reflect",
              "instructions": "Context for the reflection",
              "reflectionPrompt": "[Open-ended question ending with '?' — answered in the learner's own words]",
              "orderIndex": ${actionExamples.length}
            }`);

  // Classic prompt also respects the distribution plan when present
  const classicPlanWeekCount = hasPlanClassic
    ? new Set(input.clipDistributionPlan!.lessons.map((l) => l.weekNumber)).size
    : 0;

  const classicDurationInstruction = hasPlanClassic
    ? `- Duration: EXACTLY ${classicPlanWeekCount} lessons with 1 session each, matching the pre-computed video assignment plan below.`
    : input.aiStructured
      ? `- Duration: EXACTLY ${input.durationWeeks} lessons of 3-8 minutes of meaningful content each. Use the natural topic breaks in the source videos to choose lesson boundaries, but the total lesson count is fixed at ${input.durationWeeks}.`
      : `- Duration: EXACTLY ${input.durationWeeks} lessons (you MUST create ${input.durationWeeks} lessons)`;

  const classicWeekCountRule = hasPlanClassic
    ? `1. Generate EXACTLY ${classicPlanWeekCount} lessons (weekNumber 1 through ${classicPlanWeekCount}) with EXACTLY 1 session per lesson — this matches the VIDEO ASSIGNMENT PLAN. Do NOT merge lessons or create multiple sessions per lesson.`
    : input.aiStructured
      ? `1. Generate EXACTLY ${input.durationWeeks} lessons (weekNumber 1 through ${input.durationWeeks}) with EXACTLY 1 session per lesson. Each lesson must have 3-8 minutes of content. Use natural topic breaks to choose boundaries, but the lesson count is fixed.`
      : `1. Generate EXACTLY ${input.durationWeeks} lessons (weekNumber 1 through ${input.durationWeeks})`;

  const classicTaskInstruction = hasPlanClassic
    ? `Create a ${classicPlanWeekCount}-lesson structured learning program that transforms ${input.targetAudience || "learners"} toward ${input.targetTransformation || "the intended outcome"}.`
    : input.aiStructured
      ? `Create a structured learning program with the ideal number of lessons that transforms ${input.targetAudience || "learners"} toward ${input.targetTransformation || "the intended outcome"}.`
      : `Create a ${input.durationWeeks}-lesson structured learning program that transforms ${input.targetAudience || "learners"} toward ${input.targetTransformation || "the intended outcome"}.`;

  const classicDurationWeeksOutput = input.aiStructured
    ? `"<number of weeks you chose>"`
    : `${input.durationWeeks}`;

  return `You are an expert curriculum designer creating a transformational learning program.
${qualityRules}
PROGRAM CONTEXT:
- Title: "${input.programTitle}"
${classicDurationInstruction}
- Content available: ${contentSummary}
${input.programDescription ? `- Description: ${input.programDescription}` : ""}
${audienceContext}
${transformationContext}
${input.outcomeStatement ? `- Outcome Statement: ${input.outcomeStatement}` : ""}
${vibeInstructions}

AVAILABLE CONTENT SOURCES:
${contentDescriptions}
${classicPlanBlock}
YOUR TASK:
${classicTaskInstruction}

CRITICAL REQUIREMENTS:
${classicWeekCountRule}
${hasPlanClassic
    ? `2. Follow the VIDEO ASSIGNMENT PLAN exactly — use the specified video IDs for WATCH actions in each lesson. Every video must appear at least once.`
    : `2. Distribute content logically across all ${input.durationWeeks} lessons (approximately ${contentPerWeek} source(s) per lesson)`}
3. Each lesson needs a clear theme that builds toward the transformation
4. Content from the same cluster shares related topics — use this to group them logically
5. Each session MUST include 2-3 key takeaways (keyTakeaways array)
${hasVideos ? `6. For VIDEO content: create WATCH actions with the exact youtubeVideoId` : ""}
${hasDocs ? `${hasVideos ? "7" : "6"}. For DOCUMENT content: create READ actions referencing key points from the document` : ""}

STRUCTURE EACH LESSON WITH:
- 1 session per lesson
- Each session should have:
  * keyTakeaways: 2-3 concise bullet points (each ≤ 200 characters) summarizing what learners will gain
${actionInstructions.join("\n")}

OUTPUT FORMAT (JSON only, no markdown):
{
  "programId": "${input.programId}",
  "title": "${input.programTitle}",
  "description": "A compelling 1-2 sentence description of the program transformation",
  "pacingMode": "drip_by_week",
  "durationWeeks": ${classicDurationWeeksOutput},
  "weeks": [
    {
      "title": "[Outcome-oriented title — what the learner can do after this lesson]",
      "summary": "What learners will achieve in this lesson",
      "weekNumber": 1,
      "sessions": [
        {
          "title": "Session title",
          "summary": "Session focus",
          "keyTakeaways": [
            "First key insight or skill they'll gain",
            "Second key insight or skill they'll gain",
            "Third key insight or skill they'll gain"
          ],
          "orderIndex": 0,
          "actions": [
${actionExamples.join(",\n")}
          ]
        }
      ]
    }
  ]
}

QUALITY GUIDELINES:
- Lesson titles must be outcome-oriented (see LESSON TITLE RULES above) — avoid generic themes like "Building Your Foundation" or "Introduction"
- Key takeaways should be specific, actionable outcomes drawn from the transcripts — not vague promises
- Instructions should be specific and actionable, not generic
- DO actions must follow STEP/ACTION RULES above: imperative verb titles, physical activities, grounded in transcript content
- REFLECT prompts must follow REFLECT RULE above: one per lesson, open-ended question ending with "?"
- Build complexity progressively — earlier lessons introduce concepts, later lessons integrate them
- Final lesson should synthesize learning and prepare for real-world application
- If a style guide was provided, ensure all content matches that tone and energy
- Use the specific concepts, skills, and examples from each content source to design exercises and reflection prompts`;
}

async function callAnthropic(input: GenerateInput): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  // DIAGNOSTIC INSTRUMENTATION (2026-06-02): the harness observed the
  // Anthropic fetch aborting at ~153s with bare "This operation was aborted"
  // despite GENERATION_TIMEOUT_MS=600_000. Cause unknown — could be Anthropic
  // LB drop, Vercel function instance recycling, or an AbortSignal injected
  // elsewhere. This wrapper walks the err.cause chain so future aborts surface
  // the underlying socket/error code (UND_ERR_SOCKET, ECONNRESET, etc.) and
  // we can pick the right targeted fix in Phase 2. No behavior change vs the
  // bare fetchWithTimeout — same timeout, same error rethrow.
  const llmStart = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 32768,
        messages: [{ role: "user", content: buildPrompt(input) }],
      }),
    }, GENERATION_TIMEOUT_MS);

    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => "");
      throw new Error(`Anthropic API error: ${res.status} ${bodyPreview.slice(0, 200)}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    return data.content[0].text;
  } catch (err) {
    const elapsedMs = Date.now() - llmStart;
    // Walk the .cause chain. undici wraps the original socket error inside
    // .cause; the abort path can nest 2-3 deep. Capture name/code/message at
    // each level. Avoid logging full message bodies (may include prompt content).
    const chain: string[] = [];
    let cur: unknown = err;
    let depth = 0;
    while (cur && typeof cur === "object" && depth < 5) {
      const e = cur as { name?: string; message?: string; code?: string; cause?: unknown };
      chain.push(
        `${e.name ?? "?"}${e.code ? `/${e.code}` : ""}: ${(e.message ?? "?").slice(0, 200)}`,
      );
      cur = e.cause;
      depth++;
    }
    console.error(
      `[LLM] Anthropic fetch threw after ${elapsedMs}ms ` +
        `(GENERATION_TIMEOUT_MS=${GENERATION_TIMEOUT_MS}ms) — cause chain: ${chain.join(" -> ")}`,
    );
    throw err;
  }
}

async function callOpenAI(input: GenerateInput): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const prompt = buildPrompt(input);

  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16384, // GPT-4o cap
    }),
  }, GENERATION_TIMEOUT_MS);

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`OpenAI API error: ${res.status} - ${errorBody}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(input: GenerateInput): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");

  const model = getGeminiTextModel();
  const prompt = buildPrompt(input);

  const res = await fetchWithTimeout(
    `${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    },
    GENERATION_TIMEOUT_MS,
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function repairJSON(
  badOutput: string,
  error: string,
  provider: LLMProvider,
  _input: GenerateInput
): Promise<string> {
  // Spell out the exact required field names. The original prompt uses "lesson"
  // terminology heavily, which leads the LLM to invent fields like "lessonTitle"
  // or "lessons". The repair pass needs the canonical schema or it loops.
  const repairPrompt = `The previous JSON output failed schema validation.

Validation error:
${error}

Bad output:
${badOutput}

REQUIRED SCHEMA — use these EXACT field names:
{
  "programId": string,
  "title": string,
  "description": string (optional),
  "pacingMode": "drip_by_week" | "unlock_on_complete",
  "durationWeeks": number,
  "weeks": [
    {
      "title": string,                       // REQUIRED — the lesson title
      "summary": string (optional),
      "weekNumber": number,                  // 1, 2, 3, ...
      "sessions": [                          // REQUIRED — array, never call this "lessons"
        {
          "title": string,                   // REQUIRED
          "summary": string (optional),
          "keyTakeaways": string[] (optional),
          "orderIndex": number,
          "actions": [                       // REQUIRED — at least one item
            {
              "title": string,
              "type": "watch" | "read" | "do" | "reflect",
              "instructions": string (optional),
              "reflectionPrompt": string (optional, required for "reflect"),
              "youtubeVideoId": string (optional),
              "orderIndex": number
            }
          ],
          "clips": [...] (optional),
          "overlays": [...] (optional)
        }
      ]
    }
  ]
}

Rewrite the JSON above so every \`weeks[]\` entry has \`title\`, \`weekNumber\`, and a non-empty \`sessions\` array. Keep all the substantive content from the bad output — only fix field names and structure. Return ONLY the corrected JSON, no markdown.`;

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY!;
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 32768,
        messages: [{ role: "user", content: repairPrompt }],
      }),
    }, LLM_TIMEOUT_MS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    return data.content[0].text;
  }

  if (provider === "gemini") {
    const key = process.env.GOOGLE_AI_API_KEY!;
    const model = getGeminiTextModel();
    const res = await fetchWithTimeout(
      `${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: repairPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      },
      LLM_TIMEOUT_MS,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // OpenAI
  const key = process.env.OPENAI_API_KEY!;
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "user", content: repairPrompt }],
      max_tokens: 16384, // GPT-4o cap
    }),
  }, LLM_TIMEOUT_MS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  return data.choices[0].message.content;
}
