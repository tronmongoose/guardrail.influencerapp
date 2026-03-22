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

    // Already has access
    if (access.platformPromoGranted || access.platformPaymentComplete) {
      return NextResponse.json({ redirectUrl: "/dashboard" });
    }

    // Accept optional amount (in dollars) from request body
    let bodyAmount: number | null = null;
    try {
      const body = await req.json();
      if (body.amount && typeof body.amount === "number" && body.amount > 0) {
        bodyAmount = Math.round(body.amount * 100); // convert dollars to cents
      }
    } catch {
      // no body is fine
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
      return NextResponse.json({ redirectUrl: "/dashboard" });
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
      success_url: `${appUrl}/dashboard?platform_access=success`,
      cancel_url: `${appUrl}/onboarding/upgrade`,
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
