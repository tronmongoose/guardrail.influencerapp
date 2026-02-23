import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createMagicLink, getMagicLinkUrl } from "@/lib/magic-link";
import { sendMagicLinkEmail } from "@/lib/email";
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

      const userId = session.metadata?.userId;
      const programId = session.metadata?.programId;

      if (!userId || !programId) {
        logger.warn({
          operation: "stripe.webhook.missing_metadata",
          sessionId: session.id,
        });
        break;
      }

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
      });

      // Fetch user and program for magic link
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const program = await prisma.program.findUnique({ where: { id: programId } });

      if (user && program) {
        // Generate and send magic link
        const { token } = await createMagicLink({
          email: user.email,
          programId,
        });
        const magicLinkUrl = getMagicLinkUrl(token, programId, true);

        await sendMagicLinkEmail(user.email, magicLinkUrl, program.title);

        logger.info({
          operation: "stripe.webhook.magic_link_sent",
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
