"use client";

import { useState } from "react";

type EnhanceType =
  | "outcome"
  | "description"
  | "transformation"
  | "target_audience"
  | "session_summary"
  | "action_instructions"
  | "reflection_prompt"
  | "key_takeaway";

interface AiAssistButtonProps {
  /** Current text value to enhance */
  value: string;
  /** Enhancement type determines the AI prompt style */
  type: EnhanceType;
  /** Called with the enhanced text */
  onEnhance: (enhanced: string) => void;
  /** Optional context (e.g., program title + transformation) for better suggestions */
  context?: string;
  /** Minimum characters required before the button activates */
  minLength?: number;
  /** "icon" (default) = small icon only; "prominent" = labeled pill button */
  variant?: "icon" | "prominent";
}

export function AiAssistButton({
  value,
  type,
  onEnhance,
  context,
  minLength = 5,
  variant = "icon",
}: AiAssistButtonProps) {
  const [loading, setLoading] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEnhance = value.trim().length >= minLength;
  const canUndo = previousValue !== null;

  async function handleEnhance() {
    if (!canEnhance || loading) return;

    setPreviousValue(value);
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, type, context }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Enhancement failed");
      }

      const { enhanced } = await res.json();
      onEnhance(enhanced);
    } catch (err) {
      console.error("AI enhance failed:", err);
      setPreviousValue(null);
      setErrorMessage(err instanceof Error ? err.message : "Enhancement failed");
    } finally {
      setLoading(false);
    }
  }

  function handleUndo() {
    if (previousValue === null) return;
    onEnhance(previousValue);
    setPreviousValue(null);
  }

  const wandIcon = loading ? (
    <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 4l5 5L8 21l-5-2 2-5L15 4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3l1.5 1.5M3 6h1M6 3v1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13l1 1M19 13v1.5M18 14.5h1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (variant === "prominent") {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEnhance}
            disabled={!canEnhance || loading}
            title={canEnhance ? "Improve with AI" : `Type at least ${minLength} characters to use AI`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              canEnhance && !loading
                ? { background: "linear-gradient(135deg, rgba(0,255,200,0.15), rgba(255,0,128,0.15))", border: "1px solid rgba(0,255,200,0.35)", color: "#00ffc8" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280" }
            }
          >
            {wandIcon}
            {loading ? "Improving…" : "Improve with AI"}
          </button>
          {canUndo && !loading && (
            <button
              type="button"
              onClick={handleUndo}
              title="Undo AI suggestion"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-neon-pink hover:bg-neon-pink/10 transition"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 6L3 10l4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Undo
            </button>
          )}
        </div>
        {errorMessage && (
          <p className="text-xs text-red-400 mt-1.5">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleEnhance}
        disabled={!canEnhance || loading}
        title={canEnhance ? "Improve with AI" : `Type at least ${minLength} characters`}
        className="p-1 rounded transition disabled:opacity-30 text-gray-500 hover:text-neon-cyan hover:bg-neon-cyan/10"
      >
        {wandIcon}
      </button>
      {canUndo && !loading && (
        <button
          type="button"
          onClick={handleUndo}
          title="Undo AI suggestion"
          className="p-1 rounded text-gray-500 hover:text-neon-pink hover:bg-neon-pink/10 transition"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 6L3 10l4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </span>
  );
}
