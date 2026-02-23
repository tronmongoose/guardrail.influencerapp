import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EnrollButton } from "./enroll-button";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { getTokenCSSVars } from "@/lib/skin-bridge";

export default async function SalesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await prisma.program.findUnique({
    where: { slug },
    include: {
      creator: true,
      weeks: {
        include: { sessions: { include: { actions: true } } },
        orderBy: { weekNumber: "asc" },
      },
    },
  });

  if (!program) {
    console.error(`[sales-page] No program found for slug: "${slug}"`);
    notFound();
  }
  if (!program.published) {
    console.error(`[sales-page] Program found but not published — slug: "${slug}", id: ${program.id}, published: ${program.published}`);
    notFound();
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

  const TYPE_LABELS: Record<string, string> = {
    WATCH: "Watch",
    READ: "Read",
    DO: "Practice",
    REFLECT: "Reflect",
  };

  function getTypeStyle(type: string): React.CSSProperties {
    switch (type) {
      case "WATCH":
      case "READ":
        return {
          backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 80%)",
          color: "var(--token-color-accent)",
        };
      case "REFLECT":
        return {
          backgroundColor: "color-mix(in srgb, var(--token-color-semantic-action-reflect), transparent 80%)",
          color: "var(--token-color-semantic-action-reflect)",
        };
      case "DO":
        return {
          backgroundColor: "color-mix(in srgb, var(--token-color-semantic-action-do), transparent 80%)",
          color: "var(--token-color-semantic-action-do)",
        };
      default:
        return {
          backgroundColor: "color-mix(in srgb, var(--token-color-text-secondary), transparent 80%)",
          color: "var(--token-color-text-secondary)",
        };
    }
  }

  return (
    <div
      className="min-h-screen"
      data-skin={program.skinId}
      style={{
        ...(skinCSSVars as React.CSSProperties),
        backgroundColor: "var(--skin-bg)",
        color: "var(--skin-text)",
      }}
    >
      {/* Hero */}
      <header className="px-6 pt-16 pb-12 text-center max-w-2xl mx-auto">
        {/* Duration badge */}
        <span
          className="inline-block text-xs font-medium px-3 py-1 rounded-full mb-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--skin-accent) 15%, transparent)",
            color: "var(--skin-accent)",
            border: "1px solid color-mix(in srgb, var(--skin-accent) 30%, transparent)",
          }}
        >
          {program.durationWeeks}-week program
        </span>

        {/* Transformation headline */}
        {program.targetTransformation ? (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
              {program.targetTransformation}
            </h1>
            <p className="text-lg" style={{ color: "var(--skin-text-muted)" }}>
              {program.title}
            </p>
          </>
        ) : (
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
            {program.title}
          </h1>
        )}

        {/* Creator */}
        {program.creator.name && (
          <p className="mt-4 text-sm" style={{ color: "var(--skin-text-muted)" }}>
            by <span style={{ color: "var(--skin-text)" }}>{program.creator.name}</span>
          </p>
        )}

        {/* Quick stats */}
        <div className="flex items-center justify-center gap-6 mt-8 text-sm" style={{ color: "var(--skin-text-muted)" }}>
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
            <h2 className="text-lg font-semibold mb-3">About this program</h2>
            <p className="leading-relaxed" style={{ color: "var(--skin-text-muted)" }}>
              {program.description}
            </p>
          </section>
        )}

        {/* Outcome statement */}
        {program.outcomeStatement && (
          <section
            className="mb-12 p-6 rounded-xl text-center"
            style={{
              backgroundColor: "var(--skin-bg-secondary)",
              border: "1px solid var(--skin-border)",
            }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: "var(--skin-accent)" }}>
              The Transformation
            </p>
            <p className="text-lg font-medium leading-relaxed">
              {program.outcomeStatement}
            </p>
          </section>
        )}

        {/* Curriculum */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">What you&apos;ll learn</h2>
          <div className="space-y-3">
            {program.weeks.map((week) => (
              <details
                key={week.id}
                className="group rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "var(--skin-bg-secondary)",
                  border: "1px solid var(--skin-border)",
                }}
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--skin-accent) 15%, transparent)",
                        color: "var(--skin-accent)",
                      }}
                    >
                      {week.weekNumber}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{week.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--skin-text-muted)" }}>
                        {week.sessions.length} session{week.sessions.length !== 1 ? "s" : ""}
                        {" · "}
                        {week.sessions.reduce((s, sess) => s + sess.actions.length, 0)} actions
                      </p>
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-180"
                    style={{ color: "var(--skin-text-muted)" }}
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
                      <p className="text-sm font-medium mb-1.5">{session.title}</p>
                      {session.summary && (
                        <p className="text-xs mb-2" style={{ color: "var(--skin-text-muted)" }}>
                          {session.summary}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {session.actions.map((action) => (
                          <span
                            key={action.id}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={getTypeStyle(action.type)}
                          >
                            {TYPE_LABELS[action.type] || action.type}: {action.title}
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
            className="mb-12 p-6 rounded-xl text-center"
            style={{
              backgroundColor: "var(--skin-bg-secondary)",
              border: "1px solid var(--skin-border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--skin-text-muted)" }}>Created by</p>
            <p className="text-lg font-semibold mt-1">{program.creator.name}</p>
          </section>
        )}
      </main>

      {/* Sticky CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 backdrop-blur-xl z-40"
        style={{
          backgroundColor: "color-mix(in srgb, var(--skin-bg) 90%, transparent)",
          borderTop: "1px solid var(--skin-border)",
        }}
      >
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="flex-shrink-0">
            <p className="text-2xl font-bold">{priceDisplay}</p>
          </div>
          <div className="flex-1">
            <EnrollButton
              programId={program.id}
              isFree={program.priceInCents === 0}
              priceDisplay={priceDisplay}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
