import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EnrollButton } from "./enroll-button";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { getTokenCSSVars } from "@/lib/skin-bridge";
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

  // Feature cards: first 2 sessions (across all weeks) that have a summary
  const featureCards = program.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => s.summary)
    .slice(0, 2);

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

          {/* Right: video preview placeholder (desktop only) */}
          <div
            className="hidden md:flex flex-col items-center justify-center gap-3"
            style={{
              aspectRatio: "4/3",
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "2px solid var(--token-color-accent)",
              boxShadow: "var(--token-shadow-md)",
              position: "relative",
            }}
          >
            {/* Play button */}
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
        className="max-w-5xl mx-auto"
        style={{ borderTop: "2px solid var(--token-color-accent)", margin: "0 24px" }}
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
            {program.weeks.map((week) => (
              <div key={week.id} className="flex items-center gap-4">
                {/* Circle indicator */}
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
                    Week {week.weekNumber}
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
    </div>
  );
}
