"use client";

import { useState, useEffect, useRef, useMemo } from "react";

export interface GenerationStep {
  key: string;
  label: string;
  subtitle: string;
  status: "pending" | "active" | "completed";
}

const STEP_DEFINITIONS = [
  { key: "preparing_videos", label: "Preparing your videos", subtitle: "Getting your videos ready for AI analysis" },
  { key: "watching", label: "Watching your videos", subtitle: "AI is analyzing every frame and word of your content" },
  { key: "analyzing", label: "Understanding your expertise", subtitle: "Identifying the concepts that make your teaching unique" },
  { key: "clustering", label: "Finding the natural structure", subtitle: "Organizing ideas into a sequence that clicks" },
  { key: "digesting", label: "Extracting key insights", subtitle: "Pulling out the moments that matter most" },
  { key: "mapping", label: "Mapping the learning journey", subtitle: "Designing the path from beginner to mastery" },
  { key: "scenes", label: "Building scene-based lessons", subtitle: "Curating video clips, transitions, and overlays" },
  { key: "sessions", label: "Writing each lesson with care", subtitle: "Crafting sessions that transform knowledge into action" },
  { key: "actions", label: "Adding the finishing touches", subtitle: "Polishing every detail so your program shines" },
] as const;

interface UseGenerationStepsInput {
  stage: string | null;
  progress: number;
  status: string;
}

interface UseGenerationStepsResult {
  steps: GenerationStep[];
  activeStepIndex: number;
  displayProgress: number;
  estimatedMinutesRemaining: number | null;
}

// Per-stage simulation: each stage has a ceiling (max % it can reach) and an
// expectedSeconds (how long it typically takes). The bar advances smoothly
// from the previous stage's ceiling toward the current stage's ceiling over
// expectedSeconds, easing out so long stages don't park at the ceiling too
// hard. When the backend advances `progress`, the displayed bar uses it as a
// floor (so real progress always wins).
//
// Total expected wall-clock at the upper end:
//   2s + 4s + 120s + 8s + 120s + 5s + 10s + 30s = ~5 min for a 10-video program.
// Smaller programs finish faster — real progress pulls the bar forward.
//
// Ceilings are sized so the slowest stages (fetching_transcripts, generating)
// own the biggest contiguous slices and the short stages don't jump much.
const STAGES: Record<string, { ceiling: number; expectedSeconds: number }> = {
  // Client-side stage emitted by the wizard/edit page while polling Mux
  // readiness BEFORE generate-async has been posted. Long uploads can sit
  // here for 5-15 min while Mux finishes the static rendition transcode.
  preparing_videos: { ceiling: 11, expectedSeconds: 720 },
  queued: { ceiling: 13, expectedSeconds: 2 },
  preparing: { ceiling: 17, expectedSeconds: 4 },
  fetching_transcripts: { ceiling: 49, expectedSeconds: 120 },
  analyzing: { ceiling: 55, expectedSeconds: 8 },
  generating: { ceiling: 87, expectedSeconds: 120 },
  validating: { ceiling: 90, expectedSeconds: 5 },
  persisting: { ceiling: 94, expectedSeconds: 10 },
  generating_skin: { ceiling: 98, expectedSeconds: 30 },
  complete: { ceiling: 100, expectedSeconds: 0 },
};

// Bubble step → bar-% threshold. 9 bubbles evenly distributed every ~11.1%
// so each one lights up as the bar crosses its slice — decouples cadence
// from stage names entirely.
const STEP_THRESHOLDS = [0, 11.11, 22.22, 33.33, 44.44, 55.55, 66.66, 77.78, 88.89];

/**
 * Maps backend generation {stage, progress} to 8 rich frontend steps.
 *
 * Bar advances via per-stage simulation: each stage runs an ease-out curve
 * from the prior ceiling to its own ceiling over its expectedSeconds. Real
 * backend `progress` acts as a floor. Bubbles fire at fixed %-thresholds so
 * they tick at even visual intervals regardless of which stage is slow.
 */
