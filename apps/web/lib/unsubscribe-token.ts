import crypto from "crypto";

/**
 * Stateless unsubscribe tokens: HMAC(userId) with a server secret, so the
 * footer link works without storing per-email tokens. Falls back to CRON_SECRET
 * if a dedicated UNSUBSCRIBE_SECRET is not set.
 */
function secret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.CRON_SECRET ||
    "journeyline-insecure-dev-secret"
  );
}

export function makeUnsubToken(userId: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubToken(userId: string, token: string): boolean {
  const expected = makeUnsubToken(userId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
