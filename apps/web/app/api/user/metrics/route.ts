import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeApplicationFeeCents, getTakeRateBps } from "@/lib/take-rate";

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all creator programs with their entitlements' paid amounts. Reading
  // per-entitlement (not priceInCents × count) keeps the dashboard truthful
  // even after a price edit — the actual amount each learner paid is locked
  // in on the entitlement row at enrollment.
  const programs = await prisma.program.findMany({
    where: { creatorId: user.id },
    select: {
      priceInCents: true,
      platformFeePaid: true,
      entitlements: {
        select: { amountPaidCents: true },
      },
    },
  });

  const creatorTakeRateInput = {
    platformPaymentComplete: user.platformPaymentComplete,
    platformPromoGranted: user.platformPromoGranted,
    email: user.email,
  };

  const totalEnrollments = programs.reduce(
    (sum, p) => sum + p.entitlements.length,
    0
  );
  // Net revenue: sum each entitlement's paid amount minus JourneyLine's
  // per-program take rate. Grandfathered programs/creators get 0% — same
  // rules as checkout, so the dashboard matches what Stripe paid out.
  // Legacy entitlements (created before amountPaidCents existed) fall back
  // to the current program priceInCents — best-effort for old data.
  const totalRevenueCents = programs.reduce((sum, p) => {
    const bps = getTakeRateBps({
      program: { platformFeePaid: p.platformFeePaid },
      creator: creatorTakeRateInput,
    });
    return (
      sum +
      p.entitlements.reduce((entSum, ent) => {
        const grossCents = ent.amountPaidCents ?? p.priceInCents;
        const feeCents = computeApplicationFeeCents(grossCents, bps);
        return entSum + (grossCents - feeCents);
      }, 0)
    );
  }, 0);

  return NextResponse.json({
    totalEnrollments,
    totalRevenueCents,
    programViews: 0, // not tracked yet
  });
}
