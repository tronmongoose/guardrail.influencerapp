"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-neon-pink"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-400 mb-6 text-sm">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-surface-card border border-surface-border rounded-lg text-gray-300 hover:border-neon-cyan hover:text-neon-cyan transition text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 transition"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
