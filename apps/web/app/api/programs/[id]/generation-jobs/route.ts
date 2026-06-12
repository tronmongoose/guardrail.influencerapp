import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isDebugUser } from "@/lib/debug-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDebugUser(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const program = await prisma.program.findFirst({
    where: { id: programId, creatorId: user.id },
    select: { id: true },
  });
  if (!program) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jobs = await prisma.generationJob.findMany({
    where: { programId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      stage: true,
      progress: true,
      error: true,
      steps: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
