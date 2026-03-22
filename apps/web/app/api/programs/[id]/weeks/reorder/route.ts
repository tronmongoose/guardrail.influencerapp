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

  // Fetch current titles to know which ones are auto-generated ("Week N")
  const currentWeeks = await prisma.week.findMany({
    where: { id: { in: weekIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(currentWeeks.map((w) => [w.id, w.title]));
  const autoTitlePattern = /^Week\s+\d+$/i;

  // Two-pass update to avoid unique constraint violations on (programId, weekNumber):
  // First set to negative temporaries, then to final positive values.
  // Also update auto-generated titles ("Week N") to reflect the new position.
  try {
    await prisma.$transaction([
      ...weekIds.map((weekId, index) =>
        prisma.week.update({
          where: { id: weekId },
          data: { weekNumber: -(index + 1) },
        })
      ),
      ...weekIds.map((weekId, index) => {
        const newWeekNumber = index + 1;
        const currentTitle = titleMap.get(weekId) ?? "";
        const data: { weekNumber: number; title?: string } = { weekNumber: newWeekNumber };
        if (autoTitlePattern.test(currentTitle)) {
          data.title = `Week ${newWeekNumber}`;
        }
        return prisma.week.update({ where: { id: weekId }, data });
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reorder] transaction failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
