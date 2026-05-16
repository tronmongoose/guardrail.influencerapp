import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/progress/session
 * Body: { sessionId: string, watched: boolean }
 *
 * Records whether a learner has watched a session's chained clips.
 * Used by the inline chained player (fires on chain completion) and
 * by the timeline WATCH card (manual toggle via completion circle).
 *
 * Returns 401 if no current user, 400 if the body is malformed.
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

  const { sessionId, watched } = (body ?? {}) as { sessionId?: unknown; watched?: unknown };
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (typeof watched !== "boolean") {
    return NextResponse.json({ error: "watched must be boolean" }, { status: 400 });
  }

  const now = new Date();
  const record = await prisma.learnerSessionProgress.upsert({
    where: { userId_sessionId: { userId: user.id, sessionId } },
    create: {
      userId: user.id,
      sessionId,
      watched,
      watchedAt: watched ? now : null,
    },
    update: {
      watched,
      watchedAt: watched ? now : null,
    },
  });

  return NextResponse.json({
    sessionId: record.sessionId,
    watched: record.watched,
    watchedAt: record.watchedAt,
  });
}
