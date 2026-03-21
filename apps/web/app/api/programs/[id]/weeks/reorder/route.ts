import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Reorder weeks
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { creatorId: true },
  });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { weekIds } = body as { weekIds: string[] };

  if (!Array.isArray(weekIds)) {
    return NextResponse.json({ error: "weekIds must be an array" }, { status: 400 });
  }

  // Two-pass update to avoid unique constraint violations on (programId, weekNumber):
  // First set to negative temporaries, then to final positive values.
  await prisma.$transaction([
    ...weekIds.map((weekId, index) =>
      prisma.week.update({
        where: { id: weekId },
        data: { weekNumber: -(index + 1) },
      })
    ),
    ...weekIds.map((weekId, index) =>
      prisma.week.update({
        where: { id: weekId },
        data: { weekNumber: index + 1 },
      })
    ),
  ]);

  return NextResponse.json({ success: true });
}
