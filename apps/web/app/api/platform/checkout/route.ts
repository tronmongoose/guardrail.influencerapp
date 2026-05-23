import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

type AccessRow = { platformPromoGranted: boolean; platformPaymentComplete: boolean };

async function getPlatformAccess(userId: string): Promise<AccessRow> {
  const rows = await prisma.$queryRaw<AccessRow[]>`
    SELECT "platformPromoGranted", "platformPaymentComplete"
    FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  return rows[0] ?? { platformPromoGranted: false, platformPaymentComplete: false };
}

export async function POST(req: Request) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use raw SQL so new columns work before Prisma client restart
    const access = await getPlatformAccess(user.id);

    // Parse body once: amount (optional) + from (optional in-progress programId)
    // First-time creators hit this route via the wizard's PLATFORM_ACCESS_REQUIRED
    // detour; honoring `from` routes them back to their in-progress program
    // instead of dumping them on /dashboard.
    let bodyAmount: number | null = null;
    let fromProgramId: string | null = null;
    try {
      const body = await req.json();
      if (body.amount && typeof body.amount === "number" && body.amount > 0) {
        bodyAmount = Math.round(body.amount * 100); // convert dollars to cents
      }
      if (typeof body.from === "string" && body.from.length > 0) {
        fromProgramId = body.from;
      }
    } catch {
      // no body is fine
    }

    const accessRedirect = fromProgramId
      ? `/programs/${fromProgramId}/edit?wizard=true`
      : "/dashboard";

    // Already has access
    if (access.platformPromoGranted || access.platformPaymentComplete) {
      return NextResponse.json({ redirectUrl: accessRedirect });
    }

    const envFeeCents = parseInt(process.env.PLATFORM_ACCESS_FEE_CENTS ?? "0", 10);
    const feeCents = bodyAmount ?? envFeeCents;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // If fee is 0 or Stripe not configured, grant access immediately via raw SQL
    if (feeCents === 0 || !isStripeConfigured()) {
      await prisma.$executeRaw`
        UPDATE "User" SET "platformPaymentComplete" = true WHERE id = ${user.id}
      `;
      logger.info({ operation: "platform.checkout.free_grant", userId: user.id });
      return NextResponse.json({ redirectUrl: accessRedirect });
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: feeCents,
            product_data: {
              name: "Journeyline Creator Access",
              description: "One-time fee for full creator access to Journeyline",
            },
          },
          quantity: 1,
        },
      ],
      success_url: fromProgramId
        ? `${appUrl}/programs/${fromProgramId}/edit?wizard=true&platform_access=success`
        : `${appUrl}/dashboard?platform_access=success`,
      cancel_url: fromProgramId
        ? `${appUrl}/onboarding/upgrade?from=${fromProgramId}`
        : `${appUrl}/onboarding/upgrade`,
      customer_email: user.email,
      metadata: {
        type: "platform_access",
        userId: user.id,
      },
    });

    logger.info({
      operation: "platform.checkout.session_created",
      userId: user.id,
      sessionId: session.id,
      feeCents,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    logger.error({ operation: "platform.checkout.error" }, err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
