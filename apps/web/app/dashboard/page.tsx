"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Suspense, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { ProgramListItem } from "@guide-rail/shared";

interface GenerationJob {
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: string | null;
  progress: number;
}

interface ProgramWithGeneration extends ProgramListItem {
  generationJob?: GenerationJob | null;
}

interface Metrics {
  totalEnrollments: number;
  totalRevenueCents: number;
  programViews: number;
}

function getGreeting(firstName: string | null | undefined): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const name = firstName?.trim() ? `, ${firstName.trim()}` : "";
  return `Good ${time}${name}`;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRevenue(cents: number): string {
  if (cents === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0f" }}>
          <div className="text-gray-400">Loading...</div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: clerkUser, isLoaded } = useUser();
  const { showToast } = useToast();
  const [programs, setPrograms] = useState<ProgramWithGeneration[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("stripe") === "success") {
      showToast("Stripe connected! You can now set prices for your programs.", "success");
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser) {
      router.push("/");
      return;
    }

    Promise.all([
      fetch("/api/programs").then((r) => r.json()),
      fetch("/api/user/onboarding").then((r) => r.json()),
      fetch("/api/user/metrics").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([programsData, userData, metricsData]) => {
        // Platform access gate
        const hasAccess = userData.platformPromoGranted || userData.platformPaymentComplete;
        if (!hasAccess) {
          router.push("/onboarding/upgrade");
          return;
        }

        if (
          (!Array.isArray(programsData) || programsData.length === 0) &&
          !userData.onboardingComplete
        ) {
          router.push("/new");
          return;
        }
        setPrograms(Array.isArray(programsData) ? programsData : []);
        if (metricsData) setMetrics(metricsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isLoaded, clerkUser, router]);

  const handleCreateProgram = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/programs/create", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create program");
      }
      const program = await res.json();
      router.push(`/programs/${program.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create program");
      setCreating(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0f" }}>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const metricPills = [
    {
      label: "Enrollments",
      value: metrics ? String(metrics.totalEnrollments) : "—",
    },
    {
      label: "Revenue",
      value: metrics ? formatRevenue(metrics.totalRevenueCents) : "—",
    },
    {
      label: "Program views",
      value: metrics ? String(metrics.programViews) : "—",
    },
  ];

  return (
    <>
    <style>{`body { background-color: #0a0a0f !important; }`}</style>
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0f" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-4 border-b border-white/10" style={{ backgroundColor: "#0a0a0f" }}>
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-white"
        >
          Journeyline
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/settings"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Settings
          </Link>
          <UserButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Header: greeting + metrics + New Program button ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            <h1 className="text-[28px] font-semibold text-white leading-tight">
              {getGreeting(clerkUser?.firstName)}
            </h1>

            {/* Metric pills */}
            <div className="flex gap-3">
              {metricPills.map((pill) => (
                <div
                  key={pill.label}
                  className="flex-1 min-w-[100px] rounded-xl px-4 py-3" style={{ backgroundColor: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="text-lg font-semibold text-neon-cyan leading-none mb-1">
                    {pill.value}
                  </p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{pill.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* New Program */}
          <button
            onClick={handleCreateProgram}
            disabled={creating}
            className="flex-shrink-0 btn-neon px-4 py-2.5 rounded-xl text-surface-dark text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? "Creating…" : "+ New Program"}
          </button>
        </div>

        {/* ── Programs ── */}
        <div className="space-y-3">
          {programs.length === 0 ? (
            /* Empty state */
            <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center" style={{ backgroundColor: "#111118" }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#1a1a24" }}>
                <svg
                  className="w-7 h-7 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Build your first program
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                Turn your videos into a structured learning experience with AI-powered curriculum design.
              </p>
              <button
                onClick={handleCreateProgram}
                disabled={creating}
                className="btn-neon px-6 py-2.5 rounded-xl text-surface-dark text-sm font-semibold disabled:opacity-50"
              >
                {creating ? "Creating…" : "+ New Program"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {programs.map((p) => {
                const timeAgo = getTimeAgo(new Date(p.updatedAt));
                const isGenerating =
                  p.generationJob?.status === "PENDING" ||
                  p.generationJob?.status === "PROCESSING";
                const generationFailed = p.generationJob?.status === "FAILED";
                const initial = p.title.trim()[0]?.toUpperCase() ?? "P";

                return (
                  <Link
                    key={p.id}
                    href={`/programs/${p.id}/edit`}
                    className="flex items-center gap-4 rounded-xl p-4 hover:border-neon-cyan/40 transition-all hover:-translate-y-0.5 group" style={{ backgroundColor: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {/* Thumbnail placeholder */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1a1a24" }}>
                      <span className="text-lg font-bold text-neon-cyan select-none">
                        {initial}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <h2 className="text-[17px] font-medium text-white truncate leading-snug">
                          {p.title}
                        </h2>
                        {isGenerating ? (
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-neon-pink/10 text-neon-pink border border-neon-pink/30 flex items-center gap-1">
                            <svg
                              className="w-3 h-3 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            {p.generationJob?.progress}%
                          </span>
                        ) : generationFailed ? (
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                            Failed
                          </span>
                        ) : (
                          <span
                            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.published
                                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                                : "bg-white/5 text-gray-400 border border-white/10"
                            }`}
                          >
                            {p.published ? "Published" : "Draft"}
                          </span>
                        )}
                        {p.priceInCents > 0 && (
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                            {formatPrice(p.priceInCents)}
                          </span>
                        )}
                      </div>

                      {isGenerating && (
                        <div className="mb-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink transition-all"
                            style={{ width: `${p.generationJob?.progress || 0}%` }}
                          />
                        </div>
                      )}

                      <p className="text-xs text-gray-400">
                        {p._count.weeks} week{p._count.weeks !== 1 ? "s" : ""}
                        {" · "}
                        {p._count.videos} video{p._count.videos !== 1 ? "s" : ""}
                        {" · "}
                        {timeAgo}
                      </p>
                    </div>

                    {/* Share */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!p.slug) return;
                          const url = `${window.location.origin}/p/${p.slug}`;
                          navigator.clipboard.writeText(url).then(() => {
                            setCopiedId(p.id);
                            setTimeout(() => setCopiedId(null), 1500);
                          });
                        }}
                        className="p-1 text-gray-500 hover:text-teal-400 transition-colors"
                        aria-label="Copy link"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                        </svg>
                      </button>
                      {copiedId === p.id && (
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap pointer-events-none" style={{ backgroundColor: "#1a1a24", border: "1px solid rgba(255,255,255,0.15)" }}>
                          Copied!
                        </span>
                      )}
                    </div>

                    {/* Arrow */}
                    <span className="flex-shrink-0 text-gray-300 group-hover:text-neon-cyan transition text-lg leading-none">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
