import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Update a session
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: programId, sessionId } = await params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { week: { include: { program: { select: { creatorId: true, id: true } } } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.week.program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.week.program.id !== programId) {
    return NextResponse.json({ error: "Session does not belong to program" }, { status: 400 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.summary !== undefined) data.summary = body.summary;
  if (body.keyTakeaways !== undefined) data.keyTakeaways = body.keyTakeaways;
  if (body.weekId !== undefined) {
    data.weekId = body.weekId;
    // Append to end of target week
    const lastInTargetWeek = await prisma.session.findFirst({
      where: { weekId: body.weekId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    data.orderIndex = (lastInTargetWeek?.orderIndex ?? -1) + 1;
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data,
    include: {
      actions: { orderBy: { orderIndex: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

// Delete a session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: programId, sessionId } = await params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { week: { include: { program: { select: { creatorId: true, id: true } } } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.week.program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.week.program.id !== programId) {
    return NextResponse.json({ error: "Session does not belong to program" }, { status: 400 });
  }

  await prisma.session.delete({ where: { id: sessionId } });

  return NextResponse.json({ success: true });
}
