import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeApplicationFeeCents, getTakeRateBps } from "@/lib/take-rate";

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
      platformFeePaid: true,
      _count: {
        select: { entitlements: true },
      },
    },
  });

  const creatorTakeRateInput = {
    platformPaymentComplete: user.platformPaymentComplete,
    platformPromoGranted: user.platformPromoGranted,
    email: user.email,
  };

  const totalEnrollments = programs.reduce((sum, p) => sum + p._count.entitlements, 0);
  // Net revenue: gross price × enrollments minus JourneyLine's per-program
  // take rate. Grandfathered programs/creators get 0% — getTakeRateBps applies
  // the same rules used at checkout, so the dashboard matches what Stripe paid out.
  const totalRevenueCents = programs.reduce((sum, p) => {
    const grossCents = p.priceInCents * p._count.entitlements;
    const bps = getTakeRateBps({
      program: { platformFeePaid: p.platformFeePaid },
      creator: creatorTakeRateInput,
    });
    const feeCents = computeApplicationFeeCents(grossCents, bps);
    return sum + (grossCents - feeCents);
  }, 0);

  return NextResponse.json({
    totalEnrollments,
    totalRevenueCents,
    programViews: 0, // not tracked yet
  });
}
