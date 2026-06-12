import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createMagicLink, getMagicLinkUrl } from "@/lib/magic-link";
import { logger } from "@/lib/logger";
import { getTakeRateBps, computeApplicationFeeCents } from "@/lib/take-rate";
import {
  notifyAdminEnrollment,
  sendLearnerWelcomeEmail,
  sendCreatorEnrollmentEmail,
} from "@/lib/email";
import Stripe from "stripe";

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
          email: true,
          name: true,
          stripeAccountId: true,
          stripeOnboardingComplete: true,
          platformPaymentComplete: true,
          platformPromoGranted: true,
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

    notifyAdminEnrollment(
      { email: user.email, name: user.name },
      { title: program.title, id: programId },
      "promo",
    ).catch(() => {});

    // Branded welcome email + creator notification (fire-and-forget)
    sendBrandedEnrollmentEmails({
      learnerEmail: user.email,
      programId,
      creator: program.creator,
      programTitle: program.title,
    }).catch(() => {});

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

    notifyAdminEnrollment(
      { email: user.email, name: user.name },
      { title: program.title, id: programId },
      "free",
    ).catch(() => {});

    // Branded welcome email + "you got a new student" notification
    sendBrandedEnrollmentEmails({
      learnerEmail: user.email,
      programId,
      creator: program.creator,
      programTitle: program.title,
    }).catch(() => {});

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
    success_url: `${appUrl}/checkout/success?programId=${programId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/p/${program.slug}?checkout=cancelled`,
    metadata: {
      userId: user.id,
      programId: program.id,
      creatorId: program.creatorId,
    },
    // customer_email intentionally omitted — passing it triggers Stripe Link
    // to email the learner "save your card with Link" before our welcome
    // email arrives. Stripe collects the email at the hosted page; the
    // webhook still receives it via session.customer_details.email.
  };

  // Route the learner payment to the creator via Stripe Connect destination
  // charge. JourneyLine takes a 10% application fee on the destination charge;
  // grandfathered programs/creators (paid the legacy $99 fee or were promo'd)
  // get a 0% take rate forever — see lib/take-rate.ts.
  if (program.creator.stripeAccountId && program.creator.stripeOnboardingComplete) {
    const bps = getTakeRateBps({
      program: { platformFeePaid: program.platformFeePaid },
      creator: program.creator,
    });
    const applicationFeeCents = computeApplicationFeeCents(program.priceInCents, bps);

    sessionConfig.payment_intent_data = {
      transfer_data: {
        destination: program.creator.stripeAccountId,
      },
      ...(applicationFeeCents > 0 ? { application_fee_amount: applicationFeeCents } : {}),
    };

    logger.info({
      operation: "checkout.stripe_connect_enabled",
      userId: user.id,
      programId,
      creatorAccountId: program.creator.stripeAccountId,
      takeRateBps: bps,
      applicationFeeCents,
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

/**
 * Send the branded learner welcome + creator "new student" emails for free or
 * promo enrollments. Generates a fresh magic link for the welcome email so the
 * learner can re-enter from their inbox even after the immediate redirect.
 *
 * Stripe-paid enrollments handle this in the webhook so payout timing can be
 * resolved from the charge.
 */
async function sendBrandedEnrollmentEmails(args: {
  learnerEmail: string;
  programId: string;
  programTitle: string;
  creator: { id: string; email: string; name: string | null };
}): Promise<void> {
  const { token } = await createMagicLink({
    email: args.learnerEmail,
    programId: args.programId,
  });
  const magicLinkUrl = getMagicLinkUrl(token, args.programId, true);

  await Promise.allSettled([
    sendLearnerWelcomeEmail({
      learnerEmail: args.learnerEmail,
      programId: args.programId,
      magicLinkUrl,
      creator: { name: args.creator.name, email: args.creator.email },
    }),
    sendCreatorEnrollmentEmail({
      creator: args.creator,
      programTitle: args.programTitle,
      learnerEmail: args.learnerEmail,
      // No Stripe session for free/promo — variant becomes "free"
    }),
  ]);
}
