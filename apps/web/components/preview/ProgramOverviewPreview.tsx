"use client";

import { getActionTypeBg, ACTION_TYPE_LABELS } from "@/lib/action-type-styles";
import { stripWrappingQuotes } from "@/lib/strip-quotes";
import type { WeekData, SessionData } from "@/components/builder";
import { MuxVideoPlayer } from "@/components/viewer/MuxVideoPlayer";

interface SessionVideo {
  muxPlaybackId: string | null;
  thumbnailUrl: string | null;
  title: string | null;
}

function getSessionVideo(session: SessionData): SessionVideo | null {
  const firstClip = session.compositeSession?.clips?.[0];
  const watch = session.actions.find((a) => a.type === "WATCH");
  if (!firstClip && !watch) return null;

  const muxPlaybackId =
    firstClip?.youtubeVideo?.muxPlaybackId ??
    watch?.muxPlaybackId ??
    watch?.youtubeVideo?.muxPlaybackId ??
    null;

  const thumbnailUrl = muxPlaybackId
    ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=2&width=640`
    : firstClip?.youtubeVideo?.thumbnailUrl ??
      watch?.youtubeVideo?.thumbnailUrl ??
      (watch?.youtubeVideo?.videoId
        ? `https://img.youtube.com/vi/${watch.youtubeVideo.videoId}/hqdefault.jpg`
        : null);

  const title = firstClip?.chapterTitle ?? watch?.title ?? null;

  return { muxPlaybackId, thumbnailUrl, title };
}

function getSessionThumbnail(session: SessionData): string | null {
  return getSessionVideo(session)?.thumbnailUrl ?? null;
}

interface ProgramOverviewPreviewProps {
  program: {
    title: string;
    description: string | null;
    targetAudience: string | null;
    targetTransformation: string | null;
    outcomeStatement?: string | null;
    priceInCents?: number;
    durationWeeks?: number;
    pacingMode?: string;
    creator?: { name: string | null } | null;
    creatorAvatarUrl?: string | null;
    weeks: WeekData[];
  };
  // skin kept for backwards compat — CSS vars are injected by the parent frame
  skin: { name: string };
  onSelectSession: (sessionId: string) => void;
  /** Force mobile single-column layout regardless of viewport width. Use when
   *  rendering inside a narrow container (e.g. device-preview frame) where
   *  Tailwind responsive breakpoints fire against the browser viewport. */
  layout?: "auto" | "mobile";
}

const actionTypeOrder = ["WATCH", "READ", "DO", "REFLECT"] as const;
const actionTypeIcons: Record<string, string> = {
  WATCH: "▶",
  READ: "📖",
  DO: "💪",
  REFLECT: "✏",
};

