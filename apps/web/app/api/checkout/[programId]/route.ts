import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createMagicLink, getMagicLinkUrl } from "@/lib/magic-link";
import { logger } from "@/lib/logger";
import Stripe from "stripe";

// Platform fee percentage (e.g., 10%)
const PLATFORM_FEE_PERCENT = 10;

interface CheckoutRequestBody {
  email?: string;
  name?: string;
  promoCode?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params;

  // Check Clerk auth first (creators), then fall back to magic link session
  const clerkUser = await getOrCreateUser();
  let user = clerkUser ?? await getCurrentUser();

  // If no session, require email in request body
  let body: CheckoutRequestBody = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is okay for authenticated users
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      creator: {
        select: {
          id: true,
          stripeAccountId: true,
          stripeOnboardingComplete: true,
        },
      },
    },
  });

  if (!program || !program.published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If no authenticated user, create/find user by email
  if (!user) {
    if (!body.email) {
      return NextResponse.json(
        { error: "Email required", requiresEmail: true },
        { status: 400 }
      );
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    // Find or create user
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: body.name || null,
          role: "LEARNER",
        },
      });

      logger.info({
        operation: "checkout.user_created",
        userId: user.id,
        programId,
      });
    }
  }

  // Check if user already has access
  const existing = await prisma.entitlement.findUnique({
    where: { userId_programId: { userId: user.id, programId } },
  });

  if (existing?.status === "ACTIVE") {
    // Already enrolled — Clerk users go straight to learn page, others get magic link
    if (clerkUser) {
      return NextResponse.json({ enrolled: true, redirectUrl: `/learn/${programId}` });
    }
    const { token } = await createMagicLink({ email: user.email, programId });
    return NextResponse.json({ enrolled: true, redirectUrl: getMagicLinkUrl(token, programId) });
  }

  // Learner promo code — grant free access to paid program
  if (body.promoCode && program.priceInCents > 0) {
    const upperCode = body.promoCode.toUpperCase();
    const now = new Date();

    // Raw SQL so PromoCode table works before Prisma client restart
    const promoRows = await prisma.$queryRaw<Array<{ id: string; maxUses: number | null; uses: number }>>`
      SELECT id, "maxUses", uses FROM "PromoCode"
      WHERE code = ${upperCode}
        AND active = true
        AND "creatorId" = ${program.creatorId}
        AND ("programId" IS NULL OR "programId" = ${programId})
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      LIMIT 1
    `;
    const promo = promoRows[0];

    if (!promo || (promo.maxUses !== null && promo.uses >= promo.maxUses)) {
      return NextResponse.json(
        { error: "Invalid or expired promo code", promoError: true },
        { status: 400 }
      );
    }

    // Increment uses and grant entitlement
    await prisma.$executeRaw`UPDATE "PromoCode" SET uses = uses + 1 WHERE id = ${promo.id}`;
    await prisma.entitlement.upsert({
      where: { userId_programId: { userId: user.id, programId } },
      create: { userId: user.id, programId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });

    logger.info({
      operation: "checkout.promo_enrollment",
      userId: user.id,
      programId,
      promoCode: upperCode,
    });

    if (clerkUser) {
      return NextResponse.json({ enrolled: true, redirectUrl: `/learn/${programId}` });
    }
    const { token } = await createMagicLink({ email: user.email, programId });
    return NextResponse.json({ enrolled: true, redirectUrl: getMagicLinkUrl(token, programId) });
  }

  // Free program - grant access and redirect directly
  if (program.priceInCents === 0) {
    await prisma.entitlement.upsert({
      where: { userId_programId: { userId: user.id, programId } },
      create: { userId: user.id, programId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });

    logger.info({
      operation: "checkout.free_enrollment",
      userId: user.id,
      programId,
    });

    // Clerk users go straight to learn page, others get magic link
    if (clerkUser) {
      return NextResponse.json({ enrolled: true, redirectUrl: `/learn/${programId}` });
    }
    const { token } = await createMagicLink({ email: user.email, programId });
    return NextResponse.json({ enrolled: true, redirectUrl: getMagicLinkUrl(token, programId) });
  }

  // Paid program - create Stripe checkout session
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payments not configured" },
      { status: 503 }
    );
  }

  if (!program.stripePriceId) {
    return NextResponse.json(
      { error: "Program not set up for payments" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Build checkout session config
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price: program.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/checkout/success?programId=${programId}`,
    cancel_url: `${appUrl}/p/${program.slug}?checkout=cancelled`,
    metadata: {
      userId: user.id,
      programId: program.id,
      creatorId: program.creatorId,
    },
    customer_email: user.email,
  };

  // If creator has Stripe Connect, use destination charges for split payments
  if (program.creator.stripeAccountId && program.creator.stripeOnboardingComplete) {
    const applicationFee = Math.round(program.priceInCents * (PLATFORM_FEE_PERCENT / 100));

    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: program.creator.stripeAccountId,
      },
    };

    logger.info({
      operation: "checkout.stripe_connect_enabled",
      userId: user.id,
      programId,
      creatorAccountId: program.creator.stripeAccountId,
      applicationFee,
    });
  } else {
    // No Stripe Connect - all funds go to platform
    logger.info({
      operation: "checkout.standard_payment",
      userId: user.id,
      programId,
      note: "Creator has not set up Stripe Connect",
    });
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  logger.info({
    operation: "checkout.session_created",
    userId: user.id,
    programId,
    sessionId: session.id,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
