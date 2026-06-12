"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";

const FEATURES = [
  "Turn your videos into structured paced programs",
  "Built-in payments, directly into your account — keep 100% of every sale",
  "AI-powered structure and sequencing",
  "Custom branding & themes for every program",
];

export default function UpgradePage() {
  // useSearchParams (used inside UpgradePageInner) requires a Suspense
  // boundary in Next 15 prerender — without it the prod build fails with
  // "useSearchParams() should be wrapped in a suspense boundary".
  return (
    <Suspense fallback={null}>
      <UpgradePageInner />
    </Suspense>
  );
}

function UpgradePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Wizard appends `?from=<programId>` when redirecting here on
  // PLATFORM_ACCESS_REQUIRED so we can route the creator back to their
  // in-progress program after access is granted instead of dumping them
  // on /dashboard.
  const fromProgramId = searchParams.get("from");
  const { isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const envFeeCents = parseInt(process.env.NEXT_PUBLIC_PLATFORM_ACCESS_FEE_CENTS ?? "0", 10);
  const isFree = envFeeCents === 0;
  const feeDollars = Math.round(envFeeCents / 100);

  const buttonLabel = isFree
    ? "Get Started Free"
    : `Pay $${feeDollars} to publish this program`;

  const handleGetStarted = async () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      if (fromProgramId) {
        body.from = fromProgramId;
      }

      const res = await fetch("/api/platform/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data: { redirectUrl?: string; checkoutUrl?: string; error?: string } = {};
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Unexpected server response. Please try again.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      const destination = data.redirectUrl || data.checkoutUrl;
      if (destination) {
        window.location.href = destination;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center px-4 pt-10 sm:pt-0">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-neon-cyan/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Publish your Journeyline</h1>
            {!isFree && (
              <p className="text-4xl font-bold text-gray-900 pt-2">${feeDollars}</p>
            )}
            <p className="text-sm text-gray-500">
              One-time fee to publish this program to learners around the world.
            </p>
          </div>

          {/* Features */}
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {/* Payout timing note */}
          <p className="text-xs text-gray-500 text-left">
            Payments hit your account about 2 days after a learner pays for your Journeyline.
          </p>

          {/* CTA */}
          <button
            onClick={handleGetStarted}
            disabled={loading}
            className="w-full btn-neon py-3 rounded-xl text-surface-dark font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner size="sm" color="pink" />
                Processing...
              </>
            ) : (
              buttonLabel
            )}
          </button>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <p className="text-xs text-gray-400 pt-2">
            Have a discount code? Apply it on the next page at checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
