import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;

  try {
    const user = await getOrCreateUser();
    if (!user) throw new Error("Unauthorized");

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { creatorId: true },
    });
    if (!program) throw new Error("Program not found");
    if (program.creatorId !== user.id) throw new Error("Forbidden");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No file provided");

    if (!["video/mp4", "video/quicktime"].includes(file.type)) {
      throw new Error("Invalid file type");
    }
    if (file.size > 500 * 1024 * 1024) {
      throw new Error("File exceeds 500 MB limit");
    }

    const blob = await put(`programs/${programId}/${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
