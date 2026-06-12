"use client";

import type { GenerationStep } from "./useGenerationSteps";

interface GenerationStepsProps {
  steps: GenerationStep[];
  activeStepIndex: number;
  displayProgress: number;
  estimatedMinutesRemaining: number | null;
  variant: "full" | "compact";
}

// SVG icons for each step (used in full variant)
const STEP_ICONS: Record<string, React.ReactNode> = {
  watching: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  ),
  analyzing: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  ),
  clustering: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  ),
  digesting: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  ),
  mapping: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  ),
  scenes: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  ),
  sessions: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  ),
  actions: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  ),
};

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-neon-pink animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function GenerationSteps({ steps, activeStepIndex, displayProgress, estimatedMinutesRemaining, variant }: GenerationStepsProps) {
  if (variant === "compact") {
    return <CompactSteps steps={steps} activeStepIndex={activeStepIndex} displayProgress={displayProgress} estimatedMinutesRemaining={estimatedMinutesRemaining} />;
  }
  return <FullSteps steps={steps} activeStepIndex={activeStepIndex} displayProgress={displayProgress} estimatedMinutesRemaining={estimatedMinutesRemaining} />;
}

function FullSteps({ steps, activeStepIndex, displayProgress, estimatedMinutesRemaining }: Omit<GenerationStepsProps, "variant">) {
  return (
    <div role="progressbar" aria-valuenow={displayProgress} aria-valuemin={0} aria-valuemax={100}>
      {/* Step list */}
      <div className="inline-flex flex-col items-start text-left">
        {steps.map((step, i) => (
          <div key={step.key}>
            {/* Step row */}
            <div className="flex items-start gap-3">
              {/* Icon circle */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 mt-0.5
                  ${step.status === "completed"
                    ? "bg-neon-cyan/20 border border-neon-cyan/50 animate-step-complete"
                    : step.status === "active"
                    ? "bg-neon-pink/20 border-2 border-neon-pink animate-step-pulse scale-110"
                    : "bg-surface-card border border-surface-border"
                  }
                `}
                aria-label={`${step.label} - ${step.status}`}
              >
                {step.status === "completed" ? (
                  <CheckIcon />
                ) : step.status === "active" ? (
                  <SpinnerIcon />
                ) : (
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {STEP_ICONS[step.key]}
                  </svg>
                )}
              </div>

              {/* Label + subtitle */}
              <div className="min-w-0">
                <span
                  className={`block text-sm font-medium transition-all duration-500 ${
                    step.status === "completed"
                      ? "text-neon-cyan"
                      : step.status === "active"
                      ? "text-shimmer"
                      : "text-gray-600"
                  }`}
                  aria-live={step.status === "active" ? "polite" : undefined}
                >
                  {step.label}{step.status === "active" ? "..." : ""}
                </span>
                {step.status === "active" && (
                  <span className="block text-xs text-gray-500 mt-0.5 animate-fade-in">
                    {step.subtitle}
                  </span>
                )}
              </div>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`w-0.5 h-4 ml-[15px] transition-colors duration-500 ${
                  i < activeStepIndex ? "bg-neon-cyan/40" : "bg-surface-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="max-w-sm mx-auto mt-6">
        <div className="h-2 bg-surface-dark rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink transition-all duration-700 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {Math.round(displayProgress)}% complete
          {estimatedMinutesRemaining !== null && ` (${estimatedMinutesRemaining} min remaining)`}
        </p>
      </div>
    </div>
  );
}

function CompactSteps({ steps, activeStepIndex, displayProgress, estimatedMinutesRemaining }: Omit<GenerationStepsProps, "variant">) {
  const activeStep = steps[activeStepIndex];
  const completedCount = steps.filter((s) => s.status === "completed").length;

  return (
    <div role="progressbar" aria-valuenow={displayProgress} aria-valuemin={0} aria-valuemax={100}>
      {/* Active step label */}
      <div className="flex items-center gap-1.5" aria-live="polite">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-pink animate-pulse flex-shrink-0" />
        <span className="text-xs text-gray-300">
          {activeStep ? `${activeStep.label}...` : "Starting..."}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-surface-dark rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink transition-all duration-700 ease-out"
          style={{ width: `${displayProgress}%` }}
        />
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between mt-1">
        <p className="text-[10px] text-gray-500">
          {completedCount} of {steps.length} steps
        </p>
        <p className="text-[10px] text-gray-500">
          {Math.round(displayProgress)}%
          {estimatedMinutesRemaining !== null && ` (${estimatedMinutesRemaining} min)`}
        </p>
      </div>
    </div>
  );
}
