"use client";

interface DurationPreset {
  weeks: number;
  ratioNote: string;
  label?: string;
  aiRecommended?: boolean;
}

interface DurationSelectorProps {
  value: number;
  onChange: (weeks: number) => void;
  pacingMode: "unlock_on_complete" | "drip_by_week";
  presets: DurationPreset[];
}

export function DurationSelector({
  value,
  onChange,
  pacingMode,
  presets,
}: DurationSelectorProps) {
  const unit = pacingMode === "unlock_on_complete" ? "sessions" : "lessons";

  return (
    <div className="grid grid-cols-3 gap-3">
      {presets.map((preset) => (
        <button
          key={preset.weeks}
          type="button"
          onClick={() => onChange(preset.weeks)}
          className={`
            relative py-4 px-4 rounded-xl border text-center transition-all
            ${
              value === preset.weeks
                ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-lg shadow-neon-cyan/20"
                : "bg-surface-card border-surface-border text-gray-400 hover:border-neon-cyan/50 hover:text-gray-300"
            }
          `}
        >
          {preset.aiRecommended && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/30 whitespace-nowrap">
              AI recommends
            </span>
          )}
          {preset.label && (
            <div className="text-[11px] font-medium opacity-60 mb-1">{preset.label}</div>
          )}
          <div className="text-2xl font-bold">{preset.weeks}</div>
          <div className="text-sm opacity-70">{unit}</div>
          <div className="text-xs mt-1 opacity-50">{preset.ratioNote}</div>
        </button>
      ))}
    </div>
  );
}
