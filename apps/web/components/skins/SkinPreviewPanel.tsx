"use client";

import { useMemo } from "react";
import { getSkinTokens } from "@/lib/skin-bundles/registry";
import { getTokenCSSVars } from "@/lib/skin-bridge";
import { getSkinCatalogEntry } from "@/lib/skin-bundles/catalog";
import type { CSSProperties } from "react";
import type { SkinTokens } from "@guide-rail/shared";

interface SkinPreviewPanelProps {
  skinId: string;
  viewMode?: "desktop" | "mobile";
}

// ── Section header (sticky) ───────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-2"
      style={{
        backgroundColor: "var(--token-color-bg-elevated)",
        borderBottom: "1px solid var(--token-color-border-subtle)",
        borderTop: "1px solid var(--token-color-border-subtle)",
      }}
    >
      <div
        className="w-0.5 self-stretch rounded-full"
        style={{ backgroundColor: "var(--token-color-accent)" }}
      />
      <span
        className="text-[9px] font-bold tracking-[0.15em] uppercase"
        style={{ color: "var(--token-color-text-secondary)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Token sub-heading ─────────────────────────────────────────────────────────
function TokenGroupLabel({ label }: { label: string }) {
  return (
    <p
      className="text-[9px] font-bold tracking-widest uppercase mt-4 mb-1.5 first:mt-0"
      style={{ color: "var(--token-color-accent)" }}
    >
      {label}
    </p>
  );
}

// ── Single token row ──────────────────────────────────────────────────────────
function TokenRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span
        className="text-[10px] truncate"
        style={{ color: "var(--token-color-text-secondary)" }}
      >
        {name}
      </span>
      <code
        className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 font-mono"
        style={{
          backgroundColor: "var(--token-color-bg-elevated)",
          color: "var(--token-color-text-primary)",
          border: "1px solid var(--token-color-border-subtle)",
        }}
      >
        {value}
      </code>
    </div>
  );
}

// ── Color swatch row ──────────────────────────────────────────────────────────
function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div
        className="w-4 h-4 rounded-full flex-shrink-0 border"
        style={{
          backgroundColor: value,
          borderColor: "var(--token-color-border-subtle)",
        }}
      />
      <span
        className="text-[10px] flex-1 truncate"
        style={{ color: "var(--token-color-text-secondary)" }}
      >
        {name}
      </span>
      <code
        className="text-[9px] font-mono flex-shrink-0"
        style={{ color: "var(--token-color-text-secondary)" }}
      >
        {value}
      </code>
    </div>
  );
}

