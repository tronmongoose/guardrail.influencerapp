import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmbeddings, clusterEmbeddings, generateProgramDraft, extractContentDigests } from "@guide-rail/ai";
import { ProgramDraftSchema } from "@guide-rail/shared";
import { aiLogger, createTimer } from "@/lib/logger";

const HF_MODEL = process.env.HF_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";

/**
 * Async program generation endpoint.
 * Creates a GenerationJob and processes it in the background.
 * Returns immediately with the job ID for polling.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { videos: true, artifacts: true },
  });

  if (!program || program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasContent = program.videos.length > 0 || program.artifacts.length > 0;
  if (!hasContent) {
    return NextResponse.json({ error: "No content to process" }, { status: 400 });
  }

  // Check for existing pending/processing job
  const existingJob = await prisma.generationJob.findFirst({
    where: {
      programId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });

  if (existingJob) {
    return NextResponse.json({
      jobId: existingJob.id,
      status: existingJob.status,
      stage: existingJob.stage,
      progress: existingJob.progress,
      message: "Generation already in progress",
    });
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

  // Start async processing (fire and forget)
  processGenerationJob(job.id, programId).catch((err) => {
    console.error("[generate-async] Background job failed:", err);
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
async function processGenerationJob(jobId: string, programId: string) {
  const timer = createTimer();

  try {
    // Mark as processing
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", stage: "embedding", progress: 5, startedAt: new Date() },
    });

    // Fetch program with videos and artifacts
    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: { videos: true, artifacts: true },
    });

    if (!program) throw new Error("Program not found");

    // Filter artifacts with usable text
    const usableArtifacts = program.artifacts.filter(
      (a) => a.extractedText && a.extractedText.length > 0
    );

    // Build ID sets for later lookups
    const videoIdSet = new Set(program.videos.map((v) => v.id));

    // Step 1: Embeddings (5-25%)
    const videoEmbeddingInputs = program.videos.map((v) => ({
      contentId: v.id,
      text: v.transcript
        ? `${v.title ?? ""}: ${v.transcript}`.slice(0, 4000)
        : `${v.title ?? ""} ${v.description ?? ""}`.trim() || v.videoId,
    }));

    const artifactEmbeddingInputs = usableArtifacts.map((a) => ({
      contentId: a.id,
      text: `${a.originalFilename}: ${a.extractedText!}`.slice(0, 4000),
    }));

    const embeddingInputs = [...videoEmbeddingInputs, ...artifactEmbeddingInputs];

    aiLogger.embeddingStart(programId, embeddingInputs.length);
    const embeddingTimer = createTimer();

    const embeddingResults = await getEmbeddings(embeddingInputs);
    aiLogger.embeddingSuccess(programId, embeddingTimer.elapsed(), embeddingResults.length);

    // Store video embeddings only (Embedding table has FK to YouTubeVideo)
    for (const result of embeddingResults) {
      if (videoIdSet.has(result.contentId)) {
        await prisma.embedding.upsert({
          where: {
            programId_videoId_model: { programId, videoId: result.contentId, model: HF_MODEL },
          },
          create: { programId, videoId: result.contentId, model: HF_MODEL, vector: result.embedding },
          update: { vector: result.embedding },
        });
      }
      // Artifact embeddings used in-memory only (no FK in Embedding table)
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "clustering", progress: 25 },
    });

    // Step 2: Clustering (25-35%)
    const clusterInputs = embeddingResults.map((r) => ({
      contentId: r.contentId,
      embedding: r.embedding,
    }));

    const totalContent = program.videos.length + usableArtifacts.length;
    const k = Math.min(program.durationWeeks, totalContent);
    const clusters = clusterEmbeddings(clusterInputs, k);

    aiLogger.clusteringComplete(programId, timer.elapsed(), {
      videoCount: program.videos.length,
      clusterCount: clusters.length,
    });

    // Store cluster assignments for videos only (ClusterAssignment has FK to YouTubeVideo)
    for (const cluster of clusters) {
      for (const contentId of cluster.contentIds) {
        if (videoIdSet.has(contentId)) {
          await prisma.clusterAssignment.upsert({
            where: { programId_videoId: { programId, videoId: contentId } },
            create: { programId, videoId: contentId, clusterId: cluster.clusterId },
            update: { clusterId: cluster.clusterId },
          });
        }
      }
    }

    // Step 2.5: Content Extraction / Analysis (35-60%)
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "analyzing", progress: 35 },
    });

    const videosForExtraction = program.videos.map((v) => ({
      contentId: v.id,
      contentTitle: v.title ?? "Untitled",
      text: v.transcript,
      contentType: "video" as const,
    }));

    const artifactsForExtraction = usableArtifacts.map((a) => ({
      contentId: a.id,
      contentTitle: a.originalFilename,
      text: a.extractedText,
      contentType: "document" as const,
    }));

    const allForExtraction = [...videosForExtraction, ...artifactsForExtraction];

    aiLogger.extractionStart(programId, allForExtraction.length);
    const extractionTimer = createTimer();

    const contentDigests = await extractContentDigests(
      allForExtraction,
      async (completed, total) => {
        const extractionProgress = 35 + Math.round((completed / total) * 25);
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { progress: extractionProgress },
        });
      },
    );

    aiLogger.extractionSuccess(programId, extractionTimer.elapsed(), contentDigests.length);

    // Step 3: LLM Generation (60-85%)
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "generating", progress: 60 },
    });

    // Build lookup maps
    const videoMap = new Map(program.videos.map((v) => [v.id, v]));
    const artifactMap = new Map(usableArtifacts.map((a) => [a.id, a]));

    const clusterData = clusters.map((c) => ({
      clusterId: c.clusterId,
      contentIds: c.contentIds,
      contentTitles: c.contentIds.map((cid) => {
        const video = videoMap.get(cid);
        if (video) return video.title ?? "Untitled";
        const artifact = artifactMap.get(cid);
        if (artifact) return artifact.originalFilename;
        return "Untitled";
      }),
      contentTranscripts: c.contentIds.map((cid) => {
        const video = videoMap.get(cid);
        if (video) return video.transcript ?? "";
        const artifact = artifactMap.get(cid);
        if (artifact) return artifact.extractedText ?? "";
        return "";
      }),
      contentTypes: c.contentIds.map((cid): "video" | "document" =>
        videoIdSet.has(cid) ? "video" : "document"
      ),
      summary: `Group of ${c.contentIds.length} content source(s)`,
    }));

    aiLogger.generationStart(programId, {
      clusterCount: clusters.length,
      durationWeeks: program.durationWeeks,
    });

    const llmTimer = createTimer();
    const draft = await generateProgramDraft({
      programId,
      programTitle: program.title,
      programDescription: program.description ?? undefined,
      outcomeStatement: program.outcomeStatement ?? undefined,
      targetAudience: program.targetAudience ?? undefined,
      targetTransformation: program.targetTransformation ?? undefined,
      vibePrompt: program.vibePrompt ?? undefined,
      durationWeeks: program.durationWeeks,
      clusters: clusterData,
      contentDigests,
    });

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "validating", progress: 85 },
    });

    // Validate
    const validated = ProgramDraftSchema.safeParse(draft);
    if (!validated.success) {
      aiLogger.validationFailure(programId, validated.error.issues.length);
      throw new Error(`Schema validation failed: ${JSON.stringify(validated.error.issues)}`);
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { stage: "persisting", progress: 90 },
    });

    // Step 4: Persist (90-100%)
    await prisma.programDraft.create({
      data: {
        programId,
        draftJson: JSON.parse(JSON.stringify(validated.data)),
        status: "PENDING",
      },
    });

    // Delete existing structure and create new (atomic — if anything fails, old weeks are preserved)
    let sessionCount = 0;
    let actionCount = 0;

    await prisma.$transaction(async (tx) => {
      await tx.week.deleteMany({ where: { programId } });

      for (const week of validated.data.weeks) {
        const createdWeek = await tx.week.create({
          data: {
            programId,
            title: week.title,
            summary: week.summary,
            weekNumber: week.weekNumber,
          },
        });

        for (const session of week.sessions) {
          sessionCount++;
          const createdSession = await tx.session.create({
            data: {
              weekId: createdWeek.id,
              title: session.title,
              summary: session.summary,
              keyTakeaways: session.keyTakeaways ?? [],
              orderIndex: session.orderIndex,
            },
          });

          for (const action of session.actions) {
            actionCount++;
            await tx.action.create({
              data: {
                sessionId: createdSession.id,
                title: action.title,
                type: action.type.toUpperCase() as "WATCH" | "READ" | "DO" | "REFLECT",
                instructions: action.instructions,
                reflectionPrompt: action.reflectionPrompt,
                orderIndex: action.orderIndex,
                youtubeVideoId: action.youtubeVideoId,
              },
            });
          }
        }
      }
    });

    aiLogger.generationSuccess(programId, timer.elapsed(), {
      weekCount: validated.data.weeks.length,
      sessionCount,
      actionCount,
    });

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

  } catch (err) {
    console.error("[generate-async] Job failed:", err);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}
