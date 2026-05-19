import { NextRequest, NextResponse, after } from "next/server";
import { setGlobalDispatcher, Agent } from "undici";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProgramDraft, extractContentDigests, analyzeUploadedVideoWithGemini, distributeClipsToLessons, validateAndFixClipDistribution, validateDraftQuality, computeGuardrailedLessonCount } from "@guide-rail/ai";
import type { ContentDigest, EnrichedContentDigest, DistributionPlan } from "@guide-rail/ai";
import { ProgramDraftSchema } from "@guide-rail/shared";
import { Prisma } from "@prisma/client";
import { aiLogger, createTimer } from "@/lib/logger";
import { generateSkinFromVibe } from "@/lib/generate-skin";
import { sendProgramReadyEmail } from "@/lib/email";
import { getMux, isMuxConfigured } from "@/lib/mux";
import { stripWrappingQuotes } from "@/lib/strip-quotes";

// Lift undici's default 300s headersTimeout / bodyTimeout to 10 min for ALL
// fetches in this serverless function process. Large Anthropic prompts (a
// 10-video program is ~93k chars of context) routinely take 5-8 min to start
// streaming, which trips undici's default and surfaces as
// `UND_ERR_HEADERS_TIMEOUT`. The import lives in this server-only route file
// so the client bundle never sees it; static so Vercel actually ships
// undici with the serverless function (a dynamic Function-eval import
// silently failed at runtime because Vercel didn't include the package).
try {
  setGlobalDispatcher(new Agent({
    headersTimeout: 10 * 60_000,
    bodyTimeout: 10 * 60_000,
    connect: { timeout: 30_000 },
  }));
  console.info("[generate-async] undici global dispatcher installed: headers=600s body=600s");
} catch (err) {
  console.error("[generate-async] FAILED to install undici dispatcher:", err);
}

export const maxDuration = 800; // Vercel Pro (Fluid Compute): keep function alive for long video analysis

/**
 * Async program generation endpoint.
 * Creates a GenerationJob and processes it in the background.
 * Returns immediately with the job ID for polling.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;

  let instructions: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { instructions?: unknown } | null;
    if (body && typeof body.instructions === "string") {
      const trimmed = body.instructions.trim();
      if (trimmed.length > 0) instructions = trimmed.slice(0, 2000);
    }
  } catch {
    // empty / non-JSON body is fine — instructions are optional
  }

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { videos: true, artifacts: true },
  });

  if (!program || program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check creator has platform access
  const hasAccess = user.platformPromoGranted || user.platformPaymentComplete;
  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "Platform access required",
        code: "PLATFORM_ACCESS_REQUIRED",
        message: "Please complete platform setup to generate programs.",
      },
      { status: 402 }
    );
  }

  const hasContent = program.videos.length > 0 || program.artifacts.length > 0;
  if (!hasContent) {
    return NextResponse.json({ error: "No content to process" }, { status: 400 });
  }

  // Check for existing pending/processing job
  const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes without progress = stale

  const existingJob = await prisma.generationJob.findFirst({
    where: {
      programId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });

  if (existingJob) {
    const lastActivity = existingJob.updatedAt ?? existingJob.createdAt;
    const isStale = Date.now() - lastActivity.getTime() > STALE_THRESHOLD_MS;

    if (isStale) {
      // Auto-cancel stale job so user can retry
      await prisma.generationJob.update({
        where: { id: existingJob.id },
        data: {
          status: "FAILED",
          error: `Automatically cancelled: no progress for ${Math.round(STALE_THRESHOLD_MS / 60000)} minutes (stuck at ${existingJob.progress}% / ${existingJob.stage})`,
          completedAt: new Date(),
        },
      });
      console.warn(`[generate-async] Auto-cancelled stale job ${existingJob.id} for program ${programId}`);
      // Fall through to create a new job
    } else {
      return NextResponse.json({
        jobId: existingJob.id,
        status: existingJob.status,
        stage: existingJob.stage,
        progress: existingJob.progress,
        message: "Generation already in progress",
      });
    }
  }

  // Create new job
  const job = await prisma.generationJob.create({
    data: {
      programId,
      status: "PENDING",
      stage: "queued",
      progress: 0,
    },
  });

  // Start async processing after the response is sent.
  // after() tells Vercel to keep the function alive for background work (up to maxDuration).
  after(async () => {
    try {
      await processGenerationJob(job.id, programId, instructions);
    } catch (err) {
      console.error("[generate-async] Background job failed:", err);
    }
  });

  return NextResponse.json({
    jobId: job.id,
    status: "PENDING",
    stage: "queued",
    progress: 0,
    message: "Generation started",
  });
}

/**
 * Background processing function.
 * Updates job status/progress as it runs.
 * Processes both YouTube videos and uploaded artifacts (PDFs, DOCXs, etc.).
 */
const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (within Vercel Pro 800s maxDuration with buffer). Parallel Gemini analysis (below) keeps multi-video programs comfortably within this budget — a 15-video program completes in ~3 min on cached renditions.

