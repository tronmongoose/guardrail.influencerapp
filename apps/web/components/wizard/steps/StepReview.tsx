"use client";

import { SkinPicker } from "@/components/skins/SkinPicker";
import type { WizardState } from "../ProgramWizard";

interface StepReviewProps {
  state: WizardState;
  skinId: string;
  onSkinChange: (skinId: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function StepReview({ state, skinId, onSkinChange, isGenerating, onGenerate }: StepReviewProps) {
  const totalContent = state.content.videos.length + state.content.artifacts.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Choose Your Theme</h2>
        <p className="text-gray-400 text-sm">
          Pick a look for your program page. You can change it anytime after launch.
        </p>
      </div>

      {/* Compact summary strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-sm">
        <span className="text-white font-medium truncate max-w-[200px]">
          {state.basics.title || "Untitled"}
        </span>
        <span className="text-gray-500">·</span>
        <span className="text-gray-400">{state.duration.weeks}w program</span>
        <span className="text-gray-500">·</span>
        <span className="text-gray-400">
          {state.content.videos.length} video{state.content.videos.length !== 1 ? "s" : ""}
          {state.content.artifacts.length > 0 && `, ${state.content.artifacts.length} doc${state.content.artifacts.length !== 1 ? "s" : ""}`}
        </span>
        {state.vibe.vibePrompt && (
          <>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400 italic truncate max-w-[180px]">{state.vibe.vibePrompt}</span>
          </>
        )}
      </div>

      {/* Skin picker — hero feature */}
      <SkinPicker value={skinId} onChange={onSkinChange} />

      {/* No-content warning */}
      {totalContent === 0 && (
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

      {/* Generate button */}
      <div>
        <button
          onClick={onGenerate}
          disabled={isGenerating || totalContent === 0}
          className={`
            w-full py-4 rounded-xl font-semibold text-lg transition-all
            ${isGenerating || totalContent === 0
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
              Generating your program...
            </span>
          ) : (
            "Generate Program Structure"
          )}
        </button>
        <p className="text-center text-xs text-gray-500 mt-3">
          AI will analyze your content and build out weeks, sessions, and actions.
        </p>
      </div>
    </div>
  );
}
