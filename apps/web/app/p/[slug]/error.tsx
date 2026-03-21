"use client";

import { useEffect } from "react";

export default function ProgramPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Program page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-white mb-2">This page isn&apos;t available</h1>
        <p className="text-gray-400 mb-6 text-sm">
          There was a problem loading this program. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 transition text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 transition text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
