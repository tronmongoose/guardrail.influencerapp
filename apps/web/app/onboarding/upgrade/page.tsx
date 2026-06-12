"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const BENEFITS = [
  "Publishing your program is free — no upfront fee.",
  "JourneyLine takes 10% of each learner purchase; you keep 90%.",
  "Payouts arrive in your Stripe account about 2 days after each sale.",
  "AI-powered structure, custom branding, and built-in payments included.",
];

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradePageInner />
    </Suspense>
  );
}

function UpgradePageInner() {
  const searchParams = useSearchParams();
  const fromProgramId = searchParams.get("from");
  const backHref = fromProgramId
    ? `/programs/${fromProgramId}/edit`
    : "/dashboard";
  const backLabel = fromProgramId ? "Back to your program" : "Go to dashboard";

  return (
    <div className="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center px-4 pt-10 sm:pt-0">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-neon-cyan/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Publishing is on us</h1>
            <p className="text-sm text-gray-500">
              JourneyLine earns when you earn — a flat 10% revenue share on each sale.
            </p>
          </div>

          <ul className="text-sm text-gray-600 space-y-2 text-left">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <Link
            href={backHref}
            className="w-full inline-block btn-neon py-3 rounded-xl text-surface-dark font-semibold"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
