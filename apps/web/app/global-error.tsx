"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            background: "#0a0a0f",
            color: "#e5e5e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#fff",
                marginBottom: "0.5rem",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#9ca3af",
                marginBottom: "1.5rem",
              }}
            >
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.625rem 1.5rem",
                background: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.3)",
                borderRadius: "0.5rem",
                color: "#22d3ee",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
