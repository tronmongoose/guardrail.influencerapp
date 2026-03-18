import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { parseYouTubeVideoId, fetchYouTubeOEmbed, fetchYouTubeTranscript } from "@guide-rail/shared";
import { analyzeVideoWithGemini } from "@guide-rail/ai";
import { videoLogger, createTimer } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;
  const timer = createTimer();

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { creatorId: true }
  });
  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { url, source, title: uploadedTitle } = await req.json();

  // Handle direct file uploads (from Vercel Blob)
  if (source === "upload") {
    const rawName = (uploadedTitle as string | undefined) || url.split("/").pop() || "Uploaded Video";
    const title = rawName.replace(/\.[^/.]+$/, ""); // strip extension
    const video = await prisma.youTubeVideo.create({
      data: {
        videoId: crypto.randomUUID(),
        url,
        title,
        programId,
      },
    });
    return NextResponse.json(video);
  }

  const videoId = parseYouTubeVideoId(url);
  if (!videoId) {
    videoLogger.ingestionFailure(programId, null, timer.elapsed(), new Error("Invalid YouTube URL"), {
      stage: "parse",
      source: "single",
    });
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  videoLogger.ingestionStart(programId, videoId, "single");

  // Check duplicate
  const existing = await prisma.youTubeVideo.findUnique({
    where: { programId_videoId: { programId, videoId } },
  });
  if (existing) return NextResponse.json(existing);

  // Fetch metadata via oEmbed
  let meta: { title: string; authorName: string; thumbnailUrl: string };
  let hasMetadata = true;
  try {
    meta = await fetchYouTubeOEmbed(videoId);
  } catch {
    hasMetadata = false;
    meta = { title: videoId, authorName: "", thumbnailUrl: "" };
  }

  // Fetch transcript (best effort, don't fail if unavailable)
  let transcript: string | null = null;
  let hasTranscript = false;
  try {
    transcript = await fetchYouTubeTranscript(videoId);
    hasTranscript = !!transcript;
  } catch {
    videoLogger.transcriptUnavailable(programId, videoId);
  }

  try {
    const video = await prisma.youTubeVideo.create({
      data: {
        videoId,
        url,
        title: meta.title,
        authorName: meta.authorName,
        thumbnailUrl: meta.thumbnailUrl,
        transcript,
        programId,
      },
    });

    videoLogger.ingestionSuccess(programId, videoId, timer.elapsed(), {
      hasTranscript,
      hasMetadata,
      source: "single",
    });

    // Fire-and-forget Gemini video analysis (runs in background)
    analyzeVideoWithGemini(videoId, meta.title, undefined)
      .then(async (analysis) => {
        await prisma.videoAnalysis.upsert({
          where: { youtubeVideoId: video.id },
          create: {
            youtubeVideoId: video.id,
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
        console.log(`[gemini] Video analysis saved for ${videoId} (record ${video.id})`);
      })
      .catch((err) => {
        console.error(`[gemini] Video analysis failed for ${videoId}:`, err);
      });

    return NextResponse.json(video);
  } catch (err) {
    videoLogger.ingestionFailure(programId, videoId, timer.elapsed(), err, {
      stage: "database",
      source: "single",
    });
    throw err;
  }
}
