import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/progress/session
 * Body shapes:
 *   { sessionId, clipId, watched }     — toggle a single CompositeSession clip
 *   { sessionId, watched }             — legacy: toggle the whole session
 *
 * When `clipId` is supplied, the clip ID is added to / removed from
 * `watchedClipIds`. The session-level `watched` rollup is recomputed
 * server-side: true iff every clip in the session's CompositeSession is in
 * `watchedClipIds`. When `clipId` is absent (legacy callers / chained-player
 * `onAllComplete`), the session-level flag is toggled directly and — when
 * marking watched — `watchedClipIds` is filled with every clip ID so the
 * per-clip UI hydrates consistently on next load.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, clipId, watched } = (body ?? {}) as {
    sessionId?: unknown;
    clipId?: unknown;
    watched?: unknown;
  };
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (typeof watched !== "boolean") {
    return NextResponse.json({ error: "watched must be boolean" }, { status: 400 });
  }
  if (clipId !== undefined && (typeof clipId !== "string" || clipId.length === 0)) {
    return NextResponse.json({ error: "clipId must be a non-empty string when provided" }, { status: 400 });
  }

  // Pull the session's CompositeSession clips so we can compute the
  // session-level rollup after the array mutation.
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      compositeSession: {
        select: { clips: { select: { id: true } } },
      },
    },
  });
  const allClipIds = session?.compositeSession?.clips.map((c) => c.id) ?? [];

  const existing = await prisma.learnerSessionProgress.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId } },
    select: { watchedClipIds: true },
  });
  const currentClipIds = new Set(existing?.watchedClipIds ?? []);

  let nextClipIds: string[];
  if (typeof clipId === "string") {
    if (watched) currentClipIds.add(clipId);
    else currentClipIds.delete(clipId);
    nextClipIds = Array.from(currentClipIds);
  } else if (watched) {
    // Legacy/whole-session mark: fill the array with every clip ID so the
    // per-clip UI shows them all as done on next load.
    nextClipIds = allClipIds;
  } else {
    nextClipIds = [];
  }

  // Session-level rollup: true iff every clip is watched (and there is at
  // least one clip — empty CompositeSession shouldn't read as "watched").
  const rollupWatched =
    typeof clipId === "string"
      ? allClipIds.length > 0 && allClipIds.every((id) => nextClipIds.includes(id))
      : watched;

  const now = new Date();
  const record = await prisma.learnerSessionProgress.upsert({
    where: { userId_sessionId: { userId: user.id, sessionId } },
    create: {
      userId: user.id,
      sessionId,
      watched: rollupWatched,
      watchedAt: rollupWatched ? now : null,
      watchedClipIds: nextClipIds,
    },
    update: {
      watched: rollupWatched,
      watchedAt: rollupWatched ? now : null,
      watchedClipIds: nextClipIds,
    },
  });

  return NextResponse.json({
    sessionId: record.sessionId,
    watched: record.watched,
    watchedAt: record.watchedAt,
    watchedClipIds: record.watchedClipIds,
  });
}
