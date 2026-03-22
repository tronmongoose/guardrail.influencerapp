"use client";

import { useState, useEffect, useCallback } from "react";
import { WizardProgress } from "./WizardProgress";
import { StepBasics } from "./steps/StepBasics";
import { StepDuration } from "./steps/StepDuration";
import { StepContent } from "./steps/StepContent";
import { StepReview } from "./steps/StepReview";
import { useGeneration } from "@/components/generation";

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
  };
  content: {
    videos: Array<{
      id: string;
      videoId: string;
      title: string | null;
      thumbnailUrl: string | null;
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
  { label: "Duration", description: "Program length" },
  { label: "Theme", description: "Your look" },
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

  // Persist state to localStorage (exclude extractedText to avoid quota issues with large docs)
  useEffect(() => {
    const serializable = {
      ...state,
      content: {
        ...state.content,
        artifacts: state.content.artifacts.map(({ extractedText, ...rest }) => rest),
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
        return state.content.videos.length > 0 || state.content.artifacts.length > 0;
      case 2: // Duration
        return state.duration.weeks >= 2;
      case 3: // Theme (optional)
        return true;
      default:
        return false;
    }
  }, [currentStep, state]);

  // Auto-select middle preset when entering the duration step if current value isn't one of the presets
  useEffect(() => {
    if (currentStep !== 2) return;
    const videoCount = state.content.videos.length;
    let presets: number[];
    if (videoCount === 0) {
      presets = [4, 8, 12];
    } else {
      const short = Math.max(2, Math.ceil(videoCount / 2));
      const med = Math.max(short + 2, videoCount);
      const long = Math.min(26, med + Math.ceil(med / 2));
      presets = [short, med, long];
    }
    if (!presets.includes(state.duration.weeks)) {
      setState((prev) => ({ ...prev, duration: { ...prev.duration, weeks: presets[1] } }));
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
          pacingMode: state.duration.pacingMode,
          vibePrompt: state.vibe.vibePrompt,
          skinId: state.theme.skinId,
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
        throw new Error(error.detail || error.error || "Failed to start generation");
      }

      // Clear wizard state from localStorage
      localStorage.removeItem(getStorageKey(programId));

      // Register with notification system to track progress
      startGeneration(programId);

      // Navigate away immediately - user will see notification when complete
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
          />
        );
      case 2:
        return (
          <StepDuration
            weeks={state.duration.weeks}
            pacingMode={state.duration.pacingMode}
            videoCount={state.content.videos.length}
            onWeeksChange={(weeks) => updateState("duration", { weeks })}
            onPacingModeChange={(pacingMode) => updateState("duration", { pacingMode })}
          />
        );
      case 3:
        return (
          <StepReview
            state={state}
            skinId={state.theme.skinId}
            onSkinChange={(skinId) => updateState("theme", { skinId })}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
          />
        );
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
