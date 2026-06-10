import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { isPlatformFeeExempt } from "@/lib/platform-fee";

export async function POST(req: Request) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body: from (REQUIRED programId). Per-program billing means every
    // payment attaches to a specific Program. The fee amount is locked to
    // PLATFORM_ACCESS_FEE_CENTS server-side — clients can't override it.
    let fromProgramId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body.from === "string" && body.from.length > 0) {
        fromProgramId = body.from;
      }
    } catch {
      // no body is fine
    }

    if (!fromProgramId) {
      return NextResponse.json(
        { error: "Missing program context. Open the program edit page and click Publish to start checkout." },
        { status: 400 }
      );
    }

    // Authorize: program must exist and be owned by the requesting user
    const program = await prisma.program.findUnique({
      where: { id: fromProgramId },
      select: { id: true, creatorId: true, platformFeePaid: true },
    });
    if (!program || program.creatorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const accessRedirect = `/programs/${fromProgramId}/edit?wizard=true&platform_access=success`;

    // Already paid for this program OR creator is exempt — short-circuit.
    const grandfathered = user.platformPaymentComplete || user.platformPromoGranted;
    const exempt = isPlatformFeeExempt(user.email) || grandfathered;
    if (program.platformFeePaid || exempt) {
      return NextResponse.json({ redirectUrl: accessRedirect });
    }

    const feeCents = parseInt(process.env.PLATFORM_ACCESS_FEE_CENTS ?? "0", 10);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // If fee is 0 or Stripe not configured, flip the program flag directly
    if (feeCents === 0 || !isStripeConfigured()) {
      await prisma.program.update({
        where: { id: fromProgramId },
        data: { platformFeePaid: true, platformFeePaidAt: new Date() },
      });
      logger.info({ operation: "platform.checkout.free_grant", userId: user.id, programId: fromProgramId });
      return NextResponse.json({ redirectUrl: accessRedirect });
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: feeCents,
            product_data: {
              name: "Journeyline Program Publish Fee",
              description: "One-time fee to publish this program",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/programs/${fromProgramId}/edit?wizard=true&platform_access=success`,
      cancel_url: `${appUrl}/onboarding/upgrade?from=${fromProgramId}`,
      customer_email: user.email,
      metadata: {
        type: "program_fee",
        userId: user.id,
        programId: fromProgramId,
      },
    });

    logger.info({
      operation: "platform.checkout.session_created",
      userId: user.id,
      programId: fromProgramId,
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
