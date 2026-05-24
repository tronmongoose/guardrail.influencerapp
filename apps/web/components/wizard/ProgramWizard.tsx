"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WizardProgress } from "./WizardProgress";
import { StepBasics } from "./steps/StepBasics";
import { StepDuration } from "./steps/StepDuration";
import { StepContent } from "./steps/StepContent";
import { StepReview } from "./steps/StepReview";
import { TransitionStylePicker } from "./TransitionStylePicker";
import { useGeneration } from "@/components/generation";
import { computeSmartPresets } from "@guide-rail/ai";

export interface WizardState {
  basics: {
    title: string;
    description: string;
    outcomeStatement: string;
    targetAudience: string;
    targetTransformation: string;
  };
  duration: {
    weeks: number;
    pacingMode: "drip_by_week" | "unlock_on_complete";
    aiStructured: boolean;
    followUploadOrder: boolean;
  };
  content: {
    videos: Array<{
      id: string;
      videoId: string;
      title: string | null;
      thumbnailUrl: string | null;
      durationSeconds?: number | null;
      topicCount?: number;
    }>;
    artifacts: Array<{
      id?: string;
      originalFilename: string;
      fileType: string;
      extractedText?: string;
      metadata: { pageCount?: number; wordCount: number };
    }>;
  };
  vibe: {
    vibePrompt: string;
  };
  theme: {
    skinId: string;
    transitionMode: "NONE" | "SIMPLE" | "BRANDED";
  };
}

interface ProgramWizardProps {
  programId: string;
  initialState?: Partial<WizardState>;
  onComplete: () => void;
  onCancel: () => void;
}

const STEPS = [
  { label: "Basics", description: "Who & what" },
  { label: "Content", description: "Videos & files" },
  { label: "Lessons flow", description: "Program length" },
  { label: "Theme", description: "Your look & vibe" },
  { label: "Create", description: "Launch it" },
];

const DEFAULT_STATE: WizardState = {
  basics: {
    title: "",
    description: "",
    outcomeStatement: "",
    targetAudience: "",
    targetTransformation: "",
  },
  duration: {
    weeks: 8,
    pacingMode: "unlock_on_complete", // Default to staged progression for better completion rates
    aiStructured: true,
    followUploadOrder: false,
  },
  content: {
    videos: [],
    artifacts: [],
  },
  vibe: {
    vibePrompt: "",
  },
  theme: {
    skinId: "classic-minimal",
    transitionMode: "NONE" as const,
  },
};

function getStorageKey(programId: string) {
  return `wizard-state-${programId}`;
}

