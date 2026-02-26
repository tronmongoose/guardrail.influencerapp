import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional published filter via query param
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const where: { creatorId: string; published?: boolean } = {
      creatorId: user.id,
    };

    if (statusParam === "PUBLISHED") {
      where.published = true;
    } else if (statusParam === "DRAFT") {
      where.published = false;
    }

    const programs = await prisma.program.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        durationWeeks: true,
        priceInCents: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            videos: true,
            weeks: true,
          },
        },
        generationJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            stage: true,
            progress: true,
          },
        },
      },
    });

    // Transform to include latest generation job
    const programsWithGen = programs.map((p) => ({
      ...p,
      generationJob: p.generationJobs[0] || null,
      generationJobs: undefined,
    }));

    return NextResponse.json(programsWithGen);
  } catch (error) {
    console.error("Failed to fetch programs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
