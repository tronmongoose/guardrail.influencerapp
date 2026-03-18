"use client";

import { useState, useCallback } from "react";
import { ACTION_TYPE_LABELS, getActionTypeColor, getActionTypeBgWithBorder } from "@/lib/action-type-styles";

export interface ViewerAction {
  id: string;
  title: string;
  type: string;
  instructions: string | null;
  reflectionPrompt: string | null;
  completed: boolean;
  reflectionText?: string;
}

export interface ActionsPanelProps {
  actions: ViewerAction[];
  userId: string;
  onActionComplete?: (actionId: string) => void;
}

const REFLECT_MIN_CHARS = 20;

export function ActionsPanel({ actions, userId, onActionComplete }: ActionsPanelProps) {
  const [completedSet, setCompletedSet] = useState<Set<string>>(
    () => new Set(actions.filter((a) => a.completed).map((a) => a.id))
  );
  const [reflections, setReflections] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const a of actions) {
      if (a.reflectionText) map[a.id] = a.reflectionText;
    }
    return map;
  });
  // Draft text for in-progress REFLECT actions (separate from saved reflections)
  const [reflectDraft, setReflectDraft] = useState<Record<string, string>>({});
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const markComplete = useCallback(
    async (actionId: string, reflectionText?: string) => {
      setSavingAction(actionId);
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionId,
            userId,
            completed: true,
            reflectionText: reflectionText || undefined,
          }),
        });
        if (res.ok) {
          setCompletedSet((prev) => new Set(prev).add(actionId));
          if (reflectionText) {
            setReflections((prev) => ({ ...prev, [actionId]: reflectionText }));
          }
          onActionComplete?.(actionId);
        }
      } finally {
        setSavingAction(null);
      }
    },
    [userId, onActionComplete]
  );

  if (actions.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3
        className="text-sm font-semibold px-1"
        style={{ color: "var(--token-color-text-secondary)" }}
      >
        Actions
      </h3>
      <div className="space-y-2">
        {actions.map((action) => {
          const isComplete = completedSet.has(action.id);
          const isSaving = savingAction === action.id;
          const isExpanded = expandedAction === action.id;
          const isReflect = action.type === "REFLECT";
          const draft = reflectDraft[action.id] ?? "";
          const charCount = draft.trim().length;
          const canSubmit = charCount >= REFLECT_MIN_CHARS;

          return (
            <div
              key={action.id}
              className="rounded-lg border p-3 transition-colors"
              style={{
                ...getActionTypeBgWithBorder(action.type),
                opacity: isComplete ? 0.65 : 1,
              }}
            >
              {/* Row header — always visible */}
              <button
                onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                className="flex w-full items-center gap-3 text-left"
              >
                {/* Completion circle */}
                <div
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                  style={{
                    borderColor: isComplete
                      ? "var(--token-color-semantic-success)"
                      : "var(--token-color-border-subtle)",
                    backgroundColor: isComplete
                      ? "var(--token-color-semantic-success)"
                      : "transparent",
                  }}
                >
                  {isComplete && (
                    <svg className="h-3 w-3" style={{ color: "var(--token-color-bg-default)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={getActionTypeColor(action.type)}
                    >
                      {ACTION_TYPE_LABELS[action.type] || action.type}
                    </span>
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--token-color-text-primary)" }}
                    >
                      {action.title}
                    </span>
                  </div>
                </div>

                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  style={{ color: "var(--token-color-text-secondary)" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="mt-3 pl-8 space-y-3">
                  {/* Instructions / description */}
                  {action.instructions && (
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--token-color-text-secondary)" }}
                    >
                      {action.instructions}
                    </p>
                  )}

                  {isReflect ? (
                    isComplete ? (
                      /* ── Saved confirmation state ── */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: "var(--token-color-semantic-success)" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span
                            className="text-sm"
                            style={{ color: "var(--token-color-text-secondary)" }}
                          >
                            Reflection saved
                          </span>
                        </div>
                        {reflections[action.id] && (
                          <p
                            className="text-sm leading-relaxed rounded-xl px-4 py-3"
                            style={{
                              backgroundColor: "rgba(0,0,0,0.04)",
                              color: "var(--token-color-text-primary)",
                            }}
                          >
                            {reflections[action.id]}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* ── Active reflection input ── */
                      <div className="space-y-3">
                        {action.reflectionPrompt && (
                          <p
                            className="text-sm italic"
                            style={{ color: "var(--token-color-text-secondary)" }}
                          >
                            {action.reflectionPrompt}
                          </p>
                        )}

                        {/* Textarea + char count */}
                        <div className="space-y-1">
                          <textarea
                            value={draft}
                            onChange={(e) =>
                              setReflectDraft((prev) => ({
                                ...prev,
                                [action.id]: e.target.value,
                              }))
                            }
                            placeholder="What did this bring up for you? There's no wrong answer."
                            rows={4}
                            className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none"
                            style={{
                              backgroundColor: "rgba(0,0,0,0.04)",
                              border: "none",
                              color: "var(--token-color-text-primary)",
                              minHeight: "7rem",
                            }}
                          />
                          <div className="flex justify-end pr-1">
                            <span
                              className="text-xs tabular-nums transition-colors"
                              style={{
                                color: canSubmit
                                  ? "var(--token-color-text-secondary)"
                                  : "var(--token-color-text-tertiary, #9ca3af)",
                              }}
                            >
                              {charCount} / {REFLECT_MIN_CHARS} min
                            </span>
                          </div>
                        </div>

                        {/* Full-width submit */}
                        <button
                          onClick={() => markComplete(action.id, draft.trim())}
                          disabled={!canSubmit || isSaving}
                          className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
                          style={{
                            backgroundColor:
                              canSubmit && !isSaving
                                ? "var(--token-color-accent)"
                                : "rgba(0,0,0,0.08)",
                            color:
                              canSubmit && !isSaving
                                ? "var(--token-comp-viewer-overlay-text)"
                                : "var(--token-color-text-secondary)",
                            cursor: canSubmit && !isSaving ? "pointer" : "default",
                          }}
                        >
                          {isSaving ? "Saving…" : "Save reflection & complete"}
                        </button>
                      </div>
                    )
                  ) : (
                    /* ── Non-REFLECT: plain Mark Complete ── */
                    !isComplete && (
                      <button
                        onClick={() => markComplete(action.id)}
                        disabled={isSaving}
                        className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--token-color-accent)",
                          color: "var(--token-comp-viewer-overlay-text)",
                        }}
                      >
                        {isSaving ? "Saving…" : "Mark Complete"}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
