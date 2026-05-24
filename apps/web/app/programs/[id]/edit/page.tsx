"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  ProgramBuilderSplit,
  type WeekData,
  type YouTubeVideoData,
  type SessionData,
} from "@/components/builder";
import { ProgramWizard } from "@/components/wizard/ProgramWizard";
import { SkinSidebar } from "@/components/skins/SkinSidebar";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { getSkinCatalogEntry } from "@/lib/skin-bundles/catalog";
import type { SkinTokens } from "@guide-rail/shared";
import { tokensToSkin, getTokenCSSVars } from "@/lib/skin-bridge";
import { getSkinDecorations, getHeadingEffectStyle, resolveColorKey } from "@/lib/skin-decorations";
import { getPatternCSS } from "@/lib/decoration-patterns";
import { ProgramOverviewPreview } from "@/components/preview/ProgramOverviewPreview";
import { SessionPreview } from "@/components/preview/SessionPreview";
import { CreatorAvatarUpload } from "@/components/builder/CreatorAvatarUpload";
import { useGenerationSteps } from "@/components/generation/useGenerationSteps";
import { GenerationSteps } from "@/components/generation/GenerationSteps";
import { useGeneration } from "@/components/generation/GenerationProvider";
import { createStripeLoginLink } from "@/app/actions/stripe";

