"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const programId = searchParams.get("programId");

  return (
    <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-neon-cyan"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Payment Successful!
          </h1>

          <p className="text-gray-400 mb-6">
            Thank you for your purchase. We&apos;ve sent an access link to your
            email address. Check your inbox to start learning!
          </p>

          <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-300">
              <strong className="text-neon-cyan">Next step:</strong> Check your
              email for an access link to your program. The link is valid for 24
              hours.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            {programId && (
              <Link
                href={`/learn/${programId}`}
                className="px-6 py-3 bg-gradient-to-r from-neon-cyan to-neon-pink text-surface-dark rounded-lg font-medium hover:opacity-90 transition"
              >
                Go to Program
              </Link>
            )}
            <Link
              href="/"
              className="px-6 py-3 bg-surface-dark border border-surface-border text-gray-300 rounded-lg font-medium hover:border-neon-cyan hover:text-neon-cyan transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
