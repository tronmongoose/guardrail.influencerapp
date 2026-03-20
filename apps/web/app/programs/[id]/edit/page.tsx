"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  ProgramBuilderSplit,
  type WeekData,
  type YouTubeVideoData,
  type SessionData,
} from "@/components/builder";
import { ProgramWizard } from "@/components/wizard/ProgramWizard";
import { SkinPicker } from "@/components/skins/SkinPicker";
import { getSkin, getSkinCSSVars } from "@/lib/skins";
import { ProgramOverviewPreview } from "@/components/preview/ProgramOverviewPreview";
import { SessionPreview } from "@/components/preview/SessionPreview";
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

function GenerationProgress({ stage, progress, onCancel }: { stage: string | null; progress: number; onCancel?: () => void }) {
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
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-pink-50 border border-pink-200 flex items-center justify-center generation-icon-glow">
        <svg className="w-10 h-10 text-pink-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      {/* Rotating ambient header */}
      <p className="text-sm text-gray-500 mb-2 h-5 transition-opacity duration-700" key={headerIndex}>
        {AMBIENT_HEADERS[headerIndex]}
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-3">Building your program...</h2>
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
      {onCancel && (
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-red-400 underline transition mt-2"
        >
          Cancel generation
        </button>
      )}
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
  const [activeTab, setActiveTab] = useState<"curriculum" | "settings" | "pricing" | "preview">("curriculum");
  const [previewView, setPreviewView] = useState<"overview" | "session">("overview");
  const [previewDeviceMode, setPreviewDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [previewSelectedSessionId, setPreviewSelectedSessionId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
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

  // Poll for async generation progress (max 10 minutes)
  useEffect(() => {
    if (!asyncGenerating) return;

    const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes
    const startTime = Date.now();

    const interval = setInterval(async () => {
      // Timeout: stop polling after 10 minutes
      if (Date.now() - startTime > MAX_POLL_MS) {
        clearInterval(interval);
        setAsyncGenerating(false);
        setLastGenError("Generation timed out. Please try again.");
        showToast("Generation timed out. Please try again.", "error");
        return;
      }

      try {
        const res = await fetch(`/api/programs/${id}/generate-async/status`);
        if (!res.ok) return;
        const data = await res.json();

        setAsyncStage(data.stage);
        setAsyncProgress(data.progress || 0);

        if (data.isStale) {
          setLastGenError("Generation appears to be stuck. You can cancel and retry.");
        }

        if (data.status === "COMPLETED") {
          setAsyncGenerating(false);
          await load();
          showToast("Program generated!", "success");
        } else if (data.status === "FAILED") {
          setAsyncGenerating(false);
          setLastGenError(data.error || "Generation failed");
          showToast(data.error || "Generation failed", "error");
        }
      } catch {
        // silently retry next interval
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [asyncGenerating, id, load, showToast]);

  async function cancelGeneration() {
    try {
      const res = await fetch(`/api/programs/${id}/generate-async/cancel`, { method: "POST" });
      if (res.ok) {
        setAsyncGenerating(false);
        setLastGenError("Generation was cancelled. You can try again.");
        showToast("Generation cancelled", "info");
      }
    } catch {
      showToast("Failed to cancel generation", "error");
    }
  }

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
      <div className="min-h-screen bg-white flex items-center justify-center">
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 border border-pink-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-lg text-gray-900 mb-2">Failed to load program</p>
          <p className="text-sm text-gray-500 mb-4">{loadError || "Program not found"}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-teal-400 transition"
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

  const previewSkin = getSkin(program.skinId);
  const previewCssVars = getSkinCSSVars(previewSkin);
  const previewSelectedSession = previewSelectedSessionId
    ? program.weeks.flatMap((w) => w.sessions).find((s) => s.id === previewSelectedSessionId)
    : null;

  return (
    <>
    {/* Publish Confirmation Modal */}
    {showPublishConfirm && program && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            You&apos;re about to publish your Journeyline!
          </h2>
          <p className="text-sm text-gray-400 mb-6 text-center">{program.title}</p>

          {/* Program summary */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 justify-center flex-wrap">
            <span><span className="text-gray-900 font-medium">{program.weeks.length}</span> week{program.weeks.length !== 1 ? "s" : ""}</span>
            <span className="text-gray-200">|</span>
            <span><span className="text-gray-900 font-medium">{program.weeks.reduce((sum, w) => sum + w.sessions.length, 0)}</span> sessions</span>
            <span className="text-gray-200">|</span>
            <span><span className="text-gray-900 font-medium">{program.priceInCents > 0 ? `$${(program.priceInCents / 100).toFixed(2)}` : "Free"}</span></span>
            <span className="text-gray-200">|</span>
            <code className="text-teal-600 text-xs">/p/{program.slug}</code>
          </div>

          {/* How learners will experience it */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
            <p className="text-gray-900 font-medium mb-3">How your learners will experience it</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[10px] font-bold text-teal-600 flex-shrink-0 mt-0.5">1</span>
                <p className="text-gray-400">They visit your public link and see your sales page</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[10px] font-bold text-teal-600 flex-shrink-0 mt-0.5">2</span>
                <p className="text-gray-400">{program.priceInCents > 0 ? "They complete payment via Stripe checkout" : "They enroll for free with their email"}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[10px] font-bold text-teal-600 flex-shrink-0 mt-0.5">3</span>
                <p className="text-gray-400">They receive an access link by email</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[10px] font-bold text-teal-600 flex-shrink-0 mt-0.5">4</span>
                <p className="text-gray-400">They log in with an email code and start their journey</p>
              </div>
            </div>
          </div>

          {/* After publishing */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
            <p className="text-gray-900 font-medium mb-2">After publishing</p>
            <p className="text-gray-400 mb-2">Your program remains fully editable. You can update titles, descriptions, instructions, and add new content at any time.</p>
            <p className="text-gray-500 text-xs">Just be careful removing weeks or sessions that learners may have already started.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowPublishConfirm(false)}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-300 hover:border-gray-500 transition text-sm"
            >
              Go Back
            </button>
            <button
              onClick={() => {
                setShowPublishConfirm(false);
                publishProgram();
              }}
              disabled={publishing}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-pink-500 text-gray-900 font-semibold rounded-lg hover:opacity-90 transition text-sm disabled:opacity-50"
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
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Journeyline is Live!</h2>
          <p className="text-gray-400 mb-6">Congrats! Share the link below so learners can find your program.</p>

          <div className="bg-gray-50 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500 mb-1">Share URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-teal-600 text-sm truncate">
                {typeof window !== "undefined" ? window.location.origin : ""}{publishedUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${publishedUrl}`);
                  showToast("URL copied!", "success");
                }}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:border-teal-400 transition"
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
              className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-teal-400 transition"
            >
              Continue Editing
            </button>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-500 to-pink-500 text-gray-900 font-medium rounded-lg hover:opacity-90 transition text-center"
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
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 border border-pink-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Not Ready to Publish</h2>
          <p className="text-gray-400 mb-4 text-center text-sm">Please fix these issues first:</p>

          <ul className="space-y-2 mb-6">
            {publishErrors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-pink-600 mt-0.5">•</span>
                <span className="text-gray-300">{err.message}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setPublishErrors(null)}
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-teal-400 transition"
          >
            Got it
          </button>
        </div>
      </div>
    )}

    {/* Stripe Connect Prompt Modal */}
    {showStripePrompt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#635BFF]/10 border border-[#635BFF]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Stripe to Get Paid</h2>
          <p className="text-gray-400 mb-6 text-sm">
            To sell your program, you&apos;ll need to connect a Stripe account. This takes just a few minutes and lets you receive payments directly.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-medium text-gray-900 mb-2">What happens next:</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Quick setup through Stripe (2-3 min)
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Receive payments directly to your bank
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Return here to publish your program
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowStripePrompt(false)}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-teal-400 transition"
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

    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xl font-bold tracking-tight text-gray-900 hover:text-teal-600 transition flex-shrink-0"
          >
            ←
          </button>
          <div className="h-6 w-px bg-gray-200 flex-shrink-0" />
          <button
            onClick={() => setActiveTab("settings")}
            className="text-base font-semibold text-gray-900 truncate hover:text-teal-600 transition cursor-pointer text-left"
            title="Click to edit program details"
          >
            {program.title}
          </button>
          <span
            className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
              program.published
                ? "bg-teal-50 text-teal-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {program.published ? "Published" : "Draft"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Publish / Unpublish / View Live */}
          {!program.published && program.weeks.length > 0 && (
            <button
              onClick={() => setShowPublishConfirm(true)}
              disabled={publishing}
              className="text-xs px-4 py-1.5 rounded-lg font-medium bg-gradient-to-r from-teal-500 to-pink-500 text-gray-900 hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
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
            <>
              <button
                onClick={async () => {
                  if (!confirm("Unpublish this program? Learners will no longer be able to access it via the public link.")) return;
                  try {
                    const res = await fetch(`/api/programs/${id}/unpublish`, { method: "POST" });
                    if (!res.ok) throw new Error("Failed to unpublish");
                    await load();
                    showToast("Program unpublished", "success");
                  } catch {
                    showToast("Failed to unpublish", "error");
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-white text-gray-500 border border-gray-200 hover:border-pink-400 hover:text-pink-600 transition"
              >
                Unpublish
              </button>
              <a
                href={`/p/${program.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition"
              >
                View Live →
              </a>
            </>
          )}
        </div>
      </nav>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="flex overflow-x-auto px-6">
          {(["curriculum", "settings", "pricing", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap capitalize transition border-b-2 ${
                activeTab === tab
                  ? "text-gray-900 border-teal-500"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
            >
              {tab === "curriculum" ? "Curriculum" : tab === "settings" ? "Settings" : tab === "pricing" ? "Pricing" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      {/* === Curriculum Tab === */}
      {activeTab === "curriculum" && (
        <main className="p-4">
          {program.weeks.length === 0 && program.videos.length === 0 ? (
            <div className="max-w-lg mx-auto mt-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Let&apos;s build your program</h2>
              <p className="text-gray-400 mb-6">
                Start by adding videos and content, then let AI help you create a structured learning experience.
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-pink-500 text-white font-semibold hover:opacity-90 transition"
              >
                Open Program Wizard
              </button>
            </div>
          ) : program.weeks.length === 0 && asyncGenerating ? (
            <GenerationProgress stage={asyncStage} progress={asyncProgress} onCancel={cancelGeneration} />
          ) : program.weeks.length === 0 ? (
            <div className="max-w-lg mx-auto mt-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-pink-50 border border-pink-200 flex items-center justify-center">
                <svg className="w-10 h-10 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {lastGenError ? "Generation failed" : "Ready to generate!"}
              </h2>
              {lastGenError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                  <p className="text-xs text-red-600 line-clamp-3">{lastGenError}</p>
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
                className="px-8 py-3 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-600 transition disabled:opacity-50 flex items-center gap-2 mx-auto"
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
            <ProgramBuilderSplit
              programId={program.id}
              weeks={program.weeks}
              videos={program.videos}
              onUpdate={load}
            />
          )}
        </main>
      )}

      {/* === Settings Tab === */}
      {activeTab === "settings" && (
        <div className="max-w-2xl mx-auto py-8 px-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const res = await fetch(`/api/programs/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: formData.get("title"),
                    description: formData.get("description") || null,
                    targetAudience: formData.get("targetAudience") || null,
                    targetTransformation: formData.get("targetTransformation") || null,
                    vibePrompt: formData.get("vibePrompt") || null,
                  }),
                });
                if (!res.ok) throw new Error("Failed to save");
                await load();
                showToast("Program details updated", "success");
              } catch {
                showToast("Failed to update details", "error");
              }
            }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Program Details</h2>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  name="title"
                  defaultValue={program.title}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={program.description || ""}
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target Audience</label>
                <input
                  name="targetAudience"
                  defaultValue={program.targetAudience || ""}
                  placeholder="Who is this program for?"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target Transformation</label>
                <input
                  name="targetTransformation"
                  defaultValue={program.targetTransformation || ""}
                  placeholder="What will learners achieve?"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">AI Vibe Prompt</label>
                <textarea
                  name="vibePrompt"
                  defaultValue={program.vibePrompt || ""}
                  rows={2}
                  placeholder="How should the AI write? (only affects re-generation)"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>
              {program.published && (
                <p className="text-xs text-gray-500">
                  Slug: <code className="text-teal-600">/p/{program.slug}</code> — frozen after publish
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Theme</h2>
              <SkinPicker value={program.skinId} onChange={handleSkinChange} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              {program.videos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (program.weeks.length > 0) {
                      if (!confirm("This will replace your current structure. Continue?")) return;
                    }
                    generateStructure();
                    setActiveTab("curriculum");
                  }}
                  disabled={generating}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100 transition disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Spinner size="sm" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {program.weeks.length > 0 ? "Regenerate Program" : "Generate with AI"}
                    </>
                  )}
                </button>
              )}
              <button
                type="submit"
                className="ml-auto px-5 py-2 bg-gradient-to-r from-teal-500 to-pink-500 text-gray-900 font-semibold rounded-lg hover:opacity-90 transition text-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* === Pricing Tab === */}
      {activeTab === "pricing" && (
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Price</h2>
              <p className="text-sm text-gray-400 mb-4">Choose how much to charge for your program</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1900, 2900, 4900, 9900, 14900, 19900].map((price) => (
                <button
                  key={price}
                  onClick={() => handlePriceChange(price)}
                  className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition ${
                    program.priceInCents === price
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  }`}
                >
                  {formatPrice(price)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Payments</h2>
            <p className="text-sm text-gray-400">Connect Stripe to receive payments for paid programs</p>
            {stripeStatus?.onboardingComplete ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
                <svg className="w-5 h-5 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-teal-700 font-medium">Stripe connected</span>
              </div>
            ) : (
              <div className="bg-[#635BFF]/5 border border-[#635BFF]/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#635BFF]/10 border border-[#635BFF]/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Connect Stripe</p>
                    <p className="text-xs text-gray-400">Required to sell paid programs</p>
                  </div>
                </div>
                <button
                  onClick={handleConnectStripe}
                  disabled={connectingStripe}
                  className="w-full px-4 py-2.5 bg-[#635BFF] text-white font-medium rounded-lg hover:bg-[#5851ea] transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {connectingStripe ? (
                    <>
                      <Spinner size="sm" />
                      Connecting...
                    </>
                  ) : (
                    "Connect Stripe →"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Preview Tab === */}
      {activeTab === "preview" && (
        program.weeks.length > 0 ? (
          <div className="flex flex-col" style={{ height: "calc(100vh - 112px)" }}>
            {/* Preview toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Preview</span>
                <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-500">
                  {previewSkin.name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewView("overview")}
                    className={`px-3 py-1 text-xs rounded transition ${
                      previewView === "overview" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setPreviewView("session")}
                    disabled={!previewSelectedSessionId}
                    className={`px-3 py-1 text-xs rounded transition ${
                      previewView === "session" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white disabled:opacity-50"
                    }`}
                  >
                    Session
                  </button>
                </div>
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewDeviceMode("desktop")}
                    className={`p-1.5 rounded transition ${previewDeviceMode === "desktop" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}
                    title="Desktop view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPreviewDeviceMode("mobile")}
                    className={`p-1.5 rounded transition ${previewDeviceMode === "mobile" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}
                    title="Mobile view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {/* Preview frame */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-gray-900">
              <div
                className={`h-full overflow-auto transition-all ${previewDeviceMode === "desktop" ? "w-full max-w-5xl" : "w-[375px]"}`}
                style={{
                  ...previewCssVars,
                  backgroundColor: previewSkin.colors.bg,
                  borderRadius: previewDeviceMode === "mobile" ? "24px" : "8px",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                }}
              >
                {previewView === "overview" ? (
                  <ProgramOverviewPreview
                    program={program}
                    skin={previewSkin}
                    onSelectSession={(sessionId) => {
                      setPreviewSelectedSessionId(sessionId);
                      setPreviewView("session");
                    }}
                  />
                ) : previewSelectedSession ? (
                  <SessionPreview
                    session={previewSelectedSession as SessionData & { keyTakeaways?: string[] }}
                    skin={previewSkin}
                    onBack={() => {
                      setPreviewView("overview");
                      setPreviewSelectedSessionId(null);
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p style={{ color: previewSkin.colors.textMuted }}>Select a session from the overview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto mt-16 text-center">
            <p className="text-gray-400">Build your curriculum first to preview your program.</p>
          </div>
        )
      )}

    </div>
    </>
  );
}
