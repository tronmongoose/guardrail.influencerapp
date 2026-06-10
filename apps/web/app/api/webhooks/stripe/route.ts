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

      // Per-program platform fee (NEW path)
      if (session.metadata?.type === "program_fee") {
        const userId = session.metadata.userId;
        const programId = session.metadata.programId;
        if (!userId || !programId) {
          logger.warn({
            operation: "stripe.webhook.program_fee_missing_metadata",
            sessionId: session.id,
          });
          break;
        }
        try {
          await prisma.program.update({
            where: { id: programId },
            data: {
              platformFeePaid: true,
              platformFeeSessionId: session.id,
              platformFeePaidAt: new Date(),
            },
          });
          logger.info({
            operation: "stripe.webhook.program_fee_paid",
            userId,
            programId,
            sessionId: session.id,
          });
        } catch (err) {
          // P2002 = unique violation on platformFeeSessionId → webhook replay, safe to no-op
          logger.info({
            operation: "stripe.webhook.program_fee_replay_or_error",
            userId,
            programId,
            sessionId: session.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // Legacy account-level platform access — kept as a logged no-op for the
      // deploy window so any in-flight checkouts don't error at the webhook.
      // Existing creators with platformPaymentComplete=true stay grandfathered;
      // there's nothing to update here. Remove this branch in a follow-up.
      if (session.metadata?.type === "platform_access") {
        logger.info({
          operation: "stripe.webhook.legacy_platform_access_noop",
          userId: session.metadata.userId,
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

      // Create or update entitlement
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
          currentWeek: 1, // Start at week 1
        },
        update: {
          status: "ACTIVE",
          stripeSessionId: session.id,
          stripePaymentIntent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
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
          creator: { select: { id: true, email: true, name: true } },
        },
      });

      if (user && program) {
        notifyAdminEnrollment(
          { email: user.email, name: user.name },
          { title: program.title, id: programId },
          "paid",
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
          fallbackAmountCents: session.amount_total ?? program.priceInCents,
          fallbackCurrency: session.currency || program.currency,
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
