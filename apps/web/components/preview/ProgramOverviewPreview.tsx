"use client";

import type { WeekData } from "@/components/builder";

interface ProgramOverviewPreviewProps {
  program: {
    title: string;
    description: string | null;
    targetAudience: string | null;
    targetTransformation: string | null;
    priceInCents?: number;
    weeks: WeekData[];
  };
  // skin is kept for backwards compat but layout uses CSS custom properties
  // (injected by parent via getTokenCSSVars)
  skin: { name: string };
  onSelectSession: (sessionId: string) => void;
}

export function ProgramOverviewPreview({
  program,
  onSelectSession,
}: ProgramOverviewPreviewProps) {
  // Feature cards: first 2 sessions that have a summary
  const featureCards = program.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => s.summary)
    .slice(0, 2);

  const priceDisplay =
    program.priceInCents === 0
      ? "Free"
      : program.priceInCents
      ? `$${(program.priceInCents / 100).toFixed(2)}`
      : null;

  return (
    <div
      className="min-h-full"
      style={{
        backgroundColor: "var(--token-color-bg-default)",
        color: "var(--token-color-text-primary)",
        fontFamily: "var(--token-text-body-md-font)",
      }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Left: text */}
          <div className="flex flex-col gap-6">
            {/* Gradient heading */}
            <h1
              style={{
                fontFamily: "var(--token-text-heading-xl-font)",
                fontSize: "clamp(1.75rem, 4vw, var(--token-text-heading-xl-size))",
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
              <button
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  borderRadius: "var(--token-comp-btn-primary-radius)",
                  background:
                    "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                  color: "#fff",
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                } as React.CSSProperties}
              >
                {priceDisplay === "Free" ? "Enroll free" : priceDisplay ? `Buy for ${priceDisplay}` : "Join the program"}
              </button>
            </div>
          </div>

          {/* Right: video preview (desktop only) */}
          <div
            className="hidden md:flex flex-col items-center justify-center gap-3"
            style={{
              aspectRatio: "4/3",
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "2px solid var(--token-color-accent)",
              boxShadow: "var(--token-shadow-md)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background:
                  "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 0 40px color-mix(in srgb, var(--token-color-accent) 60%, transparent)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
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
              Preview
            </p>
            <p
              style={{
                fontFamily: "var(--token-text-body-sm-font)",
                fontSize: "var(--token-text-body-sm-size)",
                color: "var(--token-color-text-primary)",
              }}
            >
              Watch program intro
            </p>
          </div>
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "2px solid var(--token-color-accent)",
          margin: "0 24px",
          maxWidth: "calc(64rem - 0px)",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      />

      {/* ── What you get ─────────────────────────────────────────────────────── */}
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
          What you get
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: weeks list */}
          <div className="flex flex-col gap-5">
            {program.weeks.map((week, i) => (
              <div key={week.id} className="flex items-center gap-4">
                <div
                  className="flex-shrink-0"
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: "2px solid var(--token-color-accent)",
                  }}
                />
                <div>
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
                    Week {i + 1}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--token-text-body-md-font)",
                      fontSize: "var(--token-text-body-md-size)",
                      fontWeight: "500",
                      color: "var(--token-color-text-primary)",
                    }}
                  >
                    {week.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: feature cards (sessions with summaries, clickable) */}
          {featureCards.length > 0 && (
            <div className="flex flex-col gap-4">
              {featureCards.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="p-5 text-left transition-opacity hover:opacity-80"
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
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      {priceDisplay !== null && (
        <section className="px-6 pt-8 pb-16 max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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
          </div>
          <div className="w-full md:w-auto md:min-w-[280px]">
            <button
              style={{
                width: "100%",
                padding: "12px 24px",
                borderRadius: "var(--token-comp-btn-primary-radius)",
                background:
                  "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                color: "#fff",
                fontFamily: "var(--token-text-body-sm-font)",
                fontSize: "var(--token-text-body-sm-size)",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              } as React.CSSProperties}
            >
              Start your journey
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
