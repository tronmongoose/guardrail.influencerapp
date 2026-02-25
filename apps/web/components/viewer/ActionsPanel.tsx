"use client";

import { useState, useCallback } from "react";

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

const ACTION_TYPE_VERBS: Record<string, string> = {
  WATCH: "Watch",
  READ: "Read",
  DO: "Practice",
  REFLECT: "Reflect",
};

function getActionTypeStyle(type: string): React.CSSProperties {
  switch (type) {
    case "WATCH":
    case "READ":
      return { color: "var(--token-color-accent)" };
    case "REFLECT":
      return { color: "var(--token-color-semantic-action-reflect)" };
    case "DO":
      return { color: "var(--token-color-semantic-action-do)" };
    default:
      return { color: "var(--token-color-text-secondary)" };
  }
}

function getActionTypeBgStyle(type: string): React.CSSProperties {
  switch (type) {
    case "WATCH":
    case "READ":
      return {
        backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 90%)",
        borderColor: "color-mix(in srgb, var(--token-color-accent), transparent 70%)",
      };
    case "REFLECT":
      return {
        backgroundColor: "color-mix(in srgb, var(--token-color-semantic-action-reflect), transparent 90%)",
        borderColor: "color-mix(in srgb, var(--token-color-semantic-action-reflect), transparent 70%)",
      };
    case "DO":
      return {
        backgroundColor: "color-mix(in srgb, var(--token-color-semantic-action-do), transparent 90%)",
        borderColor: "color-mix(in srgb, var(--token-color-semantic-action-do), transparent 70%)",
      };
    default:
      return {
        backgroundColor: "color-mix(in srgb, var(--token-color-text-secondary), transparent 90%)",
        borderColor: "color-mix(in srgb, var(--token-color-text-secondary), transparent 70%)",
      };
  }
}

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

          return (
            <div
              key={action.id}
              className="rounded-lg border p-3 transition-colors"
              style={{
                ...getActionTypeBgStyle(action.type),
                opacity: isComplete ? 0.6 : 1,
              }}
            >
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
                      style={getActionTypeStyle(action.type)}
                    >
                      {ACTION_TYPE_VERBS[action.type] || action.type}
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

              {isExpanded && (
                <div className="mt-3 pl-8 space-y-3">
                  {action.instructions && (
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--token-color-text-secondary)" }}
                    >
                      {action.instructions}
                    </p>
                  )}

                  {action.type === "REFLECT" && action.reflectionPrompt && (
                    <div className="space-y-2">
                      <p
                        className="text-sm italic"
                        style={{ color: "var(--token-color-text-secondary)" }}
                      >
                        {action.reflectionPrompt}
                      </p>
                      {!isComplete && (
                        <textarea
                          value={reflections[action.id] || ""}
                          onChange={(e) =>
                            setReflections((prev) => ({
                              ...prev,
                              [action.id]: e.target.value,
                            }))
                          }
                          placeholder="Write your reflection..."
                          className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                          style={{
                            backgroundColor: "var(--token-color-bg-default)",
                            borderColor: "var(--token-color-border-subtle)",
                            color: "var(--token-color-text-primary)",
                          }}
                          rows={3}
                        />
                      )}
                      {isComplete && reflections[action.id] && (
                        <p
                          className="text-sm rounded-md p-2"
                          style={{
                            backgroundColor: "var(--token-color-bg-default)",
                            color: "var(--token-color-text-primary)",
                          }}
                        >
                          {reflections[action.id]}
                        </p>
                      )}
                    </div>
                  )}

                  {!isComplete && (
                    <button
                      onClick={() => markComplete(action.id, reflections[action.id])}
                      disabled={isSaving}
                      className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--token-color-accent)",
                        color: "var(--token-comp-viewer-overlay-text)",
                      }}
                    >
                      {isSaving ? "Saving..." : "Mark Complete"}
                    </button>
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
