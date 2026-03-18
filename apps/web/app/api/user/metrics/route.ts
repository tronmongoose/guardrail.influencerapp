import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all creator programs with enrollment counts and prices
  const programs = await prisma.program.findMany({
    where: { creatorId: user.id },
    select: {
      priceInCents: true,
      _count: {
        select: { entitlements: true },
      },
    },
  });

  const totalEnrollments = programs.reduce((sum, p) => sum + p._count.entitlements, 0);
  const totalRevenueCents = programs.reduce(
    (sum, p) => sum + p.priceInCents * p._count.entitlements,
    0
  );

  return NextResponse.json({
    totalEnrollments,
    totalRevenueCents,
    programViews: 0, // not tracked yet
  });
}