export function ProgramOverviewPreview({
  program,
  onSelectSession,
  layout = "auto",
}: ProgramOverviewPreviewProps) {
  const isMobile = layout === "mobile";
  const totalSessions = program.weeks.reduce((n, w) => n + w.sessions.length, 0);
  const allActions = program.weeks.flatMap((w) => w.sessions.flatMap((s) => s.actions));
  const actionTypeCounts = allActions.reduce(
    (acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const pacingLabel =
    !program.pacingMode || program.pacingMode === "DRIP_BY_WEEK" ? "Drip-paced" : "Self-paced";

  const priceDisplay =
    program.priceInCents === 0
      ? "Free"
      : program.priceInCents
      ? `$${(program.priceInCents / 100).toFixed(2)}`
      : null;

  // Feature cards: sessions with keyTakeaways or summary
  const featureCards = program.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => (s.keyTakeaways && s.keyTakeaways.length > 0) || s.summary);

  const hasWhoSection = !!(program.targetAudience || program.outcomeStatement);
  const creatorName = program.creator?.name;
  const durationWeeks = program.durationWeeks ?? program.weeks.length;

  const heroVideo = (() => {
    for (const week of program.weeks) {
      for (const session of week.sessions) {
        const v = getSessionVideo(session);
        if (v && (v.muxPlaybackId || v.thumbnailUrl)) return v;
      }
    }
    return null;
  })();
  const heroThumbnail = heroVideo?.thumbnailUrl ?? null;

  return (
    <div
      className="min-h-full"
      style={{
        background: "var(--token-color-bg-gradient, var(--token-color-bg-default))",
        color: "var(--token-color-text-primary)",
        fontFamily: "var(--token-text-body-md-font)",
      }}
    >
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-8 max-w-5xl mx-auto">
        <div className={`grid grid-cols-1 items-center ${isMobile ? "gap-10" : "md:grid-cols-2 gap-10 md:gap-16"}`}>

          {/* Left: text */}
          <div className="flex flex-col gap-6 min-w-0 overflow-hidden">
            {(creatorName || program.creatorAvatarUrl) && (
              <div className="flex items-center gap-3">
                {program.creatorAvatarUrl && (
                  <div className="w-14 h-14 rounded-full p-[1.5px] bg-gradient-to-br from-teal-400 via-pink-500 to-purple-500 flex-shrink-0">
                    <div className="w-full h-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--token-color-bg-elevated)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={program.creatorAvatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                {creatorName && (
                  <p
                    style={{
                      fontFamily: "var(--token-text-label-sm-font)",
                      fontSize: "var(--token-text-label-sm-size)",
                      fontWeight: "var(--token-text-label-sm-weight)",
                      color: "var(--token-color-text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                    }}
                  >
                    Coach {creatorName}
                  </p>
                )}
              </div>
            )}

            <h1
              style={{
                fontFamily: "var(--token-text-heading-xl-font)",
                fontSize: "clamp(1.75rem, 4vw, var(--token-text-heading-xl-size))",
                fontWeight: "var(--token-text-heading-xl-weight)",
                lineHeight: "1.05",
                color: "var(--token-color-text-primary)",
                wordBreak: "break-word",
              }}
            >
              {stripWrappingQuotes(program.title || program.targetTransformation || "")}
            </h1>

            {program.description && (
              <p
                style={{
                  fontFamily: "var(--token-text-body-md-font)",
                  fontSize: "var(--token-text-body-md-size)",
                  color: "var(--token-color-text-secondary)",
                  lineHeight: "1.5",
                }}
              >
                {program.description}
              </p>
            )}

            {/* Preview CTA */}
            <div className="max-w-xs">
              <button
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  borderRadius: "var(--token-comp-btn-primary-radius, 100px)",
                  background:
                    "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                  color: "#fff",
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  fontWeight: "600",
                } as React.CSSProperties}
              >
                {priceDisplay === "Free" ? "Enroll free" : priceDisplay ? `Buy for ${priceDisplay}` : "Join the program"}
              </button>
            </div>
          </div>

          {/* Right: Video (desktop only) — falls back to At a Glance card */}
          {heroVideo ? (
            <div className={`${isMobile ? "hidden" : "hidden md:flex"} flex-col gap-4`}>
              {/* Player when available, static thumbnail fallback otherwise */}
              {heroVideo.muxPlaybackId ? (
                <div
                  style={{
                    borderRadius: "var(--token-radius-lg)",
                    overflow: "hidden",
                    boxShadow: "var(--token-shadow-md)",
                  }}
                >
                  <MuxVideoPlayer
                    playbackId={heroVideo.muxPlaybackId}
                    title={heroVideo.title ?? program.title}
                  />
                </div>
              ) : (
                <div
                  className="relative overflow-hidden"
                  style={{
                    aspectRatio: "16/9",
                    borderRadius: "var(--token-radius-lg)",
                    boxShadow: "var(--token-shadow-md)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroThumbnail ?? ""}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: "var(--token-color-accent)" }}
                    >
                      <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24" style={{ color: "#fff" }}>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              {/* Compact stats */}
              <p
                className="flex flex-wrap gap-x-2"
                style={{
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  color: "var(--token-color-text-secondary)",
                }}
              >
                <span>{durationWeeks} {durationWeeks === 1 ? "lesson" : "lessons"}</span>
                <span>·</span>
                <span>{totalSessions} sessions</span>
                <span>·</span>
                <span>{allActions.length} actions</span>
                <span>·</span>
                <span>{pacingLabel}</span>
              </p>
              {/* Action type pills */}
              {allActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actionTypeOrder.map((type) => {
                    const count = actionTypeCounts[type];
                    if (!count) return null;
                    return (
                      <span
                        key={type}
                        style={{
                          ...getActionTypeBg(type, 85),
                          fontFamily: "var(--token-text-label-sm-font)",
                          fontSize: "var(--token-text-label-sm-size)",
                          fontWeight: "var(--token-text-label-sm-weight)",
                          borderRadius: "100px",
                          padding: "4px 12px",
                        }}
                      >
                        {actionTypeIcons[type]} {count} {ACTION_TYPE_LABELS[type]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`${isMobile ? "hidden" : "hidden md:flex"} flex-col gap-5 p-7`}
              style={{
                borderRadius: "var(--token-radius-lg)",
                backgroundColor: "var(--token-color-bg-elevated)",
                border: "2px solid var(--token-color-accent)",
                boxShadow: "var(--token-shadow-md)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--token-text-label-sm-font)",
                  fontSize: "var(--token-text-label-sm-size)",
                  fontWeight: "var(--token-text-label-sm-weight)",
                  color: "var(--token-color-accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                }}
              >
                At a glance
              </p>

              <div className="flex gap-6">
                {[
                  { label: "Lessons", value: durationWeeks },
                  { label: "Sessions", value: totalSessions },
                  { label: "Actions", value: allActions.length },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p
                      style={{
                        fontFamily: "var(--token-text-heading-lg-font)",
                        fontSize: "var(--token-text-heading-lg-size)",
                        fontWeight: "var(--token-text-heading-lg-weight)",
                        color: "var(--token-color-text-primary)",
                        lineHeight: "1",
                      }}
                    >
                      {value}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--token-text-body-sm-font)",
                        fontSize: "var(--token-text-body-sm-size)",
                        color: "var(--token-color-text-secondary)",
                        marginTop: "2px",
                      }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <p
                style={{
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  color: "var(--token-color-text-secondary)",
                }}
              >
                {pacingLabel} · Start any time
              </p>

              {allActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actionTypeOrder.map((type) => {
                    const count = actionTypeCounts[type];
                    if (!count) return null;
                    return (
                      <span
                        key={type}
                        style={{
                          ...getActionTypeBg(type, 85),
                          fontFamily: "var(--token-text-label-sm-font)",
                          fontSize: "var(--token-text-label-sm-size)",
                          fontWeight: "var(--token-text-label-sm-weight)",
                          borderRadius: "100px",
                          padding: "4px 12px",
                        }}
                      >
                        {actionTypeIcons[type]} {count} {ACTION_TYPE_LABELS[type]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Mobile hero video ─────────────────────────────────────────────── */}
      {heroVideo && (
        <div className={`${isMobile ? "block" : "md:hidden"} px-6 pb-6 max-w-5xl mx-auto`}>
          {heroVideo.muxPlaybackId ? (
            <div
              style={{
                borderRadius: "var(--token-radius-lg)",
                overflow: "hidden",
                boxShadow: "var(--token-shadow-md)",
              }}
            >
              <MuxVideoPlayer
                playbackId={heroVideo.muxPlaybackId}
                title={heroVideo.title ?? program.title}
              />
            </div>
          ) : (
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: "16/9",
                borderRadius: "var(--token-radius-lg)",
                boxShadow: "var(--token-shadow-md)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroThumbnail ?? ""}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: "var(--token-color-accent)" }}
                >
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24" style={{ color: "#fff" }}>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile stats strip ────────────────────────────────────────────────── */}
      <div className={`${isMobile ? "block" : "md:hidden"} px-6 pb-6 max-w-5xl mx-auto`}>
        <p
          className="flex flex-wrap gap-x-3 gap-y-1"
          style={{
            fontFamily: "var(--token-text-label-sm-font)",
            fontSize: "var(--token-text-label-sm-size)",
            color: "var(--token-color-text-secondary)",
          }}
        >
          <span>{durationWeeks} {durationWeeks === 1 ? "lesson" : "lessons"}</span>
          <span>·</span>
          <span>{totalSessions} sessions</span>
          <span>·</span>
          <span>{allActions.length} actions</span>
          <span>·</span>
          <span>{pacingLabel}</span>
        </p>
      </div>

      {/* ── Who it's for (conditional) ────────────────────────────────────────── */}
      {hasWhoSection && (
        <section className="px-6 pb-10 max-w-5xl mx-auto">
          <div
            className={`grid grid-cols-1 gap-4 ${!isMobile && program.targetAudience && program.outcomeStatement ? "md:grid-cols-2" : ""}`}
          >
            {program.targetAudience && (
              <div
                className="p-6"
                style={{
                  borderRadius: "var(--token-radius-lg)",
                  backgroundColor: "var(--token-color-bg-elevated)",
                  border: "1px solid var(--token-color-border-subtle)",
                }}
              >
                <p
                  className="mb-2"
                  style={{
                    fontFamily: "var(--token-text-label-sm-font)",
                    fontSize: "var(--token-text-label-sm-size)",
                    fontWeight: "var(--token-text-label-sm-weight)",
                    color: "var(--token-color-accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Who it&apos;s for
                </p>
                <p
                  style={{
                    fontFamily: "var(--token-text-body-md-font)",
                    fontSize: "var(--token-text-body-md-size)",
                    color: "var(--token-color-text-primary)",
                    lineHeight: "1.6",
                  }}
                >
                  {program.targetAudience}
                </p>
              </div>
            )}
            {program.outcomeStatement && (
              <div
                className="p-6"
                style={{
                  borderRadius: "var(--token-radius-lg)",
                  backgroundColor: "var(--token-color-bg-elevated)",
                  border: "1px solid var(--token-color-border-subtle)",
                }}
              >
                <p
                  className="mb-2"
                  style={{
                    fontFamily: "var(--token-text-label-sm-font)",
                    fontSize: "var(--token-text-label-sm-size)",
                    fontWeight: "var(--token-text-label-sm-weight)",
                    color: "var(--token-color-accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  What you&apos;ll achieve
                </p>
                <p
                  style={{
                    fontFamily: "var(--token-text-body-md-font)",
                    fontSize: "var(--token-text-body-md-size)",
                    color: "var(--token-color-text-primary)",
                    lineHeight: "1.6",
                  }}
                >
                  {program.outcomeStatement}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Divider ──────────────────────────────────────────────────────────── */}
      <div
        className="max-w-5xl mx-auto"
        style={{ borderTop: "2px solid var(--token-color-accent)", margin: "0 24px" }}
      />

      {/* ── What's inside ────────────────────────────────────────────────────── */}
      <section className="px-6 pt-12 pb-16 max-w-5xl mx-auto">
        <h2
          className="mb-6"
          style={{
            fontFamily: "var(--token-text-heading-lg-font)",
            fontSize: "var(--token-text-heading-lg-size)",
            fontWeight: "var(--token-text-heading-lg-weight)",
            color: "var(--token-color-text-primary)",
          }}
        >
          What&apos;s inside
        </h2>

        {/* Sneak peek — horizontal carousel of session preview cards */}
        {featureCards.length > 0 && (
          <div className="mb-10">
            <p
              className="mb-3"
              style={{
                fontFamily: "var(--token-text-label-sm-font)",
                fontSize: "var(--token-text-label-sm-size)",
                fontWeight: "var(--token-text-label-sm-weight)",
                color: "var(--token-color-accent)",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
              }}
            >
              Sneak peek
            </p>
            <div
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-6 px-6"
              style={{ scrollbarWidth: "thin" }}
            >
              {featureCards.map((session) => {
                const thumbUrl = getSessionThumbnail(session);
                return (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className="text-left transition-opacity hover:opacity-90 flex-shrink-0 snap-start overflow-hidden flex flex-col"
                    style={{
                      width: "clamp(240px, 72vw, 300px)",
                      borderRadius: "var(--token-radius-lg)",
                      backgroundColor: "var(--token-color-bg-elevated)",
                      border: "1px solid var(--token-color-border-subtle)",
                      boxShadow: "var(--token-shadow-md)",
                    }}
                  >
                    {thumbUrl && (
                      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-2">
                      <p
                        style={{
                          fontFamily: "var(--token-text-body-md-font)",
                          fontSize: "var(--token-text-body-md-size)",
                          fontWeight: "700",
                          color: "var(--token-color-text-primary)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {stripWrappingQuotes(session.title)}
                      </p>
                      {session.keyTakeaways && session.keyTakeaways.length > 0 ? (
                        <ul className="flex flex-col gap-1">
                          {session.keyTakeaways.slice(0, 2).map((item, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2"
                              style={{
                                fontFamily: "var(--token-text-body-sm-font)",
                                fontSize: "var(--token-text-body-sm-size)",
                                color: "var(--token-color-text-secondary)",
                                lineHeight: "1.45",
                              }}
                            >
                              <span style={{ color: "var(--token-color-accent)", flexShrink: 0 }}>✓</span>
                              <span
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : session.summary ? (
                        <p
                          style={{
                            fontFamily: "var(--token-text-body-sm-font)",
                            fontSize: "var(--token-text-body-sm-size)",
                            color: "var(--token-color-text-secondary)",
                            lineHeight: "1.45",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {session.summary}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Curriculum — full-width lesson rows */}
        {program.weeks.length > 0 && (
          <div className="flex flex-col gap-3">
            {program.weeks.map((week) => (
              <div
                key={week.id}
                className="flex items-start gap-4 p-4"
                style={{
                  borderRadius: "var(--token-radius-lg)",
                  backgroundColor: "var(--token-color-bg-elevated)",
                  border: "1px solid var(--token-color-border-subtle)",
                }}
              >
                <div
                  className="flex-shrink-0 mt-1"
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: "2px solid var(--token-color-accent)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      style={{
                        fontFamily: "var(--token-text-label-sm-font)",
                        fontSize: "var(--token-text-label-sm-size)",
                        fontWeight: "var(--token-text-label-sm-weight)",
                        color: "var(--token-color-accent)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Lesson {week.weekNumber}
                    </p>
                    {week.sessions.length > 0 && (
                      <span
                        className="px-2 py-0.5"
                        style={{
                          fontFamily: "var(--token-text-label-sm-font)",
                          fontSize: "11px",
                          color: "var(--token-color-text-secondary)",
                          backgroundColor: "var(--token-color-bg-default)",
                          borderRadius: "100px",
                          border: "1px solid var(--token-color-border-subtle)",
                        }}
                      >
                        {week.sessions.length} {week.sessions.length === 1 ? "session" : "sessions"}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--token-text-body-md-font)",
                      fontSize: "var(--token-text-body-md-size)",
                      fontWeight: "500",
                      color: "var(--token-color-text-primary)",
                      marginTop: "2px",
                    }}
                  >
                    {stripWrappingQuotes(week.title)}
                  </p>
                  {week.summary && (
                    <p
                      style={{
                        fontFamily: "var(--token-text-body-sm-font)",
                        fontSize: "var(--token-text-body-sm-size)",
                        color: "var(--token-color-text-secondary)",
                        lineHeight: "1.5",
                        marginTop: "4px",
                      }}
                    >
                      {week.summary}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      {priceDisplay !== null && (
        <section className={`px-6 pt-8 pb-12 max-w-5xl mx-auto flex flex-col gap-6 ${isMobile ? "" : "md:flex-row md:items-center md:justify-between"} items-start`}>
          <div>
            <p
              style={{
                fontFamily: "var(--token-text-label-sm-font)",
                fontSize: "var(--token-text-label-sm-size)",
                fontWeight: "var(--token-text-label-sm-weight)",
                color: "var(--token-color-accent)",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "8px",
              }}
            >
              Investment
            </p>
            <p
              style={{
                fontFamily: "var(--token-text-heading-xl-font)",
                fontSize: "var(--token-text-heading-xl-size)",
                fontWeight: "var(--token-text-heading-xl-weight)",
                color: "var(--token-color-text-primary)",
                lineHeight: "1",
              }}
            >
              {priceDisplay}
            </p>
            <p
              className="flex flex-wrap gap-x-2 gap-y-0.5 mt-3"
              style={{
                fontFamily: "var(--token-text-body-sm-font)",
                fontSize: "var(--token-text-body-sm-size)",
                color: "var(--token-color-text-secondary)",
              }}
            >
              <span>Start any time</span>
              <span>·</span>
              <span>{pacingLabel}</span>
              <span>·</span>
              <span>Lifetime access</span>
            </p>
          </div>
          <div className="w-full md:w-auto md:min-w-[280px]">
            <button
              style={{
                width: "100%",
                padding: "12px 24px",
                borderRadius: "var(--token-comp-btn-primary-radius, 100px)",
                background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                color: "#fff",
                fontFamily: "var(--token-text-body-sm-font)",
                fontSize: "var(--token-text-body-sm-size)",
                fontWeight: "600",
              } as React.CSSProperties}
            >
              {priceDisplay === "Free" ? "Enroll free" : `Buy for ${priceDisplay}`}
            </button>
          </div>
        </section>
      )}

      {/* ── Footer branding ──────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-5 flex items-center justify-center gap-2"
        style={{ borderTop: "1px solid var(--token-color-border-subtle)" }}
      >
        <span
          className="flex items-center gap-1.5"
          style={{
            fontFamily: "var(--token-text-label-sm-font)",
            fontSize: "var(--token-text-label-sm-size)",
            color: "var(--token-color-text-secondary)",
          }}
        >
          <span>Powered by</span>
          <span
            style={{
              fontWeight: "700",
              background:
                "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Journeyline
          </span>
        </span>
      </footer>
    </div>
  );
}
