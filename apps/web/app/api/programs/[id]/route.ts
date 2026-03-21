import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        videos: { orderBy: { createdAt: "asc" } },
        drafts: { orderBy: { createdAt: "desc" }, take: 5 },
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: {
            sessions: {
              orderBy: { orderIndex: "asc" },
              include: {
                actions: { orderBy: { orderIndex: "asc" } },
                compositeSession: {
                  include: {
                    clips: { orderBy: { orderIndex: "asc" }, include: { youtubeVideo: true } },
                    overlays: { orderBy: { orderIndex: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!program) {
      return NextResponse.json(
        { error: "Not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    // Verify ownership
    if (program.creatorId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(program, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err) {
    console.error("[programs/[id] GET] Unhandled error:", err);
    return NextResponse.json(
      { error: "Failed to load program" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership before allowing update
  const existing = await prisma.program.findUnique({
    where: { id },
    select: { creatorId: true, published: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title) {
    data.title = body.title;
    // Only update slug for unpublished programs — don't break live URLs
    if (!existing.published) {
      data.slug = slugify(body.title) + "-" + id.slice(0, 6);
    }
  }
  if (body.description !== undefined) data.description = body.description;
  if (body.outcomeStatement !== undefined) data.outcomeStatement = body.outcomeStatement;
  if (body.durationWeeks) data.durationWeeks = body.durationWeeks;
  if (body.priceInCents !== undefined) data.priceInCents = body.priceInCents;
  if (body.styleInfluencers !== undefined) data.styleInfluencers = body.styleInfluencers;
  // New program definition fields
  if (body.targetAudience !== undefined) data.targetAudience = body.targetAudience;
  if (body.targetTransformation !== undefined) data.targetTransformation = body.targetTransformation;
  if (body.vibePrompt !== undefined) data.vibePrompt = body.vibePrompt;
  if (body.skinId !== undefined) data.skinId = body.skinId;
  if (body.pacingMode !== undefined) {
    // Map from shared schema format to Prisma enum format
    const pacingModeMap: Record<string, string> = {
      drip_by_week: "DRIP_BY_WEEK",
      unlock_on_complete: "UNLOCK_ON_COMPLETE",
    };
    data.pacingMode = pacingModeMap[body.pacingMode] || "DRIP_BY_WEEK";
  }

  const program = await prisma.program.update({ where: { id }, data });
  return NextResponse.json(program);
}