export function useGenerationSteps(input: UseGenerationStepsInput): UseGenerationStepsResult {
  const { stage, progress, status } = input;

  const [simulatedProgress, setSimulatedProgress] = useState(0);
  // Track the in-flight stage so we can reset the simulation when it changes.
  const stageRef = useRef<string | null>(null);
  const stageStartTimeRef = useRef<number>(Date.now());
  const stageStartProgressRef = useRef<number>(0);

  // Step-completion dwell so bubbles don't visually skip ahead too fast.
  const [displayedActiveIndex, setDisplayedActiveIndex] = useState(0);
  const lastStepChangeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (status !== "PROCESSING") {
      stageRef.current = null;
      setSimulatedProgress(0);
      return;
    }

    const effectiveStage = stage ?? "queued";
    // Stage transition: lock in the bar's current displayed value as the
    // simulation's new starting point so the new stage's curve picks up
    // from where we are (no jumps).
    if (stageRef.current !== effectiveStage) {
      stageRef.current = effectiveStage;
      stageStartTimeRef.current = Date.now();
      stageStartProgressRef.current = simulatedProgress;
    }

    const interval = setInterval(() => {
      const cfg = STAGES[effectiveStage] ?? STAGES.queued;
      const start = stageStartProgressRef.current;
      const elapsed = (Date.now() - stageStartTimeRef.current) / 1000;
      const t = cfg.expectedSeconds > 0 ? Math.min(elapsed / cfg.expectedSeconds, 1) : 1;
      // Ease-out: fast at first, asymptotes to ceiling. Stage that takes
      // longer than expectedSeconds just sits at the ceiling waiting on
      // the real backend progress.
      const eased = 1 - Math.pow(1 - t, 1.5);
      const simulated = start + (cfg.ceiling - start) * eased;
      setSimulatedProgress(simulated);
    }, 400);

    return () => clearInterval(interval);
    // simulatedProgress is intentionally not in deps — including it would
    // re-create the interval on every tick and break the simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status]);

  // Real backend progress is the floor; simulation is layered on top.
  const displayProgress = stage === "complete"
    ? 100
    : Math.max(progress, simulatedProgress);

  const rawSteps = useMemo((): GenerationStep[] => {
    return STEP_DEFINITIONS.map((_, i) => {
      const threshold = STEP_THRESHOLDS[i];
      const nextThreshold = STEP_THRESHOLDS[i + 1] ?? 100;
      let status: GenerationStep["status"];
      if (stage === "complete") status = "completed";
      else if (displayProgress >= nextThreshold) status = "completed";
      else if (displayProgress >= threshold) status = "active";
      else status = "pending";
      return { ...STEP_DEFINITIONS[i], status };
    });
  }, [stage, displayProgress]);

  const rawActiveIndex = rawSteps.findIndex((s) => s.status === "active");

  // Enforce minimum 1.5s dwell per bubble so they don't visually flicker
  // through when the bar advances quickly.
  useEffect(() => {
    const targetIndex = Math.max(rawActiveIndex, 0);
    if (targetIndex > displayedActiveIndex) {
      const elapsed = Date.now() - lastStepChangeRef.current;
      const minDwell = 1500;
      if (elapsed >= minDwell) {
        setDisplayedActiveIndex(targetIndex);
        lastStepChangeRef.current = Date.now();
      } else {
        const timer = setTimeout(() => {
          setDisplayedActiveIndex(targetIndex);
          lastStepChangeRef.current = Date.now();
        }, minDwell - elapsed);
        return () => clearTimeout(timer);
      }
    }
  }, [rawActiveIndex, displayedActiveIndex]);

  const steps = useMemo((): GenerationStep[] => {
    return rawSteps.map((step, i) => {
      if (i < displayedActiveIndex) return { ...step, status: "completed" as const };
      if (i === displayedActiveIndex && rawActiveIndex >= displayedActiveIndex) return { ...step, status: "active" as const };
      if (i > displayedActiveIndex) return { ...step, status: "pending" as const };
      return step;
    });
  }, [rawSteps, displayedActiveIndex, rawActiveIndex]);

  // Walk stage ceilings to derive minutes remaining. Within the current stage,
  // remaining seconds scale linearly with the bar slice (ceiling - prevCeiling);
  // later stages contribute their full expectedSeconds. Floors at 1 min so the
  // bar never reads "0 min remaining" while still actively generating.
  const estimatedMinutesRemaining = useMemo((): number | null => {
    if (stage === "complete" || displayProgress >= 100) return null;
    let prevCeiling = 0;
    let totalRemainingSeconds = 0;
    let foundCurrent = false;
    for (const cfg of Object.values(STAGES)) {
      if (!foundCurrent) {
        if (displayProgress < cfg.ceiling) {
          const slice = cfg.ceiling - prevCeiling;
          const remainingInStage = slice > 0
            ? (cfg.expectedSeconds * (cfg.ceiling - displayProgress)) / slice
            : 0;
          totalRemainingSeconds += remainingInStage;
          foundCurrent = true;
        }
      } else {
        totalRemainingSeconds += cfg.expectedSeconds;
      }
      prevCeiling = cfg.ceiling;
    }
    if (!foundCurrent) return null;
    return Math.max(1, Math.ceil(totalRemainingSeconds / 60));
  }, [stage, displayProgress]);

  return {
    steps,
    activeStepIndex: displayedActiveIndex,
    displayProgress,
    estimatedMinutesRemaining,
  };
}
