import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

// Synchronous payment confirmation called from the success_url. Closes the
// race between Stripe's redirect and the checkout.session.completed webhook —
// without this, the edit page's auto-fire publish can run before the webhook
// has flipped Program.platformFeePaid, bouncing the creator back to the
// paywall after they've already paid.
//
// Idempotent with the webhook: both attempt the same Program.update, and the
// unique constraint on platformFeeSessionId makes the second one a no-op.
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }

  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sessionId = "";
  try {
    const body = await req.json();
    sessionId = typeof body.session_id === "string" ? body.session_id : "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.type !== "program_fee") {
      return NextResponse.json({ error: "Session not a program fee" }, { status: 400 });
    }

    const programId = session.metadata.programId;
    const sessionUserId = session.metadata.userId;
    if (!programId || sessionUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // "paid" for a real charge, "no_payment_required" for 100%-off coupons.
    const isPaid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
    if (!isPaid) {
      return NextResponse.json(
        { error: "Payment not complete", payment_status: session.payment_status },
        { status: 402 }
      );
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
        operation: "platform.checkout.confirm.success",
        userId: user.id,
        programId,
        sessionId,
      });
    } catch {
      // P2002 (unique on platformFeeSessionId) = webhook already applied.
      logger.info({
        operation: "platform.checkout.confirm.already_applied",
        userId: user.id,
        programId,
        sessionId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ operation: "platform.checkout.confirm.error" }, err);
    return NextResponse.json(
      { error: "Could not confirm payment" },
      { status: 500 }
    );
  }
}
