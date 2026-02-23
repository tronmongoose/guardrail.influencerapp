"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  ProgramBuilderSplit,
  type WeekData,
  type YouTubeVideoData,
} from "@/components/builder";
import { ProgramWizard } from "@/components/wizard/ProgramWizard";
import { SkinPicker } from "@/components/skins/SkinPicker";
import { PreviewModal } from "@/components/preview/PreviewModal";
import { getSkin } from "@/lib/skins";
import { useGenerationSteps } from "@/components/generation/useGenerationSteps";
import { GenerationSteps } from "@/components/generation/GenerationSteps";

interface StripeConnectStatus {
  connected: boolean;
  status: string | null;
  onboardingComplete: boolean;
}

interface Program {
  id: string;
  title: string;
  description: string | null;
  outcomeStatement: string | null;
  targetAudience: string | null;
  targetTransformation: string | null;
  vibePrompt: string | null;
  skinId: string;
  durationWeeks: number;
  pacingMode: "DRIP_BY_WEEK" | "UNLOCK_ON_COMPLETE";
  slug: string;
  published: boolean;
  priceInCents: number;
  videos: YouTubeVideoData[];
  drafts: { id: string; status: string; createdAt: string }[];
  weeks: WeekData[];
}

const AMBIENT_HEADERS = [
  "Great content deserves great structure",
  "Your expertise is becoming a program",
  "Turning knowledge into transformation",
  "Every lesson is being crafted with intention",
  "Building something your learners will love",
];

function GenerationProgress({ stage, progress }: { stage: string | null; progress: number }) {
  const stepsData = useGenerationSteps({ stage, progress, status: "PROCESSING" });
  const [headerIndex, setHeaderIndex] = useState(0);

  // Rotate ambient header every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderIndex((prev) => (prev + 1) % AMBIENT_HEADERS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      {/* Animated icon */}
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center generation-icon-glow">
        <svg className="w-10 h-10 text-neon-pink animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      {/* Rotating ambient header */}
      <p className="text-sm text-gray-500 mb-2 h-5 transition-opacity duration-700" key={headerIndex}>
        {AMBIENT_HEADERS[headerIndex]}
      </p>

      <h2 className="text-2xl font-bold text-white mb-3">Building your program...</h2>
      <p className="text-gray-400 mb-8">
        AI is carefully analyzing your content and crafting a structured curriculum
      </p>

      <GenerationSteps
        steps={stepsData.steps}
        activeStepIndex={stepsData.activeStepIndex}
        displayProgress={stepsData.displayProgress}
        variant="full"
      />

      <p className="text-xs text-gray-600 mt-4">
        Sit back and relax — this usually takes 20-45 seconds
      </p>
    </div>
  );
}

