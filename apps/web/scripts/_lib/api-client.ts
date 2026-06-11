import type { ClerkSession } from "./clerk-session";
import { mintClerkSession } from "./clerk-session";

export type ApiClient = {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
  putBytes(absoluteUrl: string, bytes: Buffer, contentType: string, timeoutMs?: number): Promise<void>;
};

export function createApiClient(opts: { baseUrl: string }): ApiClient {
  let session: ClerkSession | null = null;

  async function getSession(): Promise<ClerkSession> {
    if (session && Date.now() < session.expiresAtMs) return session;
    session = await mintClerkSession();
    return session;
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const s = await getSession();
    const url = `${opts.baseUrl}${path}`;
    // Send the JWT as Bearer (works for API routes via Clerk's machine-auth
    // path), plus the cookie chain (__client + __session) as a belt-and-
    // braces fallback for cookie-only verification.
    const cookieParts = [`__session=${s.jwt}`];
    if (s.cookieChain) cookieParts.push(s.cookieChain);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${s.jwt}`,
      Cookie: cookieParts.join("; "),
    };
    let init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init = { ...init, body: JSON.stringify(body) };
    }
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body ?? {}),
    patch: (path, body) => request("PATCH", path, body ?? {}),
    delete: (path) => request("DELETE", path),
    async putBytes(absoluteUrl, bytes, contentType, timeoutMs = 10 * 60_000) {
      // Mux direct uploads — no auth header, raw bytes, Content-Type matters.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        // Wrap in Blob to dodge the Uint8Array<ArrayBufferLike> vs
        // Uint8Array<ArrayBuffer> variance issue with the DOM lib's BodyInit.
        const blob = new Blob([new Uint8Array(bytes)], { type: contentType });
        const res = await fetch(absoluteUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
          signal: controller.signal,
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`PUT ${absoluteUrl} → ${res.status}: ${txt.slice(0, 300)}`);
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
