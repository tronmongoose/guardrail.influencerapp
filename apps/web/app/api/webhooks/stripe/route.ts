import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createMagicLink, getMagicLinkUrl } from "@/lib/magic-link";
import {
  sendLearnerWelcomeEmail,
  sendCreatorEnrollmentEmail,
  notifyAdminEnrollment,
} from "@/lib/email";
import { logger } from "@/lib/logger";
import { getTakeRateBps, computeApplicationFeeCents } from "@/lib/take-rate";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn({ operation: "stripe.webhook.missing_secret" });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error({ operation: "stripe.webhook.signature_failed" }, err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Legacy platform-fee sessions ($99 per-program "program_fee" + the
      // earlier account-level "platform_access"). The fee path was retired
      // when we pivoted to a 10% revenue share. Keep this branch as a logged
      // no-op so any in-flight checkout that completes after deploy doesn't
      // 500 the webhook. Creators on platformFeePaid=true and account-level
      // grandfather flags are honored at checkout time via lib/take-rate.ts.
      if (
        session.metadata?.type === "program_fee" ||
        session.metadata?.type === "platform_access"
      ) {
        logger.info({
          operation: "stripe.webhook.legacy_platform_fee_noop",
          metadataType: session.metadata.type,
          userId: session.metadata.userId,
          programId: session.metadata.programId,
          sessionId: session.id,
        });
        break;
      }

      const userId = session.metadata?.userId;
      const programId = session.metadata?.programId;

      if (!userId || !programId) {
        logger.warn({
          operation: "stripe.webhook.missing_metadata",
          sessionId: session.id,
        });
        break;
      }

      // Idempotency guard for Stripe webhook retries. Only the webhook writes
      // stripeSessionId on the entitlement, so seeing a matching sessionId
      // here means we've sent the welcome email on a prior delivery. The
      // /checkout/success auto-grant intentionally omits stripeSessionId so
      // it doesn't trip this guard.
      const priorEntitlement = await prisma.entitlement.findUnique({
        where: { userId_programId: { userId, programId } },
      });
      const alreadyProcessed =
        priorEntitlement?.status === "ACTIVE" &&
        priorEntitlement.stripeSessionId === session.id;

      // Create or update entitlement. amount_total is the source of truth
      // for what the learner actually paid — the creator dashboard reads it
      // so revenue stays accurate even if program.priceInCents is edited.
      const amountPaidCents = session.amount_total ?? 0;
      await prisma.entitlement.upsert({
        where: { userId_programId: { userId, programId } },
        create: {
          userId,
          programId,
          status: "ACTIVE",
          stripeSessionId: session.id,
          stripePaymentIntent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          amountPaidCents,
          currentWeek: 1, // Start at week 1
        },
        update: {
          status: "ACTIVE",
          stripeSessionId: session.id,
          stripePaymentIntent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          amountPaidCents,
        },
      });

      logger.info({
        operation: "stripe.webhook.entitlement_created",
        userId,
        programId,
        sessionId: session.id,
        alreadyProcessed,
      });

      if (alreadyProcessed) {
        // Skip the email block — Stripe is retrying a delivery we've already
        // handled. Entitlement upsert above is still useful as a self-heal.
        break;
      }

      // Fetch user, program, and creator for branded emails
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const program = await prisma.program.findUnique({
        where: { id: programId },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
              platformPaymentComplete: true,
              platformPromoGranted: true,
            },
          },
        },
      });

      if (user && program) {
        const grossCents = session.amount_total ?? program.priceInCents;
        const currency = session.currency || program.currency;
        const bps = getTakeRateBps({
          program: { platformFeePaid: program.platformFeePaid },
          creator: program.creator,
        });
        const platformCents = computeApplicationFeeCents(grossCents, bps);
        const creatorCents = grossCents - platformCents;

        notifyAdminEnrollment(
          { email: user.email, name: user.name },
          { title: program.title, id: programId },
          "paid",
          { grossCents, platformCents, creatorCents, currency },
          { id: program.creator.id, email: program.creator.email, name: program.creator.name },
        ).catch(() => {});

        // Generate magic link, embed in branded welcome email
        const { token } = await createMagicLink({
          email: user.email,
          programId,
        });
        const magicLinkUrl = getMagicLinkUrl(token, programId, true);

        await sendLearnerWelcomeEmail({
          learnerEmail: user.email,
          programId,
          magicLinkUrl,
          creator: { name: program.creator.name, email: program.creator.email },
        });

        // "You just got paid" — fire-and-forget, payout lookup walks Stripe
        sendCreatorEnrollmentEmail({
          creator: program.creator,
          programTitle: program.title,
          learnerEmail: user.email,
          stripeSessionId: session.id,
          fallbackAmountCents: grossCents,
          fallbackCurrency: currency,
        }).catch((err) => {
          logger.warn({
            operation: "stripe.webhook.creator_email_failed",
            programId,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        logger.info({
          operation: "stripe.webhook.welcome_emails_sent",
          userId,
          programId,
        });
      }

      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      logger.info({
        operation: "stripe.webhook.session_expired",
        sessionId: session.id,
      });
      break;
    }

    case "account.updated": {
      // Handle Stripe Connect account updates
      const account = event.data.object as Stripe.Account;
      const userId = account.metadata?.userId;

      if (userId) {
        const status = account.charges_enabled ? "active" : "pending";
        const isComplete = account.details_submitted ?? false;

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeAccountStatus: status,
            stripeOnboardingComplete: isComplete,
          },
        });

        logger.info({
          operation: "stripe.webhook.account_updated",
          userId,
          accountId: account.id,
          status,
          isComplete,
        });
      }
      break;
    }

    default:
      logger.info({
        operation: "stripe.webhook.unhandled_event",
        eventType: event.type,
      });
  }

  return NextResponse.json({ received: true });
}
