import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EnrollButton } from "./enroll-button";
import { resolveTokens } from "@/lib/resolve-tokens";
import { getTokenCSSVars } from "@/lib/skin-bridge";
import { getSkinDecorations, resolveColorKey } from "@/lib/skin-decorations";
import { getPatternCSS } from "@/lib/decoration-patterns";
import { getActionTypeBg, ACTION_TYPE_LABELS } from "@/lib/action-type-styles";
import type { Metadata } from "next";
import { logger } from "@/lib/logger";
import { getCurrentUserForProgram, hasEntitlement } from "@/lib/auth";
import { stripWrappingQuotes } from "@/lib/strip-quotes";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await prisma.program.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      targetTransformation: true,
      published: true,
      creator: { select: { name: true } },
    },
  });

  if (!program || !program.published) {
    return { title: "Program Not Found" };
  }

  const title = program.title;
  const description =
    program.description ||
    program.targetTransformation ||
    `A guided learning program by ${program.creator.name || "Journeyline"}`;

  return {
    title: `${title} | Journeyline`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Journeyline",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SalesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let program;
  try {
    program = await prisma.program.findUnique({
      where: { slug },
      include: {
        creator: true,
        weeks: {
          include: {
            sessions: {
              include: {
                actions: {
                  include: {
                    youtubeVideo: { select: { thumbnailUrl: true, muxPlaybackId: true } },
                  },
                },
                compositeSession: {
                  include: {
                    clips: {
                      orderBy: { orderIndex: "asc" },
                      include: {
                        youtubeVideo: { select: { thumbnailUrl: true, muxPlaybackId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { weekNumber: "asc" },
        },
      },
    });
  } catch (err) {
    logger.error({ operation: "sales_page.db_error", slug }, err);
    notFound();
  }

  if (!program) {
    logger.warn({ operation: "sales_page.not_found", slug });
    notFound();
  }
  if (!program.published) {
    logger.warn({ operation: "sales_page.not_published", slug, programId: program.id });
    notFound();
  }

  // Check if current user is already enrolled
  let isEnrolled = false;
  try {
    const user = await getCurrentUserForProgram(program.id);
    if (user) {
      isEnrolled = await hasEntitlement(user.id, program.id);
    }
  } catch {
    // Not logged in — that's fine
  }

  // Map private blob URL to public proxy URL for avatar rendering
  if (program.creatorAvatarUrl) {
    program.creatorAvatarUrl = `/api/programs/${program.id}/avatar`;
  }

  const tokens = await resolveTokens(program);
  const skinCSSVars = getTokenCSSVars(tokens);
  const decorations = getSkinDecorations(program.skinId, tokens);

  const priceDisplay =
    program.priceInCents === 0
      ? "Free"
      : `$${(program.priceInCents / 100).toFixed(2)}`;

  // Derived stats
  const totalSessions = program.weeks.reduce((n, w) => n + w.sessions.length, 0);
  const allActions = program.weeks.flatMap((w) => w.sessions.flatMap((s) => s.actions));
  const actionTypeCounts = allActions.reduce(
    (acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const pacingLabel = program.pacingMode === "DRIP_BY_WEEK" ? "Drip-paced" : "Self-paced";
  const groupLabel = "Lesson";

  // Feature cards: sessions with keyTakeaways or summary
  const featureCards = program.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => (s.keyTakeaways && s.keyTakeaways.length > 0) || s.summary);

  // Helper: derive thumbnail URL for a session. Scene-based sessions keep their
  // video refs on compositeSession.clips; classic sessions keep them on WATCH actions.
  function getSessionThumbnail(session: typeof featureCards[number]): string | null {
    const watch = session.actions.find((a) => a.type === "WATCH");
    if (watch) {
      const muxId = watch.muxPlaybackId ?? watch.youtubeVideo?.muxPlaybackId;
      if (muxId) return `https://image.mux.com/${muxId}/thumbnail.jpg?time=2&width=640`;
      if (watch.youtubeVideo?.thumbnailUrl) return watch.youtubeVideo.thumbnailUrl;
    }
    const firstClip = session.compositeSession?.clips?.[0];
    if (firstClip?.youtubeVideo) {
      const muxId = firstClip.youtubeVideo.muxPlaybackId;
      if (muxId) return `https://image.mux.com/${muxId}/thumbnail.jpg?time=2&width=640`;
      if (firstClip.youtubeVideo.thumbnailUrl) return firstClip.youtubeVideo.thumbnailUrl;
    }
    return null;
  }

  // First available video thumbnail for the hero
  const heroThumbnail = (() => {
    for (const week of program.weeks) {
      for (const session of week.sessions) {
        const t = getSessionThumbnail(session);
        if (t) return t;
      }
    }
    return null;
  })();

  const hasWhoSection = !!(program.targetAudience || program.outcomeStatement);

  // Action type display order
  const actionTypeOrder = ["WATCH", "READ", "DO", "REFLECT"] as const;
  const actionTypeIcons: Record<string, string> = {
    WATCH: "▶",
    READ: "📖",
    DO: "💪",
    REFLECT: "✏",
  };

  return (
    <div
      className="min-h-screen relative"
      data-skin={program.skinId}
      style={{
        ...(skinCSSVars as React.CSSProperties),
        background: "var(--token-color-bg-gradient, var(--token-color-bg-default))",
        color: "var(--token-color-text-primary)",
        fontFamily: "var(--token-text-body-md-font)",
      }}
    >
      {/* ── Skin decoration overlays ──────────────────────────────────────── */}
      {decorations.backgroundPattern && (() => {
        const patColor = resolveColorKey(decorations.backgroundPattern.colorKey, tokens);
        const patCss = getPatternCSS({ type: decorations.backgroundPattern.type, color: patColor, spacing: decorations.backgroundPattern.spacing, size: decorations.backgroundPattern.size });
        return (
          <div
            className="fixed inset-0 pointer-events-none z-10"
            style={{
              backgroundImage: patCss.backgroundImage,
              backgroundSize: patCss.backgroundSize,
              backgroundPosition: patCss.backgroundPosition,
              opacity: decorations.backgroundPattern.opacity,
            }}
          />
        );
      })()}
      {decorations.floatingElements.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {decorations.floatingElements.map((el, i) => {
            const color = el.color === "accent" ? tokens.color.accent.primary
              : el.color === "accent-secondary" ? tokens.color.accent.secondary
              : el.color === "text-primary" ? tokens.color.text.primary
              : el.color === "text-secondary" ? tokens.color.text.secondary
              : el.color === "white" ? "#ffffff"
              : tokens.color.accent.primary;
            const cls = `pub-deco-${i}`;
            const delay = el.animationDelay ?? "0s";
            const animStr = !el.animation ? "none"
              : el.animation === "float" ? `deco-float 6s ease-in-out ${delay} infinite`
              : el.animation === "float-slow" ? `deco-float-slow 8s ease-in-out ${delay} infinite`
              : el.animation === "float-reverse" ? `deco-float-reverse 7s ease-in-out ${delay} infinite`
              : el.animation === "pulse-gentle" ? `deco-pulse 4s ease-in-out ${delay} infinite`
              : el.animation === "drift" ? `deco-drift 12s ease-in-out ${delay} infinite`
              : el.animation === "wander" ? `deco-wander 14s ease-in-out ${delay} infinite`
              : "none";
            const isEmoji = el.shape === "emoji";
            const style: React.CSSProperties = {
              position: "absolute", top: el.top, left: el.left, right: el.right, bottom: el.bottom,
              width: el.size, height: el.size,
              ...(isEmoji ? {
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: el.size, lineHeight: 1, color, userSelect: "none" as const,
              } : {
                backgroundColor: el.shape === "ring" ? "transparent" : color,
                borderRadius: el.shape === "circle" || el.shape === "ring" ? "50%" : 2,
                border: el.shape === "ring" ? `1.5px solid ${color}` : undefined,
                transform: el.shape === "diamond" ? "rotate(45deg)" : undefined,
              }),
            };
            return (
              <div key={i} className={cls} style={style}>
                {isEmoji && el.emoji ? el.emoji : null}
                <style>{`.${cls} { opacity: ${el.opacity}; animation: ${animStr}; --el-opacity: ${el.opacity}; --el-opacity-peak: ${Math.min(el.opacity * 1.5, 1)}; }`}</style>
              </div>
            );
          })}
        </div>
      )}
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Left: text */}
          <div className="flex flex-col gap-6 min-w-0 overflow-hidden">
            {/* Creator label with optional avatar */}
            {(program.creator.name || program.creatorAvatarUrl) && (
              <div className="flex items-center gap-3">
                {program.creatorAvatarUrl && (
                  <div
                    className="w-14 h-14 rounded-full flex-shrink-0"
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
                        src={program.creatorAvatarUrl}
                        alt={program.creator.name ? `${program.creator.name}'s avatar` : "Creator avatar"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  </div>
                )}
                {program.creator.name && (
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
                    Coach {program.creator.name}
                  </p>
                )}
              </div>
            )}

            {/* Big heading */}
            <h1
              style={{
                fontFamily: "var(--token-text-heading-xl-font)",
                fontSize: "clamp(2rem, 5vw, var(--token-text-heading-xl-size))",
                fontWeight: "var(--token-text-heading-xl-weight)",
                lineHeight: "1.05",
                color: "var(--token-color-text-primary)",
                wordBreak: "break-word",
              }}
            >
              {stripWrappingQuotes(program.title || program.targetTransformation || "")}
            </h1>

            {/* Subtitle */}
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

            {/* CTA */}
            <div className="max-w-xs">
              <EnrollButton
                programId={program.id}
                isFree={program.priceInCents === 0}
                priceDisplay={priceDisplay}
                isEnrolled={isEnrolled}
              />
            </div>
          </div>

          {/* Right: Video thumbnail (desktop only) — falls back to At a Glance card */}
          {heroThumbnail ? (
            <div className="hidden md:flex flex-col gap-4">
              {/* Thumbnail */}
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
                  src={heroThumbnail}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {/* Dark scrim */}
                <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)" }} />
                {/* Play button */}
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
              {/* Compact stats */}
              <p
                className="flex flex-wrap gap-x-2"
                style={{
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  color: "var(--token-color-text-secondary)",
                }}
              >
                <span>{program.durationWeeks} {program.durationWeeks === 1 ? "lesson" : "lessons"}</span>
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
              className="hidden md:flex flex-col gap-5 p-7"
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

              {/* Key numbers */}
              <div className="flex gap-6">
                {[
                  { label: "Lessons", value: program.durationWeeks },
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

              {/* Pacing */}
              <p
                style={{
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  color: "var(--token-color-text-secondary)",
                }}
              >
                {pacingLabel} · Start any time
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
                        className="px-3 py-1 text-sm rounded-full"
                        style={{
                          ...getActionTypeBg(type, 85),
                          fontFamily: "var(--token-text-label-sm-font)",
                          fontSize: "var(--token-text-label-sm-size)",
                          fontWeight: "var(--token-text-label-sm-weight)",
                          borderRadius: "100px",
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

      {/* ── Mobile hero thumbnail (hidden on md+) ────────────────────────────── */}
      {heroThumbnail && (
        <div className="md:hidden px-6 pb-6 max-w-5xl mx-auto">
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
              src={heroThumbnail}
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
        </div>
      )}

      {/* ── Mobile stats strip (hidden on md+) ───────────────────────────────── */}
      <div className="md:hidden px-6 pb-6 max-w-5xl mx-auto">
        <p
          className="flex flex-wrap gap-x-3 gap-y-1"
          style={{
            fontFamily: "var(--token-text-label-sm-font)",
            fontSize: "var(--token-text-label-sm-size)",
            color: "var(--token-color-text-secondary)",
          }}
        >
          <span>{program.durationWeeks} {program.durationWeeks === 1 ? "lesson" : "lessons"}</span>
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
            className={`grid grid-cols-1 gap-4 ${program.targetAudience && program.outcomeStatement ? "md:grid-cols-2" : ""}`}
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
                  <div
                    key={session.id}
                    className="flex-shrink-0 snap-start overflow-hidden flex flex-col"
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
                  </div>
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
                      {groupLabel} {week.weekNumber}
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
      <section
        className="px-6 pt-8 pb-16 max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
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
            {isEnrolled ? "Enrolled" : priceDisplay}
          </p>
          {/* Trust signals */}
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
          <EnrollButton
            programId={program.id}
            isFree={program.priceInCents === 0}
            priceDisplay={priceDisplay}
            isEnrolled={isEnrolled}
          />
        </div>
      </section>

      {/* ── Footer branding ──────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-5 flex items-center justify-center gap-2"
        style={{ borderTop: "1px solid var(--token-color-border-subtle)" }}
      >
        <a
          href="https://journeyline.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{
            fontFamily: "var(--token-text-label-sm-font)",
            fontSize: "var(--token-text-label-sm-size)",
            color: "var(--token-color-text-secondary)",
            textDecoration: "none",
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
        </a>
      </footer>
    </div>
  );
}