/** Max concurrent Gemini analysis tasks. Each task waits on Mux MP4 rendition then calls Gemini Files API. Bumping this from 1 (serial) to 4 cuts wall-clock by ~4x on multi-video programs. Gemini's per-key RPM limits handle 4-way comfortably for our workload. */
const ANALYSIS_CONCURRENCY = 4;

/**
 * Bounded-concurrency runner. Runs at most `limit` tasks in parallel, pulling
 * from the items queue as each worker finishes. Used to parallelize Gemini
 * video analysis without blowing up rate limits or memory.
 */
async function runWithBoundedConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await task(items[i], i);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
}

async function processGenerationJob(jobId: string, programId: string, instructions?: string) {
  const timer = createTimer();
  const deadline = Date.now() + JOB_TIMEOUT_MS;

  function checkDeadline(stage: string) {
    if (Date.now() > deadline) {
      throw new Error(`Job timed out after ${Math.round(JOB_TIMEOUT_MS / 60000)} minutes during ${stage} stage`);
    }
  }

  try {
    // Mark as processing — start with preparing stage so the UI shows progress immediately
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", stage: "preparing", progress: 2, startedAt: new Date() },
    });

    // Fetch program with videos, artifacts, and existing analyses
    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        videos: {
          include: { analysis: true },
        },
        artifacts: true,
      },
    });

    if (!program) throw new Error("Program not found");

    // Filter artifacts with usable text
    const usableArtifacts = program.artifacts.filter(
      (a) => a.extractedText && a.extractedText.length > 0
    );

    // All non-segment, top-level videos for the pipeline
    const videosForPipeline = program.videos.filter((v) => !v.isSegment);
    const videoIdSet = new Set(videosForPipeline.map((v) => v.id));

    // ── Diagnostic: log each video's state entering the pipeline ──
    console.info(`[generate-async] ═══ PIPELINE START ═══`);
    console.info(`[generate-async] Program: "${program.title}" (${programId})`);
    console.info(`[generate-async] Videos: ${videosForPipeline.length}, Artifacts: ${usableArtifacts.length}`);
    for (const v of videosForPipeline) {
      console.info(`[generate-async]   VIDEO "${v.title}" | url=${v.url.slice(0, 60)} | transcript=${v.transcript ? `${v.transcript.length} chars` : "NONE"} | analysis=${v.analysis ? "YES" : "NO"}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Step 1: Gemini Video Analysis (5-25%) ──
    // Analyzes videos that don't yet have a VideoAnalysis record.
    // In production, the video.asset.ready webhook pre-runs this. But locally
    // (no webhook) or if the user clicks Generate before the webhook fires,
    // this step runs Gemini directly using the Mux MP4 static rendition URL.
    // ══════════════════════════════════════════════════════════════════════════
    checkDeadline("fetching_transcripts");
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "fetching_transcripts", progress: 5 },
    });

    // Resolve muxPlaybackId from Mux API for videos that don't have it yet.
    // Poll in parallel until each asset reports `ready` — webhooks may be delayed,
    // and if the user clicks Generate right after uploading, Mux is still transcoding.
    const videosWithoutPlaybackId = videosForPipeline.filter(
      (v) => !v.analysis && !v.muxPlaybackId && v.muxUploadId && isMuxConfigured()
    );
    if (videosWithoutPlaybackId.length > 0) {
      console.info(`[generate-async] [MUX] Resolving playbackId for ${videosWithoutPlaybackId.length} video(s) via Mux API`);
      const mux = getMux();
      const MUX_RESOLVE_POLL_MS = 5_000;
      const MUX_RESOLVE_MAX_MS = 6 * 60_000; // 6 min per video (runs in parallel)

      await Promise.all(videosWithoutPlaybackId.map(async (v) => {
        const waitUntil = Date.now() + MUX_RESOLVE_MAX_MS;
        while (Date.now() < waitUntil && Date.now() < deadline) {
          try {
            let assetId = v.muxAssetId;
            if (!assetId) {
              const upload = await mux.video.uploads.retrieve(v.muxUploadId!);
              assetId = upload.asset_id ?? null;
              if (assetId) {
                await prisma.youTubeVideo.update({ where: { id: v.id }, data: { muxAssetId: assetId } });
                (v as { muxAssetId: string | null }).muxAssetId = assetId;
              }
            }

            if (!assetId) {
              console.info(`[generate-async] [MUX]   "${v.title}" — waiting for Mux to create asset...`);
              await new Promise((r) => setTimeout(r, MUX_RESOLVE_POLL_MS));
              continue;
            }

            const asset = await mux.video.assets.retrieve(assetId);
            if (asset.status === "ready" && asset.playback_ids?.[0]?.id) {
              const pid = asset.playback_ids[0].id;
              await prisma.youTubeVideo.update({
                where: { id: v.id },
                data: { muxPlaybackId: pid, muxStatus: "ready", url: `https://stream.mux.com/${pid}` },
              });
              (v as { muxPlaybackId: string | null }).muxPlaybackId = pid;
              console.info(`[generate-async] [MUX]   ✓ "${v.title}" → playbackId=${pid}`);
              return;
            }

            if (asset.status === "errored") {
              console.warn(`[generate-async] [MUX]   "${v.title}" — asset errored, giving up`);
              return;
            }

            console.info(`[generate-async] [MUX]   "${v.title}" — status=${asset.status}, polling...`);
            await new Promise((r) => setTimeout(r, MUX_RESOLVE_POLL_MS));
          } catch (err) {
            console.warn(`[generate-async] [MUX]   "${v.title}" poll error:`, err instanceof Error ? err.message : err);
            await new Promise((r) => setTimeout(r, MUX_RESOLVE_POLL_MS));
          }
        }
        console.warn(`[generate-async] [MUX]   "${v.title}" — timed out waiting for asset to be ready`);
      }));
    }

    const videosNeedingAnalysis = videosForPipeline.filter(
      (v) => !v.analysis && v.muxPlaybackId
    );

    if (videosNeedingAnalysis.length > 0 && process.env.GOOGLE_AI_API_KEY) {
      console.info(`[generate-async] [GEMINI] ${videosNeedingAnalysis.length} video(s) need Gemini analysis`);
      const MUX_RENDITION_POLL_MS = 5_000;
      const MUX_RENDITION_MAX_MS = 5 * 60_000; // 5 min max wait for renditions (Mux MP4 transcode for 20-min videos commonly takes 2-4 min)

      // Run video analyses in parallel (bounded by ANALYSIS_CONCURRENCY). Each
      // task is independent: separate Mux MP4 poll, separate Gemini call,
      // separate VideoAnalysis upsert. The in-memory mutation of `v.analysis`
      // is write-only per object and the objects are distinct, so no race.
      // Progress counts completions rather than indices so the bar advances
      // smoothly even when tasks finish out of order.
      let completedAnalyses = 0;
      await runWithBoundedConcurrency(videosNeedingAnalysis, ANALYSIS_CONCURRENCY, async (v) => {
        checkDeadline("fetching_transcripts");
        const mp4Url = `https://stream.mux.com/${v.muxPlaybackId}/capped-1080p.mp4`;

        // Wait for the MP4 static rendition to be accessible before sending to Gemini
        console.info(`[generate-async] [GEMINI] Waiting for MP4 rendition: "${v.title}"`);
        const renditionStart = Date.now();
        let mp4Ready = false;
        while (!mp4Ready && (Date.now() - renditionStart) < MUX_RENDITION_MAX_MS) {
          checkDeadline("fetching_transcripts");
          try {
            const headRes = await fetch(mp4Url, { method: "HEAD" });
            if (headRes.ok) {
              mp4Ready = true;
              console.info(`[generate-async] [GEMINI] ✓ MP4 ready for "${v.title}" (${Math.round((Date.now() - renditionStart) / 1000)}s)`);
            } else {
              console.info(`[generate-async] [GEMINI]   MP4 not ready yet (${headRes.status}) — waiting ${MUX_RENDITION_POLL_MS / 1000}s...`);
              await new Promise((r) => setTimeout(r, MUX_RENDITION_POLL_MS));
            }
          } catch {
            await new Promise((r) => setTimeout(r, MUX_RENDITION_POLL_MS));
          }
        }

        if (!mp4Ready) {
          console.warn(`[generate-async] [GEMINI] ✗ MP4 not available after ${MUX_RENDITION_MAX_MS / 1000}s for "${v.title}" — skipping`);
          completedAnalyses++;
          return;
        }

        console.info(`[generate-async] [GEMINI] Analyzing "${v.title}" via ${mp4Url}`);

        try {
          const analysis = await analyzeUploadedVideoWithGemini(
            mp4Url,
            v.title ?? "Untitled",
            "video/mp4",
          );

          await prisma.videoAnalysis.upsert({
            where: { youtubeVideoId: v.id },
            create: {
              youtubeVideoId: v.id,
              summary: analysis.summary,
              fullTranscript: analysis.fullTranscript ?? null,
              segments: analysis.segments as unknown as Prisma.InputJsonValue,
              topics: analysis.topics as unknown as Prisma.InputJsonValue,
              keyMoments: analysis.keyMoments as unknown as Prisma.InputJsonValue ?? undefined,
              people: analysis.people as unknown as Prisma.InputJsonValue ?? undefined,
              durationSeconds: analysis.durationSeconds ?? null,
            },
            update: {
              summary: analysis.summary,
              fullTranscript: analysis.fullTranscript ?? null,
              segments: analysis.segments as unknown as Prisma.InputJsonValue,
              topics: analysis.topics as unknown as Prisma.InputJsonValue,
              keyMoments: analysis.keyMoments as unknown as Prisma.InputJsonValue ?? undefined,
              people: analysis.people as unknown as Prisma.InputJsonValue ?? undefined,
              durationSeconds: analysis.durationSeconds ?? null,
              analyzedAt: new Date(),
            },
          });

          // Store transcript on video record too
          if (analysis.fullTranscript) {
            await prisma.youTubeVideo.update({
              where: { id: v.id },
              data: { transcript: analysis.fullTranscript, durationSeconds: analysis.durationSeconds ?? undefined },
            });
            (v as { transcript: string | null }).transcript = analysis.fullTranscript;
          }

          // Attach analysis to the in-memory video object for the digest step
          (v as { analysis: unknown }).analysis = {
            summary: analysis.summary,
            fullTranscript: analysis.fullTranscript,
            segments: analysis.segments,
            topics: analysis.topics,
            keyMoments: analysis.keyMoments,
            people: analysis.people,
            durationSeconds: analysis.durationSeconds,
          };

          console.info(`[generate-async] [GEMINI] ✓ "${v.title}" — ${analysis.topics.length} topics, ${analysis.fullTranscript?.length ?? 0} char transcript`);
        } catch (err) {
          console.error(`[generate-async] [GEMINI] ✗ "${v.title}" failed:`, err instanceof Error ? err.message : err);
        }

        completedAnalyses++;
        const analysisProgress = 5 + Math.round((completedAnalyses / videosNeedingAnalysis.length) * 20);
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { progress: analysisProgress },
        });
      });
    } else if (videosNeedingAnalysis.length > 0) {
      console.warn(`[generate-async] ${videosNeedingAnalysis.length} video(s) need analysis but GOOGLE_AI_API_KEY is not set`);
    }

    const finalWithAnalysis = videosForPipeline.filter((v) => v.analysis).length;
    const finalWithTranscript = videosForPipeline.filter((v) => v.transcript).length;
    console.info(`[generate-async] After analysis: ${finalWithAnalysis}/${videosForPipeline.length} analyzed, ${finalWithTranscript}/${videosForPipeline.length} with transcript`);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 25 },
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── Step 2: Content Extraction / Enriched Digests (25-45%) ──
    // Passes transcripts to the LLM for structured extraction (topics, skills,
    // key concepts). Videos without transcripts get title-only fallback digests.
    // ══════════════════════════════════════════════════════════════════════════
    checkDeadline("analyzing");
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "analyzing", progress: 25 },
    });

    const enrichedDigests: (ContentDigest | EnrichedContentDigest)[] = [];

    // Videos with existing VideoAnalysis records (from prior Mux AI or Gemini runs)
    // get enriched digests directly — no LLM call needed.
    const videosNeedingLLMExtraction: { contentId: string; contentTitle: string; text: string | null; contentType: "video" }[] = [];

    for (const v of videosForPipeline) {
      if (v.analysis) {
        // Use existing analysis as enriched digest
        const a = v.analysis;
        const topics = (a.topics as unknown as { label: string; startSeconds: number; endSeconds: number; subtopics?: string[] }[]) ?? [];
        const segments = (a.segments as unknown as { startSeconds: number; endSeconds: number; text: string; topic?: string }[]) ?? [];
        const keyMoments = (a.keyMoments as unknown as { timestampSeconds: number; description: string; significance?: string; type?: string }[]) ?? [];

        enrichedDigests.push({
          contentId: v.id,
          contentTitle: v.title ?? "Untitled",
          contentType: "video",
          keyConcepts: topics.map((t) => t.label),
          skillsIntroduced: topics.flatMap((t) => t.subtopics ?? []).slice(0, 5),
          memorableExamples: keyMoments.filter((m) => m.significance === "high").map((m) => m.description).slice(0, 3),
          difficultyLevel: "intermediate",
          summary: a.summary,
          segments,
          topics,
          keyMoments,
          durationSeconds: a.durationSeconds ?? undefined,
        } as EnrichedContentDigest);
      } else if (v.transcript && v.transcript.length >= 50) {
        // Has transcript but no analysis — needs LLM extraction
        videosNeedingLLMExtraction.push({
          contentId: v.id,
          contentTitle: v.title ?? "Untitled",
          text: v.transcript,
          contentType: "video",
        });
      } else {
        // No transcript and no analysis — title-only fallback. Include the
        // actual durationSeconds so the clip distributor can slice the video
        // proportionally instead of falling back to the 600s default.
        enrichedDigests.push({
          contentId: v.id,
          contentTitle: v.title ?? "Untitled",
          contentType: "video",
          keyConcepts: [v.title ?? "Video content"],
          skillsIntroduced: [],
          memorableExamples: [],
          difficultyLevel: "intermediate",
          summary: `Uploaded video: ${v.title ?? "Untitled"}`,
          durationSeconds: v.durationSeconds ?? null,
        } as ContentDigest);
      }
    }

    // ── Diagnostic: log digest routing decisions ──
    const digestWithAnalysis = videosForPipeline.filter((v) => v.analysis).length;
    const withTranscriptOnly = videosNeedingLLMExtraction.length;
    const titleOnlyFallback = videosForPipeline.length - digestWithAnalysis - withTranscriptOnly;
    console.info(`[generate-async] ═══ DIGEST ROUTING ═══`);
    console.info(`[generate-async]   Existing analysis → enriched digest: ${digestWithAnalysis}`);
    console.info(`[generate-async]   Transcript → LLM extraction: ${withTranscriptOnly}`);
    console.info(`[generate-async]   Title-only fallback (no transcript, no analysis): ${titleOnlyFallback}`);
    for (const item of videosNeedingLLMExtraction) {
      console.info(`[generate-async]   LLM EXTRACT: "${item.contentTitle}" | text=${item.text ? `${item.text.length} chars` : "NULL"} | preview="${(item.text ?? "").slice(0, 120)}..."`);
    }

    // Artifacts always go through LLM extraction
    const artifactsForExtraction = usableArtifacts.map((a) => ({
      contentId: a.id,
      contentTitle: a.originalFilename,
      text: a.extractedText,
      contentType: "document" as const,
    }));

    const allForExtraction = [...videosNeedingLLMExtraction, ...artifactsForExtraction];

    if (allForExtraction.length > 0) {
      aiLogger.extractionStart(programId, allForExtraction.length);
      const extractionTimer = createTimer();

      const llmDigests = await extractContentDigests(
        allForExtraction,
        (completed, total) => {
          console.info(`[generate-async] Extraction progress: ${completed}/${total}`);
        },
      );
      // Backfill durationSeconds for video digests so the clip distributor
      // doesn't fall back to the 600s default for transcript-only videos.
      const videoDurationById = new Map(
        videosForPipeline.map((v) => [v.id, v.durationSeconds] as const),
      );
      for (const d of llmDigests) {
        if (d.contentType === "video" && videoDurationById.has(d.contentId)) {
          d.durationSeconds = videoDurationById.get(d.contentId) ?? null;
        }
      }
      enrichedDigests.push(...llmDigests);
      aiLogger.extractionSuccess(programId, extractionTimer.elapsed(), llmDigests.length);
    } else {
      console.info(`[generate-async] All content has existing analysis — skipping LLM extraction`);
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 45 },
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── Step 2.5: Pre-compute clip distribution (45%) ──
    // Deterministically assigns topic clips from Gemini analysis to lessons
    // so the LLM gets a mandatory assignment plan instead of guessing.
    // ══════════════════════════════════════════════════════════════════════════
    const enrichedOnly = enrichedDigests.filter(
      (d): d is EnrichedContentDigest => "topics" in d && ((d as EnrichedContentDigest).topics?.length ?? 0) > 0,
    );
    const basicOnly = enrichedDigests.filter(
      (d) => !("topics" in d) || !((d as EnrichedContentDigest).topics?.length),
    );

    let clipDistributionPlan: DistributionPlan | undefined;

    // Lesson count: aiStructured runs duration-aware guardrails (1–12 lessons,
    // tuned for the 1–3 × ~20 min video case). Otherwise honor the creator's
    // explicit choice (already clamped to 12 at the PATCH route).
    //
    // For segmented parents (Gemini split a long video into N topic chunks),
    // feed the children to the heuristic so a 20-min/3-segment input lands on
    // the multi-video path (3 lessons) instead of the single-video duration path.
    const segmentsByParent = new Map<string, typeof program.videos>();
    for (const v of program.videos) {
      if (v.isSegment && v.parentVideoId) {
        const arr = segmentsByParent.get(v.parentVideoId) ?? [];
        arr.push(v);
        segmentsByParent.set(v.parentVideoId, arr);
      }
    }
    const lessonCountInputs = videosForPipeline.flatMap((v) => {
      const segs = segmentsByParent.get(v.id);
      return segs && segs.length > 0
        ? segs.map((s) => ({ durationSeconds: s.durationSeconds }))
        : [{ durationSeconds: v.durationSeconds }];
    });

    const effectiveWeeks = program.aiStructured
      ? computeGuardrailedLessonCount(lessonCountInputs)
      : program.durationWeeks;
    console.info(
      `[generate-async] aiStructured=${program.aiStructured} videos=${videosForPipeline.length} segmentExpandedCount=${lessonCountInputs.length} → effectiveWeeks=${effectiveWeeks}`,
    );

    if (enrichedOnly.length > 0) {
      clipDistributionPlan = distributeClipsToLessons(
        enrichedOnly,
        basicOnly,
        effectiveWeeks,
        1, // sessionsPerWeek
      );

      console.info(`[generate-async] ═══ CLIP DISTRIBUTION ═══`);
      console.info(`[generate-async]   Total clips: ${clipDistributionPlan.totalClips} across ${clipDistributionPlan.lessons.length} lessons`);
      console.info(`[generate-async]   Total duration: ${Math.round(clipDistributionPlan.totalDurationSeconds / 60)}min`);
      for (const lesson of clipDistributionPlan.lessons) {
        console.info(`[generate-async]   Lesson ${lesson.lessonIndex + 1}: ${lesson.clips.length} clip(s), ${Math.round(lesson.totalDurationSeconds / 60)}min — [${lesson.clips.map((c) => `"${c.topicLabel}"`).join(", ")}]`);
      }
      for (const w of clipDistributionPlan.warnings) {
        console.warn(`[generate-async]   WARNING: ${w}`);
      }
    } else {
      console.info(`[generate-async] No enriched digests — skipping clip distribution (LLM will assign freely)`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Step 3: LLM Generation (45-85%) ──
    // ══════════════════════════════════════════════════════════════════════════
    checkDeadline("generating");
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "generating", progress: 45 },
    });

    // Build a single flat content grouping (clustering removed — LLM handles grouping)
    const allContentIds = [
      ...videosForPipeline.map((v) => v.id),
      ...usableArtifacts.map((a) => a.id),
    ];
    const allContentTitles = [
      ...videosForPipeline.map((v) => v.title ?? "Untitled"),
      ...usableArtifacts.map((a) => a.originalFilename),
    ];
    const allContentTranscripts = [
      ...videosForPipeline.map((v) => {
        // 1. Prefer YouTubeVideo.transcript (set by caption scraper or prior pipeline run)
        if (v.transcript && v.transcript.length > 0) return v.transcript;
        // 2. Fall back to VideoAnalysis.fullTranscript (set by Gemini via webhook or pipeline)
        const ft = v.analysis?.fullTranscript;
        if (typeof ft === "string" && ft.length > 0) return ft;
        // 3. Reconstruct from analysis segments (Gemini always returns segment text)
        const segs = v.analysis?.segments as unknown as { text?: string }[] | undefined;
        if (segs && segs.length > 0) {
          const reconstructed = segs.map((s) => s.text ?? "").filter(Boolean).join(" ");
          if (reconstructed.length > 0) return reconstructed;
        }
        return "";
      }),
      ...usableArtifacts.map((a) => a.extractedText ?? ""),
    ];

    // Warn about videos with no transcript at all — these will get hallucinated content
    const missingTranscriptVideos = videosForPipeline.filter((_v, i) => allContentTranscripts[i].length === 0);
    if (missingTranscriptVideos.length > 0) {
      console.warn(`[generate-async] ⚠ ${missingTranscriptVideos.length} video(s) have NO transcript — LLM will generate from metadata only:`);
      for (const v of missingTranscriptVideos) {
        console.warn(`[generate-async]   "${v.title}" | hasAnalysis=${!!v.analysis} | muxPlaybackId=${v.muxPlaybackId ?? "NONE"}`);
      }
    }

    const allContentTypes: ("video" | "document")[] = [
      ...videosForPipeline.map((): "video" => "video"),
      ...usableArtifacts.map((): "document" => "document"),
    ];

    const clusterData = [{
      clusterId: 0,
      contentIds: allContentIds,
      contentTitles: allContentTitles,
      contentTranscripts: allContentTranscripts,
      contentTypes: allContentTypes,
      summary: `All ${allContentIds.length} content source(s)`,
    }];

    const hasVideoAnalysis = enrichedDigests.some(
      (d) => "topics" in d && (d as EnrichedContentDigest).topics?.length > 0,
    );

    // ── Diagnostic: log what the LLM will receive ──
    console.info(`[generate-async] ═══ LLM INPUT SUMMARY ═══`);
    console.info(`[generate-async]   Provider: ${process.env.LLM_PROVIDER || "stub"}`);
    console.info(`[generate-async]   hasVideoAnalysis: ${hasVideoAnalysis}`);
    console.info(`[generate-async]   Total digests: ${enrichedDigests.length}`);
    for (const d of enrichedDigests) {
      const isEnriched = "topics" in d && (d as EnrichedContentDigest).topics?.length > 0;
      console.info(`[generate-async]   DIGEST: "${d.contentTitle}" | type=${d.contentType} | enriched=${isEnriched} | summary="${d.summary.slice(0, 150)}..." | concepts=[${d.keyConcepts.join(", ")}]`);
    }
    console.info(`[generate-async]   Transcripts in cluster data: ${allContentTranscripts.filter((t) => t.length > 0).length}/${allContentTranscripts.length}`);
    for (let i = 0; i < allContentTitles.length; i++) {
      console.info(`[generate-async]   CLUSTER CONTENT[${i}]: "${allContentTitles[i]}" | transcript=${allContentTranscripts[i].length} chars | preview="${allContentTranscripts[i].slice(0, 100)}..."`);
    }

    aiLogger.generationStart(programId, {
      clusterCount: 1,
      durationWeeks: program.durationWeeks,
    });

    const llmTimer = createTimer();
    const combinedVibePrompt = [
      program.vibePrompt,
      instructions ? `IMPORTANT REGENERATION INSTRUCTIONS FROM CREATOR: ${instructions}` : null,
    ]
      .filter((s): s is string => Boolean(s))
      .join("\n\n") || undefined;

    const draft = await generateProgramDraft({
      programId,
      programTitle: program.title,
      programDescription: program.description ?? undefined,
      outcomeStatement: program.outcomeStatement ?? undefined,
      targetAudience: program.targetAudience ?? undefined,
      targetTransformation: program.targetTransformation ?? undefined,
      vibePrompt: combinedVibePrompt,
      durationWeeks: effectiveWeeks,
      clusters: clusterData,
      contentDigests: enrichedDigests,
      hasVideoAnalysis,
      clipDistributionPlan,
      aiStructured: program.aiStructured,
    });

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "validating", progress: 85 },
    });

    // Validate
    let validated = ProgramDraftSchema.safeParse(draft);
    if (!validated.success) {
      aiLogger.validationFailure(programId, validated.error.issues.length);
      throw new Error(`Schema validation failed: ${JSON.stringify(validated.error.issues)}`);
    }

    // Post-validate clip distribution — repair if LLM deviated from the plan
    if (clipDistributionPlan && enrichedOnly.length > 0) {
      const clipValidation = validateAndFixClipDistribution(
        validated.data,
        clipDistributionPlan,
        enrichedOnly,
      );

      if (!clipValidation.valid) {
        console.warn(`[generate-async] Clip distribution validation failed: ${clipValidation.errors.join("; ")}`);
        if (clipValidation.fixedDraft) {
          const revalidated = ProgramDraftSchema.safeParse(clipValidation.fixedDraft);
          if (revalidated.success) {
            validated = revalidated;
            console.info(`[generate-async] Applied programmatic clip fixes — draft repaired`);
          } else {
            // Previously this silently fell back to the original (broken) LLM
            // draft, which is how empty Lesson 2 reached production. Fail
            // loudly so the GenerationJob errors out and the creator retries.
            console.error(`[generate-async] Clip fix produced invalid draft — failing job`, revalidated.error.issues);
            throw new Error(
              `Clip distribution repair failed schema validation: ${revalidated.error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")}`,
            );
          }
        } else {
          throw new Error(
            `Clip distribution validation failed and no auto-fix available: ${clipValidation.errors.join("; ")}`,
          );
        }
      } else {
        console.info(`[generate-async] Clip distribution validation passed`);
      }
    }

    // Curriculum-quality warnings (non-blocking) — surfaces weak lesson titles,
    // missing/multiple REFLECT actions, non-question reflectionPrompts, and
    // concept-restatement DO actions.
    const qualityWarnings = validateDraftQuality(validated.data);
    if (qualityWarnings.length > 0) {
      console.warn(`[generate-async] ═══ QUALITY WARNINGS (${qualityWarnings.length}) ═══`);
      for (const w of qualityWarnings) {
        console.warn(`[generate-async]   ⚠ ${w}`);
      }
    } else {
      console.info(`[generate-async] Quality checks passed`);
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "persisting", progress: 90 },
    });

    // ── Step 4: Persist (90-100%) ──
    checkDeadline("persisting");
    await prisma.programDraft.create({
      data: {
        programId,
        draftJson: JSON.parse(JSON.stringify(validated.data)),
        status: "PENDING",
      },
    });

    // Sequential queries (no $transaction) to avoid Neon PgBouncer timeout issues.
    let sessionCount = 0;
    let actionCount = 0;
    let compositeCount = 0;

    // Wake up Neon compute — may have suspended during the minutes-long AI stages above
    await prisma.$queryRaw`SELECT 1`;

    await prisma.week.deleteMany({ where: { programId } });

    for (const week of validated.data.weeks) {
      const createdWeek = await prisma.week.create({
        data: {
          programId,
          title: stripWrappingQuotes(week.title),
          summary: week.summary,
          weekNumber: week.weekNumber,
        },
      });

      for (const session of week.sessions) {
        sessionCount++;
        const createdSession = await prisma.session.create({
          data: {
            weekId: createdWeek.id,
            title: stripWrappingQuotes(session.title),
            summary: session.summary,
            keyTakeaways: session.keyTakeaways ?? [],
            orderIndex: session.orderIndex,
          },
        });

        if (session.actions.length > 0) {
          actionCount += session.actions.length;
          await prisma.action.createMany({
            data: session.actions.map((action) => ({
              sessionId: createdSession.id,
              title: stripWrappingQuotes(action.title),
              type: action.type.toUpperCase() as "WATCH" | "READ" | "DO" | "REFLECT",
              instructions: action.instructions,
              reflectionPrompt: action.reflectionPrompt,
              orderIndex: action.orderIndex,
              youtubeVideoId: action.youtubeVideoId,
            })),
          });
        }

        // Drop any clip whose bounds collapsed to zero (or negative) duration
        // before we persist. Gemini occasionally emits a "marker" topic where
        // startSeconds === endSeconds, and if one slips past the distributor's
        // guards it would render as a duplicate WATCH item in the learner
        // viewer pointing at the same source video as the real clip.
        const usableClips = (session.clips ?? []).filter((clip) => {
          if (clip.startSeconds == null || clip.endSeconds == null) return true;
          return clip.endSeconds > clip.startSeconds;
        });

        if (usableClips.length > 0) {
          compositeCount++;
          const compositeSession = await prisma.compositeSession.create({
            data: {
              sessionId: createdSession.id,
              title: session.title,
              description: session.summary,
              autoAdvance: true,
            },
          });

          // Re-index clips after filtering so orderIndex stays contiguous (0..n-1).
          await prisma.sessionClip.createMany({
            data: usableClips.map((clip, idx) => ({
              compositeSessionId: compositeSession.id,
              youtubeVideoId: clip.youtubeVideoId,
              startSeconds: clip.startSeconds ?? null,
              endSeconds: clip.endSeconds ?? null,
              orderIndex: idx,
              transitionType: (clip.transitionType ?? "NONE") as "NONE" | "FADE" | "CROSSFADE" | "SLIDE_LEFT",
              transitionDurationMs: clip.transitionDurationMs ?? 500,
              chapterTitle: clip.chapterTitle ?? null,
              chapterDescription: clip.chapterDescription ?? null,
            })),
          });

          if (session.overlays && session.overlays.length > 0) {
            await prisma.sessionOverlay.createMany({
              data: session.overlays.map((overlay) => ({
                compositeSessionId: compositeSession.id,
                type: overlay.type as "TITLE_CARD" | "CHAPTER_TITLE" | "KEY_POINTS" | "LOWER_THIRD" | "CTA" | "OUTRO",
                content: overlay.content as unknown as Prisma.InputJsonValue,
                clipOrderIndex: overlay.clipOrderIndex ?? null,
                triggerAtSeconds: overlay.triggerAtSeconds ?? null,
                durationMs: overlay.durationMs ?? 5000,
                position: (overlay.position ?? "CENTER") as "CENTER" | "BOTTOM" | "TOP" | "LOWER_THIRD",
                orderIndex: overlay.orderIndex,
              })),
            });
          }
        }
      }
    }

    await prisma.program.update({
      where: { id: programId },
      data: { durationWeeks: validated.data.weeks.length },
    });

    aiLogger.generationSuccess(programId, timer.elapsed(), {
      weekCount: validated.data.weeks.length,
      sessionCount,
      actionCount,
    });

    console.info(`[generate-async] Persisted: ${sessionCount} sessions, ${actionCount} actions, ${compositeCount} composite sessions`);

    // ── Step 5: Custom Skin Generation (93-100%) ──
    // Only runs when the creator selected "Build My Own" in the skin picker (skinId = "auto-generate")
    if (program.skinId === "auto-generate") {
      checkDeadline("generating_skin");
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { stage: "generating_skin", progress: 93 },
      });

      try {
        const skinTokens = await generateSkinFromVibe({
          title: program.title,
          targetTransformation: program.targetTransformation,
          vibePrompt: program.vibePrompt,
          niche: null,
        });

        if (skinTokens) {
          const customSkin = await prisma.customSkin.upsert({
            where: {
              // If there's already a custom skin for this program, update it
              id: program.customSkinId ?? "__none__",
            },
            create: {
              creatorId: program.creatorId,
              name: program.title,
              tokens: skinTokens as unknown as Prisma.InputJsonValue,
            },
            update: {
              name: program.title,
              tokens: skinTokens as unknown as Prisma.InputJsonValue,
            },
          });

          await prisma.program.update({
            where: { id: programId },
            data: {
              customSkinId: customSkin.id,
              skinId: "classic-minimal", // clear sentinel; custom skin takes precedence
            },
          });

          console.info(`[generate-async] Custom skin generated and linked: ${customSkin.id}`);
        } else {
          // Stub mode or unsupported provider — reset sentinel to catalog fallback
          await prisma.program.update({
            where: { id: programId },
            data: { skinId: "classic-minimal" },
          });
        }
      } catch (skinErr) {
        // Skin generation failure is non-fatal — log and fall back to catalog skin
        console.error("[generate-async] Skin generation failed (non-fatal):", skinErr);
        await prisma.program.update({
          where: { id: programId },
          data: { skinId: "classic-minimal" },
        });
      }
    }

    // Mark complete
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        stage: "complete",
        progress: 100,
        completedAt: new Date(),
      },
    });

    // Notify creator via email (best-effort, non-blocking)
    try {
      const creator = await prisma.user.findUnique({
        where: { id: program.creatorId },
        select: { email: true, name: true },
      });
      if (creator?.email) {
        await sendProgramReadyEmail(
          creator.email,
          creator.name ?? "there",
          program.title ?? "Your Program",
          programId,
        );
      }
    } catch (err) {
      console.error("[generate-async] Failed to send completion email:", err);
    }

  } catch (err) {
    console.error("[generate-async] Job failed:", err);

    // Always write a non-empty error message. The client uses `error` to surface a
    // failure panel + retry button; an empty/null error makes the UI fall through
    // and silently re-open the wizard, which looks like the job never ran.
    const rawMessage = err instanceof Error ? err.message : String(err ?? "");
    const errorMessage = rawMessage.trim() || "Generation failed unexpectedly. Please try again.";

    try {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: errorMessage,
          completedAt: new Date(),
        },
      });
    } catch (updateErr) {
      // If even the FAILED write fails (DB connection lost, etc.), the job is left
      // stuck in PROCESSING. The status route's isStale detection (3 min) is the
      // last line of defense — log loudly so we can see this in production.
      console.error("[generate-async] CRITICAL: failed to mark job FAILED — job will be stuck until isStale triggers:", updateErr);
    }
  }
}
