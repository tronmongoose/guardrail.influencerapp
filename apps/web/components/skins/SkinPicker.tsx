"use client";

import { useState, useMemo, useEffect } from "react";
import { SKIN_CATEGORIES, getSkinCatalogEntry, SKIN_CATALOG } from "@/lib/skin-bundles/catalog";
import { SkinPreviewPanel } from "./SkinPreviewPanel";
import { SkinIcon, CategoryIcon, useCustomSkins, deleteCustomSkin } from "./skin-picker-shared";
import { SkinStudioModal } from "./SkinStudioModal";
import type { SkinTokens } from "@guide-rail/shared";

interface SkinPickerProps {
  value: string;
  onChange: (skinId: string) => void;
  thumbnailUrl?: string | null;
  /** Program id — required for the Skin Studio modal to generate/save. */
  programId: string;
  /** Program title shown in the preview panel + studio modal. */
  programTitle?: string;
  /** Called after a custom skin is created or refined via the studio. The
   *  parent can use the tokens to update its preview state optimistically. */
  onCustomSkinSaved?: (skinId: string, tokens: SkinTokens) => void | Promise<void>;
}

export function SkinPicker({ value, onChange, thumbnailUrl, programId, programTitle, onCustomSkinSaved }: SkinPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    if (value === "auto-generate" || value.startsWith("custom:")) return new Set(["my-brand"]);
    const entry = getSkinCatalogEntry(value);
    return entry ? new Set([entry.category]) : new Set();
  });
  // Mobile: active tab (category id)
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (value === "auto-generate" || value.startsWith("custom:")) return "my-brand";
    const entry = getSkinCatalogEntry(value);
    return entry?.category ?? "my-brand";
  });
  // Mobile: collapse skin list after selection to reveal preview
  const [mobileListCollapsed, setMobileListCollapsed] = useState(false);

  // Custom skins fetched from server
  const { customSkins, reloadCustomSkins } = useCustomSkins();

  // Skin Studio modal state
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioInitialSkinId, setStudioInitialSkinId] = useState<string | null>(null);
  const studioInitialSkin = studioInitialSkinId
    ? customSkins.find((s) => s.id === studioInitialSkinId) ?? null
    : null;

  function openStudio(skinId: string | null) {
    setStudioInitialSkinId(skinId);
    setStudioOpen(true);
  }

  async function handleSkinSaved(newSkinId: string, tokens: SkinTokens) {
    await reloadCustomSkins();
    setLastSelectedId(newSkinId);
    onChange(newSkinId);
    if (onCustomSkinSaved) await onCustomSkinSaved(newSkinId, tokens);
  }

  async function handleDeleteCustom(customId: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const ok = await deleteCustomSkin(customId);
    if (!ok) return;
    await reloadCustomSkins();
    // If the deleted skin was currently selected, revert to the classic fallback
    if (value === `custom:${customId}`) {
      setLastSelectedId("classic-minimal");
      onChange("classic-minimal");
    }
  }

  // When value changes externally, sync category state
  useEffect(() => {
    if (value === "auto-generate" || value.startsWith("custom:")) {
      setOpenCategories((prev) => {
        if (prev.has("my-brand")) return prev;
        return new Set([...prev, "my-brand"]);
      });
      setActiveTab("my-brand");
      return;
    }
    const entry = getSkinCatalogEntry(value);
    if (entry) {
      setOpenCategories((prev) => {
        if (prev.has(entry.category)) return prev;
        return new Set([...prev, entry.category]);
      });
      setActiveTab(entry.category);
    }
  }, [value]);

  const query = searchQuery.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!query) return SKIN_CATEGORIES;
    return SKIN_CATEGORIES.map((cat) => ({
      ...cat,
      skins: cat.skins.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          cat.label.toLowerCase().includes(query)
      ),
    })).filter((cat) => cat.skins.length > 0);
  }, [query]);

  const visibleCount = filteredCategories.reduce((n, c) => n + c.skins.length, 0);
  const isSearching = query.length > 0;

  const [hoveredSkinId, setHoveredSkinId] = useState<string | null>(null);
  // Track the last-clicked skin so the preview updates immediately,
  // even before the parent's onChange (which may be async) resolves.
  const [lastSelectedId, setLastSelectedId] = useState(value);
  useEffect(() => { setLastSelectedId(value); }, [value]);
  const previewSkinId = hoveredSkinId ?? lastSelectedId;

  // Resolve tokens for custom skin IDs so SkinPreviewPanel can render them
  const previewCustomTokens = useMemo<SkinTokens | undefined>(() => {
    if (previewSkinId.startsWith("custom:")) {
      const id = previewSkinId.replace("custom:", "");
      const found = customSkins.find((s) => s.id === id);
      return found?.tokens;
    }
    return undefined;
  }, [previewSkinId, customSkins]);

  function toggleCategory(catId: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // ── Shared skin row ──────────────────────────────────────────────────────────
  function SkinRow({ skinId, name, onSelect }: { skinId: string; name: string; onSelect?: () => void }) {
    const isSelected = value === skinId;
    const isHovered = hoveredSkinId === skinId;
    const isCustom = skinId.startsWith("custom:");
    const customId = isCustom ? skinId.replace("custom:", "") : null;
    // For custom skins, derive a color from the stored tokens for the icon
    const customTokens = customId
      ? customSkins.find((s) => s.id === customId)?.tokens
      : undefined;
    return (
      <div
        key={skinId}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors text-left group"
        style={{
          backgroundColor: isHovered
            ? "#f3f4f6"
            : isSelected
            ? "#f9fafb"
            : undefined,
        }}
        onMouseEnter={() => setHoveredSkinId(skinId)}
      >
        <button
          onClick={() => { setLastSelectedId(skinId); onChange(skinId); onSelect?.(); }}
          className="flex-1 flex items-center gap-2.5 text-left min-w-0"
        >
          {isCustom && customTokens ? (
            <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center overflow-hidden"
              style={{
                backgroundColor: customTokens.color.background.default,
                border: `1.5px solid ${customTokens.color.accent.primary}55`,
              }}>
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: customTokens.color.accent.primary }} />
            </div>
          ) : (
            <SkinIcon skinId={skinId} />
          )}
          <p
            className="flex-1 text-xs font-medium truncate"
            style={{ color: isSelected ? "#111827" : "#374151" }}
          >
            {name}
          </p>
        </button>
        {customId && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); openStudio(customId); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-600 p-0.5"
              aria-label="Edit skin"
              title="Edit in Skin Studio"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828 9 16l.172-2.828z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteCustom(customId, name); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 p-0.5"
              aria-label="Delete skin"
              title="Delete skin"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" />
              </svg>
            </button>
          </>
        )}
        {isSelected && !customId && (
          <svg className="flex-shrink-0 w-3.5 h-3.5" style={{ color: "#6366f1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <>
      {/* ══ DESKTOP layout (md+): side-by-side ══════════════════════════════════ */}
      <div
        className="hidden md:flex border border-gray-200 rounded-xl overflow-hidden shadow-sm"
        style={{ height: "min(560px, calc(100vh - 380px))", minHeight: 380 }}
        onMouseLeave={() => setHoveredSkinId(null)}
      >
        {/* Left panel — 25% */}
        <div
          className="flex flex-col bg-white flex-shrink-0 border-r border-gray-200"
          style={{ width: "25%", minWidth: 180 }}
          onMouseLeave={() => setHoveredSkinId(null)}
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-white sticky top-0 z-10 flex-shrink-0">
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search skins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400 min-w-0 text-gray-700"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 transition flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category list */}
          <div className="overflow-y-auto flex-1">
            {filteredCategories.map((cat) => {
              const isOpen = isSearching || openCategories.has(cat.id);
              return (
                <div key={cat.id} className="border-b border-gray-100 last:border-b-0">
                  <button
                    onClick={() => !isSearching && toggleCategory(cat.id)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition text-left"
                    style={{ cursor: isSearching ? "default" : "pointer" }}
                  >
                    <div className="flex items-center gap-2">
                      {!isSearching && (
                        <svg
                          className="w-3 h-3 transition-transform duration-200 flex-shrink-0 text-gray-400"
                          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      <span className="text-gray-500">
                        <CategoryIcon path={cat.icon} size={13} />
                      </span>
                      <span className="text-xs font-bold tracking-widest text-gray-700" style={{ letterSpacing: "0.08em" }}>
                        {cat.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{cat.skins.length}</span>
                  </button>

                  {isOpen && (
                    <div className="pb-1">
                      {cat.skins.map((skin) => (
                        <SkinRow key={skin.id} skinId={skin.id} name={skin.name} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No skins match &ldquo;{searchQuery}&rdquo;
              </div>
            )}

            {/* ── My Brand (bottom) ── */}
            {!isSearching && (
              <div className="border-t border-gray-100">
                <button
                  onClick={() => toggleCategory("my-brand")}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 transition-transform duration-200 flex-shrink-0 text-gray-400"
                      style={{ transform: openCategories.has("my-brand") ? "rotate(90deg)" : "rotate(0deg)" }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-gray-500">
                      <CategoryIcon path="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5z M8 14l-1 5 5-3 5 3-1-5" size={13} />
                    </span>
                    <span className="text-xs font-bold tracking-widest text-gray-700" style={{ letterSpacing: "0.08em" }}>
                      MY BRAND
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{1 + customSkins.length}</span>
                </button>

                {openCategories.has("my-brand") && (
                  <div className="pb-1">
                    {/* Build My Own tile — opens Skin Studio modal */}
                    <button
                      onClick={() => openStudio(null)}
                      onMouseEnter={() => setHoveredSkinId("auto-generate")}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors text-left"
                      style={{
                        backgroundColor: hoveredSkinId === "auto-generate"
                          ? "#f3f4f6"
                          : value === "auto-generate"
                          ? "#f9fafb"
                          : undefined,
                      }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)", border: "1.5px solid #a78bfa55" }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5zM3 18l2 2M19 4l2 2M3 4l2-2" />
                        </svg>
                      </div>
                      <p className="flex-1 text-xs font-medium truncate" style={{ color: "#374151" }}>
                        Build My Own…
                      </p>
                    </button>

                    {/* Existing custom skins */}
                    {customSkins.map((skin) => (
                      <SkinRow key={`custom:${skin.id}`} skinId={`custom:${skin.id}`} name={skin.name} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 text-center text-xs text-gray-400 flex-shrink-0 bg-white">
            {visibleCount} of {SKIN_CATALOG.length} skins
          </div>
        </div>

        {/* Right panel: preview */}
        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          {previewSkinId === "auto-generate" && customSkins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-10 text-center"
              style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5zM3 18l2 2M19 4l2 2M3 4l2-2" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">Design your brand skin</p>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                  Open the Skin Studio to generate a palette + typography, then fine-tune colors, radius, and shadows.
                </p>
              </div>
              <button
                onClick={() => openStudio(null)}
                className="w-full max-w-xs py-3.5 px-6 rounded-xl font-semibold text-white text-sm shadow-md transition-all"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #a855f7)",
                  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
                }}
              >
                ✦ Open Skin Studio
              </button>
            </div>
          ) : (
            <SkinPreviewPanel
              skinId={previewSkinId === "auto-generate" ? "custom" : previewSkinId}
              tokens={previewSkinId === "auto-generate" ? customSkins[0]?.tokens : previewCustomTokens}
              viewMode="desktop"
              thumbnailUrl={thumbnailUrl}
              programTitle={programTitle}
            />
          )}
        </div>
      </div>

      {/* ══ MOBILE layout (<md): selector-first, preview-below ═════════════════ */}
      <div
        className="flex flex-col md:hidden border border-gray-200 rounded-xl overflow-hidden shadow-sm"
        onMouseLeave={() => setHoveredSkinId(null)}
      >
        {/* Category tab strip — wrapped in relative container so we can overlay
            a right-edge fade + chevron, signaling there are more tabs offscreen.
            Without it users only saw the first ~3 categories and didn't realize
            the strip scrolled (9th-degree mobile 2026-05-24). */}
        <div className="relative flex-shrink-0 border-b border-gray-200 bg-white">
        <div
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {SKIN_CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setActiveTab(cat.id); setMobileListCollapsed(false); }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap"
                style={{
                  color: isActive ? "#4f46e5" : "#6b7280",
                  borderBottom: isActive ? "2px solid #4f46e5" : "2px solid transparent",
                  backgroundColor: isActive ? "#f5f3ff" : undefined,
                }}
              >
                <span style={{ color: isActive ? "#4f46e5" : "#9ca3af" }}>
                  <CategoryIcon path={cat.icon} size={12} />
                </span>
                {cat.label}
              </button>
            );
          })}
          {/* My Brand tab — at the end */}
          <button
            onClick={() => { setActiveTab("my-brand"); setMobileListCollapsed(false); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap"
            style={{
              color: activeTab === "my-brand" ? "#4f46e5" : "#6b7280",
              borderBottom: activeTab === "my-brand" ? "2px solid #4f46e5" : "2px solid transparent",
              backgroundColor: activeTab === "my-brand" ? "#f5f3ff" : undefined,
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
              stroke={activeTab === "my-brand" ? "#4f46e5" : "#9ca3af"}
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5z" />
            </svg>
            MY BRAND
          </button>
        </div>
          {/* Right-edge fade + chevron — visual cue that more tabs scroll into view */}
          <div
            className="pointer-events-none absolute top-0 right-0 h-full flex items-center pl-6 pr-2"
            style={{
              background: "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 50%, #ffffff 100%)",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Skin list for active tab — collapses after selection */}
        {!mobileListCollapsed && (
          <div
            className="overflow-y-auto bg-white border-b border-gray-200"
            style={{ maxHeight: 200 }}
            onMouseLeave={() => setHoveredSkinId(null)}
          >
            {activeTab === "my-brand" ? (
              <>
                <button
                  onClick={() => { openStudio(null); setMobileListCollapsed(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5z" />
                    </svg>
                  </div>
                  <p className="flex-1 text-xs font-medium text-gray-700">Build My Own…</p>
                </button>
                {customSkins.map((skin) => (
                  <SkinRow key={`custom:${skin.id}`} skinId={`custom:${skin.id}`} name={skin.name} onSelect={() => setMobileListCollapsed(true)} />
                ))}
              </>
            ) : (
              (SKIN_CATEGORIES.find((c) => c.id === activeTab)?.skins ?? []).map((skin) => (
                <SkinRow key={skin.id} skinId={skin.id} name={skin.name} onSelect={() => setMobileListCollapsed(true)} />
              ))
            )}
          </div>
        )}

        {/* Preview (bottom, taller) */}
        <div className="flex-shrink-0 overflow-hidden" style={{ height: 420 }}>
          {previewSkinId === "auto-generate" && customSkins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center"
              style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.2l-3.75 2.5 1.5-4.5L6 6.5h4.5z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Design your brand skin</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Open the Skin Studio to generate + fine-tune a palette tuned to your vibe.
                </p>
              </div>
              <button
                onClick={() => openStudio(null)}
                className="w-full py-3 px-5 rounded-xl font-semibold text-white text-sm shadow-md transition-all"
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
              >
                ✦ Open Skin Studio
              </button>
            </div>
          ) : (
            <SkinPreviewPanel
              skinId={previewSkinId === "auto-generate" ? "custom" : previewSkinId}
              tokens={previewSkinId === "auto-generate" ? customSkins[0]?.tokens : previewCustomTokens}
              viewMode="mobile"
              thumbnailUrl={thumbnailUrl}
              programTitle={programTitle}
            />
          )}
        </div>
      </div>

      <SkinStudioModal
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        programId={programId}
        programTitle={programTitle}
        thumbnailUrl={thumbnailUrl}
        initialSkin={studioInitialSkin}
        onSkinSaved={handleSkinSaved}
      />
    </>
  );
}
