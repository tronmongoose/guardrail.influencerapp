"use client";

import { DurationSelector } from "@/components/duration/DurationSelector";

type PacingMode = "drip_by_week" | "unlock_on_complete";

interface StepDurationProps {
  weeks: number;
  pacingMode: PacingMode;
  videoCount: number;
  onWeeksChange: (weeks: number) => void;
  onPacingModeChange: (mode: PacingMode) => void;
}

const PACING_OPTIONS: { value: PacingMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "unlock_on_complete",
    label: "Completion-based",
    description: "Next lesson unlocks when learner completes the current one. Best for self-paced learners.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value: "drip_by_week",
    label: "Weekly release",
    description: "New content unlocks each week on a fixed schedule. Creates anticipation and pacing.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

function computePresets(videoCount: number): { weeks: number; ratioNote: string }[] {
  if (videoCount === 0) {
    return [
      { weeks: 4, ratioNote: "Focused sprint" },
      { weeks: 8, ratioNote: "Most popular" },
      { weeks: 12, ratioNote: "Deep dive" },
    ];
  }
  const short = Math.max(2, Math.ceil(videoCount / 2));
  const med   = Math.max(short + 2, videoCount);
  const long  = Math.min(26, med + Math.ceil(med / 2));
  return [
    { weeks: short, ratioNote: `~${(videoCount / short).toFixed(1)} videos/wk` },
    { weeks: med,   ratioNote: `~${(videoCount / med).toFixed(1)} videos/wk` },
    { weeks: long,  ratioNote: `~${(videoCount / long).toFixed(1)} videos/wk` },
  ];
}

export function StepDuration({ weeks, pacingMode, videoCount, onWeeksChange, onPacingModeChange }: StepDurationProps) {
  const presets = computePresets(videoCount);

  return (
    <div className="space-y-8">
      {/* Pacing Mode Selection */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Progression Style</h2>
        <p className="text-gray-400 text-sm mb-4">
          How should learners move through your program?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PACING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPacingModeChange(option.value)}
              className={`
                p-4 rounded-xl border text-left transition-all
                ${
                  pacingMode === option.value
                    ? "border-neon-cyan bg-neon-cyan/10"
                    : "border-surface-border bg-surface-dark hover:border-gray-500"
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`
                    flex-shrink-0 p-2 rounded-lg
                    ${pacingMode === option.value ? "bg-neon-cyan/20 text-neon-cyan" : "bg-surface-card text-gray-400"}
                  `}
                >
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-medium ${
                        pacingMode === option.value ? "text-neon-cyan" : "text-white"
                      }`}
                    >
                      {option.label}
                    </h3>
                    {option.value === "unlock_on_complete" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-pink/20 text-neon-pink border border-neon-pink/30">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration Selection */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">
          {pacingMode === "unlock_on_complete" ? "Program Length" : "Program Duration"}
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          {videoCount > 0
            ? `Based on your ${videoCount} video${videoCount === 1 ? "" : "s"} — pick the pace that fits your program.`
            : "You haven't added videos yet. You can adjust this after adding content."}
        </p>

        <DurationSelector
          value={weeks}
          onChange={onWeeksChange}
          pacingMode={pacingMode}
          presets={presets}
        />
      </div>

      {/* Pacing mode tip */}
      <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
        <h4 className="text-sm font-medium text-neon-cyan mb-2">
          {pacingMode === "unlock_on_complete" ? "About Completion-based Progression" : "About Weekly Release"}
        </h4>
        <p className="text-xs text-gray-400">
          {pacingMode === "unlock_on_complete" ? (
            <>
              Learners progress at their own pace. Fast learners can binge, while others take their time.
              This mode tends to have <span className="text-white">higher completion rates</span> because
              learners stay in momentum.
            </>
          ) : (
            <>
              Content unlocks weekly from the learner&apos;s enrollment date. This creates
              <span className="text-white"> anticipation and consistent engagement</span>, but some
              learners may disengage while waiting.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