// ── Marketing Lander section ──────────────────────────────────────────────────
// Mirrors the layout of apps/web/app/p/[slug]/page.tsx
// viewMode="mobile"  → single-column (hero + what you get + pricing)
// viewMode="desktop" → 2-col hero with video preview + what you get + pricing
function MarketingLanderSection({ viewMode = "mobile" }: { viewMode?: "desktop" | "mobile" }) {
  const weeks = [
    { week: 1, title: "Foundation" },
    { week: 2, title: "Progressive Overload" },
    { week: 3, title: "Recovery" },
    { week: 4, title: "Mastery" },
  ];
  const featureCards = [
    { title: "Form Fundamentals", desc: "Master proper technique from day one with detailed video breakdowns" },
    { title: "Progressive Loading", desc: "Build strength systematically with guided progression protocols" },
  ];

  // Shared sub-components (inline, scaled for preview)
  const WeekItem = ({ week, title }: { week: number; title: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{
        width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
        border: "1.5px solid var(--token-color-accent)",
      }} />
      <div>
        <p style={{
          fontFamily: "var(--token-text-label-sm-font)",
          fontSize: "9px",
          fontWeight: "var(--token-text-label-sm-weight)",
          color: "var(--token-color-accent)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
          lineHeight: 1,
        }}>
          Week {week}
        </p>
        <p style={{
          fontFamily: "var(--token-text-body-sm-font)",
          fontSize: "var(--token-text-body-sm-size)",
          fontWeight: "500",
          color: "var(--token-color-text-primary)",
        }}>
          {title}
        </p>
      </div>
    </div>
  );

  const FeatureCard = ({ title, desc }: { title: string; desc: string }) => (
    <div style={{
      padding: "10px 12px",
      borderRadius: "var(--token-radius-lg)",
      backgroundColor: "var(--token-color-bg-elevated)",
      border: "1.5px solid var(--token-color-accent)",
      boxShadow: "var(--token-shadow-sm)",
    }}>
      <p style={{
        fontFamily: "var(--token-text-body-sm-font)",
        fontSize: "var(--token-text-body-sm-size)",
        fontWeight: "700",
        color: "var(--token-color-text-primary)",
        marginBottom: "3px",
      }}>{title}</p>
      <p style={{
        fontFamily: "var(--token-text-body-sm-font)",
        fontSize: "10px",
        color: "var(--token-color-text-secondary)",
        lineHeight: "1.4",
      }}>{desc}</p>
    </div>
  );

  const wrapper: React.CSSProperties = {
    backgroundColor: "var(--token-color-bg-default)",
    fontFamily: "var(--token-text-body-md-font)",
  };

  if (viewMode === "mobile") {
    // ── Mobile: single-column hero + what you get + pricing ────────────────
    return (
      <div style={wrapper}>
        {/* Hero */}
        <div style={{ padding: "16px 16px 12px" }}>
          <p style={{
            fontFamily: "var(--token-text-label-sm-font)",
            fontSize: "9px",
            fontWeight: "var(--token-text-label-sm-weight)",
            color: "var(--token-color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: "8px",
          }}>
            Coach Maya Rivera
          </p>
          <h1 style={{
            fontFamily: "var(--token-text-heading-xl-font)",
            fontSize: "var(--token-text-heading-md-size)",
            fontWeight: "var(--token-text-heading-xl-weight)",
            lineHeight: "1.1",
            background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "8px",
          }}>
            The 8-Week Strength Foundation
          </h1>
          <p style={{
            fontFamily: "var(--token-text-body-sm-font)",
            fontSize: "var(--token-text-body-sm-size)",
            color: "var(--token-color-text-secondary)",
            marginBottom: "12px",
          }}>
            Build a training habit that actually sticks
          </p>
          <button style={{
            width: "100%",
            padding: "8px",
            borderRadius: "var(--token-comp-btn-primary-radius)",
            background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
            color: "#fff",
            fontFamily: "var(--token-text-body-sm-font)",
            fontSize: "var(--token-text-body-sm-size)",
            fontWeight: "700",
            textTransform: "uppercase" as const,
            letterSpacing: "0.08em",
          }}>
            Join the program
          </button>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1.5px solid var(--token-color-accent)", margin: "0 16px" }} />

        {/* What you get */}
        <div style={{ padding: "12px 16px" }}>
          <p style={{
            fontFamily: "var(--token-text-heading-md-font)",
            fontSize: "var(--token-text-heading-md-size)",
            fontWeight: "var(--token-text-heading-md-weight)",
            color: "var(--token-color-accent)",
            marginBottom: "10px",
          }}>
            What you get
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
            {weeks.map(({ week, title }) => (
              <WeekItem key={week} week={week} title={title} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {featureCards.map((c) => (
              <FeatureCard key={c.title} title={c.title} desc={c.desc} />
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div style={{ padding: "10px 16px 16px" }}>
          <p style={{
            fontSize: "9px", fontWeight: "700",
            color: "var(--token-color-accent)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.15em",
            marginBottom: "2px",
          }}>Investment</p>
          <p style={{
            fontFamily: "var(--token-text-heading-xl-font)",
            fontSize: "var(--token-text-heading-lg-size)",
            fontWeight: "var(--token-text-heading-xl-weight)",
            color: "var(--token-color-text-primary)",
            marginBottom: "8px",
          }}>$149</p>
          <button style={{
            width: "100%",
            padding: "8px",
            borderRadius: "var(--token-comp-btn-primary-radius)",
            background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
            color: "#fff",
            fontFamily: "var(--token-text-body-sm-font)",
            fontSize: "var(--token-text-body-sm-size)",
            fontWeight: "700",
            textTransform: "uppercase" as const,
            letterSpacing: "0.08em",
          }}>
            Start your journey
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop: 2-col hero + what you get + pricing ───────────────────────────
  return (
    <div style={wrapper}>
      {/* Hero — 2 columns */}
      <div style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Left: text */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{
            fontFamily: "var(--token-text-label-sm-font)",
            fontSize: "9px",
            fontWeight: "var(--token-text-label-sm-weight)",
            color: "var(--token-color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}>
            Coach Maya Rivera
          </p>
          <h1 style={{
            fontFamily: "var(--token-text-heading-xl-font)",
            fontSize: "var(--token-text-heading-lg-size)",
            fontWeight: "var(--token-text-heading-xl-weight)",
            lineHeight: "1.05",
            background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            The 8-Week Strength Foundation
          </h1>
          <p style={{
            fontFamily: "var(--token-text-body-sm-font)",
            fontSize: "var(--token-text-body-sm-size)",
            color: "var(--token-color-text-secondary)",
          }}>
            Build a training habit that actually sticks
          </p>
          <button style={{
            padding: "6px 14px",
            borderRadius: "var(--token-comp-btn-primary-radius)",
            background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
            color: "#fff",
            fontFamily: "var(--token-text-body-sm-font)",
            fontSize: "9px",
            fontWeight: "700",
            textTransform: "uppercase" as const,
            letterSpacing: "0.08em",
            alignSelf: "flex-start",
          }}>
            Join the program
          </button>
        </div>

        {/* Right: video preview */}
        <div style={{
          flex: 1,
          aspectRatio: "4/3",
          borderRadius: "var(--token-radius-lg)",
          backgroundColor: "var(--token-color-bg-elevated)",
          border: "1.5px solid var(--token-color-accent)",
          boxShadow: "var(--token-shadow-sm)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p style={{
            fontSize: "8px", fontWeight: "700",
            color: "var(--token-color-accent)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.15em",
          }}>Preview</p>
          <p style={{
            fontSize: "9px",
            color: "var(--token-color-text-primary)",
          }}>Watch program intro</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1.5px solid var(--token-color-accent)", margin: "0 16px" }} />

      {/* What you get */}
      <div style={{ padding: "12px 16px" }}>
        <p style={{
          fontFamily: "var(--token-text-heading-md-font)",
          fontSize: "var(--token-text-heading-md-size)",
          fontWeight: "var(--token-text-heading-md-weight)",
          color: "var(--token-color-accent)",
          marginBottom: "10px",
        }}>
          What you get
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          {/* Left: weeks */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            {weeks.map(({ week, title }) => (
              <WeekItem key={week} week={week} title={title} />
            ))}
          </div>
          {/* Right: feature cards */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
            {featureCards.map((c) => (
              <FeatureCard key={c.title} title={c.title} desc={c.desc} />
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div style={{ padding: "10px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <p style={{
            fontSize: "9px", fontWeight: "700",
            color: "var(--token-color-accent)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.15em",
            marginBottom: "2px",
          }}>Investment</p>
          <p style={{
            fontFamily: "var(--token-text-heading-xl-font)",
            fontSize: "var(--token-text-heading-lg-size)",
            fontWeight: "var(--token-text-heading-xl-weight)",
            color: "var(--token-color-text-primary)",
          }}>$149</p>
        </div>
        <button style={{
          padding: "8px 20px",
          borderRadius: "var(--token-comp-btn-primary-radius)",
          background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
          color: "#fff",
          fontFamily: "var(--token-text-body-sm-font)",
          fontSize: "9px",
          fontWeight: "700",
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
        }}>
          Start your journey
        </button>
      </div>
    </div>
  );
}

// ── Learner Journey section ───────────────────────────────────────────────────
// Mirrors the layout of apps/web/app/learn/[programId]/timeline.tsx
function LearnerJourneySection() {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const progressPercent = 38;
  const offset = circ - (progressPercent / 100) * circ;

  // Mirrors getActionTypeColor() from lib/action-type-styles.ts
  function actionColor(type: string): string {
    if (type === "REFLECT") return "var(--token-color-semantic-action-reflect)";
    if (type === "DO") return "var(--token-color-semantic-action-do)";
    return "var(--token-color-accent)"; // WATCH, READ
  }

  const actions = [
    { id: "w", title: "Intro to Movement Patterns", type: "WATCH", label: "Watch", done: false, isNext: true },
    { id: "d", title: "Bodyweight Squat Practice", type: "DO", label: "Practice", done: true, isNext: false },
    { id: "r", title: "How did your body feel?", type: "REFLECT", label: "Reflect", done: false, isNext: false },
  ];

  return (
    <div
      style={{
        backgroundColor: "var(--token-color-bg-default)",
        fontFamily: "var(--token-text-body-md-font)",
      }}
    >
      {/* Nav bar — mirrors the sticky top bar in LearnerTimeline */}
      <nav
        style={{
          backgroundColor: "var(--token-color-bg-default)",
          borderBottom: "1px solid var(--token-color-border-subtle)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span
            style={{
              fontFamily: "var(--token-text-body-sm-font)",
              fontSize: "var(--token-text-body-sm-size)",
              fontWeight: "700",
              color: "var(--token-color-accent)",
            }}
          >
            ←
          </span>
          <div className="flex-1 text-center px-4">
            <h1
              className="truncate heading-display"
              style={{
                fontFamily: "var(--token-text-heading-md-font)",
                fontSize: "var(--token-text-heading-md-size)",
                fontWeight: "var(--token-text-heading-md-weight)",
                color: "var(--token-color-text-primary)",
              }}
            >
              8-Week Strength Foundation
            </h1>
          </div>
          {/* Progress circle — mirrors the SVG arc in the nav */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r={r} fill="none" stroke="var(--token-color-border-subtle)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r={r}
                fill="none"
                stroke="var(--token-color-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{
                fontSize: "9px",
                fontWeight: "700",
                fontFamily: "var(--token-text-label-sm-font)",
                color: "var(--token-color-text-primary)",
              }}
            >
              {progressPercent}%
            </span>
          </div>
        </div>
      </nav>

      <div className="px-4 py-4 space-y-4">
        {/* Progress summary */}
        <p
          className="text-center"
          style={{
            fontFamily: "var(--token-text-body-sm-font)",
            fontSize: "var(--token-text-body-sm-size)",
            color: "var(--token-color-text-secondary)",
          }}
        >
          12 of 32 actions complete
        </p>

        {/* Week 1 — Unlocked */}
        <section>
          {/* Week header — mirrors <div className="flex items-center mb-3"> */}
          <div className="flex items-center mb-2">
            <h2
              style={{
                fontFamily: "var(--token-text-body-sm-font)",
                fontSize: "var(--token-text-body-sm-size)",
                fontWeight: "500",
                color: "var(--token-color-text-primary)",
              }}
            >
              Week 1: Foundation &amp; Mobility
            </h2>
            <span
              className="ml-auto"
              style={{
                fontFamily: "var(--token-text-body-sm-font)",
                fontSize: "var(--token-text-body-sm-size)",
                color: "var(--token-color-text-secondary)",
              }}
            >
              2/6
            </span>
          </div>

          {/* 2px progress bar */}
          <div
            className="mb-3 overflow-hidden"
            style={{
              height: "2px",
              backgroundColor: "var(--token-comp-progress-track)",
              borderRadius: "var(--token-comp-progress-radius)",
            }}
          >
            <div
              className="h-full"
              style={{
                width: "33%",
                background: "var(--token-comp-progress-fill)",
                borderRadius: "var(--token-comp-progress-radius)",
              }}
            />
          </div>

          {/* Action cards — mirrors the action card structure in LearnerTimeline */}
          <div className="space-y-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className="border overflow-hidden"
                style={{
                  borderRadius: "var(--token-radius-lg)",
                  backgroundColor: action.done ? "var(--token-color-bg-default)" : "var(--token-color-bg-elevated)",
                  borderColor: action.isNext
                    ? "var(--token-color-accent-hover)"
                    : action.done
                    ? "color-mix(in srgb, var(--token-color-border-subtle), transparent 50%)"
                    : "var(--token-color-border-subtle)",
                  borderWidth: action.isNext ? "2px" : "1px",
                  boxShadow: action.isNext
                    ? "0 10px 15px -3px color-mix(in srgb, var(--token-color-accent-hover), transparent 80%)"
                    : undefined,
                  opacity: action.done ? 0.7 : 1,
                }}
              >
                <div className="flex items-center gap-3 py-3 px-4">
                  {/* Completion circle */}
                  {action.done ? (
                    <div
                      className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-full"
                      style={{ backgroundColor: "var(--token-color-semantic-success)" }}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="w-5 h-5 flex-shrink-0 rounded-full border-2"
                      style={{ borderColor: "var(--token-color-border-subtle)" }}
                    />
                  )}

                  {/* Action info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`truncate ${action.done ? "line-through" : ""}`}
                      style={{
                        fontFamily: "var(--token-text-body-sm-font)",
                        fontSize: "var(--token-text-body-sm-size)",
                        fontWeight: "500",
                        color: action.done ? "var(--token-color-text-secondary)" : "var(--token-color-text-primary)",
                      }}
                    >
                      {action.title}
                    </p>
                    <span
                      className="uppercase tracking-wider"
                      style={{
                        fontFamily: "var(--token-text-label-sm-font)",
                        fontSize: "var(--token-text-label-sm-size)",
                        fontWeight: "600",
                        color: actionColor(action.type),
                      }}
                    >
                      {action.label}
                    </span>
                  </div>

                  {/* "Next" badge */}
                  {action.isNext && (
                    <span
                      className="uppercase tracking-widest flex-shrink-0"
                      style={{
                        fontSize: "9px",
                        fontFamily: "var(--token-text-label-sm-font)",
                        fontWeight: "700",
                        padding: "2px 8px",
                        borderRadius: "var(--token-comp-chip-radius)",
                        backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 85%)",
                        color: "var(--token-color-accent)",
                        border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 70%)",
                      }}
                    >
                      Next
                    </span>
                  )}

                  {/* Chevron for incomplete */}
                  {!action.done && (
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--token-color-text-secondary)" }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weeks 2–3 — Locked */}
        {[
          { week: 2, title: "Building Core Strength" },
          { week: 3, title: "Progressive Overload" },
        ].map(({ week, title }) => (
          <section key={week}>
            <div className="flex items-center mb-2" style={{ opacity: 0.5 }}>
              <h2
                style={{
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "var(--token-text-body-sm-size)",
                  fontWeight: "500",
                  color: "var(--token-color-text-secondary)",
                }}
              >
                Week {week}: {title}
              </h2>
            </div>
            <div
              className="py-5 text-center"
              style={{
                borderRadius: "var(--token-radius-lg)",
                backgroundColor: "color-mix(in srgb, var(--token-color-bg-default), transparent 50%)",
                border: "1px solid var(--token-color-border-subtle)",
              }}
            >
              <svg
                className="w-4 h-4 mx-auto mb-2"
                style={{ color: "var(--token-color-text-secondary)", opacity: 0.5 }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p
                style={{
                  fontFamily: "var(--token-text-body-sm-font)",
                  fontSize: "13px",
                  color: "var(--token-color-text-secondary)",
                  opacity: 0.6,
                }}
              >
                Complete Week {week - 1} to unlock
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ── Learner Step View section ─────────────────────────────────────────────────
// Mirrors the expanded action card state in timeline.tsx
function LearnerStepViewSection() {
  return (
    <div
      style={{
        backgroundColor: "var(--token-color-bg-default)",
        fontFamily: "var(--token-text-body-md-font)",
        padding: "16px",
      }}
    >
      {/* Active action card */}
      <div
        className="step-card-active overflow-hidden"
        style={{
          borderRadius: "var(--token-radius-lg)",
          backgroundColor: "var(--token-color-bg-elevated)",
          border: "1px solid var(--token-color-border-subtle)",
        }}
      >
        {/* Card header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          {/* Completion circle */}
          <div
            className="w-5 h-5 rounded-full flex-shrink-0 border-2"
            style={{ borderColor: "var(--token-color-accent)" }}
          />
          <div className="flex-1 min-w-0">
            {/* Type label */}
            <p
              style={{
                fontSize: "var(--token-text-label-sm-size)",
                fontWeight: "700",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginBottom: "2px",
              }}
            >
              Watch
            </p>
            <p
              style={{
                fontSize: "var(--token-text-body-sm-size)",
                fontWeight: "500",
                color: "var(--token-color-text-primary)",
              }}
            >
              Intro to Movement Patterns
            </p>
          </div>
          {/* Up Next badge */}
          <span
            className="flex-shrink-0 px-2 py-0.5 text-[9px] font-semibold rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 85%)",
              color: "var(--token-color-accent)",
              border: "1px solid color-mix(in srgb, var(--token-color-accent), transparent 70%)",
            }}
          >
            Up Next
          </span>
        </div>

        {/* Video player mockup */}
        <div
          className="mx-4 mb-3"
          style={{
            aspectRatio: "16/9",
            borderRadius: "var(--token-radius-md)",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid var(--token-color-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "color-mix(in srgb, var(--token-color-accent), transparent 70%)",
              border: "2px solid var(--token-color-accent)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="var(--token-color-accent)">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Mark Complete button */}
        <div className="px-4 pb-4">
          <button
            className="w-full py-2 text-sm font-semibold"
            style={{
              borderRadius: "var(--token-comp-btn-primary-radius)",
              background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
              color: "var(--token-color-bg-default)",
              fontSize: "var(--token-text-body-sm-size)",
              fontWeight: "600",
            }}
          >
            Mark Complete
          </button>
        </div>
      </div>

      {/* A completed action below */}
      <div
        className="mt-2 overflow-hidden"
        style={{
          borderRadius: "var(--token-radius-lg)",
          backgroundColor: "var(--token-color-bg-default)",
          border: "1px solid color-mix(in srgb, var(--token-color-border-subtle), transparent 50%)",
          opacity: 0.7,
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: "var(--token-color-semantic-success)" }}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontSize: "9px",
                fontWeight: "700",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginBottom: "1px",
              }}
            >
              Practice
            </p>
            <p style={{ fontSize: "12px", color: "var(--token-color-text-primary)" }}>
              Bodyweight Squat Practice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Program Covers section ────────────────────────────────────────────────────
// Shows how a program appears as a card/thumbnail in listings
function ProgramCoversSection() {
  return (
    <div
      style={{
        backgroundColor: "var(--token-color-bg-default)",
        fontFamily: "var(--token-text-body-md-font)",
        padding: "16px",
      }}
    >
      {/* Program cover card */}
      <div
        style={{
          borderRadius: "var(--token-radius-lg)",
          backgroundColor: "var(--token-color-bg-elevated)",
          border: "1px solid var(--token-color-border-subtle)",
          boxShadow: "var(--token-shadow-md)",
          overflow: "hidden",
        }}
      >
        {/* Cover image area with gradient overlay */}
        <div
          style={{
            aspectRatio: "16/9",
            position: "relative",
            background: "var(--token-color-bg-gradient, linear-gradient(135deg, var(--token-color-bg-elevated) 0%, var(--token-color-bg-default) 100%))",
          }}
        >
          {/* Decorative orbs */}
          <div
            style={{
              position: "absolute",
              top: "20%",
              right: "20%",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "radial-gradient(circle, color-mix(in srgb, var(--token-color-accent), transparent 60%), transparent 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "15%",
              left: "10%",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "radial-gradient(circle, color-mix(in srgb, var(--token-color-accent-secondary, var(--token-color-accent)), transparent 60%), transparent 70%)",
            }}
          />
          {/* Bottom gradient overlay + title */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--token-color-bg-default), transparent 30%) 60%, var(--token-color-bg-default) 100%)",
              display: "flex",
              flexDirection: "column" as const,
              justifyContent: "flex-end",
              padding: "12px",
            }}
          >
            <h3
              style={{
                fontSize: "var(--token-text-heading-md-size)",
                fontWeight: "700",
                lineHeight: "1.2",
                background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginBottom: "4px",
              }}
            >
              8-Week Strength Foundation
            </h3>
            <p style={{ fontSize: "11px", color: "var(--token-color-text-secondary)" }}>
              Build strength from the ground up
            </p>
          </div>
        </div>

        {/* Card footer */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Creator */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                fontSize: "10px",
                fontWeight: "600",
                color: "#fff",
              }}
            >
              A
            </div>
            <span style={{ fontSize: "12px", color: "var(--token-color-text-secondary)" }}>
              Alex Rivera
            </span>
          </div>
          {/* Chips */}
          <div className="flex items-center gap-1.5">
            <span
              className="px-2 py-0.5 text-[9px] font-semibold"
              style={{
                borderRadius: "var(--token-comp-chip-radius)",
                backgroundColor: "var(--token-comp-chip-bg)",
                color: "var(--token-comp-chip-text)",
              }}
            >
              8 weeks
            </span>
            <span
              className="px-2 py-0.5 text-[9px] font-semibold"
              style={{
                borderRadius: "100px",
                background: "linear-gradient(90deg, var(--token-color-accent), var(--token-color-accent-secondary, var(--token-color-accent)))",
                color: "var(--token-color-bg-default)",
              }}
            >
              $47
            </span>
          </div>
        </div>
      </div>

      {/* Second card (smaller, locked/preview state) */}
      <div
        className="mt-2"
        style={{
          borderRadius: "var(--token-radius-lg)",
          backgroundColor: "var(--token-color-bg-elevated)",
          border: "1px solid var(--token-color-border-subtle)",
          overflow: "hidden",
          opacity: 0.65,
        }}
      >
        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "var(--token-radius-md)",
              background: "var(--token-color-bg-gradient, linear-gradient(135deg, var(--token-color-bg-elevated), var(--token-color-bg-default)))",
              flexShrink: 0,
            }}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--token-color-text-primary)" }}>
              Yoga Flow Fundamentals
            </p>
            <p style={{ fontSize: "10px", color: "var(--token-color-text-secondary)" }}>
              Maya Chen · 4 weeks · Free
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Design Tokens section ─────────────────────────────────────────────────────
function DesignTokensSection({ tokens }: { tokens: SkinTokens }) {
  const c = tokens.color;
  const t = tokens.text;

  return (
    <div className="px-5 py-5 space-y-1">

      {/* ── Colors ── */}
      <TokenGroupLabel label="Colors — Background" />
      <ColorSwatch name="default" value={c.background.default} />
      <ColorSwatch name="elevated" value={c.background.elevated} />
      <ColorSwatch name="hero" value={c.background.hero} />
      <ColorSwatch name="surface" value={c.background.surface} />

      <TokenGroupLabel label="Colors — Text" />
      <ColorSwatch name="primary" value={c.text.primary} />
      <ColorSwatch name="secondary" value={c.text.secondary} />

      <TokenGroupLabel label="Colors — Accent" />
      <ColorSwatch name="accent" value={c.accent.primary} />
      <ColorSwatch name="accent secondary" value={c.accent.secondary} />
      <ColorSwatch name="accent hover" value={c.accentHover} />

      <TokenGroupLabel label="Colors — Semantic" />
      <ColorSwatch name="success" value={c.semantic.success} />
      <ColorSwatch name="warning" value={c.semantic.warning} />
      <ColorSwatch name="error" value={c.semantic.error} />
      <ColorSwatch name="action DO" value={c.semantic.actionDo} />
      <ColorSwatch name="action REFLECT" value={c.semantic.actionReflect} />

      <TokenGroupLabel label="Colors — Border" />
      <ColorSwatch name="subtle" value={c.border.subtle} />

      {/* ── Typography ── */}
      <TokenGroupLabel label="Typography" />
      {(
        [
          { label: "display", style: t.heading.display },
          { label: "heading xl", style: t.heading.xl },
          { label: "heading lg", style: t.heading.lg },
          { label: "heading md", style: t.heading.md },
          { label: "body md", style: t.body.md },
          { label: "body sm", style: t.body.sm },
          { label: "label sm", style: t.label.sm },
        ] as const
      ).map(({ label, style }) => (
        <div key={label} className="flex items-baseline justify-between gap-2 py-0.5">
          <span
            style={{
              fontFamily: style.font,
              fontSize: style.size,
              fontWeight: style.weight,
              lineHeight: style.lineHeight,
              color: "var(--token-color-text-primary)",
              // Cap display size so it fits in preview
              maxHeight: "2.5rem",
              overflow: "hidden",
            }}
          >
            Aa
          </span>
          <div className="text-right flex-shrink-0">
            <p
              className="text-[9px] font-semibold"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {label}
            </p>
            <code
              className="text-[8px] font-mono"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {style.size} / {style.weight}
            </code>
          </div>
        </div>
      ))}

      {/* ── Radius ── */}
      <TokenGroupLabel label="Border Radius" />
      <div className="flex gap-4 items-end py-1">
        {(["sm", "md", "lg"] as const).map((key) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <div
              className="w-6 h-6"
              style={{
                borderRadius: tokens.radius[key],
                backgroundColor: "var(--token-color-accent)",
                opacity: 0.7,
              }}
            />
            <code
              className="text-[8px] font-mono"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {key}
            </code>
            <code
              className="text-[8px] font-mono"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {tokens.radius[key]}
            </code>
          </div>
        ))}
      </div>

      {/* ── Shadow ── */}
      <TokenGroupLabel label="Shadow" />
      <div className="flex gap-4 items-end py-2">
        {(["sm", "md", "lg"] as const).map((key) => (
          <div key={key} className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-8"
              style={{
                borderRadius: "var(--token-radius-md)",
                backgroundColor: "var(--token-color-bg-elevated)",
                boxShadow: tokens.shadow[key],
              }}
            />
            <code
              className="text-[8px] font-mono"
              style={{ color: "var(--token-color-text-secondary)" }}
            >
              {key}
            </code>
          </div>
        ))}
      </div>

      {/* ── Motion ── */}
      <TokenGroupLabel label="Motion" />
      <TokenRow name="duration" value={tokens.motion.transition.duration} />
      <TokenRow name="easing" value={tokens.motion.transition.easing} />

      {/* ── Component tokens ── */}
      <TokenGroupLabel label="Components — Button" />
      <TokenRow name="primary variant" value={tokens.component.button.primary.variant} />
      <TokenRow name="primary radius" value={tokens.component.button.primary.radius} />
      <TokenRow name="secondary variant" value={tokens.component.button.secondary.variant} />

      <TokenGroupLabel label="Components — Card" />
      <TokenRow name="radius" value={tokens.component.card.radius} />
      <TokenRow name="shadow" value={tokens.component.card.shadow} />
      <TokenRow name="border" value={tokens.component.card.border} />

      <TokenGroupLabel label="Components — Chip" />
      <div className="flex items-center gap-2 py-1">
        <span
          className="px-2 py-0.5 text-[9px] font-semibold"
          style={{
            borderRadius: "var(--token-comp-chip-radius)",
            backgroundColor: "var(--token-comp-chip-bg)",
            color: "var(--token-comp-chip-text)",
          }}
        >
          sample chip
        </span>
        <span
          className="text-[9px]"
          style={{ color: "var(--token-color-text-secondary)" }}
        >
          chip preview
        </span>
      </div>

      <TokenGroupLabel label="Components — Progress" />
      <div className="space-y-1 py-1">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--token-comp-progress-track)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: "65%",
              background: "var(--token-comp-progress-fill)",
            }}
          />
        </div>
        <code
          className="text-[8px] font-mono block"
          style={{ color: "var(--token-color-text-secondary)" }}
        >
          fill: {tokens.component.progress.fill}
        </code>
      </div>

      <TokenGroupLabel label="Components — Viewer" />
      <TokenRow name="transition style" value={tokens.component.viewer.overlay.transition.style} />
      <TokenRow name="transition duration" value={`${tokens.component.viewer.overlay.transition.durationMs}ms`} />

      {/* bottom padding */}
      <div className="h-4" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SkinPreviewPanel({ skinId, viewMode = "mobile" }: SkinPreviewPanelProps) {
  const tokens = useMemo(() => getSkinTokens(skinId), [skinId]);
  const cssVars = useMemo(() => getTokenCSSVars(tokens), [tokens]);
  const entry = getSkinCatalogEntry(skinId);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        ...(cssVars as CSSProperties),
        backgroundColor: "var(--token-color-bg-default)",
        color: "var(--token-color-text-primary)",
        fontFamily: "var(--token-text-body-md-font)",
      }}
    >
      {/* Skin name header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{
          backgroundColor: "var(--token-color-bg-elevated)",
          borderBottom: "1px solid var(--token-color-border-subtle)",
        }}
      >
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: "var(--token-color-text-secondary)" }}
        >
          {entry?.category ?? "skin"}
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--token-color-text-primary)" }}
        >
          {entry?.name ?? skinId}
        </span>
      </div>

      {/* Scrollable multi-section content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Section 1: Public program page ── */}
        <SectionHeader label="Public program page" />
        <MarketingLanderSection viewMode={viewMode} />

        {/* ── Section 2: Learner timeline ── */}
        <SectionHeader label="Learner timeline" />
        <LearnerJourneySection />

        {/* ── Section 3: Learner step view ── */}
        <SectionHeader label="Learner step view" />
        <LearnerStepViewSection />

        {/* ── Section 4: Program covers ── */}
        <SectionHeader label="Program covers" />
        <ProgramCoversSection />

        {/* ── Section 5: Design Tokens ── */}
        <SectionHeader label="Design Tokens" />
        <DesignTokensSection tokens={tokens} />

      </div>
    </div>
  );
}
