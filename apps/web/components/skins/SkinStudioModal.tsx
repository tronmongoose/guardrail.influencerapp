"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SkinTokens } from "@guide-rail/shared";
import { RADIUS_PRESETS, SHADOW_PRESETS, FONT_PRESETS, applyFontPreset } from "@guide-rail/shared";
import type { RadiusPresetId, ShadowPresetId, FontPresetId } from "@guide-rail/shared";
import { SkinPreviewPanel } from "./SkinPreviewPanel";
import { findEmojis } from "@/lib/skin-emoji-library";
import { pickColorFromPrompt, type DetectedColor } from "@/lib/skin-color-library";

interface SkinStudioModalProps {
  open: boolean;
  onClose: () => void;
  programId: string;
  programTitle?: string;
  thumbnailUrl?: string | null;
  /** Existing custom skin to refine. When absent, modal opens in seed mode. */
  initialSkin?: { id: string; name: string; tokens: SkinTokens } | null;
  /** Called when a skin has been created or updated. Passes `custom:{id}` and
   *  the full token set so the parent can update UI state optimistically
   *  without waiting for a refetch. */
  onSkinSaved: (skinId: string, tokens: SkinTokens) => void | Promise<void>;
}

type ColorKey =
  | "bg.default"
  | "bg.elevated"
  | "text.primary"
  | "text.secondary"
  | "accent.primary"
  | "accent.secondary";

const COLOR_FIELDS: { key: ColorKey; label: string }[] = [
  { key: "bg.default",      label: "Background" },
  { key: "bg.elevated",     label: "Surface" },
  { key: "text.primary",    label: "Text" },
  { key: "text.secondary",  label: "Muted text" },
  { key: "accent.primary",  label: "Accent" },
  { key: "accent.secondary", label: "Accent 2" },
];

function getColor(tokens: SkinTokens, key: ColorKey): string {
  switch (key) {
    case "bg.default":       return tokens.color.background.default;
    case "bg.elevated":      return tokens.color.background.elevated;
    case "text.primary":     return tokens.color.text.primary;
    case "text.secondary":   return tokens.color.text.secondary;
    case "accent.primary":   return tokens.color.accent.primary;
    case "accent.secondary": return tokens.color.accent.secondary;
  }
}

function setColor(tokens: SkinTokens, key: ColorKey, value: string): SkinTokens {
  const next = structuredClone(tokens);
  switch (key) {
    case "bg.default":       next.color.background.default = value; break;
    case "bg.elevated":      next.color.background.elevated = value; break;
    case "text.primary":     next.color.text.primary = value; break;
    case "text.secondary":   next.color.text.secondary = value; break;
    case "accent.primary":   next.color.accent.primary = value; break;
    case "accent.secondary": next.color.accent.secondary = value; break;
  }
  return next;
}

