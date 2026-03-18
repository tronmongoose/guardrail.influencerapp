"use client";

interface DurationSelectorProps {
  value: number;
  onChange: (weeks: number) => void;
  pacingMode: "unlock_on_complete" | "drip_by_week";
}

// MVP: Only 6, 8, 12 weeks
const DURATION_PRESETS = [
  { weeks: 6, label: "6 weeks", description: "Standard" },
  { weeks: 8, label: "8 weeks", description: "Deep dive" },
  { weeks: 12, label: "12 weeks", description: "Comprehensive" },
];

export function DurationSelector({
  value,
  onChange,
  pacingMode,
}: DurationSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Preset buttons */}
      <div className="grid grid-cols-3 gap-3">
        {DURATION_PRESETS.map((preset) => (
          <button
            key={preset.weeks}
            type="button"
            onClick={() => onChange(preset.weeks)}
            className={`
              py-4 px-4 rounded-xl border text-center transition-all
              ${
                value === preset.weeks
                  ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-lg shadow-neon-cyan/20"
                  : "bg-surface-card border-surface-border text-gray-400 hover:border-neon-cyan/50 hover:text-gray-300"
              }
            `}
          >
            <div className="text-2xl font-bold">{preset.weeks}</div>
            <div className="text-sm opacity-70">{pacingMode === "unlock_on_complete" ? "sessions" : "weeks"}</div>
            <div className="text-xs mt-1 opacity-50">{preset.description}</div>
          </button>
        ))}
      </div>

      {/* Visual preview */}
      <div className="mt-4 p-4 bg-surface-dark rounded-lg border border-surface-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Program Timeline</span>
          <span className="text-sm font-medium text-white">
            {value} {pacingMode === "unlock_on_complete" ? "sessions" : "weeks"}
          </span>
        </div>
        <div className="h-3 bg-surface-card rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink rounded-full transition-all duration-300"
            style={{ width: `${(value / 12) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{pacingMode === "unlock_on_complete" ? "6s" : "6w"}</span>
          <span>{pacingMode === "unlock_on_complete" ? "8s" : "8w"}</span>
          <span>{pacingMode === "unlock_on_complete" ? "12s" : "12w"}</span>
        </div>
      </div>

      {/* Sessions estimate */}
      <div className="text-center text-sm text-gray-400">
        <span className="text-neon-cyan font-medium">{value}</span> {pacingMode === "unlock_on_complete" ? "sessions" : "weeks"} = approximately{" "}
        <span className="text-neon-pink font-medium">{value * 2}</span> to{" "}
        <span className="text-neon-pink font-medium">{value * 3}</span> sessions
      </div>
    </div>
  );
}
