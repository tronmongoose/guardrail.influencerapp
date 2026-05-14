"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { MuxVideoPlayer } from "@/components/viewer/MuxVideoPlayer";
import { ACTION_TYPE_LABELS, getActionTypeColor, getActionTypeBgWithBorder } from "@/lib/action-type-styles";
import { stripWrappingQuotes } from "@/lib/strip-quotes";

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
  youtubeVideo: { videoId: string; title: string | null; url: string; muxPlaybackId: string | null } | null;
  progress: ActionProgress[];
}

type PacingMode = "DRIP_BY_WEEK" | "UNLOCK_ON_COMPLETE";

interface CompositeClipData {
  id: string;
  startSeconds: number | null;
  endSeconds: number | null;
  chapterTitle: string | null;
  orderIndex: number;
  youtubeVideo: { muxPlaybackId: string | null; thumbnailUrl: string | null; videoId: string; title: string | null; url: string } | null;
}

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
        compositeSession?: { clips: CompositeClipData[] } | null;
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
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  targetTransformation: string | null;
  durationWeeks: number;
}

export function LearnerTimeline({
  program,
  userId,
  enrolledAt,
  currentWeek,
  completedWeeks,
  pacingMode,
  creatorName,
  creatorAvatarUrl,
  targetTransformation,
  durationWeeks,
}: Props) {
  const { showToast } = useToast();

  const groupLabel = "Lesson";
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

  // Track which sessions' composite videos have been watched (local state)
  const [watchedSessions, setWatchedSessions] = useState<Set<string>>(() => new Set());

  // Celebration overlay state (week milestones only — not final week)
  const [celebration, setCelebration] = useState<{
    weekNumber: number;
    weekTitle: string;
    actionCount: number;
  } | null>(null);

  // Program complete full-screen overlay
  const [showProgramComplete, setShowProgramComplete] = useState(false);

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

        if (isLastWeek) {
          setShowProgramComplete(true);
        } else {
          setCelebration({
            weekNumber,
            weekTitle: week?.title ?? `${groupLabel} ${weekNumber}`,
            actionCount: weekActionCount,
          });
          setTimeout(() => setCelebration(null), 6000);
        }
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

  // Per-week completion percentages — same reactive dependency as the circular indicator
  const weekCompletionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of program.weeks) {
      const actions = w.sessions.flatMap((s) => s.actions);
      const done = actions.filter((a) => completedActions.has(a.id)).length;
      map[w.id] = actions.length > 0 ? Math.round((done / actions.length) * 100) : 0;
    }
    return map;
  }, [program.weeks, completedActions]);

  // SVG arc for progress circle (nav — small)
  const progressArc = useMemo(() => {
    const r = 18;
    const circ = 2 * Math.PI * r;
    const offset = circ - (progressPercent / 100) * circ;
    return { r, circ, offset };
  }, [progressPercent]);

  // SVG arc for sidebar progress ring (desktop — large)
  const sidebarArc = useMemo(() => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const offset = circ - (progressPercent / 100) * circ;
    return { r, circ, offset };
  }, [progressPercent]);

  // Formatted enrollment date
  const startedDate = useMemo(() => {
    const d = new Date(enrolledAt);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [enrolledAt]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--token-color-bg-gradient, var(--token-color-bg-default))", fontFamily: "var(--token-text-body-md-font)" }}
    >
      {/* Fixed top bar */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-sm"
        style={{
          backgroundColor: "color-mix(in srgb, var(--token-color-bg-default), transparent 5%)",
          borderBottom: "1px solid var(--token-color-border-subtle)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-xl md:max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-sm font-bold"
            style={{ color: "var(--token-color-accent)" }}
          >
            &larr;
          </Link>
          {/* Mobile: centered title */}
          <div className="flex-1 text-center px-4 md:hidden">
            <h1
              className="text-sm font-semibold truncate heading-display"
              style={{ color: "var(--token-color-text-primary)" }}
            >
              {program.title}
            </h1>
          </div>
          {/* Desktop: spacer (title is in sidebar) */}
          <div className="hidden md:block flex-1" />
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

      {/* Layout wrapper: sidebar on desktop, single column on mobile */}
      <div className="md:flex md:gap-8 md:max-w-5xl md:mx-auto md:px-6 md:py-8">
        {/* Desktop sticky sidebar */}
        <aside
          className="hidden md:block w-72 flex-shrink-0 sticky top-16 self-start h-fit max-h-[calc(100vh-5rem)] overflow-y-auto space-y-6 pb-8"
        >
          {/* Program identity */}
          <div>
            {creatorAvatarUrl && (
              <div className="mb-3">
                <div
                  className="w-16 h-16 rounded-full"
                  style={{
                    padding: "1.5px",
                    background: "linear-gradient(135deg, var(--token-color-accent), #ec4899, #a855f7)",
                  }}
                >
                  <div
                    className="w-full h-full rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--token-color-bg-elevated)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creatorAvatarUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <h1
              className="text-lg font-bold leading-tight mb-1"
              style={{ color: "var(--token-color-text-primary)" }}
            >
              {program.title}
            </h1>
            {creatorName && (
              <p
                className="text-xs"
                style={{ color: "var(--token-color-text-secondary)" }}
              >
                by {creatorName}
              </p>
            )}
          </div>

          {targetTransformation && (
            <p
              className="text-sm leading-relaxed line-clamp-3"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {targetTransformation}
            </p>
          )}

          {/* Large progress ring */}
          <div className="flex flex-col items-center py-2">
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40" cy="40" r={sidebarArc.r}
                  fill="none"
                  stroke="var(--token-color-border-subtle)"
                  strokeWidth="3"
                />
                <circle
                  cx="40" cy="40" r={sidebarArc.r}
                  fill="none" stroke="url(#sidebarProgressGrad)" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={sidebarArc.circ}
                  strokeDashoffset={sidebarArc.offset}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="sidebarProgressGrad">
                    <stop offset="0%" stopColor="var(--token-color-accent)" />
                    <stop offset="100%" stopColor="var(--token-color-semantic-action-reflect)" />
                  </linearGradient>
                </defs>
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                style={{ color: "var(--token-color-text-primary)" }}
              >
                {progressPercent}%
              </span>
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {completedCount} of {totalActions} actions
            </p>
          </div>

          {/* Per-week mini progress */}
          <div className="space-y-2">
            {program.weeks.map((week) => {
              const isUnlocked = week.weekNumber <= unlockedWeekNumber;
              const pct = weekCompletionMap[week.id] ?? 0;
              const isComplete = pct === 100;
              return (
                <div key={week.id} className="flex items-center gap-2" style={{ opacity: isUnlocked ? 1 : 0.4 }}>
                  <span
                    className="text-[11px] w-16 truncate flex-shrink-0"
                    style={{ color: "var(--token-color-text-secondary)" }}
                  >
                    {groupLabel} {week.weekNumber}
                  </span>
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--token-comp-progress-track)" }}
                  >
                    {isUnlocked && (
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: "var(--token-comp-progress-fill)",
                        }}
                      />
                    )}
                  </div>
                  {isComplete && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--token-color-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {!isUnlocked && (
                    <svg className="w-3 h-3 flex-shrink-0" style={{ color: "var(--token-color-text-secondary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Started date */}
          <p
            className="text-[11px]"
            style={{ color: "var(--token-color-text-secondary)", opacity: 0.6 }}
          >
            Started {startedDate}
          </p>
        </aside>

        {/* Main content column */}
        <main className="flex-1 max-w-xl md:max-w-2xl mx-auto md:mx-0 px-4 md:px-0 py-6 md:py-0 pb-24 space-y-4">
          {/* Mobile program hero card */}
          <div
            className="p-4 mb-2 md:hidden"
            style={{
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid var(--token-color-border-subtle)",
            }}
          >
            <div className="flex items-center gap-3 mb-1">
              {creatorAvatarUrl && (
                <div
                  className="w-12 h-12 rounded-full flex-shrink-0"
                  style={{
                    padding: "1.5px",
                    background: "linear-gradient(135deg, var(--token-color-accent), #ec4899, #a855f7)",
                  }}
                >
                  <div
                    className="w-full h-full rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--token-color-bg-elevated)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creatorAvatarUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                </div>
              )}
              <div className="min-w-0">
                <h2
                  className="text-base font-bold leading-tight"
                  style={{ color: "var(--token-color-text-primary)" }}
                >
                  {program.title}
                </h2>
                {creatorName && (
                  <p
                    className="text-xs"
                    style={{ color: "var(--token-color-text-secondary)" }}
                  >
                    by {creatorName}
                  </p>
                )}
              </div>
            </div>
            {targetTransformation && (
              <p
                className="text-xs leading-relaxed line-clamp-2 mt-1"
                style={{ color: "var(--token-color-text-secondary)", opacity: 0.8 }}
              >
                {targetTransformation}
              </p>
            )}
          </div>

          {/* Progress summary (mobile only — desktop has sidebar ring) */}
          <div className="text-center mb-2 md:hidden">
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
          const weekProgress = weekCompletionMap[week.id] ?? 0;
          const weekCompletedCount = weekActions.length > 0 ? Math.round((weekProgress / 100) * weekActions.length) : 0;
          const isWeekComplete = weekActions.length > 0 && weekProgress === 100;

          return (
            <section key={week.id}>
              {/* Week header */}
              <div className="flex items-center mb-3" style={{ opacity: isUnlocked ? 1 : 0.5 }}>
                <h2
                  className="text-sm font-medium"
                  style={{ color: isUnlocked ? "var(--token-color-text-primary)" : "var(--token-color-text-secondary)" }}
                >
                  {groupLabel} {week.weekNumber}: {stripWrappingQuotes(week.title).replace(/^(Week|Lesson)\s+\d+:\s*/i, "")}
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

              {/* Week heading gradient divider */}
              <div
                style={{
                  height: "1px",
                  background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                  marginBottom: "12px",
                  opacity: isUnlocked ? 1 : 0.3,
                }}
              />

              {/* Week progress bar */}
              {isUnlocked && weekActions.length > 0 && (
                <div
                  className="overflow-hidden mb-3"
                  style={{
                    height: "2px",
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
                  <svg className="w-4 h-4 mx-auto mb-2" style={{ color: "var(--token-color-text-secondary)", opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--token-color-text-secondary)", opacity: 0.6 }}
                  >
                    {pacingMode === "UNLOCK_ON_COMPLETE" ? (
                      <>Complete {groupLabel} {week.weekNumber - 1} to unlock</>
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
                          {stripWrappingQuotes(session.title)}
                        </h3>
                        <span className="text-[10px]" style={{ color: "var(--token-color-text-secondary)" }}>{sessionDone}/{sessionActions.length}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      {/* WATCH step: one card per session that links to the
                          focused viewer at /learn/[programId]/[sessionId],
                          which plays all clips chained with chapter markers.
                          Replaces an earlier per-clip rendering that produced
                          N "Part X of N · WATCH" cards per lesson — a single
                          continuous video was being presented as N separate
                          steps with N separate Mark-as-watched checkboxes. */}
                      {session.compositeSession?.clips?.length &&
                        !session.actions.some((a) => a.type === "WATCH" && a.youtubeVideo) && (() => {
                          const clips = session.compositeSession.clips.filter((c) => c.youtubeVideo);
                          if (clips.length === 0) return null;

                          const watchKey = `watch:session:${session.id}`;
                          const watchDone = watchedSessions.has(watchKey);
                          const totalSeconds = clips.reduce((sum, c) => {
                            if (c.startSeconds != null && c.endSeconds != null) {
                              return sum + Math.max(0, c.endSeconds - c.startSeconds);
                            }
                            return sum;
                          }, 0);
                          const fmtTotal = (s: number) => {
                            const m = Math.floor(s / 60);
                            const sec = Math.floor(s % 60);
                            return m > 0 ? `${m} min` : `${sec}s`;
                          };
                          const partsLabel = clips.length > 1 ? `${clips.length} parts` : null;
                          const totalLabel = totalSeconds > 0 ? fmtTotal(totalSeconds) : null;
                          const subtitleParts = [partsLabel, totalLabel].filter(Boolean);
                          const titleText =
                            clips[0].chapterTitle?.trim() ||
                            clips[0].youtubeVideo?.title ||
                            session.title;

                          return (
                            <div
                              className={`border transition-all duration-300 overflow-hidden ${
                                watchDone ? "opacity-70" : ""
                              }`}
                              style={{
                                borderRadius: "var(--token-radius-lg)",
                                backgroundColor: watchDone
                                  ? "var(--token-color-bg-default)"
                                  : "var(--token-color-bg-elevated)",
                                borderColor: "var(--token-color-border-subtle)",
                              }}
                            >
                              <Link
                                href={`/learn/${program.id}/${session.id}`}
                                onClick={() => {
                                  setWatchedSessions((prev) => new Set(prev).add(watchKey));
                                }}
                                className="w-full flex items-center gap-3 py-3 px-4 text-left cursor-pointer"
                              >
                                <CompletionCircle
                                  done={watchDone}
                                  isSaving={false}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setWatchedSessions((prev) => {
                                      const next = new Set(prev);
                                      if (watchDone) next.delete(watchKey);
                                      else next.add(watchKey);
                                      return next;
                                    });
                                  }}
                                />

                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-medium truncate ${watchDone ? "line-through" : ""}`}
                                    style={{
                                      color: watchDone
                                        ? "var(--token-color-text-secondary)"
                                        : "var(--token-color-text-primary)",
                                    }}
                                  >
                                    {titleText}
                                  </p>
                                  <span
                                    className="text-[10px] uppercase tracking-wider font-semibold"
                                    style={getActionTypeColor("WATCH")}
                                  >
                                    {["Watch", ...subtitleParts].join(" · ")}
                                  </span>
                                </div>

                                <svg
                                  className="w-4 h-4"
                                  style={{ color: "var(--token-color-text-secondary)" }}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            </div>
                          );
                        })()}
                      {session.actions.map((action) => {
                        const done = completedActions.has(action.id);
                        const isNext = action.id === nextActionId;
                        const isExpanded = expandedAction === action.id;
                        const isCompleting = justCompleted === action.id;
                        const isSaving = savingAction === action.id;

                        const cardBorderStyle = (): React.CSSProperties => {
                          if (isNext && !isExpanded) {
                            return {
                              borderColor: "var(--token-color-accent-hover)",
                              borderWidth: "2px",
                              boxShadow: "0 10px 15px -3px color-mix(in srgb, var(--token-color-accent-hover), transparent 80%)",
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
                              isExpanded && !done
                                ? "step-card-active"
                                : isNext && !isExpanded
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
                                setExpandedAction(isExpanded ? null : action.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setExpandedAction(isExpanded ? null : action.id);
                                }
                              }}
                              className="w-full flex items-center gap-3 py-3 px-4 text-left cursor-pointer"
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
                                {action.type !== "WATCH" && (
                                  <p
                                    className={`text-sm font-medium truncate ${done ? "line-through" : ""}`}
                                    style={{
                                      color: done
                                        ? "var(--token-color-text-secondary)"
                                        : "var(--token-color-text-primary)",
                                    }}
                                  >
                                    {action.title.replace(/^(Watch|Practice|Reflect|Read):\s*/i, "")}
                                  </p>
                                )}
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
                              <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                style={{ color: "var(--token-color-text-secondary)" }}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            {/* Expanded detail card */}
                            {isExpanded && (
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

                                {/* Video embed */}
                                {action.youtubeVideo && (
                                  action.youtubeVideo.muxPlaybackId ? (
                                    <MuxVideoPlayer
                                      playbackId={action.youtubeVideo.muxPlaybackId}
                                      title={action.youtubeVideo.title || action.title}
                                    />
                                  ) : action.youtubeVideo.url.includes("blob.vercel-storage.com") ? (
                                    <div
                                      className="aspect-video overflow-hidden"
                                      style={{
                                        borderRadius: "var(--token-comp-video-radius)",
                                        border: "var(--token-comp-video-border)",
                                      }}
                                    >
                                      <video
                                        src={action.youtubeVideo.url}
                                        title={action.youtubeVideo.title || action.title}
                                        className="w-full h-full"
                                        controls
                                        playsInline
                                        preload="metadata"
                                      />
                                    </div>
                                  ) : (
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
                                  )
                                )}

                                {/* Reflection prompt */}
                                {action.type === "REFLECT" && action.reflectionPrompt && (
                                  <div style={{ color: "var(--token-color-semantic-action-reflect)" }}>
                                    <p className="text-xs opacity-80 italic mb-2 px-1">
                                      {action.reflectionPrompt}
                                    </p>
                                    {done ? (
                                      action.progress[0]?.reflectionText ? (
                                        <p
                                          className="px-3 py-2 text-sm whitespace-pre-wrap"
                                          style={{
                                            borderRadius: "var(--token-radius-md)",
                                            backgroundColor: "var(--token-color-bg-default)",
                                            border: "1px solid var(--token-color-border-subtle)",
                                            color: "var(--token-color-text-primary)",
                                          }}
                                        >
                                          {action.progress[0].reflectionText}
                                        </p>
                                      ) : null
                                    ) : (
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
                                    )}
                                  </div>
                                )}

                                {/* Complete action button */}
                                {!done && (
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
                                )}
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
      </div>

      {/* Milestone celebration overlay */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="p-8 w-full text-center animate-slide-up"
            style={{
              maxWidth: "calc(100% - 32px)",
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid rgba(0, 255, 240, 0.3)",
              boxShadow: "0 0 24px rgba(0, 255, 240, 0.08)",
            }}
          >
            {/* Animated checkmark */}
            <div className="flex justify-center mb-4" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle
                  cx="28" cy="28" r="24"
                  stroke="var(--token-color-accent)"
                  strokeWidth="2.5"
                  strokeDasharray="150.8"
                  strokeDashoffset="150.8"
                  strokeLinecap="round"
                  className="animate-draw-circle"
                />
                <polyline
                  points="17,28 24,35 39,20"
                  stroke="var(--token-color-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="35"
                  strokeDashoffset="35"
                  className="animate-draw-check"
                />
              </svg>
            </div>

            <h3
              className="text-xl font-bold mb-2"
              style={{ color: "var(--token-color-text-primary)" }}
            >
              {`${groupLabel} ${celebration.weekNumber} Complete!`}
            </h3>
            <p
              className="text-sm mb-1"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {groupLabel} {celebration.weekNumber}: {celebration.weekTitle}
            </p>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {celebration.weekNumber === 1
                ? "You started. That's the hardest part."
                : celebration.weekNumber === 2
                  ? "Two weeks in. You're building momentum."
                  : "Halfway there. Keep going."}
            </p>
            <button
              onClick={() => {
                setCelebration(null);
                setTimeout(() => scrollToNextAction(), 200);
              }}
              className="px-6 py-2.5 text-sm font-semibold transition"
              style={{
                borderRadius: "var(--token-comp-btn-primary-radius)",
                backgroundColor: "var(--token-color-accent)",
                color: "var(--token-color-text-on-accent, #fff)",
                border: "none",
              }}
            >
              {`Continue to ${groupLabel} ${celebration.weekNumber + 1} \u2192`}
            </button>
          </div>
        </div>
      )}

      {/* Program complete full-screen overlay */}
      {showProgramComplete && (
        <ProgramCompleteOverlay
          programId={program.id}
          programTitle={program.title}
          weekCount={program.weeks.length}
          actionCount={totalActions}
          onClose={() => setShowProgramComplete(false)}
        />
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
/*  Program complete full-screen overlay                              */
/* ------------------------------------------------------------------ */

interface ProgramCompleteOverlayProps {
  programId: string;
  programTitle: string;
  weekCount: number;
  actionCount: number;
  onClose: () => void;
}

function ProgramCompleteOverlay({
  programId,
  programTitle,
  weekCount,
  actionCount,
  onClose,
}: ProgramCompleteOverlayProps): React.ReactElement {
  const r = 58;
  const circ = 2 * Math.PI * r;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-md"
      style={{ zIndex: 60 }}
    >
      {/* Animated arc */}
      <div className="relative mb-[-28px]" style={{ zIndex: 1 }}>
        <svg
          width="136"
          height="136"
          viewBox="0 0 136 136"
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="68" cy="68" r={r}
            fill="none"
            stroke="rgba(0,255,240,0.1)"
            strokeWidth="3"
          />
          {/* Gradient fill arc */}
          <circle
            cx="68" cy="68" r={r}
            fill="none"
            stroke="url(#pcArcGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            className="animate-arc-complete"
          />
          <defs>
            <linearGradient id="pcArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--token-color-accent)" />
              <stop offset="100%" stopColor="var(--token-color-accent-secondary, var(--token-color-accent))" />
            </linearGradient>
          </defs>
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="animate-label-pop text-sm font-bold"
            style={{ color: "var(--token-color-accent)" }}
          >
            100%
          </span>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm animate-overlay-pop"
        style={{
          borderRadius: "var(--token-radius-lg)",
          backgroundColor: "var(--token-color-bg-elevated)",
          border: "1px solid rgba(0,255,240,0.3)",
          boxShadow: "0 0 40px rgba(0,255,240,0.12), 0 0 80px rgba(0,255,240,0.06)",
          padding: "44px 28px 28px",
        }}
      >
        <h2
          className="text-center font-semibold mb-2"
          style={{ fontSize: 28, color: "#fff" }}
        >
          Program Complete
        </h2>
        <p
          className="text-center text-sm mb-1"
          style={{ color: "rgba(0,255,240,0.65)" }}
        >
          {programTitle}
        </p>
        <p
          className="text-center text-[13px] mb-5"
          style={{ color: "#9ca3af" }}
        >
          You completed all {weekCount} weeks and {actionCount} actions
        </p>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: "20px" }} />

        <p
          className="text-center text-[13px] italic mb-6"
          style={{ color: "var(--token-color-text-secondary)" }}
        >
          You finished every week. That&apos;s rare.
        </p>

        <Link
          href={`/learn/${programId}`}
          onClick={onClose}
          className="block w-full text-center py-2.5 text-sm font-semibold transition hover:opacity-90"
          style={{
            borderRadius: "var(--token-comp-btn-primary-radius)",
            backgroundColor: "var(--token-color-accent)",
            color: "var(--token-color-text-on-accent, #fff)",
          }}
        >
          Back to your program
        </Link>
        <button
          onClick={onClose}
          className="block w-full text-center mt-3 py-2 text-sm transition hover:opacity-80"
          style={{ color: "var(--token-color-text-secondary)", background: "none", border: "none" }}
        >
          View my progress
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small extracted sub-components for clarity                        */
/* ------------------------------------------------------------------ */


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
