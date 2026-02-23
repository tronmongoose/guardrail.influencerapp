import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      creatorId: true,
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (program.creatorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    id: program.id,
    slug: program.slug,
    title: program.title,
    published: program.published,
    status: program.status,
    salesUrl: `/p/${program.slug}`,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
  });
}
