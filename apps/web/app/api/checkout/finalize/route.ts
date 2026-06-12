import { NextRequest, NextResponse } from "next/server";
import { claimAccessFromStripeSession } from "@/lib/claim-access";
import { logger } from "@/lib/logger";

const LEARNER_SESSION_COOKIE = "guiderail_learner_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days — match /auth/magic

// Stripe success_url lands here. We claim the entitlement, set the learner
// session cookie via NextResponse, then redirect to the presentational
// success page. The cookie write has to happen in a Route Handler —
// page renders cannot mutate cookies in Next 15.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const programId = url.searchParams.get("programId") ?? "";
  const sessionId = url.searchParams.get("session_id") ?? "";

  const successUrl = (granted: boolean) =>
    new URL(
      `/checkout/success?programId=${encodeURIComponent(programId)}&granted=${granted ? "1" : "0"}`,
      url.origin,
    );

  if (!programId || !sessionId) {
    return NextResponse.redirect(successUrl(false));
  }

  const result = await claimAccessFromStripeSession(sessionId, programId);

  if (!result.ok) {
    logger.warn({
      operation: "checkout.finalize.claim_failed",
      programId,
      sessionId,
      reason: result.reason,
    });
    return NextResponse.redirect(successUrl(false));
  }

  const response = NextResponse.redirect(successUrl(true));
  response.cookies.set(LEARNER_SESSION_COOKIE, result.userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  logger.info({
    operation: "checkout.finalize.access_granted",
    programId,
    sessionId,
    entitlementCreated: result.entitlementCreated,
  });

  return response;
}
