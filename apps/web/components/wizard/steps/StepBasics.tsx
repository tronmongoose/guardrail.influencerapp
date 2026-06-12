"use client";

import { AiAssistButton } from "@/components/ui/AiAssistButton";

interface StepBasicsProps {
  value: {
    title: string;
    description: string;
    outcomeStatement: string;
    targetAudience: string;
    targetTransformation: string;
  };
  onChange: (value: Partial<StepBasicsProps["value"]>) => void;
}

export function StepBasics({ value, onChange }: StepBasicsProps) {
  const aiContext = [value.title, value.targetTransformation].filter(Boolean).join(" — ");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Program Basics</h2>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Program Name <span className="text-neon-pink">*</span>
        </label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., Strength Foundation"
          className="w-full px-4 py-3 bg-surface-dark border border-surface-border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
        />
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Who is this for?
        </label>
        <p className="text-xs text-gray-500 mb-2">
          A quick sketch of who this is for — their background, skill level, and what they&apos;re trying to solve.
        </p>
        <textarea
          value={value.targetAudience}
          onChange={(e) => onChange({ targetAudience: e.target.value })}
          placeholder="e.g., beginner fitness creators looking to build their first online program"
          rows={2}
          className="w-full px-4 py-3 bg-surface-dark border border-surface-border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none"
        />
        <AiAssistButton
          value={value.targetAudience}
          type="target_audience"
          context={aiContext}
          onEnhance={(enhanced) => onChange({ targetAudience: enhanced })}
          variant="prominent"
        />
      </div>

      {/* Target Transformation */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Target Transformation <span className="text-neon-pink">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          What specific outcome will learners achieve? This drives your entire program.
        </p>
        <textarea
          value={value.targetTransformation}
          onChange={(e) => onChange({ targetTransformation: e.target.value })}
          placeholder="e.g., Build a consistent workout habit and gain 10lbs of lean muscle in 90 days"
          rows={2}
          className="w-full px-4 py-3 bg-surface-dark border border-surface-border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none"
        />
        <AiAssistButton
          value={value.targetTransformation}
          type="transformation"
          context={aiContext}
          onEnhance={(enhanced) => onChange({ targetTransformation: enhanced })}
          variant="prominent"
        />
      </div>

      {/* Tips */}
      <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
        <h4 className="text-sm font-medium text-neon-cyan mb-2">What helps the AI the most:</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• A specific audience (e.g., &quot;beginner runners&quot; beats &quot;fitness people&quot;)</li>
          <li>• A measurable transformation (e.g., &quot;run a 5K in 60 days&quot; beats &quot;get fit&quot;)</li>
          <li>• Anything is better than nothing — you can refine it all after generation</li>
          <li>• Type a rough draft and hit <strong className="text-neon-cyan">Improve with AI</strong> to polish it instantly</li>
        </ul>
      </div>
    </div>
  );
}
