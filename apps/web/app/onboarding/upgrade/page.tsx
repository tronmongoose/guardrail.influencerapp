"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";

const PRESET_PRICES = [25, 50, 100, 500];

const FEATURES = [
  "Turn your videos into structured weekly programs",
  "Built-in payments, directly into your account — keep 100% of every sale",
  "AI-powered structure and sequencing",
  "Custom branding & themes for every program",
];

export default function UpgradePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [customPrice, setCustomPrice] = useState("");

  const envFeeCents = parseInt(process.env.NEXT_PUBLIC_PLATFORM_ACCESS_FEE_CENTS ?? "0", 10);
  const isFree = envFeeCents === 0;

  // Effective chosen amount in dollars (null = nothing selected yet, or free)
  const chosenDollars = isFree
    ? 0
    : selectedPrice !== null
    ? selectedPrice
    : customPrice !== ""
    ? parseFloat(customPrice) || null
    : null;

  const buttonLabel = (() => {
    if (isFree) return "Get Started Free";
    if (chosenDollars && chosenDollars > 0) return `Pay $${chosenDollars} & Get Started`;
    return "Select an amount to continue";
  })();

  const isButtonDisabled = loading || (!isFree && (!chosenDollars || chosenDollars <= 0));

  const handleGetStarted = async () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      if (!isFree && chosenDollars && chosenDollars > 0) {
        body.amount = chosenDollars;
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
            <h1 className="text-2xl font-bold text-gray-900">Unlock Journeyline</h1>
            <p className="text-sm text-gray-500">
              One-time payment to create and publish your programs to learners around the world.
            </p>
          </div>

          {/* Price picker */}
          {!isFree && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 text-left">Choose your amount</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_PRICES.map((price) => (
                  <button
                    key={price}
                    type="button"
                    onClick={() => {
                      setSelectedPrice(price);
                      setCustomPrice("");
                    }}
                    className={`py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                      selectedPrice === price
                        ? "bg-neon-cyan border-neon-cyan text-surface-dark"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    ${price}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Other amount"
                  value={customPrice}
                  onChange={(e) => {
                    setCustomPrice(e.target.value);
                    setSelectedPrice(null);
                  }}
                  className={`w-full pl-7 pr-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-neon-cyan/40 ${
                    customPrice !== "" && selectedPrice === null
                      ? "border-neon-cyan"
                      : "border-gray-200"
                  }`}
                />
              </div>
            </div>
          )}

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

          {/* CTA */}
          <button
            onClick={handleGetStarted}
            disabled={isButtonDisabled}
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

          {/* Back link */}
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition"
          >
            Have a promo code? Go back to onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
