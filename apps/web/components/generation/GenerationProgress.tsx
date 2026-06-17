"use client";

import { useState, useEffect } from "react";
import { useGenerationSteps } from "./useGenerationSteps";
import { GenerationSteps } from "./GenerationSteps";

const AMBIENT_HEADERS = [
  "Great content deserves great structure",
  "Your expertise is becoming a program",
  "Turning knowledge into transformation",
  "Every lesson is being crafted with intention",
  "Building something your learners will love",
];

interface GenerationProgressProps {
  stage: string | null;
  progress: number;
  onCancel?: () => void;
  creatorEmail?: string;
  programTitle?: string;
}

export function GenerationProgress({ stage, progress, onCancel, creatorEmail, programTitle }: GenerationProgressProps) {
  const stepsData = useGenerationSteps({ stage, progress, status: "PROCESSING" });
  const [headerIndex, setHeaderIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderIndex((prev) => (prev + 1) % AMBIENT_HEADERS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-pink-900/30 border border-pink-700/50 flex items-center justify-center generation-icon-glow">
        <svg className="w-10 h-10 text-pink-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

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
        estimatedMinutesRemaining={stepsData.estimatedMinutesRemaining}
        variant="full"
      />

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
