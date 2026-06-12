import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@guide-rail/shared", "@guide-rail/ai"],
  // @guide-rail/ai dynamically loads undici at runtime to install an Agent
  // with extended headersTimeout/bodyTimeout for large Anthropic prompts.
  // The dynamic import is hidden from webpack via new Function(), so without
  // this list Next.js wouldn't include undici in the deployed serverless
  // function bundle — the runtime import would fail silently and the
  // dispatcher would never get applied. Listing it here keeps it out of
  // webpack but ensures it ships with the function.
  serverExternalPackages: ["undici"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "image.mux.com" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
