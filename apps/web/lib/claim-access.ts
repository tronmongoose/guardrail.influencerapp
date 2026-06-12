import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

const SESSION_RECENCY_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ClaimAccessResult =
  | {
      ok: true;
      userId: string;
      entitlementCreated: boolean;
    }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "invalid_session"
        | "not_paid"
        | "program_mismatch"
        | "stale_session"
        | "missing_user";
    };

/**
 * Validates a Stripe Checkout Session and ensures the buyer has an active
 * Entitlement for the given program. Idempotent with the webhook handler:
 * if the webhook already ran, this no-ops the entitlement work and just
 * returns the userId so the caller can set the learner cookie.
 *
 * Anti-replay guards: session must be paid, metadata.programId must match,
 * session must be < 24h old.
 */
export async function claimAccessFromStripeSession(
  sessionId: string,
  programId: string,
): Promise<ClaimAccessResult> {
  if (!isStripeConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    logger.warn({
      operation: "claim_access.stripe_retrieve_failed",
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "invalid_session" };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid" };
  }

  if (session.metadata?.programId !== programId) {
    logger.warn({
      operation: "claim_access.program_mismatch",
      sessionId,
      urlProgramId: programId,
      metadataProgramId: session.metadata?.programId,
    });
    return { ok: false, reason: "program_mismatch" };
  }

  // Anti-replay: reject if the session is stale. Stripe `created` is a Unix
  // timestamp in seconds.
  const sessionAgeMs = Date.now() - session.created * 1000;
  if (sessionAgeMs > SESSION_RECENCY_MS) {
    return { ok: false, reason: "stale_session" };
  }

  const userId = session.metadata?.userId;
  if (!userId) {
    return { ok: false, reason: "missing_user" };
  }

  // Webhook backup: upsert the entitlement in case the webhook hasn't fired
  // yet (race) or failed silently. Idempotent with the webhook's own upsert.
  const existing = await prisma.entitlement.findUnique({
    where: { userId_programId: { userId, programId } },
  });

  if (existing?.status === "ACTIVE") {
    return { ok: true, userId, entitlementCreated: false };
  }

  // Intentionally do NOT write stripeSessionId / stripePaymentIntent here.
  // The webhook is the sole writer of those fields and uses presence of a
  // matching stripeSessionId as its idempotency signal for "welcome email
  // already sent." If we wrote sessionId here, a fast success-page flow
  // would silence the webhook's email and the learner would have no email
  // to return from another device.
  //
  // amountPaidCents is safe to write — not used as an idempotency signal,
  // and the webhook will set the same value when it eventually fires.
  const amountPaidCents = session.amount_total ?? 0;
  await prisma.entitlement.upsert({
    where: { userId_programId: { userId, programId } },
    create: {
      userId,
      programId,
      status: "ACTIVE",
      amountPaidCents,
      currentWeek: 1,
    },
    update: {
      status: "ACTIVE",
      amountPaidCents,
    },
  });

  logger.info({
    operation: "claim_access.entitlement_backfilled",
    userId,
    programId,
    sessionId,
  });

  return { ok: true, userId, entitlementCreated: true };
}
