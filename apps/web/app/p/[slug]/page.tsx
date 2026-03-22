import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EnrollButton } from "./enroll-button";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { getTokenCSSVars } from "@/lib/skin-bridge";
import { getActionTypeBg, ACTION_TYPE_LABELS } from "@/lib/action-type-styles";
import type { Metadata } from "next";
import { logger } from "@/lib/logger";
import { getCurrentUser, hasEntitlement } from "@/lib/auth";

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
          include: { sessions: { include: { actions: true } } },
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
    const user = await getCurrentUser();
    if (user) {
      isEnrolled = await hasEntitlement(user.id, program.id);
    }
  } catch {
    // Not logged in — that's fine
  }

  const tokens = getSkinTokens(program.skinId);
  const skinCSSVars = getTokenCSSVars(tokens);

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

  // Feature cards: up to 3 sessions with keyTakeaways or summary
  const featureCards = program.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => (s.keyTakeaways && s.keyTakeaways.length > 0) || s.summary)
    .slice(0, 3);

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
      className="min-h-screen"
      data-skin={program.skinId}
      style={{
        ...(skinCSSVars as React.CSSProperties),
        background: "var(--token-color-bg-gradient, var(--token-color-bg-default))",
        color: "var(--token-color-text-primary)",
        fontFamily: "var(--token-text-body-md-font)",
      }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Left: text */}
          <div className="flex flex-col gap-6">
            {/* Creator label */}
            {program.creator.name && (
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
                Coach {program.creator.name}
              </p>
            )}

            {/* Big gradient heading */}
            <h1
              style={{
                fontFamily: "var(--token-text-heading-xl-font)",
                fontSize: "clamp(2rem, 5vw, var(--token-text-heading-xl-size))",
                fontWeight: "var(--token-text-heading-xl-weight)",
                lineHeight: "1.05",
                background:
                  "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {program.targetTransformation || program.title}
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

          {/* Right: At a Glance card (desktop only) */}
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
                { label: "Weeks", value: program.durationWeeks },
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
        </div>
      </section>

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
          <span>{program.durationWeeks} weeks</span>
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
          className="mb-8"
          style={{
            fontFamily: "var(--token-text-heading-lg-font)",
            fontSize: "var(--token-text-heading-lg-size)",
            fontWeight: "var(--token-text-heading-lg-weight)",
            color: "var(--token-color-accent)",
          }}
        >
          What&apos;s inside
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: weeks list */}
          <div className="flex flex-col gap-5">
            {program.weeks.map((week) => (
              <div key={week.id} className="flex items-start gap-4">
                {/* Circle indicator */}
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
                      Week {week.weekNumber}
                    </p>
                    {week.sessions.length > 0 && (
                      <span
                        className="px-2 py-0.5"
                        style={{
                          fontFamily: "var(--token-text-label-sm-font)",
                          fontSize: "11px",
                          color: "var(--token-color-text-secondary)",
                          backgroundColor: "var(--token-color-bg-elevated)",
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
                    {week.title}
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

          {/* Right: feature cards */}
          {featureCards.length > 0 && (
            <div className="flex flex-col gap-4">
              {featureCards.map((session) => (
                <div
                  key={session.id}
                  className="p-5"
                  style={{
                    borderRadius: "var(--token-radius-lg)",
                    backgroundColor: "var(--token-color-bg-elevated)",
                    border: "2px solid var(--token-color-accent)",
                    boxShadow: "var(--token-shadow-md)",
                  }}
                >
                  <p
                    className="mb-2"
                    style={{
                      fontFamily: "var(--token-text-body-md-font)",
                      fontSize: "var(--token-text-body-md-size)",
                      fontWeight: "700",
                      color: "var(--token-color-text-primary)",
                    }}
                  >
                    {session.title}
                  </p>
                  {session.keyTakeaways && session.keyTakeaways.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {session.keyTakeaways.slice(0, 3).map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2"
                          style={{
                            fontFamily: "var(--token-text-body-sm-font)",
                            fontSize: "var(--token-text-body-sm-size)",
                            color: "var(--token-color-text-secondary)",
                            lineHeight: "1.5",
                          }}
                        >
                          <span style={{ color: "var(--token-color-accent)", flexShrink: 0 }}>✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      style={{
                        fontFamily: "var(--token-text-body-sm-font)",
                        fontSize: "var(--token-text-body-sm-size)",
                        color: "var(--token-color-text-secondary)",
                        lineHeight: "1.5",
                      }}
                    >
                      {session.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
