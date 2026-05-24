import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/p/(.*)",
  "/learn/(.*)",
  "/auth/(.*)",
  "/checkout/(.*)",
  "/onboarding/upgrade",
  "/api/auth/(.*)",
  "/api/webhooks/(.*)",
  "/api/promo-codes/validate",
  "/api/health",
  "/api/programs/(.*)/videos/upload", // Vercel Blob completion webhook is unauthenticated
  "/api/og/(.*)", // Public OG image renderer for ad creative previews
  "/api/checkout/(.*)", // Anonymous learners enroll by email; route handles its own auth
  "/api/progress(/.*)?", // Magic-link learners save progress; routes handle their own auth. The (/.*)? matches both /api/progress AND /api/progress/session — without it, the session sub-route is gated by Clerk and magic-link-only learners can't mark WATCH steps complete on mobile (9th-degree 2026-05-24).
  "/api/programs/(.*)/avatar", // Public creator avatar — fetched by email clients and public landing pages
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
