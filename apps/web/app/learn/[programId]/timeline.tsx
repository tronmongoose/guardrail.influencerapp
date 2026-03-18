"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ACTION_TYPE_LABELS, getActionTypeColor, getActionTypeBgWithBorder } from "@/lib/action-type-styles";

interface ActionProgress {
  id: string;
  completed: boolean;
  reflectionText: string | null;
}

interface ActionData {
  id: string;
  title: string;
  type: string;
  instructions: string | null;
  reflectionPrompt: string | null;
  youtubeVideo: { videoId: string; title: string | null } | null;
  progress: ActionProgress[];
}

type PacingMode = "DRIP_BY_WEEK" | "UNLOCK_ON_COMPLETE";

interface Props {
  program: {
    id: string;
    title: string;
    weeks: {
      id: string;
      title: string;
      weekNumber: number;
      sessions: {
        id: string;
        title: string;
        actions: ActionData[];
      }[];
    }[];
  };
  userId: string;
  enrolledAt: string;
  currentWeek: number;
  completedWeeks: number[];
  pacingMode: PacingMode;
  skinId: string;
  skinCSSVars: Record<string, string>;
}

export function LearnerTimeline({
  program,
  userId,
  enrolledAt,
  currentWeek,
  completedWeeks,
  pacingMode,
}: Props) {
  const { showToast } = useToast();

  const [unlockedWeekNumber, setUnlockedWeekNumber] = useState(currentWeek);
  const [completedWeeksState, setCompletedWeeksState] = useState<Set<number>>(
    () => new Set(completedWeeks)
  );

  const [completedActions, setCompletedActions] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const w of program.weeks) {
      for (const s of w.sessions) {
        for (const a of s.actions) {
          if (a.progress[0]?.completed) set.add(a.id);
        }
      }
    }
    return set;
  });

  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  // Track which action is expanded (for mobile detail view)
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Celebration overlay state
  const [celebration, setCelebration] = useState<{
    weekNumber: number;
    weekTitle: string;
    actionCount: number;
    isLastWeek: boolean;
  } | null>(null);

  // Ref for auto-scrolling to next action
  const nextActionRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Compute overall progress
  const { totalActions, completedCount, progressPercent } = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const w of program.weeks) {
      for (const s of w.sessions) {
        for (const a of s.actions) {
          total++;
          if (completedActions.has(a.id)) done++;
        }
      }
    }
    return {
      totalActions: total,
      completedCount: done,
      progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [program.weeks, completedActions]);

  const isProgramComplete = totalActions > 0 && completedCount === totalActions;

  // Find the next action (first incomplete action in order)
  const nextActionId = useMemo(() => {
    for (const week of program.weeks) {
      if (week.weekNumber > unlockedWeekNumber) break;
      for (const session of week.sessions) {
        for (const action of session.actions) {
          if (!completedActions.has(action.id)) return action.id;
        }
      }
    }
    return null;
  }, [program.weeks, completedActions, unlockedWeekNumber]);

  // Auto-scroll to next action on first render
  useEffect(() => {
    if (nextActionRef.current && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        nextActionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [nextActionId]);

  const scrollToNextAction = useCallback(() => {
    nextActionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  async function completeAction(
    actionId: string,
    weekNumber: number,
    reflectionText?: string
  ) {
    setSavingAction(actionId);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          reflectionText,
          programId: program.id,
          weekNumber,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();

      // Trigger completion animation
      setJustCompleted(actionId);
      setTimeout(() => setJustCompleted(null), 1000);

      setCompletedActions((prev) => new Set(prev).add(actionId));
      setExpandedAction(null);

      if (data.weekCompleted) {
        setCompletedWeeksState((prev) => new Set(prev).add(weekNumber));

        const week = program.weeks.find((w) => w.weekNumber === weekNumber);
        const weekActionCount = week?.sessions.flatMap((s) => s.actions).length ?? 0;
        const isLastWeek = weekNumber === program.weeks.length;

        setCelebration({
          weekNumber,
          weekTitle: week?.title ?? `Week ${weekNumber}`,
          actionCount: weekActionCount,
          isLastWeek,
        });

        setTimeout(() => setCelebration(null), 6000);
      }

      if (data.nextWeekUnlocked && data.newCurrentWeek) {
        setUnlockedWeekNumber(data.newCurrentWeek);
      } else if (!data.weekCompleted) {
        showToast("Progress saved!", "success");
      }
    } catch {
      showToast("Failed to save progress", "error");
    } finally {
      setSavingAction(null);
    }
  }

  // SVG arc for progress circle
  const progressArc = useMemo(() => {
    const r = 18;
    const circ = 2 * Math.PI * r;
    const offset = circ - (progressPercent / 100) * circ;
    return { r, circ, offset };
  }, [progressPercent]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--token-color-bg-default)" }}
    >
      {/* Fixed top bar */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-sm"
        style={{
          backgroundColor: "color-mix(in srgb, var(--token-color-bg-default), transparent 5%)",
          borderBottom: "1px solid var(--token-color-border-subtle)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-xl mx-auto">
          <Link
            href="/"
            className="text-sm font-bold"
            style={{ color: "var(--token-color-accent)" }}
          >
            &larr;
          </Link>
          <div className="flex-1 text-center px-4">
            <h1
              className="text-sm font-semibold truncate"
              style={{ color: "var(--token-color-text-primary)" }}
            >
              {program.title}
            </h1>
          </div>
          {/* Progress circle */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r={progressArc.r}
                fill="none"
                stroke="var(--token-color-border-subtle)"
                strokeWidth="3"
              />
              <circle
                cx="20" cy="20" r={progressArc.r}
                fill="none" stroke="url(#progressGrad)" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={progressArc.circ}
                strokeDashoffset={progressArc.offset}
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="progressGrad">
                  <stop offset="0%" stopColor="var(--token-color-accent)" />
                  <stop offset="100%" stopColor="var(--token-color-semantic-action-reflect)" />
                </linearGradient>
              </defs>
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
              style={{ color: "var(--token-color-text-primary)" }}
            >
              {progressPercent}%
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Progress summary */}
        <div className="text-center mb-2">
          <p
            className="text-xs"
            style={{ color: "var(--token-color-text-secondary)" }}
          >
            {completedCount} of {totalActions} actions complete
            {isProgramComplete && " — You did it!"}
          </p>
        </div>

        {/* Week sections */}
        {program.weeks.map((week) => {
          const isUnlocked = week.weekNumber <= unlockedWeekNumber;
          const weekActions = week.sessions.flatMap((s) => s.actions);
          const weekCompletedCount = weekActions.filter((a) => completedActions.has(a.id)).length;
          const isWeekComplete = weekActions.length > 0 && weekCompletedCount === weekActions.length;
          const weekProgress = weekActions.length > 0 ? Math.round((weekCompletedCount / weekActions.length) * 100) : 0;

          return (
            <section key={week.id}>
              {/* Week header */}
              <div className="flex items-center gap-3 mb-3">
                <WeekBadge
                  weekNumber={week.weekNumber}
                  isWeekComplete={isWeekComplete}
                  isUnlocked={isUnlocked}
                />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: isUnlocked ? "var(--token-color-text-primary)" : "var(--token-color-text-secondary)", opacity: isUnlocked ? 1 : 0.5 }}
                >
                  {week.title}
                </h2>
                {isUnlocked && weekActions.length > 0 && (
                  <span
                    className="ml-auto text-xs"
                    style={{ color: "var(--token-color-text-secondary)" }}
                  >
                    {weekCompletedCount}/{weekActions.length}
                  </span>
                )}
                {isWeekComplete && (
                  <svg
                    className="w-4 h-4 ml-1"
                    style={{ color: "var(--token-color-accent)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Week progress bar */}
              {isUnlocked && weekActions.length > 0 && (
                <div
                  className="h-1 overflow-hidden mb-3"
                  style={{
                    backgroundColor: "var(--token-comp-progress-track)",
                    borderRadius: "var(--token-comp-progress-radius)",
                  }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${weekProgress}%`,
                      background: "var(--token-comp-progress-fill)",
                      borderRadius: "var(--token-comp-progress-radius)",
                    }}
                  />
                </div>
              )}

              {/* Locked state */}
              {!isUnlocked && (
                <div
                  className="py-6 text-center mb-4"
                  style={{
                    borderRadius: "var(--token-radius-lg)",
                    backgroundColor: "color-mix(in srgb, var(--token-color-bg-default), transparent 50%)",
                    border: "1px solid var(--token-color-border-subtle)",
                  }}
                >
                  <svg className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--token-color-text-secondary)", opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p
                    className="text-xs"
                    style={{ color: "var(--token-color-text-secondary)" }}
                  >
                    {pacingMode === "UNLOCK_ON_COMPLETE" ? (
                      <>Complete Week {week.weekNumber - 1} to unlock</>
                    ) : (
                      <>
                        Unlocks in{" "}
                        {(() => {
                          const enrolled = new Date(enrolledAt);
                          const unlockDate = new Date(enrolled.getTime() + (week.weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
                          const daysUntil = Math.max(1, Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                          return daysUntil === 1 ? "1 day" : `${daysUntil} days`;
                        })()}
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Sessions + actions */}
              {isUnlocked && week.sessions.map((session) => {
                const sessionActions = session.actions;
                const sessionDone = sessionActions.filter((a) => completedActions.has(a.id)).length;

                return (
                  <div key={session.id} className="mb-4">
                    {/* Session sub-header */}
                    {week.sessions.length > 1 && (
                      <div className="flex items-center justify-between mb-2 px-1">
                        <h3
                          className="text-xs font-medium"
                          style={{ color: "var(--token-color-text-secondary)" }}
                        >
                          {session.title}
                        </h3>
                        <span className="text-[10px]" style={{ color: "var(--token-color-text-secondary)" }}>{sessionDone}/{sessionActions.length}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      {session.actions.map((action) => {
                        const done = completedActions.has(action.id);
                        const isNext = action.id === nextActionId;
                        const isExpanded = expandedAction === action.id;
                        const isCompleting = justCompleted === action.id;
                        const isSaving = savingAction === action.id;

                        const cardBorderStyle = (): React.CSSProperties => {
                          if (isNext && !isExpanded) {
                            return {
                              borderColor: "color-mix(in srgb, var(--token-color-accent), transparent 50%)",
                              boxShadow: "0 10px 15px -3px color-mix(in srgb, var(--token-color-accent), transparent 90%)",
                            };
                          }
                          if (isCompleting) {
                            return {
                              borderColor: "color-mix(in srgb, var(--token-color-accent), transparent 50%)",
                            };
                          }
                          if (done) {
                            return {
                              borderColor: "color-mix(in srgb, var(--token-color-border-subtle), transparent 50%)",
                            };
                          }
                          return {
                            borderColor: "var(--token-color-border-subtle)",
                          };
                        };

                        return (
                          <div
                            key={action.id}
                            ref={isNext ? nextActionRef : undefined}
                            className={`border transition-all duration-300 overflow-hidden ${
                              isNext && !isExpanded
                                ? "pulse-ring-border"
                                : isCompleting
                                ? "scale-[0.98]"
                                : done
                                ? "opacity-70"
                                : ""
                            }`}
                            style={{
                              borderRadius: "var(--token-radius-lg)",
                              backgroundColor: done
                                ? "var(--token-color-bg-default)"
                                : "var(--token-color-bg-elevated)",
                              ...cardBorderStyle(),
                            }}
                          >
                            {/* Compact action row */}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (!done) setExpandedAction(isExpanded ? null : action.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (!done) setExpandedAction(isExpanded ? null : action.id);
                                }
                              }}
                              className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
                            >
                              {/* Completion circle */}
                              <CompletionCircle
                                done={done}
                                isSaving={isSaving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!done && !isSaving) {
                                    completeAction(action.id, week.weekNumber, reflections[action.id]);
                                  }
                                }}
                              />

                              {/* Action info */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${done ? "line-through" : ""}`}
                                  style={{
                                    color: done
                                      ? "var(--token-color-text-secondary)"
                                      : "var(--token-color-text-primary)",
                                  }}
                                >
                                  {action.title}
                                </p>
                                <span
                                  className="text-[10px] uppercase tracking-wider font-semibold"
                                  style={getActionTypeColor(action.type)}
                                >
                                  {ACTION_TYPE_LABELS[action.type] || action.type}
                                </span>
                              </div>

                              {/* Up Next badge */}
                              {isNext && !isExpanded && (
                                <span
                                  className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 flex-shrink-0"
                                  style={{
                                    borderRadius: "var(--token-comp-chip-radius)",
                                    backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 85%)",
                                    color: "var(--token-color-accent)",
                                    border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 70%)",
                                  }}
                                >
                                  Next
                                </span>
                              )}

                              {/* Expand chevron */}
                              {!done && (
                                <svg
                                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                  style={{ color: "var(--token-color-text-secondary)" }}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>

                            {/* Expanded detail card */}
                            {isExpanded && !done && (
                              <div className="px-3 pb-4 pt-1 space-y-3 animate-fade-in">
                                {/* Instructions */}
                                {action.instructions && (
                                  <p
                                    className="text-xs leading-relaxed px-1"
                                    style={{ color: "var(--token-color-text-secondary)" }}
                                  >
                                    {action.instructions}
                                  </p>
                                )}

                                {/* YouTube embed */}
                                {action.youtubeVideo && (
                                  <div
                                    className="aspect-video overflow-hidden"
                                    style={{
                                      borderRadius: "var(--token-comp-video-radius)",
                                      border: "var(--token-comp-video-border)",
                                    }}
                                  >
                                    <iframe
                                      src={`https://www.youtube.com/embed/${action.youtubeVideo.videoId}?rel=0&modestbranding=1&iv_load_policy=3`}
                                      title={action.youtubeVideo.title || action.title}
                                      className="w-full h-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                )}

                                {/* Reflection prompt */}
                                {action.type === "REFLECT" && action.reflectionPrompt && (
                                  <div style={{ color: "var(--token-color-semantic-action-reflect)" }}>
                                    <p className="text-xs opacity-80 italic mb-2 px-1">
                                      {action.reflectionPrompt}
                                    </p>
                                    <textarea
                                      value={reflections[action.id] ?? ""}
                                      onChange={(e) =>
                                        setReflections((r) => ({ ...r, [action.id]: e.target.value }))
                                      }
                                      placeholder="Write your reflection..."
                                      rows={3}
                                      className="w-full px-3 py-2 text-sm focus:outline-none focus:border-current focus:ring-1 focus:ring-current resize-none"
                                      style={{
                                        borderRadius: "var(--token-radius-md)",
                                        backgroundColor: "var(--token-color-bg-default)",
                                        border: "1px solid var(--token-color-border-subtle)",
                                        color: "var(--token-color-text-primary)",
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Complete action button */}
                                <button
                                  onClick={() => completeAction(action.id, week.weekNumber, reflections[action.id])}
                                  disabled={isSaving || !!(action.type === "REFLECT" && action.reflectionPrompt && !reflections[action.id]?.trim())}
                                  className="w-full py-2.5 text-sm font-semibold transition border hover:opacity-80 disabled:opacity-50"
                                  style={{
                                    borderRadius: "var(--token-comp-btn-primary-radius)",
                                    ...getActionTypeBgWithBorder(action.type),
                                    ...getActionTypeColor(action.type),
                                  }}
                                >
                                  {isSaving ? "Saving..." : "Mark Complete"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        {/* Program completion card */}
        {isProgramComplete && (
          <div
            className="p-6 text-center animate-slide-up"
            style={{
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 60%)",
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 90%)",
                border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 70%)",
              }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: "var(--token-color-accent)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: "var(--token-color-text-primary)" }}
            >
              Program Complete!
            </h3>
            <p
              className="text-sm"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              You completed all {totalActions} actions across {program.weeks.length} weeks
            </p>
          </div>
        )}
      </main>

      {/* Milestone celebration overlay */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="relative p-8 max-w-sm w-full text-center animate-slide-up overflow-hidden"
            style={{
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 60%)",
              boxShadow: "var(--token-shadow-sm)",
            }}
          >
            <div className="confetti-burst" aria-hidden="true">
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-accent)", "--dot-angle": "0deg", "--dot-distance": "80px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-semantic-action-reflect)", "--dot-angle": "45deg", "--dot-distance": "70px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-semantic-action-do)", "--dot-angle": "90deg", "--dot-distance": "85px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-accent)", "--dot-angle": "135deg", "--dot-distance": "75px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-semantic-action-reflect)", "--dot-angle": "180deg", "--dot-distance": "80px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-semantic-action-do)", "--dot-angle": "225deg", "--dot-distance": "70px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-accent)", "--dot-angle": "270deg", "--dot-distance": "85px" } as React.CSSProperties} />
              <span className="confetti-dot" style={{ "--dot-color": "var(--token-color-semantic-action-reflect)", "--dot-angle": "315deg", "--dot-distance": "75px" } as React.CSSProperties} />
            </div>

            <div className="relative z-10">
              <div className="text-4xl mb-3">&#127881;</div>
              <h3
                className="text-xl font-bold mb-1"
                style={{ color: "var(--token-color-text-primary)" }}
              >
                {celebration.isLastWeek ? "Program Complete!" : `Week ${celebration.weekNumber} Complete!`}
              </h3>
              <p
                className="text-sm mb-1"
                style={{ color: "var(--token-color-text-secondary)" }}
              >
                {celebration.weekTitle}
              </p>
              <p
                className="text-xs mb-5"
                style={{ color: "var(--token-color-text-secondary)" }}
              >
                You completed {celebration.actionCount} actions
              </p>
              <button
                onClick={() => {
                  setCelebration(null);
                  if (!celebration.isLastWeek) {
                    setTimeout(() => scrollToNextAction(), 200);
                  }
                }}
                className="px-5 py-2.5 text-sm font-medium transition"
                style={{
                  borderRadius: "var(--token-comp-btn-secondary-radius)",
                  backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 90%)",
                  border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 60%)",
                  color: "var(--token-color-accent)",
                }}
              >
                {celebration.isLastWeek ? "View Your Journey" : `Continue to Week ${celebration.weekNumber + 1} \u2192`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating continue button (mobile) */}
      {nextActionId && !expandedAction && !celebration && !isProgramComplete && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
          <div
            className="backdrop-blur-sm px-4 py-3"
            style={{
              backgroundColor: "color-mix(in srgb, var(--token-color-bg-elevated), transparent 5%)",
              borderTop: "1px solid var(--token-color-border-subtle)",
            }}
          >
            <button
              onClick={scrollToNextAction}
              className="w-full py-2.5 text-sm font-medium transition"
              style={{
                borderRadius: "var(--token-comp-btn-secondary-radius)",
                backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 90%)",
                border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 70%)",
                color: "var(--token-color-accent)",
              }}
            >
              Continue &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small extracted sub-components for clarity                        */
/* ------------------------------------------------------------------ */

interface WeekBadgeProps {
  weekNumber: number;
  isWeekComplete: boolean;
  isUnlocked: boolean;
}

function WeekBadge({ weekNumber, isWeekComplete, isUnlocked }: WeekBadgeProps): React.ReactElement {
  const stateStyle: React.CSSProperties = isWeekComplete
    ? {
        backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 90%)",
        color: "var(--token-color-accent)",
        border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 70%)",
      }
    : isUnlocked
    ? {
        backgroundColor: "var(--token-color-bg-elevated)",
        color: "var(--token-color-text-secondary)",
        border: "1px solid var(--token-color-border-subtle)",
      }
    : {
        backgroundColor: "var(--token-color-bg-default)",
        color: "var(--token-color-text-secondary)",
        opacity: 0.5,
      };

  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
      style={{ borderRadius: "var(--token-comp-chip-radius)", ...stateStyle }}
    >
      W{weekNumber}
    </span>
  );
}

interface CompletionCircleProps {
  done: boolean;
  isSaving: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function CompletionCircle({ done, isSaving, onClick }: CompletionCircleProps): React.ReactElement {
  const baseClasses = "w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300";

  if (done) {
    return (
      <span
        aria-label="Completed"
        className={`${baseClasses} action-complete-check`}
        style={{
          backgroundColor: "var(--token-color-accent)",
          borderColor: "var(--token-color-accent)",
        }}
      >
        <svg
          className="w-3 h-3"
          style={{ color: "var(--token-color-bg-default)" }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }

  if (isSaving) {
    return (
      <button
        type="button"
        aria-label="Saving..."
        onClick={onClick}
        className={`${baseClasses} animate-pulse`}
        style={{ borderColor: "var(--token-color-accent)" }}
      >
        <Spinner size="sm" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Mark complete"
      onClick={onClick}
      className={baseClasses}
      style={{ borderColor: "var(--token-color-border-subtle)" }}
    />
  );
}
