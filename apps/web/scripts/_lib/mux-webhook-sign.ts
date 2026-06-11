import crypto from "node:crypto";

/**
 * Build a Mux-compatible `mux-signature` header value for the given body.
 * Format: `t=<unix_seconds>,v1=<HMAC_SHA256_HEX(secret, "<t>.<body>")>`.
 *
 * Re-pass the SAME body string when POSTing — any whitespace difference will
 * invalidate the signature when Mux's SDK calls .unwrap() on the server.
 */
export function signMuxWebhook(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}
