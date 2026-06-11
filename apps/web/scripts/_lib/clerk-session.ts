/**
 * Mint a Clerk session JWT that the Next.js Clerk middleware will accept as
 * the `__session` cookie.
 *
 * Flow (mirrors what Clerk's frontend JS does in a browser):
 *   1. Frontend API: PUT /v1/client          → bootstraps a Client, sets __client cookie
 *   2. Backend API:  POST /v1/sign_in_tokens → ticket for the target userId
 *   3. Frontend API: POST /v1/client/sign_ins?strategy=ticket
 *                    (with __client cookie)  → creates session, returns sessionId
 *   4. Frontend API: POST /v1/client/sessions/<sid>/tokens
 *                    (with __client cookie)  → session JWT
 *
 * Why not just Backend API for the token? POST /v1/sessions/<sid>/tokens on
 * Backend API returns a JWT, but its claims (e.g. `cat`) carry client context
 * that the middleware rejects when used as __session without the matching
 * client cookie chain. Frontend API tokens issued via the JS-style sequence
 * are the format the middleware actually accepts.
 */

import { requireEnv } from "./env";

const BACKEND_API = "https://api.clerk.com/v1";

export type ClerkSession = {
  jwt: string;
  /** Full cookie chain captured from Clerk Frontend API. Includes __client. */
  cookieChain: string;
  sessionId: string;
  userId: string;
  frontendApiHost: string;
  expiresAtMs: number;
};

function deriveFrontendApiHost(publishableKey: string): string {
  // pk_(test|live)_<base64-encoded-host>
  const match = publishableKey.match(/^pk_(test|live)_(.+)$/);
  if (!match) {
    throw new Error(
      `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is malformed: expected pk_test_* or pk_live_*`,
    );
  }
  const decoded = Buffer.from(match[2], "base64").toString("utf-8");
  return decoded.replace(/\$$/, "");
}

function collectCookieHeader(res: Response): string {
  // Use getSetCookie() (Node 18.18+) to get a proper array — headers.get()
  // collapses multiple Set-Cookie values into a single comma-joined string
  // that's ambiguous to parse. We forward ALL cookies from the sign-in
  // response to the token-mint request so Clerk recognizes us as the same
  // client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: string[] = (res.headers as any).getSetCookie?.() ?? [];
  if (arr.length === 0) {
    // Fallback for older Node: try the single header string and split on
    // comma-followed-by-cookie-name pattern (preserves cookies with dates).
    const raw = res.headers.get("set-cookie");
    if (!raw) return "";
    const parts = raw.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
    return parts.map((p) => p.split(";")[0].trim()).filter(Boolean).join("; ");
  }
  return arr.map((s) => s.split(";")[0].trim()).filter(Boolean).join("; ");
}

export async function mintClerkSession(): Promise<ClerkSession> {
  const secretKey = requireEnv("CLERK_SECRET_KEY");
  const publishableKey = requireEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const userId = requireEnv("CREATOR_TEST_CLERK_USER_ID");

  const frontendApiHost = deriveFrontendApiHost(publishableKey);
  const ua = "JourneyLine-TestHarness/1.0";

  // 1. Frontend API: bootstrap a Client. Without this, /sign_ins doesn't set
  //    __client and step 4's token call gets "Signed out".
  const clientRes = await fetch(`https://${frontendApiHost}/v1/client?_clerk_js_version=5`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": ua },
    body: "",
  });
  if (!clientRes.ok) {
    const txt = await clientRes.text().catch(() => "");
    throw new Error(`Clerk Frontend API PUT /client ${clientRes.status}: ${txt}`);
  }
  let cookies = collectCookieHeader(clientRes);

  // 2. Backend API: mint a one-shot sign-in ticket for the target userId.
  const tokenRes = await fetch(`${BACKEND_API}/sign_in_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => "");
    throw new Error(`Clerk Backend API /sign_in_tokens ${tokenRes.status}: ${txt}`);
  }
  const tokenJson = (await tokenRes.json()) as { token?: string; status?: string };
  if (!tokenJson.token) {
    throw new Error(`Clerk sign_in_tokens response missing 'token': ${JSON.stringify(tokenJson)}`);
  }
  const ticket = tokenJson.token;

  // 3. Frontend API: complete sign-in via ticket using the bootstrapped client.
  const signInRes = await fetch(`https://${frontendApiHost}/v1/client/sign_ins?_clerk_js_version=5`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: new URLSearchParams({ strategy: "ticket", ticket }).toString(),
  });
  if (!signInRes.ok) {
    const txt = await signInRes.text().catch(() => "");
    throw new Error(`Clerk Frontend API /client/sign_ins ${signInRes.status}: ${txt}`);
  }
  // Merge any new cookies (some Clerk envs rotate __client on sign-in).
  const signInCookies = collectCookieHeader(signInRes);
  if (signInCookies) cookies = signInCookies;

  const signInJson = (await signInRes.json()) as {
    response?: { status?: string; created_session_id?: string };
    client?: { sessions?: Array<{ id: string }> };
  };
  const sessionId =
    signInJson.response?.created_session_id ??
    signInJson.client?.sessions?.[0]?.id ??
    null;
  if (!sessionId) {
    throw new Error(
      `Could not extract sessionId from sign-in response: ${JSON.stringify(signInJson).slice(0, 400)}`,
    );
  }

  // 4. Frontend API: mint the session JWT against the bootstrapped client.
  //    This token is what middleware expects as __session.
  const tokensUrl = `https://${frontendApiHost}/v1/client/sessions/${sessionId}/tokens?_clerk_js_version=5`;
  const tokensRes = await fetch(tokensUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: "",
  });
  if (!tokensRes.ok) {
    const txt = await tokensRes.text().catch(() => "");
    const cookieNames = cookies.split("; ").map((c) => c.split("=")[0]).join(",");
    throw new Error(
      `Clerk Frontend API /sessions/${sessionId}/tokens ${tokensRes.status}: ${txt} (cookies: ${cookieNames || "<none>"})`,
    );
  }
  const tokensJson = (await tokensRes.json()) as { jwt?: string };
  if (!tokensJson.jwt) {
    throw new Error(
      `Clerk /tokens response missing 'jwt': ${JSON.stringify(tokensJson).slice(0, 200)}`,
    );
  }

  // Clerk session JWTs are short-lived (~60s default, refresh via /tokens).
  // For scripts we treat them as 50s-valid and let the caller re-mint if a run
  // is longer.
  return {
    jwt: tokensJson.jwt,
    cookieChain: cookies,
    sessionId,
    userId,
    frontendApiHost,
    expiresAtMs: Date.now() + 50_000,
  };
}