export function SkinStudioModal({
  open,
  onClose,
  programId,
  programTitle,
  thumbnailUrl,
  initialSkin,
  onSkinSaved,
}: SkinStudioModalProps) {
  const [workingTokens, setWorkingTokens] = useState<SkinTokens | null>(initialSkin?.tokens ?? null);
  const [workingSkinId, setWorkingSkinId] = useState<string | null>(initialSkin?.id ?? null);
  /** Vibe prompt — goes to the LLM only. */
  const [prompt, setPrompt] = useState("");
  /** Emoji search query — used to populate the match grid. */
  const [emojiQuery, setEmojiQuery] = useState("");
  /** Selected emojis, in insertion order. Cycles through floating decorations.
   *  Seeded from the stored skin's `meta.emojis` so choices persist across
   *  modal opens. */
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>(
    () => initialSkin?.tokens?.meta?.emojis ?? [],
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Exclusive accordions — at most one open at a time so the controls panel
  // stays compact and the preview stays visible.
  type OpenSection = "colors" | "feel" | null;
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const toggleSection = (s: Exclude<OpenSection, null>) =>
    setOpenSection((cur) => (cur === s ? null : s));

  // Emoji match grid — updated live as the user types
  const emojiMatches = useMemo(() => findEmojis(emojiQuery, 12), [emojiQuery]);

  // Color detection — scanned from the vibe prompt. Only shows the chip when
  // there are working tokens to apply it to.
  const detectedColor = useMemo<DetectedColor | null>(
    () => pickColorFromPrompt(prompt),
    [prompt],
  );

  // Sync when modal reopens with a different skin
  useEffect(() => {
    if (!open) return;
    setWorkingTokens(initialSkin?.tokens ?? null);
    setWorkingSkinId(initialSkin?.id ?? null);
    setPrompt("");
    setEmojiQuery("");
    setSelectedEmojis(initialSkin?.tokens?.meta?.emojis ?? []);
    setOpenSection(null);
    setError(null);
    setDirty(false);
  }, [open, initialSkin]);

  // ESC to close
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  if (!open) return null;

  const isSeedMode = !workingTokens;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const promptUsed = prompt.trim();
    try {
      const body: Record<string, string> = {};
      if (promptUsed) {
        body[isSeedMode ? "seedPrompt" : "refinementPrompt"] = promptUsed;
      }
      const res = await fetch(`/api/programs/${programId}/skin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { customSkinId: string | null; tokens: SkinTokens | null } = await res.json();
      if (!data.tokens || !data.customSkinId) {
        setError("Generation unavailable — check LLM_PROVIDER and API keys.");
        return;
      }
      setWorkingTokens(data.tokens);
      setWorkingSkinId(data.customSkinId);
      setPrompt("");
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  // ── Emoji multi-select helpers ─────────────────────────────────────────────
  function addEmoji(emoji: string) {
    setSelectedEmojis((prev) => (prev.includes(emoji) ? prev : [...prev, emoji]));
    setDirty(true);
  }
  function removeEmoji(emoji: string) {
    setSelectedEmojis((prev) => prev.filter((e) => e !== emoji));
    setDirty(true);
  }

  // ── Color apply ─────────────────────────────────────────────────────────────
  function applyDetectedColor(color: DetectedColor) {
    if (!workingTokens) return;
    const next = structuredClone(workingTokens);
    next.color.accent.primary = color.primary;
    next.color.accent.secondary = color.secondary;
    next.color.accentHover = color.primary;
    // Cascade through component tokens that reference accent colors directly.
    next.component.progress.fill = color.primary;
    if (color.gradient) {
      next.color.background.gradient = color.gradient;
    } else {
      // Clearing any previous gradient when the user picks a solid color.
      delete next.color.background.gradient;
    }
    setWorkingTokens(next);
    setDirty(true);
  }

  function applyFontPresetId(id: FontPresetId) {
    if (!workingTokens) return;
    const preset = FONT_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const next = structuredClone(workingTokens);
    applyFontPreset(next.text, preset);
    setWorkingTokens(next);
    setDirty(true);
  }

  function updateColor(key: ColorKey, value: string) {
    if (!workingTokens) return;
    setWorkingTokens(setColor(workingTokens, key, value));
    setDirty(true);
  }

  function applyRadiusPreset(id: RadiusPresetId) {
    if (!workingTokens) return;
    const preset = RADIUS_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const next = structuredClone(workingTokens);
    next.radius = { ...preset.values };
    // Propagate to component-level radius tokens so the preset actually moves
    // buttons, cards, videos, and progress bars — not just the base scale.
    next.component.button.primary.radius = preset.values.md;
    next.component.button.secondary.radius = preset.values.md;
    next.component.card.radius = preset.values.lg;
    next.component.progress.radius = preset.values.sm;
    next.component.video.frame.radius = preset.values.md;
    // Chips stay pill-shaped for "pillow", but flatten when the whole system
    // is sharp (pill chips look odd next to sharp cards).
    if (id === "sharp") next.component.chip.radius = preset.values.md;
    setWorkingTokens(next);
    setDirty(true);
  }

  function applyShadowPreset(id: ShadowPresetId) {
    if (!workingTokens) return;
    const preset = SHADOW_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const next = structuredClone(workingTokens);
    next.shadow = { ...preset.values };
    next.component.card.shadow = preset.values.md;
    setWorkingTokens(next);
    setDirty(true);
  }

  async function handleSave() {
    if (!workingTokens || !workingSkinId) return;
    setSaving(true);
    setError(null);
    try {
      // Fold the emoji selection into the tokens blob so it survives save →
      // reload → editor preview. An empty array is a valid "cleared" state —
      // getSkinDecorations falls back to category defaults when the list is
      // empty or missing.
      const tokensToSave: SkinTokens = {
        ...workingTokens,
        meta: { ...(workingTokens.meta ?? {}), emojis: selectedEmojis },
      };
      let savedTokens = tokensToSave;
      if (dirty) {
        const res = await fetch(`/api/skins/custom/${workingSkinId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tokens: tokensToSave }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data?.tokens) savedTokens = data.tokens as SkinTokens;
      }
      // Await the parent so any server round-trip (PATCH /api/programs/[id],
      // reload) finishes before we close. Otherwise a stale preview flickers.
      await onSkinSaved(`custom:${workingSkinId}`, savedTokens);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col max-w-[960px] md:max-w-[1040px] max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Skin Studio</h2>
              <p className="text-xs text-gray-500">{isSeedMode ? "Generate your brand skin" : "Refine your skin"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — responsive split: stacked on mobile, side-by-side on desktop */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Preview (left on desktop, takes all available height) */}
          <div
            className="border-b md:border-b-0 md:border-r border-gray-200 flex-shrink-0 md:flex-1 h-[280px] md:h-auto overflow-hidden"
            style={{ overscrollBehavior: "contain" }}
          >
            {workingTokens ? (
              <SkinPreviewPanel
                skinId="custom"
                tokens={workingTokens}
                viewMode="mobile"
                thumbnailUrl={thumbnailUrl}
                programTitle={programTitle}
                customEmojis={selectedEmojis.length > 0 ? selectedEmojis : null}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center"
                style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)" }}
              >
                <p className="text-sm font-medium text-gray-700">No skin generated yet</p>
                <p className="text-xs text-gray-500 max-w-sm">
                  Describe your vibe below (optional) and click <strong>Generate</strong> — AI will craft a palette + typography tuned to your program.
                </p>
              </div>
            )}
          </div>

          {/* Controls column (right on desktop) — independently scrollable */}
          <div className="flex-1 md:flex-none md:w-[420px] overflow-y-auto">

          {/* Vibe + emoji — two independent inputs */}
          <div className="px-5 py-4 border-b border-gray-200 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {isSeedMode ? "Describe the vibe" : "Refine with a prompt"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={isSeedMode ? "e.g. warm brown, ocean to sunset gradient" : "e.g. make it cooler and more minimalist"}
                  className="flex-1 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  disabled={generating}
                />
                {/* Inline button only in refine mode — seed mode uses the footer CTA */}
                {!isSeedMode && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white whitespace-nowrap transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: generating
                        ? "linear-gradient(135deg, #a5b4fc, #d8b4fe)"
                        : "linear-gradient(135deg, #6366f1, #a855f7)",
                    }}
                  >
                    {generating ? "Generating…" : "✦ Regenerate"}
                  </button>
                )}
              </div>
              {detectedColor && workingTokens && (
                <button
                  onClick={() => applyDetectedColor(detectedColor)}
                  className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition text-xs font-medium text-indigo-800"
                >
                  <span
                    className="inline-block w-4 h-4 rounded-full border border-white/40 flex-shrink-0"
                    style={{ background: detectedColor.gradient ?? detectedColor.primary }}
                    aria-hidden
                  />
                  Apply {detectedColor.summary}
                </button>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Floating emoji
                </label>
                <span className="text-[10px] text-gray-400">
                  {selectedEmojis.length > 0 ? `${selectedEmojis.length} selected` : "Tap to add"}
                </span>
              </div>
              <input
                type="text"
                value={emojiQuery}
                onChange={(e) => setEmojiQuery(e.target.value)}
                placeholder="Search: coffee, monkey, yoga…"
                className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
              {/* Match grid */}
              {emojiMatches.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {emojiMatches.map((emoji) => {
                    const active = selectedEmojis.includes(emoji);
                    return (
                      <button
                        key={emoji}
                        onClick={() => (active ? removeEmoji(emoji) : addEmoji(emoji))}
                        className="w-9 h-9 rounded-lg text-xl flex items-center justify-center border transition"
                        style={{
                          backgroundColor: active ? "#eef2ff" : "white",
                          borderColor: active ? "#6366f1" : "#e5e7eb",
                        }}
                        aria-pressed={active}
                        aria-label={active ? `Remove ${emoji}` : `Add ${emoji}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Selected chips */}
              {selectedEmojis.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                  {selectedEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => removeEmoji(emoji)}
                      className="inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-sm hover:bg-indigo-100 transition"
                      aria-label={`Remove ${emoji}`}
                    >
                      <span>{emoji}</span>
                      <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          {/* Manual controls — collapsible so the landing view stays compact */}
          <div
            className="divide-y divide-gray-200"
            style={{ opacity: workingTokens ? 1 : 0.4, pointerEvents: workingTokens ? "auto" : "none" }}
          >
            {/* Colors accordion */}
            <section>
              <button
                onClick={() => toggleSection("colors")}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                aria-expanded={openSection === "colors"}
              >
                <span className="text-xs font-semibold text-gray-700">Colors</span>
                <svg
                  className="w-3.5 h-3.5 text-gray-400 transition-transform"
                  style={{ transform: openSection === "colors" ? "rotate(90deg)" : "rotate(0deg)" }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {openSection === "colors" && (
                <div className="px-5 pb-4">
                  <div className="space-y-1.5">
                    {COLOR_FIELDS.map((f) => {
                      const current = workingTokens ? getColor(workingTokens, f.key) : "#000000";
                      return (
                        <div key={f.key} className="flex items-center gap-2.5">
                          <input
                            type="color"
                            value={current}
                            onChange={(e) => updateColor(f.key, e.target.value)}
                            className="w-9 h-8 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                            aria-label={f.label}
                          />
                          <span className="text-xs text-gray-700 flex-1">{f.label}</span>
                          <span className="text-[11px] font-mono text-gray-400 uppercase">{current}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Feel accordion */}
            <section>
              <button
                onClick={() => toggleSection("feel")}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                aria-expanded={openSection === "feel"}
              >
                <span className="text-xs font-semibold text-gray-700">Feel</span>
                <svg
                  className="w-3.5 h-3.5 text-gray-400 transition-transform"
                  style={{ transform: openSection === "feel" ? "rotate(90deg)" : "rotate(0deg)" }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {openSection === "feel" && (
                <div className="px-5 pb-4 space-y-3">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Radius</p>
                    <div className="flex gap-1.5">
                      {RADIUS_PRESETS.map((p) => {
                        const isActive = workingTokens?.radius.md === p.values.md;
                        return (
                          <button
                            key={p.id}
                            onClick={() => applyRadiusPreset(p.id)}
                            className="flex-1 px-2 py-1.5 text-xs rounded-md border transition"
                            style={{
                              backgroundColor: isActive ? "#eef2ff" : "white",
                              borderColor: isActive ? "#6366f1" : "#e5e7eb",
                              color: isActive ? "#4338ca" : "#374151",
                              fontWeight: isActive ? 600 : 500,
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Shadow</p>
                    <div className="flex gap-1.5">
                      {SHADOW_PRESETS.map((p) => {
                        const isActive = workingTokens?.shadow.md === p.values.md;
                        return (
                          <button
                            key={p.id}
                            onClick={() => applyShadowPreset(p.id)}
                            className="flex-1 px-2 py-1.5 text-xs rounded-md border transition"
                            style={{
                              backgroundColor: isActive ? "#eef2ff" : "white",
                              borderColor: isActive ? "#6366f1" : "#e5e7eb",
                              color: isActive ? "#4338ca" : "#374151",
                              fontWeight: isActive ? 600 : 500,
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Font</p>
                    <div className="flex gap-1.5">
                      {FONT_PRESETS.map((p) => {
                        const isActive = workingTokens?.text.body.md.font === p.body.family;
                        return (
                          <button
                            key={p.id}
                            onClick={() => applyFontPresetId(p.id)}
                            className="flex-1 px-2 py-1.5 text-xs rounded-md border transition leading-tight"
                            style={{
                              backgroundColor: isActive ? "#eef2ff" : "white",
                              borderColor: isActive ? "#6366f1" : "#e5e7eb",
                              color: isActive ? "#4338ca" : "#374151",
                              fontWeight: isActive ? 600 : 500,
                            }}
                          >
                            <span className="block">{p.label}</span>
                            <span
                              className="block text-[9px] font-normal text-gray-400 mt-0.5 truncate"
                              style={{ fontFamily: p.heading.family }}
                            >
                              {p.sample}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          </div>{/* /controls column */}
        </div>{/* /body split */}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          {isSeedMode ? (
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: generating
                  ? "linear-gradient(135deg, #a5b4fc, #d8b4fe)"
                  : "linear-gradient(135deg, #6366f1, #a855f7)",
              }}
            >
              {generating ? "Generating…" : "✦ Generate My Skin"}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!workingTokens || !workingSkinId || saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#4f46e5" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
