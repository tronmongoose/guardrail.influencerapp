import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Readiness check for the wizard's pre-generate poll. Returns how many of
 * the program's videos have Mux's capped-1080p.mp4 static rendition ready —
 * that file is what Gemini downloads for analysis. Wait happens client-side
 * so we don't burn Vercel function time (maxDuration = 800s) on a 13-min
 * Mux transcode for a long video.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const program = await prisma.program.findFirst({
    where: { id: programId, creatorId: user.id },
    select: {
      id: true,
      videos: {
        where: { isSegment: false },
        select: {
          id: true,
          title: true,
          durationSeconds: true,
          muxStatus: true,
          muxStaticRenditionReadyAt: true,
        },
      },
    },
  });
  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const videos = program.videos;
  const readyVideos = videos.filter((v) => !!v.muxStaticRenditionReadyAt);
  const pendingVideos = videos.filter((v) => !v.muxStaticRenditionReadyAt);

  // Estimate remaining time as 0.5× the longest pending video's duration.
  // Mux's capped-1080p transcode runs at ~0.3-0.5× source duration in practice.
  // When duration is unknown (asset.ready webhook hasn't fired yet), fall back
  // to 8 min — a conservative middle ground that won't look alarmist.
  let slowestEstimateRemainingMs = 0;
  for (const v of pendingVideos) {
    const est = v.durationSeconds
      ? Math.round(v.durationSeconds * 0.5 * 1000)
      : 8 * 60_000;
    if (est > slowestEstimateRemainingMs) slowestEstimateRemainingMs = est;
  }

  return NextResponse.json({
    readyCount: readyVideos.length,
    totalCount: videos.length,
    pendingTitles: pendingVideos.map((v) => v.title ?? "Untitled").slice(0, 3),
    slowestEstimateRemainingMs,
  });
}