export default function ProgramEditPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(searchParams.get("wizard") === "true");

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<{ field: string; message: string }[] | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [showStripePrompt, setShowStripePrompt] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // Async generation tracking
  const [asyncGenerating, setAsyncGenerating] = useState(false);
  const [asyncStage, setAsyncStage] = useState<string | null>(null);
  const [asyncProgress, setAsyncProgress] = useState(0);
  const [lastGenError, setLastGenError] = useState<string | null>(null);

  const load = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 500; // ms

    try {
      const res = await fetch(`/api/programs/${id}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!res.ok) {
        // If 404 and we have retries left, wait and retry
        // (handles race condition when program was just created)
        if (res.status === 404 && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
          return load(retryCount + 1);
        }
        throw new Error("Failed to load program");
      }
      setProgram(await res.json());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Fetch Stripe status
    fetch("/api/stripe/connect")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setStripeStatus(data);
      });
    // Check if async generation is in progress or just completed
    fetch(`/api/programs/${id}/generate-async/status`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.status === "PENDING" || data.status === "PROCESSING") {
          setAsyncGenerating(true);
          setAsyncStage(data.stage);
          setAsyncProgress(data.progress || 0);
        } else if (data.status === "FAILED" && data.error) {
          setLastGenError(data.error);
        } else if (data.status === "COMPLETED" && data.completedAt) {
          // Generation finished recently - reload program to pick up persisted weeks.
          // This handles the race where the user is redirected from /new and generation
          // finishes before or just as the edit page loads.
          const completedAt = new Date(data.completedAt);
          if (Date.now() - completedAt.getTime() < 30000) {
            // Small delay to ensure persistence is fully committed
            setTimeout(() => load(), 500);
          }
        }
      });
  }, [load, id]);

  // Poll for async generation progress
  useEffect(() => {
    if (!asyncGenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/programs/${id}/generate-async/status`);
        if (!res.ok) return;
        const data = await res.json();

        setAsyncStage(data.stage);
        setAsyncProgress(data.progress || 0);

        if (data.status === "COMPLETED") {
          setAsyncGenerating(false);
          await load();
          showToast("Program generated!", "success");
        } else if (data.status === "FAILED") {
          setAsyncGenerating(false);
          showToast(data.error || "Generation failed", "error");
        }
      } catch {
        // silently retry next interval
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [asyncGenerating, id, load, showToast]);

  async function generateStructure() {
    setGenerating(true);
    setLastGenError(null);
    try {
      // Step 1: auto-structure (embeddings + clustering)
      const s1 = await fetch(`/api/programs/${id}/auto-structure`, { method: "POST" });
      if (!s1.ok) {
        const data = await s1.json().catch(() => ({}));
        const errorMsg = data.detail ? `${data.error}: ${data.detail}` : data.error || "Auto-structure failed";
        throw new Error(errorMsg);
      }

      // Step 2: generate full draft via LLM
      const s2 = await fetch(`/api/programs/${id}/generate`, { method: "POST" });
      if (!s2.ok) {
        const data = await s2.json().catch(() => ({}));
        const errorMsg = data.detail ? `${data.error}: ${data.detail}` : data.error || "Draft generation failed";
        throw new Error(errorMsg);
      }

      await load();
      showToast("Program structure generated!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function publishProgram() {
    setPublishing(true);
    setPublishErrors(null);
    try {
      const res = await fetch(`/api/programs/${id}/publish`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        // Handle Stripe requirement for paid programs
        if (data.code === "STRIPE_REQUIRED") {
          setPublishing(false);
          setShowStripePrompt(true);
          return;
        }
        if (data.validationErrors) {
          setPublishErrors(data.validationErrors);
          showToast("Please fix the issues before publishing", "error");
        } else {
          showToast(data.error || "Failed to publish program", "error");
        }
        return;
      }

      await load();
      setPublishedUrl(data.shareUrl);
      showToast("Program published!", "success");
    } catch {
      showToast("Failed to publish program", "error");
    } finally {
      setPublishing(false);
    }
  }

  async function handleSkinChange(skinId: string) {
    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId }),
      });
      if (!res.ok) throw new Error("Failed to update skin");
      await load();
      showToast("Theme updated", "success");
    } catch {
      showToast("Failed to update theme", "error");
    }
  }

  async function handlePriceChange(priceInCents: number) {
    // If setting a paid price and Stripe not connected, show the prompt
    if (priceInCents > 0 && !stripeStatus?.onboardingComplete) {
      setShowPricePicker(false);
      setShowStripePrompt(true);
      return;
    }

    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceInCents }),
      });
      if (!res.ok) throw new Error("Failed to update price");
      await load();
      showToast("Price updated", "success");
    } catch {
      showToast("Failed to update price", "error");
    }
  }

  async function handleConnectStripe() {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start Stripe onboarding");
      }
      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to connect Stripe", "error");
      setConnectingStripe(false);
    }
  }

  function formatPrice(cents: number): string {
    if (cents === 0) return "Free";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-400">Loading program...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError || !program) {
    return (
      <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-lg text-white mb-2">Failed to load program</p>
          <p className="text-sm text-gray-500 mb-4">{loadError || "Program not found"}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-gray-300 hover:border-neon-cyan transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Wizard mode
  if (showWizard) {
    return (
      <ProgramWizard
        programId={program.id}
        initialState={{
          basics: {
            title: program.title,
            description: program.description || "",
            outcomeStatement: program.outcomeStatement || "",
            targetAudience: program.targetAudience || "",
            targetTransformation: program.targetTransformation || "",
          },
          duration: {
            weeks: program.durationWeeks,
            pacingMode: program.pacingMode === "DRIP_BY_WEEK" ? "drip_by_week" : "unlock_on_complete",
          },
          content: {
            videos: program.videos,
            artifacts: [],
          },
          vibe: {
            vibePrompt: program.vibePrompt || "",
          },
        }}
        onComplete={() => {
          setShowWizard(false);
          load();
        }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <>
    {/* Preview Modal */}
    <PreviewModal
      isOpen={showPreview}
      onClose={() => setShowPreview(false)}
      program={program}
    />

    {/* Publish Confirmation Modal */}
    {showPublishConfirm && program && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Ready to publish?</h2>

          {/* Program summary checklist */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">
                <span className="text-white font-medium">{program.weeks.length}</span> week{program.weeks.length !== 1 ? "s" : ""} with{" "}
                <span className="text-white font-medium">{program.weeks.reduce((sum, w) => sum + w.sessions.length, 0)}</span> session{program.weeks.reduce((sum, w) => sum + w.sessions.length, 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">
                <span className="text-white font-medium">
                  {program.weeks.reduce((sum, w) => sum + w.sessions.reduce((s, sess) => s + sess.actions.length, 0), 0)}
                </span> total actions
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">
                Price: <span className="text-white font-medium">{program.priceInCents > 0 ? `$${(program.priceInCents / 100).toFixed(2)}` : "Free"}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">
                URL: <code className="text-neon-cyan text-xs">/p/{program.slug}</code>
              </span>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-surface-dark rounded-lg p-4 mb-6 text-sm space-y-2">
            <p className="text-gray-400">
              <span className="text-white font-medium">What happens next:</span>
            </p>
            <p className="text-gray-500">• Your program gets a public URL that anyone can visit</p>
            <p className="text-gray-500">• Learners can enroll and start working through the content</p>
            <p className="text-gray-500">• You can unpublish or edit anytime</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowPublishConfirm(false)}
              className="flex-1 px-4 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-gray-300 hover:border-gray-500 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowPublishConfirm(false);
                publishProgram();
              }}
              disabled={publishing}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-neon-cyan to-neon-pink text-surface-dark font-semibold rounded-lg hover:opacity-90 transition text-sm disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish Now"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Publish Success Modal */}
    {publishedUrl && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Program Published!</h2>
          <p className="text-gray-400 mb-6">Your program is now live and ready to share.</p>

          <div className="bg-surface-dark rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500 mb-1">Share URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-neon-cyan text-sm truncate">
                {typeof window !== "undefined" ? window.location.origin : ""}{publishedUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${publishedUrl}`);
                  showToast("URL copied!", "success");
                }}
                className="p-2 bg-surface-card border border-surface-border rounded-lg hover:border-neon-cyan transition"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPublishedUrl(null)}
              className="flex-1 px-4 py-2 bg-surface-dark border border-surface-border rounded-lg text-gray-300 hover:border-neon-cyan transition"
            >
              Continue Editing
            </button>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-neon-cyan to-neon-pink text-surface-dark font-medium rounded-lg hover:opacity-90 transition text-center"
            >
              View Live →
            </a>
          </div>
        </div>
      </div>
    )}

    {/* Publish Validation Errors Modal */}
    {publishErrors && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2 text-center">Not Ready to Publish</h2>
          <p className="text-gray-400 mb-4 text-center text-sm">Please fix these issues first:</p>

          <ul className="space-y-2 mb-6">
            {publishErrors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-neon-pink mt-0.5">•</span>
                <span className="text-gray-300">{err.message}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setPublishErrors(null)}
            className="w-full px-4 py-2 bg-surface-dark border border-surface-border rounded-lg text-gray-300 hover:border-neon-cyan transition"
          >
            Got it
          </button>
        </div>
      </div>
    )}

    {/* Stripe Connect Prompt Modal */}
    {showStripePrompt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#635BFF]/10 border border-[#635BFF]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Stripe to Get Paid</h2>
          <p className="text-gray-400 mb-6 text-sm">
            To sell your program, you&apos;ll need to connect a Stripe account. This takes just a few minutes and lets you receive payments directly.
          </p>

          <div className="bg-surface-dark rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-medium text-white mb-2">What happens next:</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Quick setup through Stripe (2-3 min)
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Receive payments directly to your bank
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Return here to publish your program
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowStripePrompt(false)}
              className="flex-1 px-4 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-gray-300 hover:border-neon-cyan transition"
            >
              Maybe later
            </button>
            <button
              onClick={handleConnectStripe}
              disabled={connectingStripe}
              className="flex-1 px-4 py-2.5 bg-[#635BFF] text-white font-medium rounded-lg hover:bg-[#5851ea] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connectingStripe ? (
                <>
                  <Spinner size="sm" />
                  Connecting...
                </>
              ) : (
                "Connect Stripe"
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="min-h-screen gradient-bg-radial grid-bg">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-surface-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xl font-bold tracking-tight text-neon-cyan neon-text-cyan hover:opacity-80 transition"
          >
            ← GuideRail
          </button>
          <div className="h-6 w-px bg-surface-border" />
          <h1 className="text-lg font-semibold text-white truncate max-w-[300px]">
            {program.title}
          </h1>
          <span
            className={`text-xs px-2 py-1 rounded font-medium ${
              program.published
                ? "bg-neon-cyan/10 text-neon-cyan"
                : "bg-surface-card text-gray-400"
            }`}
          >
            {program.published ? "Published" : "Draft"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Generation button */}
          {program.videos.length > 0 && (
            <button
              onClick={() => {
                if (program.weeks.length > 0) {
                  if (!confirm("This will replace your current structure. Continue?")) {
                    return;
                  }
                }
                generateStructure();
              }}
              disabled={generating}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-neon-pink/10 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Spinner size="sm" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {program.weeks.length > 0 ? "Regenerate" : "Generate with AI"}
                </>
              )}
            </button>
          )}

          {/* Theme picker */}
          {program.weeks.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSkinPicker(!showSkinPicker)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-surface-card text-gray-300 border border-surface-border hover:border-neon-cyan hover:text-neon-cyan transition flex items-center gap-1.5"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSkin(program.skinId).colors.accent }}
                />
                Theme
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSkinPicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSkinPicker(false)}
                  />
                  <div className="absolute right-0 mt-2 w-[500px] p-4 bg-surface-card border border-surface-border rounded-xl shadow-xl z-20">
                    <SkinPicker
                      value={program.skinId}
                      onChange={(skinId) => {
                        handleSkinChange(skinId);
                        setShowSkinPicker(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Preview button */}
          {program.weeks.length > 0 && (
            <button
              onClick={() => setShowPreview(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-surface-card text-gray-300 border border-surface-border hover:border-neon-cyan hover:text-neon-cyan transition flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          )}

          {/* Price picker */}
          {program.weeks.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowPricePicker(!showPricePicker)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-surface-card text-gray-300 border border-surface-border hover:border-neon-pink hover:text-neon-pink transition flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatPrice(program.priceInCents)}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPricePicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPricePicker(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 p-2 bg-surface-card border border-surface-border rounded-xl shadow-xl z-20">
                    <p className="text-xs text-gray-400 px-2 py-1 mb-1">Set price</p>
                    {[0, 1900, 2900, 4900, 9900, 14900, 19900].map((price) => (
                      <button
                        key={price}
                        onClick={() => {
                          handlePriceChange(price);
                          setShowPricePicker(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                          program.priceInCents === price
                            ? "bg-neon-pink/10 text-neon-pink"
                            : "text-gray-300 hover:bg-surface-dark"
                        }`}
                      >
                        {formatPrice(price)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setShowWizard(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-surface-card text-gray-300 border border-surface-border hover:border-neon-cyan hover:text-neon-cyan transition"
          >
            Wizard
          </button>

          {/* Publish button */}
          {!program.published && program.weeks.length > 0 && (
            <button
              onClick={() => setShowPublishConfirm(true)}
              disabled={publishing}
              className="text-xs px-4 py-1.5 rounded-lg font-medium bg-gradient-to-r from-neon-cyan to-neon-pink text-surface-dark hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {publishing ? (
                <>
                  <Spinner size="sm" />
                  Publishing...
                </>
              ) : (
                "Publish"
              )}
            </button>
          )}

          {program.published && (
            <a
              href={`/p/${program.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition"
            >
              View Live →
            </a>
          )}
        </div>
      </nav>

      {/* Main content - Split View Builder */}
      <main className="p-4">
        {program.weeks.length === 0 && program.videos.length === 0 ? (
          // Empty state - encourage using wizard
          <div className="max-w-lg mx-auto mt-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Let&apos;s build your program</h2>
            <p className="text-gray-400 mb-6">
              Start by adding videos and content, then let AI help you create a structured learning experience.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="btn-neon px-8 py-3 rounded-xl text-surface-dark font-semibold"
            >
              Open Program Wizard
            </button>
          </div>
        ) : program.weeks.length === 0 && asyncGenerating ? (
          // Async generation in progress - show rich staged progress
          <GenerationProgress stage={asyncStage} progress={asyncProgress} />
        ) : program.weeks.length === 0 ? (
          // Has videos but no structure yet (and no async generation running)
          <div className="max-w-lg mx-auto mt-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {lastGenError ? "Generation failed" : "Ready to generate!"}
            </h2>
            {lastGenError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-left">
                <p className="text-xs text-red-300 line-clamp-3">{lastGenError}</p>
              </div>
            )}
            <p className="text-gray-400 mb-2">
              You have {program.videos.length} video{program.videos.length !== 1 ? "s" : ""} ready.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {lastGenError
                ? "Try generating again — the previous attempt will be retried."
                : "Let AI analyze your content and create a structured program."}
            </p>
            <button
              onClick={generateStructure}
              disabled={generating}
              className="btn-neon-pink px-8 py-3 rounded-xl text-white font-semibold disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <>
                  <Spinner size="sm" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Program Structure
                </>
              )}
            </button>
          </div>
        ) : (
          // Has structure - show split builder
          <ProgramBuilderSplit
            programId={program.id}
            weeks={program.weeks}
            videos={program.videos}
            onUpdate={load}
          />
        )}
      </main>
    </div>
    </>
  );
}
