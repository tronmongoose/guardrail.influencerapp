import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AccessRow = { platformPromoGranted: boolean; platformPaymentComplete: boolean };

/** Raw SQL helper — works even if Prisma client hasn't been restarted after schema migration */
async function getPlatformAccess(userId: string): Promise<AccessRow> {
  const rows = await prisma.$queryRaw<AccessRow[]>`
    SELECT "platformPromoGranted", "platformPaymentComplete"
    FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  return rows[0] ?? { platformPromoGranted: false, platformPaymentComplete: false };
}

export async function PATCH(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.bio !== undefined) data.bio = body.bio;
  if (body.niche !== undefined) data.niche = body.niche;
  if (body.outcomeTarget !== undefined) data.outcomeTarget = body.outcomeTarget;
  if (body.name !== undefined) data.name = body.name;

  // Mark onboarding complete if all required fields provided
  if (body.niche && body.outcomeTarget) {
    data.onboardingComplete = true;
  }

  // Upgrade role to CREATOR when completing onboarding
  if (data.onboardingComplete) {
    data.role = "CREATOR";
  }

  // Validate platform promo code — use raw SQL to avoid stale Prisma client
  const currentAccess = await getPlatformAccess(user.id);
  let platformPromoGranted = currentAccess.platformPromoGranted;

  if (body.platformPromoCode && !currentAccess.platformPromoGranted) {
    const validCode = (process.env.PLATFORM_PROMO_CODE ?? "Journey").toLowerCase();
    if (body.platformPromoCode.toLowerCase() === validCode) {
      // Raw SQL update so new column works before Prisma client restart
      await prisma.$executeRaw`
        UPDATE "User" SET "platformPromoGranted" = true WHERE id = ${user.id}
      `;
      platformPromoGranted = true;
    }
  }

  // Update remaining fields via ORM (these are existing columns)
  await prisma.user.update({ where: { id: user.id }, data });

  return NextResponse.json({
    onboardingComplete: !!data.onboardingComplete || user.onboardingComplete,
    platformPromoGranted,
    platformPaymentComplete: currentAccess.platformPaymentComplete,
  });
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use raw SQL for new fields so they work before a Prisma client restart
  const access = await getPlatformAccess(user.id);

  return NextResponse.json({
    name: user.name,
    bio: user.bio,
    niche: user.niche,
    outcomeTarget: user.outcomeTarget,
    onboardingComplete: user.onboardingComplete,
    platformPromoGranted: access.platformPromoGranted,
    platformPaymentComplete: access.platformPaymentComplete,
  });
}
