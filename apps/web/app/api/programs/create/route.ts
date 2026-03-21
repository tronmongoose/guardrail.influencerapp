import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function POST() {
  try {
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const program = await prisma.program.create({
      data: {
        title: "Untitled Program",
        slug: slugify("untitled-" + Date.now()),
        durationWeeks: 6,
        creatorId: user.id,
      },
    });

    return NextResponse.json(program);
  } catch (err) {
    console.error("[programs/create] Unhandled error:", err);
    return NextResponse.json({ error: "Failed to create program" }, { status: 500 });
  }
}
