"use client";

import { useEffect, useRef } from "react";
import { DurationSelector } from "@/components/duration/DurationSelector";
import { computeSmartPresets } from "@guide-rail/ai";
import type { VideoInfo } from "@guide-rail/ai";

interface StepDurationProps {
  weeks: number;
  videos: VideoInfo[];
  aiStructured: boolean;
  followUploadOrder: boolean;
  onWeeksChange: (weeks: number) => void;
  onAiStructuredChange: (v: boolean) => void;
  onFollowUploadOrderChange: (v: boolean) => void;
}

export function StepDuration({
  weeks,
  videos,
  aiStructured,
  followUploadOrder,
  onWeeksChange,
  onAiStructuredChange,
  onFollowUploadOrderChange,
}: StepDurationProps) {
  const videoCount = videos.length;
  const presets = computeSmartPresets(videoCount, videos);

  // AI mode: pass videoCount as a soft starting point. Gemini's natural topic
  // structure drives the actual lesson count downstream; weeks here is just a hint.
  const prevAiWeeks = useRef<number | null>(null);
  useEffect(() => {
    if (!aiStructured) return;
    const target = Math.max(2, videoCount);
    if (target !== prevAiWeeks.current) {
      prevAiWeeks.current = target;
      onWeeksChange(target);
    }
  }, [aiStructured, videoCount, onWeeksChange]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Program Structure</h2>
        <p className="text-gray-400 text-sm mb-4">
          How should we determine your program structure?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Let AI Decide — default, left position */}
          <button
            type="button"
            onClick={() => onAiStructuredChange(true)}
            className={`
              p-4 rounded-xl border text-left transition-all
              ${aiStructured
                ? "border-neon-pink bg-neon-pink/10"
                : "border-surface-border bg-surface-dark hover:border-gray-500"
              }
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`
                  flex-shrink-0 p-2 rounded-lg
                  ${aiStructured ? "bg-neon-pink/20 text-neon-pink" : "bg-surface-card text-gray-400"}
                `}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium ${aiStructured ? "text-neon-pink" : "text-white"}`}>
                  Let AI decide
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Crafts a learning arc tuned to your content's natural rhythm
                </p>
              </div>
            </div>
          </button>

          {/* Quick Setup */}
          <button
            type="button"
            onClick={() => onAiStructuredChange(false)}
            className={`
              p-4 rounded-xl border text-left transition-all
              ${!aiStructured
                ? "border-neon-cyan bg-neon-cyan/10"
                : "border-surface-border bg-surface-dark hover:border-gray-500"
              }
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`
                  flex-shrink-0 p-2 rounded-lg
                  ${!aiStructured ? "bg-neon-cyan/20 text-neon-cyan" : "bg-surface-card text-gray-400"}
                `}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium ${!aiStructured ? "text-neon-cyan" : "text-white"}`}>
                  Quick setup
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Choose your program length from presets
                </p>
              </div>
            </div>
          </button>
        </div>

        {aiStructured && videoCount >= 3 && (
          <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={followUploadOrder}
              onChange={(e) => onFollowUploadOrderChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-border bg-surface-dark text-neon-pink focus:ring-neon-pink focus:ring-offset-0 cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Follow my upload order</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Keep videos in the order you uploaded them. Otherwise the AI chooses which video opens the program.
              </p>
            </div>
          </label>
        )}
      </div>

      {!aiStructured && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">Program Length</h2>
          <p className="text-gray-400 text-sm mb-4">
            Pick the pace that fits.
          </p>

          <DurationSelector
            value={weeks}
            onChange={onWeeksChange}
            pacingMode="unlock_on_complete"
            presets={presets}
          />
        </div>
      )}
    </div>
  );
}