interface StripeConnectStatus {
  connected: boolean;
  status: string | null;
  onboardingComplete: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

interface PromoCodeItem {
  id: string;
  code: string;
  programId: string | null;
  program: { title: string } | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: string | null;
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
  customSkinId: string | null;
  customSkin: { id: string; tokens: unknown } | null;
  transitionMode: "NONE" | "SIMPLE" | "BRANDED";
  creatorAvatarUrl: string | null;
  durationWeeks: number;
  pacingMode: "DRIP_BY_WEEK" | "UNLOCK_ON_COMPLETE";
  followUploadOrder: boolean;
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

function GenerationProgress({ stage, progress, onCancel, creatorEmail, programTitle }: { stage: string | null; progress: number; onCancel?: () => void; creatorEmail?: string; programTitle?: string }) {
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
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-pink-900/30 border border-pink-700/50 flex items-center justify-center generation-icon-glow">
        <svg className="w-10 h-10 text-pink-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      {/* Rotating ambient header */}
      <p className="text-sm text-gray-500 mb-2 h-5 transition-opacity duration-700" key={headerIndex}>
        {AMBIENT_HEADERS[headerIndex]}
      </p>

      <h2 className="text-2xl font-bold text-white mb-3">
        {programTitle ? `Building "${programTitle}"` : "Building your program..."}
      </h2>
      <p className="text-gray-400 mb-8">
        We&apos;re hard at work crafting your incredible journeyline! Feel free to navigate elsewhere — we&apos;ll email you when it&apos;s ready.
      </p>

      <GenerationSteps
        steps={stepsData.steps}
        activeStepIndex={stepsData.activeStepIndex}
        displayProgress={stepsData.displayProgress}
        variant="full"
      />

      {/* Async messaging */}
      <div className="mt-6">
        {creatorEmail && (
          <p className="text-sm text-gray-500 mt-1">
            We&apos;ll email <span className="text-gray-300">{creatorEmail}</span> when it&apos;s ready.
          </p>
        )}
      </div>
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
  const { activeGenerations, dismissGeneration } = useGeneration();
  const { user } = useUser();
  const creatorEmail = user?.primaryEmailAddress?.emailAddress;

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // If the upgrade flow sent the creator back with platform_access=success,
  // they've already gone through the wizard once. Skip showing it again —
  // we'll auto-fire generation from the effect below. Without this guard the
  // wizard re-mounts fresh at step 0 and forces them to click through Basics
  // → Content → ... → Create all over again.
  const platformAccessSuccess = searchParams.get("platform_access") === "success";
  const [showWizard, setShowWizard] = useState(
    searchParams.get("wizard") === "true" && !platformAccessSuccess,
  );
  const wizardDismissedRef = useRef(platformAccessSuccess);
  const platformAccessAutoFiredRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"details" | "curriculum" | "payments" | "preview">("details");
  const [previewView, setPreviewView] = useState<"overview" | "session">("overview");
  const [previewDeviceMode, setPreviewDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [previewSelectedSessionId, setPreviewSelectedSessionId] = useState<string | null>(null);
  const [skinSidebarOpen, setSkinSidebarOpen] = useState(true);
  const [hoveredSkinId, setHoveredSkinId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<{ field: string; message: string }[] | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [showStripePrompt, setShowStripePrompt] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [openingStripeDashboard, setOpeningStripeDashboard] = useState(false);
  const payoutCardRef = useRef<HTMLDivElement | null>(null);

  // Promo codes for this program
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [promoCodesLoaded, setPromoCodesLoaded] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoMaxUses, setNewPromoMaxUses] = useState("");
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [deletePromoId, setDeletePromoId] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  // Async generation tracking
  const [asyncGenerating, setAsyncGenerating] = useState(false);
  const [genStatusChecked, setGenStatusChecked] = useState(false); // true once the status API call has resolved
  const [asyncStage, setAsyncStage] = useState<string | null>(null);
  const [asyncProgress, setAsyncProgress] = useState(0);
  const [lastGenError, setLastGenError] = useState<string | null>(null);
  const [isProgramDetailsOpen, setIsProgramDetailsOpen] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Controlled state for program details form fields — synced from `program` whenever it loads/reloads
  const [detailsTitle, setDetailsTitle] = useState("");
  const [detailsDescription, setDetailsDescription] = useState("");
  const [detailsTargetAudience, setDetailsTargetAudience] = useState("");
  const [detailsTargetTransformation, setDetailsTargetTransformation] = useState("");
  const [detailsVibePrompt, setDetailsVibePrompt] = useState("");

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
      const data = await res.json();
      setProgram(data);
      setDetailsTitle(data.title ?? "");
      setDetailsDescription(data.description ?? "");
      setDetailsTargetAudience(data.targetAudience ?? "");
      setDetailsTargetTransformation(data.targetTransformation ?? "");
      setDetailsVibePrompt(data.vibePrompt ?? "");
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load promo codes when settings tab opens
  useEffect(() => {
    if (activeTab !== "payments" || promoCodesLoaded) return;
    fetch("/api/promo-codes")
      .then(r => r.ok ? r.json() : [])
      .then((data: PromoCodeItem[]) => {
        setPromoCodes(Array.isArray(data) ? data : []);
        setPromoCodesLoaded(true);
      })
      .catch(() => setPromoCodesLoaded(true));
  }, [activeTab, promoCodesLoaded]);

  useEffect(() => {
    load();
    // Fetch Stripe status
    fetch("/api/stripe/connect")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setStripeStatus(data);
      });
    // Check if async generation is in progress or just completed.
    // genStatusChecked stays false until this resolves, preventing "Ready to generate!" from
    // showing prematurely while we don't yet know whether generation is actually in progress.
    fetch(`/api/programs/${id}/generate-async/status`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.status === "PENDING" || data?.status === "PROCESSING") {
          // Stuck job: background task likely died without writing FAILED. Surface
          // the failed-panel + retry button instead of starting polling that will
          // never resolve (and instead of falling through and re-opening the wizard).
          if (data.isStale) {
            setLastGenError("Generation appears to have stalled. Please try again.");
          } else {
            setAsyncGenerating(true);
            setAsyncStage(data.stage);
            setAsyncProgress(data.progress || 0);
          }
        } else if (data?.status === "FAILED") {
          // Always set lastGenError — even if `error` is null/empty — so the auto-wizard
          // effect doesn't fire and silently re-throw the user back into the wizard.
          setLastGenError(data.error || "Generation failed without an error message. Please try again.");
        } else if (data?.status === "COMPLETED" && data.completedAt) {
          // Generation finished recently - reload program to pick up persisted weeks.
          const completedAt = new Date(data.completedAt);
          if (Date.now() - completedAt.getTime() < 30000) {
            setTimeout(() => load(), 500);
          }
        }
      })
      .finally(() => setGenStatusChecked(true));
  }, [load, id]);

  // Handle return from Stripe Connect onboarding (and direct ?tab=payments deep links).
  // Stripe sends the creator back here via the URLs configured in /api/stripe/connect.
  useEffect(() => {
    const tab = searchParams.get("tab");
    const stripeFlag = searchParams.get("stripe");

    if (tab === "payments") {
      setActiveTab("payments");
    }

    if (stripeFlag === "success") {
      showToast("Bank connected — you're ready to start earning.", "success");
      // Webhook may have just flipped onboardingComplete — re-fetch live status.
      fetch("/api/stripe/connect")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setStripeStatus(data); })
        .catch(() => {});
    } else if (stripeFlag === "refresh") {
      showToast("Your progress is saved. Jump back in when you're ready.", "warning");
      // Defer scroll until after the Payments tab has rendered.
      setTimeout(() => {
        payoutCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }

    if (stripeFlag === "success" || stripeFlag === "refresh" || tab === "payments") {
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
    // Run once on mount with the initial query string. We intentionally don't
    // depend on searchParams — re-firing on every URL change would re-toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for generation-complete event dispatched by GenerationNotification when on this page.
  // This fires load() even when asyncGenerating is false (e.g. status was already COMPLETED on mount).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ programId: string }>).detail;
      if (detail.programId === id) load();
    };
    window.addEventListener("generation-complete", handler);
    return () => window.removeEventListener("generation-complete", handler);
  }, [id, load]);

  // Bridge activeGenerations → asyncGenerating so polling starts when the wizard triggers generation.
  // Guards with genStatusChecked to avoid interfering with the initial status-check path.
  useEffect(() => {
    if (activeGenerations.includes(id) && !asyncGenerating && genStatusChecked) {
      setAsyncGenerating(true);
    }
  }, [activeGenerations, id, asyncGenerating, genStatusChecked]);

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
        if (res.status === 404) {
          clearInterval(interval);
          setAsyncGenerating(false);
          dismissGeneration(id);
          setLastGenError("Generation ended unexpectedly. Please try again.");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();

        setAsyncStage(data.stage);
        setAsyncProgress(data.progress || 0);

        if (data.isStale) {
          setLastGenError("Generation appears to be stuck. You can cancel and retry.");
        }

        if (data.status === "COMPLETED") {
          wizardDismissedRef.current = true;
          setAsyncGenerating(false);
          await load();
          showToast("Program generated!", "success");
          setShowWelcomeModal(true);
        } else if (data.status === "FAILED") {
          setAsyncGenerating(false);
          setLastGenError(data.error || "Generation failed");
          showToast(data.error || "Generation failed", "error");
        }
      } catch {
        // silently retry next interval
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [asyncGenerating, id, load, showToast]);

  // Auto-show wizard for programs that haven't completed generation.
  // Skip when there's a known generation failure — the in-page "Generation failed"
  // panel surfaces the error + retry button instead, so the user doesn't get silently
  // re-thrown into the wizard with no idea the previous attempt failed.
  //
  // Re-reads ?platform_access=success directly from searchParams instead of
  // trusting the wizardDismissedRef seeded at mount. Reason: this page is a
  // Client Component using useSearchParams() with no Suspense boundary, so
  // Next 15 prerenders it with empty searchParams; the useState/useRef
  // initializers see platformAccessSuccess=false on first render, the ref
  // gets stuck at false, then this effect re-opens the wizard at step 0 even
  // though the creator just round-tripped through Stripe. Bit us repeatedly
  // on mobile (9th-degree 2026-05-24) — three prior "fixes" treated symptoms.
  useEffect(() => {
    if (!program || !genStatusChecked || wizardDismissedRef.current) return;
    if (lastGenError) return;
    if (searchParams.get("platform_access") === "success") return;
    if (program.weeks.length === 0 && !asyncGenerating) {
      setShowWizard(true);
    }
  }, [program, genStatusChecked, asyncGenerating, lastGenError, searchParams]);

  // Returning from /onboarding/upgrade with platform_access=success means the
  // creator already pressed Generate once in the wizard. Auto-fire generation
  // for them instead of forcing a redo. Runs exactly once per page load.
  useEffect(() => {
    if (!platformAccessSuccess) return;
    if (platformAccessAutoFiredRef.current) return;
    if (!program || !genStatusChecked) return;
    if (asyncGenerating || lastGenError) return;
    if (program.weeks.length > 0) return;

    // Lock dismissal + close the wizard SYNCHRONOUSLY before any async work
    // or URL mutation. Without this, the replaceState below strips
    // ?platform_access=success → useSearchParams updates → the auto-show
    // effect re-runs with all guards failing (ref still false because Next 15
    // SSRs this Client Component with empty searchParams; lastGenError still
    // null; asyncGenerating still false because generateStructure's fetch
    // hasn't resolved) → wizard opens at currentStep=0. Three prior fixes
    // missed this; the ref guard is the only one that survives every race.
    wizardDismissedRef.current = true;
    setShowWizard(false);

    platformAccessAutoFiredRef.current = true;
    setActiveTab("curriculum");
    generateStructure();

    // Clean the URL so a manual refresh doesn't re-fire.
    const url = new URL(window.location.href);
    url.searchParams.delete("platform_access");
    url.searchParams.delete("wizard");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    // generateStructure is stable for this purpose; keep the dep list focused
    // on the trigger inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformAccessSuccess, program, genStatusChecked, asyncGenerating, lastGenError]);

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

  async function generateStructure(instructions?: string) {
    setGenerating(true);
    setLastGenError(null);
    try {
      const res = await fetch(`/api/programs/${id}/generate-async`, {
        method: "POST",
        headers: instructions ? { "Content-Type": "application/json" } : undefined,
        body: instructions ? JSON.stringify({ instructions }) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }
      setAsyncGenerating(true);
      showToast("Generation started — this may take a minute", "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      showToast(msg, "error");
      // Surface to the in-page failed panel so a silent fetch failure on the
      // auto-fire path doesn't leave the user staring at nothing.
      setLastGenError(msg);
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
        // Handle platform access gate — redirect to upgrade page with promo code input
        if (data.code === "PLATFORM_ACCESS_REQUIRED") {
          setPublishing(false);
          router.push("/onboarding/upgrade");
          return;
        }
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

  async function handleSkinChange(rawSkinId: string) {
    const patchFields =
      rawSkinId === "auto-generate"
        ? { skinId: "auto-generate", customSkinId: null }
        : rawSkinId.startsWith("custom:")
        ? { customSkinId: rawSkinId.replace("custom:", ""), skinId: "classic-minimal" }
        : { skinId: rawSkinId, customSkinId: null };
    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchFields),
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
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start payout setup");
      }
      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't start payout setup", "error");
      setConnectingStripe(false);
    }
  }

  async function handleManagePayoutAccount() {
    setOpeningStripeDashboard(true);
    try {
      const result = await createStripeLoginLink();
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningStripeDashboard(false);
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-900/30 border border-pink-700/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-lg text-white mb-2">Failed to load program</p>
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
            aiStructured: true,
            followUploadOrder: program.followUploadOrder ?? false,
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
          // Lock dismissal so the auto-show-wizard effect can't re-fire
          // (e.g. on a brief asyncGenerating flicker during status polling).
          wizardDismissedRef.current = true;
          setShowWizard(false);
          setAsyncGenerating(true);
          setActiveTab("curriculum");
          load();
        }}
        onCancel={() => {
          wizardDismissedRef.current = true;
          setShowWizard(false);
        }}
      />
    );
  }

  const previewTokens: SkinTokens = program.customSkin?.tokens
    ? (program.customSkin.tokens as SkinTokens)
    : getSkinTokens(program.skinId);
  const previewSkin = tokensToSkin(previewTokens);

  // Hover-aware tokens for live preview: when hovering a skin in the sidebar,
  // temporarily swap CSS vars so the real program preview updates instantly.
  const effectiveTokens: SkinTokens = (() => {
    if (!hoveredSkinId) return previewTokens;
    if (hoveredSkinId === "auto-generate") return previewTokens;
    if (hoveredSkinId.startsWith("custom:")) return previewTokens; // custom skins need async load, skip hover
    return getSkinTokens(hoveredSkinId);
  })();
  const previewCssVars = getTokenCSSVars(effectiveTokens);
  const effectiveSkinId = hoveredSkinId && hoveredSkinId !== "auto-generate" && !hoveredSkinId.startsWith("custom:") ? hoveredSkinId : program.skinId;
  const previewDecorations = getSkinDecorations(effectiveSkinId, effectiveTokens);
  const previewSelectedSession = previewSelectedSessionId
    ? program.weeks.flatMap((w) => w.sessions).find((s) => s.id === previewSelectedSessionId)
    : null;

  const weekCount = program.weeks.length;
  const sessionCount = program.weeks.reduce((sum, w) => sum + w.sessions.length, 0);

  return (
    <>
    {/* Welcome / Post-Generation Modal */}
    {showWelcomeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl shadow-black/50 animate-slide-up">
          {/* Hero */}
          <div className="relative px-8 pt-8 pb-6 border-b border-gray-800 bg-gradient-to-br from-teal-500/10 via-transparent to-pink-500/10">
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-pink-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              Here&apos;s your Journeyline
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              We&apos;ve shaped <span className="text-white font-medium">&ldquo;{program.title}&rdquo;</span> into{" "}
              <span className="text-teal-400 font-medium">
                {weekCount} {weekCount === 1 ? "lesson" : "lessons"}
              </span>
              {" · "}
              <span className="text-teal-400 font-medium">
                {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
              </span>
              . Everything is yours to refine — use the tabs up top to shape the details, flow, pricing, and look.
            </p>
          </div>

          {/* Tab tiles */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => { setActiveTab("details"); setShowWelcomeModal(false); }}
              className="text-left p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-teal-500/60 hover:bg-gray-900 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-sm font-semibold text-white">Program Details</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Fine-tune your title, description, and the transformation you promise.
              </p>
            </button>

            <button
              onClick={() => { setActiveTab("curriculum"); setShowWelcomeModal(false); }}
              className="text-left p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-teal-500/60 hover:bg-gray-900 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span className="text-sm font-semibold text-white">Curriculum</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Reorder lessons, rename sessions, and polish each action.
              </p>
            </button>

            <button
              onClick={() => { setActiveTab("payments"); setShowWelcomeModal(false); }}
              className="text-left p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-teal-500/60 hover:bg-gray-900 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-white">Payments</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Set your price, create promo codes, and connect Stripe for payouts.
              </p>
            </button>

            <button
              onClick={() => { setActiveTab("preview"); setShowWelcomeModal(false); }}
              className="text-left p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-teal-500/60 hover:bg-gray-900 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <span className="text-sm font-semibold text-white">Preview &amp; Theme</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Swap skins and see exactly what your learners will experience.
              </p>
            </button>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-1 flex flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition"
            >
              I&apos;ll look around
            </button>
            <button
              onClick={() => { setActiveTab("curriculum"); setShowWelcomeModal(false); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-teal-500 to-pink-500 text-white hover:opacity-90 transition shadow-lg shadow-teal-500/10"
            >
              Start with the curriculum →
            </button>
          </div>
        </div>
      </div>
    )}

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

    <div className="min-h-screen" style={{ background: "#0a0a0f" }}>
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-800" style={{ background: "#0a0a0f" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xl font-bold tracking-tight text-white hover:text-teal-400 transition flex-shrink-0"
          >
            ←
          </button>
          <div className="h-6 w-px bg-gray-700 flex-shrink-0" />
          <button
            onClick={() => setActiveTab("details")}
            className="text-base font-semibold text-white truncate hover:text-teal-400 transition cursor-pointer text-left"
            title="Click to edit program details"
          >
            {program.title}
          </button>
          <span
            className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
              program.published
                ? "bg-teal-900/40 text-teal-400"
                : "bg-gray-800 text-gray-400"
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
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-900 text-gray-400 border border-gray-700 hover:border-pink-500 hover:text-pink-500 transition"
              >
                Unpublish
              </button>
              <a
                href={`/p/${program.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-teal-900/30 text-teal-400 border border-teal-700 hover:bg-teal-900/50 transition"
              >
                View Live →
              </a>
            </>
          )}
        </div>
      </nav>

      {/* Payout setup nudge — shown when this is a paid program but the
          creator's payout account isn't fully active yet. */}
      {program.priceInCents > 0 &&
        stripeStatus &&
        (!stripeStatus.onboardingComplete || stripeStatus.chargesEnabled === false) && (
          <div
            className="border-b border-amber-500/30 bg-amber-500/10"
            style={{ background: "rgba(245, 158, 11, 0.08)" }}
          >
            <div className="flex items-center justify-between gap-3 px-6 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  className="w-4 h-4 text-amber-400 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs sm:text-sm text-amber-200 truncate">
                  Add your bank account so learners can pay you.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab("payments");
                  setTimeout(() => {
                    payoutCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }}
                className="text-xs sm:text-sm font-medium text-amber-300 hover:text-amber-200 transition whitespace-nowrap"
              >
                Finish setup →
              </button>
            </div>
          </div>
        )}

      {/* Tab Bar */}
      <div className="border-b border-gray-800" style={{ background: "#0a0a0f" }}>
        <div className="flex overflow-x-auto px-6">
          {(["details", "curriculum", "payments", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                activeTab === tab
                  ? "text-white border-teal-500"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              {tab === "details" ? "Program Details" : tab === "curriculum" ? "Curriculum" : tab === "payments" ? "Payments" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      {/* === Curriculum Tab === */}
      {activeTab === "curriculum" && (
        <main className="p-4" style={{ background: "#0a0a0f" }}>
          {program.weeks.length === 0 && (asyncGenerating || !genStatusChecked || activeGenerations.includes(id)) ? (
            <GenerationProgress stage={asyncStage} progress={asyncProgress} onCancel={cancelGeneration} creatorEmail={creatorEmail} programTitle={program?.title ?? undefined} />
          ) : program.weeks.length === 0 && program.videos.length === 0 ? (
            <div className="flex items-center justify-center min-h-[60vh]" style={{ background: "#0a0a0f" }}>
              <div className="max-w-lg text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-teal-900/40 border border-teal-700/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Let&apos;s build your program</h2>
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
            </div>
          ) : program.weeks.length === 0 ? (
            <div className="max-w-lg mx-auto mt-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-pink-900/30 border border-pink-700/50 flex items-center justify-center">
                <svg className="w-10 h-10 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {lastGenError ? "Generation failed" : "Ready to generate!"}
              </h2>
              {lastGenError && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4 text-left">
                  <p className="text-xs text-red-400 line-clamp-3">{lastGenError}</p>
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
                onClick={() => generateStructure()}
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
              pacingMode={program.pacingMode}
              programTransitionMode={program.transitionMode ?? "NONE"}
              onRegenerate={program.videos.length > 0 ? () => setShowRegenModal(true) : undefined}
              regenerating={generating || asyncGenerating}
            />
          )}
        </main>
      )}

      {/* === Program Details Tab === */}
      {activeTab === "details" && (
        <div className="max-w-2xl mx-auto py-8 px-4" style={{ background: "#0a0a0f", minHeight: "calc(100vh - 112px)" }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch(`/api/programs/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: detailsTitle,
                    description: detailsDescription || null,
                    targetAudience: detailsTargetAudience || null,
                    targetTransformation: detailsTargetTransformation || null,
                    vibePrompt: detailsVibePrompt || null,
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
            {/* Creator Avatar */}
            <CreatorAvatarUpload
              programId={id}
              avatarUrl={program.creatorAvatarUrl}
              onUploaded={(url) => {
                setProgram((prev) => prev ? { ...prev, creatorAvatarUrl: url } : prev);
              }}
            />

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setIsProgramDetailsOpen(!isProgramDetailsOpen)}
                className="w-full flex items-center justify-between group"
              >
                <h2 className="text-base font-semibold text-white">Program Details</h2>
                <svg
                  className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-all duration-200"
                  style={{ transform: isProgramDetailsOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isProgramDetailsOpen && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Title</label>
                    <input
                      value={detailsTitle}
                      onChange={(e) => setDetailsTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Description</label>
                    <textarea
                      value={detailsDescription}
                      onChange={(e) => setDetailsDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Target Audience</label>
                    <textarea
                      value={detailsTargetAudience}
                      onChange={(e) => setDetailsTargetAudience(e.target.value)}
                      placeholder="Who is this program for?"
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gray-600 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Target Transformation</label>
                    <textarea
                      value={detailsTargetTransformation}
                      onChange={(e) => setDetailsTargetTransformation(e.target.value)}
                      placeholder="What will learners achieve?"
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gray-600 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">AI Vibe Prompt</label>
                    <textarea
                      value={detailsVibePrompt}
                      onChange={(e) => setDetailsVibePrompt(e.target.value)}
                      rows={2}
                      placeholder="How should the AI write? (only affects re-generation)"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 resize-none placeholder:text-gray-600"
                    />
                  </div>
                  {program.published && (
                    <p className="text-xs text-gray-500">
                      Slug: <code className="text-teal-400">/p/{program.slug}</code> — frozen after publish
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-gray-800">
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-teal-500 to-pink-500 text-gray-900 font-semibold rounded-lg hover:opacity-90 transition text-sm"
              >
                Save Changes
              </button>
            </div>
          </form>

          {/* Theme — compact link to Preview tab */}
          <div className="flex items-center justify-between mt-8 pt-8 border-t border-gray-800">
            <div>
              <h2 className="text-base font-semibold text-white">Theme</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Current: <span className="text-gray-300">{program.customSkin ? "AI Custom Skin" : previewSkin.name}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab("preview");
                setSkinSidebarOpen(true);
              }}
              className="px-4 py-2 text-sm font-medium text-teal-400 bg-teal-900/20 border border-teal-700 rounded-lg hover:bg-teal-900/40 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Change Theme
            </button>
          </div>
        </div>
      )}

      {/* === Payments Tab === */}
      {activeTab === "payments" && (
        <div className="max-w-2xl mx-auto py-8 px-4" style={{ background: "#0a0a0f", minHeight: "calc(100vh - 112px)" }}>
          <div className="space-y-8">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Price</h2>
                <p className="text-sm text-gray-400">What learners pay to access this program. Free works too.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[0, 2500, 5000, 10000, 50000].map((price) => (
                  <button
                    key={price}
                    onClick={() => handlePriceChange(price)}
                    className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                      program.priceInCents === price
                        ? "border-teal-500 bg-teal-900/30 text-teal-400"
                        : "border-gray-700 text-gray-400 hover:border-gray-600 bg-gray-900"
                    }`}
                  >
                    {price === 0 ? "Free" : `$${price / 100}`}
                  </button>
                ))}
              </div>
              {/* Custom price input */}
              <div className="flex items-center gap-2">
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="Other"
                    defaultValue={
                      [0, 2500, 5000, 10000, 50000].includes(program.priceInCents)
                        ? ""
                        : String(program.priceInCents / 100)
                    }
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) handlePriceChange(Math.round(val * 100));
                    }}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border-2 border-gray-700 bg-gray-900 text-gray-300 text-sm focus:outline-none focus:border-teal-500 placeholder:text-gray-600"
                  />
                </div>
                <span className="text-xs text-gray-600">custom amount</span>
              </div>
            </div>

            <div ref={payoutCardRef} className="space-y-3 scroll-mt-24">
              <h2 className="text-base font-semibold text-white">Payouts</h2>
              <p className="text-sm text-gray-400">Where your earnings land.</p>

              {(() => {
                // State C — fully connected and ready to charge.
                if (
                  stripeStatus?.onboardingComplete &&
                  stripeStatus?.chargesEnabled !== false
                ) {
                  return (
                    <div className="bg-gray-900/40 border border-l-4 border-l-teal-500 border-gray-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-900/40 text-teal-300 border border-teal-700/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          Ready to earn
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">
                        Your bank&apos;s connected. Earnings land directly in your account.
                      </p>
                      <button
                        onClick={handleManagePayoutAccount}
                        disabled={openingStripeDashboard}
                        className="mt-3 text-xs text-teal-400 hover:text-teal-300 transition font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {openingStripeDashboard ? (
                          <><Spinner size="sm" /> Opening…</>
                        ) : (
                          <>Open payout dashboard →</>
                        )}
                      </button>
                    </div>
                  );
                }

                // State B — account exists but onboarding not finished, or charges disabled.
                if (
                  stripeStatus?.connected &&
                  (!stripeStatus.onboardingComplete || stripeStatus.chargesEnabled === false)
                ) {
                  return (
                    <div className="bg-gray-900/40 border border-l-4 border-l-amber-500 border-gray-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Almost there
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-4">
                        Your progress is saved. Pick up where you left off.
                      </p>
                      <button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 text-gray-950 font-medium rounded-lg hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        {connectingStripe ? (
                          <><Spinner size="sm" /> Resuming…</>
                        ) : (
                          "Finish setup →"
                        )}
                      </button>
                      <p className="text-xs text-gray-500 mt-3">
                        Free programs publish without this — only paid ones need it.
                      </p>
                    </div>
                  );
                }

                // State A — never started (no stripeAccountId yet) or status still loading.
                // We render the same card during load to avoid layout shift; the button
                // is disabled if we don't yet have status confirmation.
                const stillLoading = stripeStatus === null;
                return (
                  <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-white mb-1.5">
                      Time to get paid
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Add your bank in about two minutes. We&apos;ll only ask for ID before
                      your first withdrawal.
                    </p>
                    <button
                      onClick={handleConnectStripe}
                      disabled={connectingStripe || stillLoading}
                      className="w-full sm:w-auto px-4 py-2.5 bg-[#4D9FFF] text-gray-950 font-medium rounded-lg hover:bg-[#3d8ce6] transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      {connectingStripe ? (
                        <><Spinner size="sm" /> Opening Stripe…</>
                      ) : (
                        "Start earning →"
                      )}
                    </button>
                    <p className="text-xs text-gray-500 mt-3">
                      Secured by Stripe · About 2 minutes
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Promo Codes */}
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Promo Codes</h2>
                <p className="text-sm text-gray-400">Give your audience a code to access this program for free.</p>
              </div>

              {/* Create form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newPromoCode.trim()) return;
                  setCreatingPromo(true);
                  setPromoError(null);
                  setPromoSuccess(null);
                  try {
                    const res = await fetch("/api/promo-codes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        code: newPromoCode.trim(),
                        programId: id,
                        maxUses: newPromoMaxUses || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to create");
                    setPromoCodes(prev => [data, ...prev]);
                    setNewPromoCode("");
                    setNewPromoMaxUses("");
                    setPromoSuccess(`Code "${data.code}" created!`);
                  } catch (err) {
                    setPromoError(err instanceof Error ? err.message : "Something went wrong");
                  } finally {
                    setCreatingPromo(false);
                  }
                }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
              >
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Code *</label>
                    <input
                      type="text"
                      value={newPromoCode}
                      onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                      placeholder="FREEMONTH"
                      maxLength={20}
                      required
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gray-600"
                    />
                    <p className="text-xs text-gray-600 mt-1">Letters, numbers, dashes. 3-20 chars.</p>
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-gray-400 block mb-1">Max uses</label>
                    <input
                      type="number"
                      value={newPromoMaxUses}
                      onChange={(e) => setNewPromoMaxUses(e.target.value)}
                      placeholder="∞"
                      min={1}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gray-600"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creatingPromo || !newPromoCode.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-900/40 text-teal-400 border border-teal-700 text-sm font-medium hover:bg-teal-900/60 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingPromo ? <><Spinner size="sm" /> Creating...</> : "+ Create code"}
                </button>
                {promoError && <p className="text-xs text-red-400">{promoError}</p>}
                {promoSuccess && <p className="text-xs text-teal-400">{promoSuccess}</p>}
              </form>

              {/* Codes list */}
              {!promoCodesLoaded ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Spinner size="sm" /> Loading codes...
                </div>
              ) : promoCodes.filter(c => c.active && (c.programId === id || c.programId === null)).length === 0 ? (
                <p className="text-sm text-gray-600">No active codes for this program yet.</p>
              ) : (
                <div className="space-y-2">
                  {promoCodes
                    .filter(c => c.active && (c.programId === id || c.programId === null))
                    .map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-mono font-semibold text-teal-400">{c.code}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {c.programId === null ? "All programs" : "This program"} ·{" "}
                            {c.uses}{c.maxUses !== null ? `/${c.maxUses}` : ""} uses
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            setDeletePromoId(c.id);
                            try {
                              await fetch(`/api/promo-codes/${c.id}`, { method: "DELETE" });
                              setPromoCodes(prev => prev.filter(x => x.id !== c.id));
                            } catch {
                              // ignore
                            } finally {
                              setDeletePromoId(null);
                            }
                          }}
                          disabled={deletePromoId === c.id}
                          className="text-xs text-gray-500 hover:text-red-400 transition"
                        >
                          {deletePromoId === c.id ? "..." : "Deactivate"}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
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
                {/* Theme sidebar toggle */}
                <button
                  onClick={() => setSkinSidebarOpen(!skinSidebarOpen)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition ${
                    skinSidebarOpen
                      ? "bg-teal-900/30 text-teal-400 border border-teal-700"
                      : "bg-gray-800 text-gray-400 hover:text-white border border-transparent"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Theme
                </button>
                <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-500">
                  {hoveredSkinId && hoveredSkinId !== "auto-generate" && !hoveredSkinId.startsWith("custom:")
                    ? (getSkinCatalogEntry(hoveredSkinId)?.name ?? hoveredSkinId)
                    : program.customSkin ? "AI Custom Skin" : previewSkin.name}
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
            {/* Preview body: sidebar + frame */}
            <div className="flex-1 flex overflow-hidden">
              {/* Skin sidebar */}
              <SkinSidebar
                value={program.customSkinId ? `custom:${program.customSkinId}` : program.skinId}
                onChange={handleSkinChange}
                onHover={setHoveredSkinId}
                programId={id}
                programTitle={program.title}
                onCustomSkinSaved={(skinId, tokens) => {
                  // Optimistically swap in the fresh tokens so the editor preview
                  // updates without waiting for the next load().
                  const customId = skinId.replace("custom:", "");
                  setProgram((prev) =>
                    prev
                      ? {
                          ...prev,
                          customSkinId: customId,
                          customSkin: { id: customId, tokens },
                        }
                      : prev
                  );
                }}
                isOpen={skinSidebarOpen}
                onToggle={() => setSkinSidebarOpen(!skinSidebarOpen)}
              />
              {/* Preview frame */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-gray-900">
                <div
                  className={`h-full overflow-auto transition-all relative ${previewDeviceMode === "desktop" ? "w-full max-w-5xl" : "w-[375px]"}`}
                  style={{
                    ...previewCssVars,
                    background: "var(--token-color-bg-gradient, var(--token-color-bg-default))",
                    borderRadius: previewDeviceMode === "mobile" ? "24px" : "8px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  {previewView === "overview" ? (
                    <ProgramOverviewPreview
                      program={program}
                      skin={previewSkin}
                      layout={previewDeviceMode === "mobile" ? "mobile" : "auto"}
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
                  {/* Decoration overlays — rendered ON TOP of content */}
                  {previewDecorations.backgroundPattern && (() => {
                    const patColor = resolveColorKey(previewDecorations.backgroundPattern.colorKey, effectiveTokens);
                    const patCss = getPatternCSS({ type: previewDecorations.backgroundPattern.type, color: patColor, spacing: previewDecorations.backgroundPattern.spacing, size: previewDecorations.backgroundPattern.size });
                    return (
                      <div
                        className="absolute inset-0 pointer-events-none z-10"
                        style={{
                          backgroundImage: patCss.backgroundImage,
                          backgroundSize: patCss.backgroundSize,
                          backgroundPosition: patCss.backgroundPosition,
                          opacity: previewDecorations.backgroundPattern.opacity,
                          borderRadius: previewDeviceMode === "mobile" ? "24px" : "8px",
                        }}
                      />
                    );
                  })()}
                  {previewDecorations.floatingElements.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ borderRadius: previewDeviceMode === "mobile" ? "24px" : "8px" }}>
                      {previewDecorations.floatingElements.map((el, i) => {
                        const color = el.color === "accent" ? effectiveTokens.color.accent.primary
                          : el.color === "accent-secondary" ? effectiveTokens.color.accent.secondary
                          : el.color === "text-primary" ? effectiveTokens.color.text.primary
                          : el.color === "text-secondary" ? effectiveTokens.color.text.secondary
                          : el.color === "white" ? "#ffffff"
                          : effectiveTokens.color.accent.primary;
                        const cls = `prev-deco-${i}`;
                        const delay = el.animationDelay ?? "0s";
                        const animStr = !el.animation ? "none"
                          : el.animation === "float" ? `deco-float 6s ease-in-out ${delay} infinite`
                          : el.animation === "float-slow" ? `deco-float-slow 8s ease-in-out ${delay} infinite`
                          : el.animation === "float-reverse" ? `deco-float-reverse 7s ease-in-out ${delay} infinite`
                          : el.animation === "pulse-gentle" ? `deco-pulse 4s ease-in-out ${delay} infinite`
                          : el.animation === "drift" ? `deco-drift 12s ease-in-out ${delay} infinite`
                          : el.animation === "wander" ? `deco-wander 14s ease-in-out ${delay} infinite`
                          : "none";
                        const isEmoji = el.shape === "emoji";
                        const style: React.CSSProperties = {
                          position: "absolute", top: el.top, left: el.left, right: el.right, bottom: el.bottom,
                          width: el.size, height: el.size,
                          ...(isEmoji ? {
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: el.size, lineHeight: 1, color, userSelect: "none" as const,
                          } : {
                            backgroundColor: el.shape === "ring" ? "transparent" : color,
                            borderRadius: el.shape === "circle" || el.shape === "ring" ? "50%" : 2,
                            border: el.shape === "ring" ? `1.5px solid ${color}` : undefined,
                            transform: el.shape === "diamond" ? "rotate(45deg)" : undefined,
                          }),
                        };
                        return (
                          <div key={i} className={cls} style={style}>
                            {isEmoji && el.emoji ? el.emoji : null}
                            <style>{`.${cls} { opacity: ${el.opacity}; animation: ${animStr}; --el-opacity: ${el.opacity}; --el-opacity-peak: ${Math.min(el.opacity * 1.5, 1)}; }`}</style>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto mt-16 text-center">
            <p className="text-gray-400">Build your curriculum first to preview your program.</p>
          </div>
        )
      )}

    {showRegenModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-pink-900/30 border border-pink-700/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Regenerate program</h2>
              <p className="text-sm text-gray-400 mt-1">
                Tell the AI what to change. Leave blank to regenerate from scratch.
              </p>
            </div>
          </div>

          <div className="bg-red-950/40 border border-red-900/60 rounded-lg p-3 mb-4">
            <p className="text-xs text-red-300">
              <strong className="font-semibold">Heads up:</strong> this replaces your entire curriculum.
              Any edits you&apos;ve made to lessons, sessions, or actions will be lost.
            </p>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-gray-300 mb-1.5">
              Instructions <span className="text-gray-500 font-normal">(optional)</span>
            </span>
            <textarea
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={'e.g. "Make 4 lessons instead of 2" or "Move the strength video before the cardio one"'}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-pink-500 placeholder:text-gray-600 resize-none"
            />
            <span className="block text-[10px] text-gray-600 mt-1 text-right">
              {regenInstructions.length} / 2000
            </span>
          </label>

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => {
                setShowRegenModal(false);
                setRegenInstructions("");
              }}
              disabled={generating}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const trimmed = regenInstructions.trim();
                setShowRegenModal(false);
                setActiveTab("curriculum");
                await generateStructure(trimmed.length > 0 ? trimmed : undefined);
                setRegenInstructions("");
              }}
              disabled={generating}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-pink-600 rounded-lg hover:bg-pink-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Spinner size="sm" />
                  Starting…
                </>
              ) : (
                "Regenerate"
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
    </>
  );
}
