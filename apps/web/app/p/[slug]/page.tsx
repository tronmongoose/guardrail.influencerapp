import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EnrollButton } from "./enroll-button";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { getTokenCSSVars } from "@/lib/skin-bridge";
import { Heading, Body, Label } from "@/components/skins/Typography";
import { ACTION_TYPE_LABELS, getActionTypeBg } from "@/lib/action-type-styles";
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

  const totalSessions = program.weeks.reduce((sum, w) => sum + w.sessions.length, 0);
  const totalActions = program.weeks.reduce(
    (sum, w) => sum + w.sessions.reduce((s, sess) => s + sess.actions.length, 0),
    0
  );

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
      {/* Hero */}
      <header className="px-6 pt-16 pb-12 text-center max-w-2xl mx-auto">
        {/* Duration badge */}
        <span
          className="inline-block px-3 py-1 mb-6"
          style={{
            fontSize: "var(--token-text-label-sm-size)",
            fontWeight: "var(--token-text-label-sm-weight)",
            borderRadius: "var(--token-comp-chip-radius)",
            backgroundColor: "var(--token-comp-chip-bg)",
            color: "var(--token-comp-chip-text)",
            border: "1px solid color-mix(in srgb, var(--token-color-accent) 30%, transparent)",
          }}
        >
          {program.durationWeeks}-week program
        </span>

        {/* Transformation headline */}
        {program.targetTransformation ? (
          <>
            <Heading
              size="xl"
              className="mb-4 sm:text-4xl leading-tight heading-display"
              style={{
                background: "linear-gradient(90deg, #C27AFF, #FB64B6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {program.targetTransformation}
            </Heading>
            <Body size="md" style={{ color: "var(--token-color-text-secondary)" }}>
              {program.title}
            </Body>
          </>
        ) : (
          <Heading
            size="xl"
            className="mb-4 sm:text-4xl leading-tight heading-display"
            style={{
              background: "linear-gradient(90deg, #C27AFF, #FB64B6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {program.title}
          </Heading>
        )}

        {/* Creator */}
        {program.creator.name && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #AD46FF, #F6339A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {program.creator.name.charAt(0).toUpperCase()}
            </span>
            <Body size="sm" as="span" style={{ color: "var(--token-color-text-secondary)" }}>
              by <span style={{ color: "var(--token-color-text-primary)" }}>{program.creator.name}</span>
            </Body>
          </div>
        )}

        {/* Quick stats */}
        <div
          className="flex items-center justify-center gap-6 mt-8"
          style={{
            fontSize: "var(--token-text-body-sm-size)",
            color: "var(--token-color-text-secondary)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {program.weeks.length} weeks
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {totalSessions} sessions
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {totalActions} actions
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-32">
        {/* Description */}
        {program.description && (
          <section className="mb-12">
            <Heading size="lg" className="mb-3">About this program</Heading>
            <Body className="leading-relaxed" style={{ color: "var(--token-color-text-secondary)" }}>
              {program.description}
            </Body>
          </section>
        )}

        {/* Outcome statement */}
        {program.outcomeStatement && (
          <section
            className="mb-12 p-6 text-center"
            style={{
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid var(--token-color-border-subtle)",
              boxShadow: "var(--token-shadow-sm)",
            }}
          >
            <Label className="mb-2 block" style={{ color: "var(--token-color-accent)" }}>
              The Transformation
            </Label>
            <Body
              style={{
                fontSize: "var(--token-text-heading-lg-size)",
                fontWeight: "var(--token-text-heading-md-weight)",
                color: "var(--token-color-text-primary)",
              }}
            >
              {program.outcomeStatement}
            </Body>
          </section>
        )}

        {/* Curriculum */}
        <section className="mb-12">
          <Heading size="lg" className="mb-4">What you&apos;ll learn</Heading>
          <div className="space-y-3">
            {program.weeks.map((week) => (
              <details
                key={week.id}
                className="group overflow-hidden"
                style={{
                  borderRadius: "var(--token-radius-lg)",
                  backgroundColor: "var(--token-color-bg-elevated)",
                  border: "1px solid var(--token-color-border-subtle)",
                }}
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderRadius: "var(--token-radius-md)",
                        backgroundColor: "var(--token-comp-badge-info-bg)",
                        color: "var(--token-comp-badge-info-text)",
                        fontSize: "var(--token-text-label-sm-size)",
                        fontWeight: "var(--token-text-heading-xl-weight)",
                      }}
                    >
                      {week.weekNumber}
                    </span>
                    <div>
                      <Body size="sm" as="p" style={{ fontWeight: "500", color: "var(--token-color-text-primary)" }}>
                        {week.title}
                      </Body>
                      <Label as="p" className="mt-0.5">
                        {week.sessions.length} session{week.sessions.length !== 1 ? "s" : ""}
                        {" · "}
                        {week.sessions.reduce((s, sess) => s + sess.actions.length, 0)} actions
                      </Label>
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-180"
                    style={{ color: "var(--token-color-text-secondary)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>

                <div className="px-4 pb-4 pt-1 space-y-3">
                  {week.sessions.map((session) => (
                    <div key={session.id}>
                      <Body size="sm" as="p" className="mb-1.5" style={{ fontWeight: "500", color: "var(--token-color-text-primary)" }}>
                        {session.title}
                      </Body>
                      {session.summary && (
                        <Label as="p" className="mb-2">
                          {session.summary}
                        </Label>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {session.actions.map((action) => (
                          <span
                            key={action.id}
                            className="text-[10px] px-2 py-0.5"
                            style={{
                              borderRadius: "var(--token-comp-chip-radius)",
                              fontWeight: "500",
                              ...getActionTypeBg(action.type, 80),
                            }}
                          >
                            {ACTION_TYPE_LABELS[action.type] || action.type}: {action.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Creator info */}
        {program.creator.name && (
          <section
            className="mb-12 p-6 text-center"
            style={{
              borderRadius: "var(--token-radius-lg)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid var(--token-color-border-subtle)",
            }}
          >
            <Body size="sm" style={{ color: "var(--token-color-text-secondary)" }}>Created by</Body>
            <Heading size="lg" className="mt-1">{program.creator.name}</Heading>
          </section>
        )}
      </main>

      {/* Sticky CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 backdrop-blur-xl z-40"
        style={{
          backgroundColor: "color-mix(in srgb, var(--token-color-bg-default) 90%, transparent)",
          borderTop: "1px solid var(--token-color-border-subtle)",
        }}
      >
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="flex-shrink-0">
            <Heading size="lg" as="p">{isEnrolled ? "Enrolled" : priceDisplay}</Heading>
          </div>
          <div className="flex-1">
            <EnrollButton
              programId={program.id}
              isFree={program.priceInCents === 0}
              priceDisplay={priceDisplay}
              isEnrolled={isEnrolled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
