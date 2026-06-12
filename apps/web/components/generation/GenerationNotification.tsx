"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGenerationSteps } from "./useGenerationSteps";
import { GenerationSteps } from "./GenerationSteps";
import { SkinPreviewPanel } from "@/components/skins/SkinPreviewPanel";
import type { SkinTokens } from "@guide-rail/shared";

interface GenerationJob {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: string | null;
  progress: number;
  error: string | null;
  completedAt: string | null;
}

interface GenerationNotificationProps {
  programId: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function GenerationNotification({
  programId,
  onComplete,
  onDismiss,
}: GenerationNotificationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOnEditPage = pathname === `/programs/${programId}/edit`;
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [skinModal, setSkinModal] = useState<{ tokens: SkinTokens; customSkinId: string } | null>(null);
  const [skinChecked, setSkinChecked] = useState(false);

  // Keep callbacks in refs so they never need to be effect deps
  const onCompleteRef = useRef(onComplete);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismissRef.current?.();
  }, []);

  useEffect(() => {
    let stopped = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let consecutiveErrors = 0;

    const stop = () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/programs/${programId}/generate-async/status`);
        if (stopped) return;

        // 404 = no job found — stop polling and clean up activeGenerations
        if (res.status === 404) { stop(); onDismissRef.current?.(); return; }
        if (!res.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) stop(); // give up after 3 consecutive errors
          return;
        }

        consecutiveErrors = 0;
        const data: GenerationJob = await res.json();
        setJob(data);

        if (data.status === "COMPLETED") {
          stop();
          onCompleteRef.current?.();
        } else if (data.status === "FAILED") {
          stop();
        }
      } catch (err) {
        console.error("Failed to poll generation status:", err);
        consecutiveErrors++;
        if (consecutiveErrors >= 3) stop();
      }
    };

    // Initial fetch, then poll every 5s until terminal status or unmount
    poll();
    interval = setInterval(poll, 5000);

    return () => stop();
  }, [programId]); // programId is the only stable dep needed

  // When on the edit page and generation completes: trigger a reload of program data via custom event,
  // then auto-dismiss the toast. This handles the case where the edit page's own polling isn't running.
  useEffect(() => {
    if (job?.status === "COMPLETED" && isOnEditPage) {
      window.dispatchEvent(new CustomEvent("generation-complete", { detail: { programId } }));
      const timer = setTimeout(() => handleDismiss(), 3000);
      return () => clearTimeout(timer);
    }
  }, [job?.status, isOnEditPage, programId, handleDismiss]);

  // After completion, check if a custom skin was generated and show preview modal
  useEffect(() => {
    if (job?.status !== "COMPLETED" || skinChecked) return;
    setSkinChecked(true);
    fetch(`/api/programs/${programId}`)
      .then((r) => r.json())
      .then((prog: { customSkin?: { id: string; tokens: SkinTokens } | null }) => {
        if (prog.customSkin?.tokens) {
          setSkinModal({ tokens: prog.customSkin.tokens, customSkinId: prog.customSkin.id });
        }
      })
      .catch(() => {});
  }, [job?.status, programId, skinChecked]);

  if (skinModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Here&apos;s your custom skin</h2>
              <p className="text-sm text-gray-500 mt-0.5">Generated from your vibe — apply it or pick a different theme.</p>
            </div>
            <button
              onClick={() => setSkinModal(null)}
              className="text-gray-400 hover:text-gray-600 transition ml-4"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-hidden" style={{ height: 420 }}>
            <SkinPreviewPanel skinId="custom" tokens={skinModal.tokens} viewMode="desktop" />
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setSkinModal(null)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              Use This Skin
            </button>
            <button
              onClick={() => {
                setSkinModal(null);
                router.push(`/programs/${programId}/edit?tab=theme`);
              }}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              Choose a Different Skin
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dismissed || !job) return null;

  // The edit page renders its own full GenerationProgress panel — hide the floating notification
  // while the job is running so both indicators don't appear at once. It becomes useful again
  // once the job finishes (COMPLETED / FAILED) and the banner needs to surface on other pages.
  if (isOnEditPage && (job.status === "PENDING" || job.status === "PROCESSING")) return null;

  // Don't show if completed more than 10 seconds ago
  if (job.status === "COMPLETED" && job.completedAt) {
    const completedAt = new Date(job.completedAt);
    if (Date.now() - completedAt.getTime() > 10000) {
      return null;
    }
  }

  const handleViewProgram = () => {
    router.push(`/programs/${programId}/edit`);
    handleDismiss();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div
        className={`
          rounded-xl border p-4 shadow-lg backdrop-blur-sm
          ${
            job.status === "FAILED"
              ? "bg-red-950/90 border-red-500/50"
              : job.status === "COMPLETED"
              ? "bg-green-950/90 border-neon-cyan/50"
              : "bg-surface-card/95 border-surface-border"
          }
        `}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {job.status === "COMPLETED" ? (
              <div className="w-8 h-8 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : job.status === "FAILED" ? (
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-neon-pink/20 flex items-center justify-center animate-pulse">
                <svg className="w-5 h-5 text-neon-pink animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-white">
                {job.status === "COMPLETED"
                  ? "Program Ready!"
                  : job.status === "FAILED"
                  ? "Generation Failed"
                  : "Generating Program"}
              </h4>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {job.status === "FAILED" && job.error ? (
              <p className="text-xs text-red-300 mt-1 line-clamp-2">{job.error}</p>
            ) : job.status === "COMPLETED" ? (
              <p className="text-xs text-gray-400 mt-1">
                Your program has been generated and is ready to edit.
              </p>
            ) : (
              <CompactProgress stage={job.stage} progress={job.progress} status={job.status} />
            )}

            {/* Actions */}
            {job.status === "COMPLETED" && !isOnEditPage && (
              <button
                onClick={handleViewProgram}
                className="mt-3 w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition"
              >
                View & Edit Program
              </button>
            )}

            {job.status === "FAILED" && (
              <button
                onClick={() => {
                  setDismissed(true);
                  router.push(`/programs/${programId}/edit`);
                }}
                className="mt-3 w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition"
              >
                View Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactProgress({ stage, progress, status }: { stage: string | null; progress: number; status: string }) {
  const stepsData = useGenerationSteps({ stage, progress, status });
  return (
    <div className="mt-1">
      <GenerationSteps
        steps={stepsData.steps}
        activeStepIndex={stepsData.activeStepIndex}
        displayProgress={stepsData.displayProgress}
        estimatedMinutesRemaining={stepsData.estimatedMinutesRemaining}
        variant="compact"
      />
    </div>
  );
}