export function ProgramWizard({
  programId,
  initialState,
  onComplete,
  onCancel,
}: ProgramWizardProps) {
  const { startGeneration } = useGeneration();
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  // Mirror uploadingCount into a ref so handleGenerate's poll-loop sees
  // live updates rather than the closure-captured value.
  const uploadingCountRef = useRef(0);
  useEffect(() => {
    uploadingCountRef.current = uploadingCount;
  }, [uploadingCount]);
  const [state, setState] = useState<WizardState>(() => {
    // Try to load from localStorage first
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(getStorageKey(programId));
      if (saved) {
        try {
          return { ...DEFAULT_STATE, ...JSON.parse(saved) };
        } catch {
          // Ignore parse errors
        }
      }
    }
    return { ...DEFAULT_STATE, ...initialState };
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const analysisPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for video analysis completion — runs on Content (1) and Lessons flow (2) steps
  // so duration/topic data arrives in time for smart presets.
  useEffect(() => {
    const videoCount = state.content.videos.length;
    if (videoCount === 0 || currentStep > 2) return;

    const poll = () =>
      fetch(`/api/programs/${programId}/videos`)
        .then((r) => r.ok ? r.json() : [])
        .then((data: Array<{ id: string; hasAnalysis?: boolean; durationSeconds?: number | null; topicCount?: number }>) => {
          const next: Record<string, boolean> = {};
          for (const v of data) next[v.id] = !!v.hasAnalysis;

          // Enrich wizard state videos with duration/topic data from analysis
          setState((prev) => {
            let changed = false;
            const enriched = prev.content.videos.map((video) => {
              const fresh = data.find((d) => d.id === video.id);
              if (!fresh) return video;
              if (
                (fresh.durationSeconds ?? null) !== (video.durationSeconds ?? null) ||
                (fresh.topicCount ?? 0) !== (video.topicCount ?? 0)
              ) {
                changed = true;
                return {
                  ...video,
                  durationSeconds: fresh.durationSeconds ?? video.durationSeconds,
                  topicCount: fresh.topicCount ?? video.topicCount,
                };
              }
              return video;
            });
            return changed ? { ...prev, content: { ...prev.content, videos: enriched } } : prev;
          });

          return next;
        })
        .catch(() => ({} as Record<string, boolean>));

    poll().then((ready) => {
      const ids = state.content.videos.map((v) => v.id);
      if (ids.every((id) => ready[id])) return; // All done, no need to poll
      if (analysisPollerRef.current) clearInterval(analysisPollerRef.current);
      // Poll faster (5s) when AI mode is active and analysis is pending
      const pollMs = state.duration.aiStructured ? 5_000 : 10_000;
      analysisPollerRef.current = setInterval(() => {
        poll().then((latest) => {
          if (ids.every((id) => latest[id]) && analysisPollerRef.current) {
            clearInterval(analysisPollerRef.current);
            analysisPollerRef.current = null;
          }
        });
      }, pollMs);
    });

    return () => {
      if (analysisPollerRef.current) {
        clearInterval(analysisPollerRef.current);
        analysisPollerRef.current = null;
      }
    };
  }, [programId, state.content.videos.length, currentStep, state.duration.aiStructured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist state to localStorage (exclude large blobs to avoid quota issues)
  useEffect(() => {
    const serializable = {
      ...state,
      content: {
        ...state.content,
        // Strip extractedText (large doc content) and base64 thumbnails (client-extracted video frames)
        artifacts: state.content.artifacts.map(({ extractedText, ...rest }) => rest),
        videos: state.content.videos.map(({ thumbnailUrl, ...rest }) =>
          thumbnailUrl?.startsWith("data:") ? rest : { ...rest, thumbnailUrl }
        ),
      },
    };
    localStorage.setItem(getStorageKey(programId), JSON.stringify(serializable));
  }, [programId, state]);

  const updateState = useCallback(
    <K extends keyof WizardState>(key: K, value: Partial<WizardState[K]>) => {
      setState((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...value },
      }));
    },
    []
  );

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 0: // Basics
        return (
          state.basics.title.trim().length > 0 &&
          state.basics.targetTransformation.trim().length > 0
        );
      case 1: // Content
        return state.content.videos.length > 0 || state.content.artifacts.length > 0 || uploadingCount > 0;
      case 2: // Duration
        return state.duration.weeks >= 2;
      case 3: // Theme (optional)
        return true;
      case 4: // Create
        return true;
      default:
        return false;
    }
  }, [currentStep, state, uploadingCount]);

  // Auto-select middle preset when entering the duration step if current value isn't one of the presets
  // Skip when AI mode is active — weeks is derived from topic analysis instead
  useEffect(() => {
    if (currentStep !== 2 || state.duration.aiStructured) return;
    const presets = computeSmartPresets(state.content.videos.length, state.content.videos);
    const presetWeeks = presets.map((p) => p.weeks);
    if (!presetWeeks.includes(state.duration.weeks)) {
      setState((prev) => ({ ...prev, duration: { ...prev.duration, weeks: presets[1].weeks } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Wait for any in-flight uploads to finish before firing the server
      // call. uploadingCount drops to 0 in StepContent's handleFileUpload
      // when its Promise.allSettled resolves; until then the YouTubeVideo
      // rows don't exist server-side and the route would see 0 videos.
      // Cap the wait at 12 min — same magnitude as the XHR timeout per file.
      const uploadWaitDeadline = Date.now() + 12 * 60_000;
      while (uploadingCountRef.current > 0 && Date.now() < uploadWaitDeadline) {
        await new Promise((r) => setTimeout(r, 500));
      }

      // Resolve skin fields: "auto-generate" → sentinel skinId; "custom:id" → customSkinId
      const rawSkinId = state.theme.skinId;
      const skinPatchFields: Record<string, string | null> =
        rawSkinId === "auto-generate"
          ? { skinId: "auto-generate", customSkinId: null }
          : rawSkinId.startsWith("custom:")
          ? { customSkinId: rawSkinId.replace("custom:", ""), skinId: "classic-minimal" }
          : { skinId: rawSkinId, customSkinId: null };

      // Save program details
      const patchRes = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.basics.title,
          description: state.basics.description,
          outcomeStatement: state.basics.outcomeStatement,
          targetAudience: state.basics.targetAudience,
          targetTransformation: state.basics.targetTransformation,
          durationWeeks: state.duration.weeks,
          aiStructured: state.duration.aiStructured,
          followUploadOrder: state.duration.followUploadOrder,
          pacingMode: state.duration.pacingMode,
          vibePrompt: state.vibe.vibePrompt,
          ...skinPatchFields,
          transitionMode: state.theme.transitionMode,
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Failed to save program details");
      }

      // Save artifacts
      for (const artifact of state.content.artifacts) {
        if (!artifact.id) {
          await fetch(`/api/programs/${programId}/artifacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(artifact),
          });
        }
      }

      // Start async generation (returns immediately)
      const genRes = await fetch(`/api/programs/${programId}/generate-async`, {
        method: "POST",
      });

      if (!genRes.ok) {
        const error = await genRes.json();
        if (error.code === "PLATFORM_ACCESS_REQUIRED") {
          // Pass programId so /onboarding/upgrade can route back here after
          // platform access is granted (promo or Stripe checkout), instead
          // of dumping the creator on /dashboard with no breadcrumb.
          window.location.href = `/onboarding/upgrade?from=${programId}`;
          return;
        }
        throw new Error(error.detail || error.error || "Failed to start generation");
      }

      // Clear wizard state from localStorage
      localStorage.removeItem(getStorageKey(programId));

      // Register with notification system
      startGeneration(programId);

      // Hand control back to the edit page — it will hide the wizard and show GenerationProgress
      onComplete();
    } catch (error) {
      console.error("Generation error:", error);
      alert(`Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsGenerating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepBasics
            value={state.basics}
            onChange={(v) => updateState("basics", v)}
          />
        );
      case 1:
        return (
          <StepContent
            programId={programId}
            videos={state.content.videos}
            artifacts={state.content.artifacts}
            onVideosChange={(videos) =>
              updateState("content", { videos })
            }
            onArtifactsChange={(artifacts) =>
              updateState("content", { artifacts })
            }
            onUploadingCountChange={setUploadingCount}
          />
        );
      case 2:
        return (
          <StepDuration
            weeks={state.duration.weeks}
            videos={state.content.videos}
            aiStructured={state.duration.aiStructured}
            followUploadOrder={state.duration.followUploadOrder}
            onWeeksChange={(weeks) => updateState("duration", { weeks })}
            onAiStructuredChange={(aiStructured) => updateState("duration", { aiStructured })}
            onFollowUploadOrderChange={(followUploadOrder) => updateState("duration", { followUploadOrder })}
          />
        );
      case 3:
        return (
          <StepReview
            state={state}
            programId={programId}
            skinId={state.theme.skinId}
            onSkinChange={(skinId) => updateState("theme", { skinId })}
          />
        );
      case 4: {
        const totalContent = state.content.videos.length + state.content.artifacts.length;
        const uploadsInProgress = uploadingCount > 0;
        // Generate is allowed once there's *intent* — either files-in-flight
        // or content already saved. state.content.videos populates only
        // AFTER each upload's PUT finishes, so during upload itself
        // totalContent is still 0. handleGenerate will wait for uploads to
        // settle before firing the server call.
        const canGenerate = totalContent > 0 || uploadsInProgress;
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Create Your Journeyline</h2>
              <p className="text-gray-400 text-sm">
                Choose a transition style, then generate your program.
              </p>
            </div>

            <TransitionStylePicker
              value={state.theme.transitionMode}
              onChange={(transitionMode) => updateState("theme", { transitionMode })}
            />

            {uploadsInProgress && (
              <div className="p-4 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-neon-cyan">
                      Uploading {uploadingCount} video{uploadingCount !== 1 ? "s" : ""}…
                    </p>
                    {!isGenerating && (
                      <p className="text-xs text-gray-400 mt-1">
                        You can press Generate now — we’ll wait for your uploads to finish on our side.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!uploadsInProgress && totalContent === 0 && (
              <div className="p-4 bg-neon-yellow/10 border border-neon-yellow/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-neon-yellow">No content added</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add at least one video or document to generate a program structure.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className={`
                  w-full py-4 rounded-xl font-semibold text-lg transition-all
                  ${isGenerating || !canGenerate
                    ? "bg-surface-card border border-surface-border text-gray-500 cursor-not-allowed"
                    : "btn-neon"
                  }
                `}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {uploadsInProgress ? "Waiting for uploads to finish…" : "Starting generation…"}
                  </span>
                ) : (
                  "Generate Journeyline →"
                )}
              </button>
              <p className="text-center text-xs text-gray-500 mt-3">
                Runs in the background — we&apos;ll notify you when your program is ready.
              </p>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Create Program</h1>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <WizardProgress
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />

        {/* Step content */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-6 mb-6">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`
              px-6 py-2.5 rounded-lg border transition
              ${
                currentStep === 0
                  ? "border-surface-border text-gray-600 cursor-not-allowed"
                  : "border-surface-border text-gray-300 hover:border-neon-cyan hover:text-neon-cyan"
              }
            `}
          >
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                px-6 py-2.5 rounded-lg font-medium transition
                ${
                  canProceed()
                    ? "btn-neon"
                    : "bg-surface-card border border-surface-border text-gray-500 cursor-not-allowed"
                }
              `}
            >
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
