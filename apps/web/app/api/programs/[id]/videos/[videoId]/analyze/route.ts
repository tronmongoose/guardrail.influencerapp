import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { analyzeVideoWithGemini } from "@guide-rail/ai";

// Gemini analysis can take 30–90 seconds for longer videos
export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const { id: programId, videoId: videoDbId } = await params;

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify program ownership
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { creatorId: true },
  });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (program.creatorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find the video record
  const video = await prisma.youTubeVideo.findUnique({
    where: { id: videoDbId },
    include: { analysis: { select: { id: true } } },
  });
  if (!video || video.programId !== programId) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Already analyzed — nothing to do
  if (video.analysis) {
    return NextResponse.json({ ok: true, alreadyAnalyzed: true });
  }

  try {
    const analysis = await analyzeVideoWithGemini(
      video.videoId,
      video.title ?? video.videoId,
      undefined
    );

    await prisma.videoAnalysis.upsert({
      where: { youtubeVideoId: video.id },
      create: {
        youtubeVideoId: video.id,
        summary: analysis.summary,
        fullTranscript: analysis.fullTranscript ?? null,
        segments: analysis.segments as unknown as Prisma.InputJsonValue,
        topics: analysis.topics as unknown as Prisma.InputJsonValue,
        keyMoments: (analysis.keyMoments as unknown as Prisma.InputJsonValue) ?? undefined,
        people: (analysis.people as unknown as Prisma.InputJsonValue) ?? undefined,
        durationSeconds: analysis.durationSeconds ?? null,
      },
      update: {
        summary: analysis.summary,
        fullTranscript: analysis.fullTranscript ?? null,
        segments: analysis.segments as unknown as Prisma.InputJsonValue,
        topics: analysis.topics as unknown as Prisma.InputJsonValue,
        keyMoments: (analysis.keyMoments as unknown as Prisma.InputJsonValue) ?? undefined,
        people: (analysis.people as unknown as Prisma.InputJsonValue) ?? undefined,
        durationSeconds: analysis.durationSeconds ?? null,
        analyzedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[gemini] On-demand analysis failed for video ${videoDbId}:`, err);
    return NextResponse.json(
      { error: "Video analysis failed. This video may not be supported." },
      { status: 500 }
    );
  }
}
