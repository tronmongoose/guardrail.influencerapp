"use client";

import type { Skin } from "@/lib/skins";
import type { WeekData } from "@/components/builder";

interface ProgramOverviewPreviewProps {
  program: {
    title: string;
    description: string | null;
    targetAudience: string | null;
    targetTransformation: string | null;
    weeks: WeekData[];
  };
  skin: Skin;
  onSelectSession: (sessionId: string) => void;
}

export function ProgramOverviewPreview({
  program,
  skin,
  onSelectSession,
}: ProgramOverviewPreviewProps) {
  const totalSessions = program.weeks.reduce((sum, w) => sum + w.sessions.length, 0);

  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: skin.colors.bg, color: skin.colors.text }}
    >
      {/* Hero section */}
      <div
        className="px-6 py-12 text-center"
        style={{ backgroundColor: skin.colors.bgSecondary }}
      >
        <h1 className="text-3xl font-bold mb-4">{program.title}</h1>
        {program.description && (
          <p
            className="text-lg max-w-2xl mx-auto mb-6"
            style={{ color: skin.colors.textMuted }}
          >
            {program.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mt-8">
          <div>
            <div className="text-2xl font-bold" style={{ color: skin.colors.accent }}>
              {program.weeks.length}
            </div>
            <div className="text-sm" style={{ color: skin.colors.textMuted }}>
              Weeks
            </div>
          </div>
          <div
            className="w-px h-10"
            style={{ backgroundColor: skin.colors.border }}
          />
          <div>
            <div className="text-2xl font-bold" style={{ color: skin.colors.accent }}>
              {totalSessions}
            </div>
            <div className="text-sm" style={{ color: skin.colors.textMuted }}>
              Sessions
            </div>
          </div>
        </div>

        {/* CTA button */}
        <button
          className={`mt-8 px-8 py-3 font-semibold transition ${
            skin.videoFrame === "rounded" ? "rounded-full" : "rounded"
          }`}
          style={{
            backgroundColor:
              skin.buttonStyle === "outline" ? "transparent" : skin.colors.accent,
            color:
              skin.buttonStyle === "outline" ? skin.colors.accent : skin.colors.bg,
            border:
              skin.buttonStyle === "outline"
                ? `2px solid ${skin.colors.accent}`
                : "none",
          }}
        >
          Start Learning
        </button>
      </div>

      {/* Transformation section */}
      {program.targetTransformation && (
        <div className="px-6 py-8 text-center">
          <h2 className="text-xl font-semibold mb-3">Your Transformation</h2>
          <p
            className="max-w-xl mx-auto"
            style={{ color: skin.colors.textMuted }}
          >
            {program.targetTransformation}
          </p>
        </div>
      )}

      {/* Week list */}
      <div className="px-6 py-8">
        <h2 className="text-xl font-semibold mb-6">Program Curriculum</h2>

        <div className="space-y-4">
          {program.weeks.map((week, weekIndex) => (
            <div
              key={week.id}
              className={`p-4 ${skin.cardStyle === "bordered" ? "border" : ""} ${
                skin.videoFrame === "rounded" ? "rounded-xl" : "rounded"
              }`}
              style={{
                backgroundColor:
                  skin.cardStyle === "flat" ? "transparent" : skin.colors.bgSecondary,
                borderColor: skin.colors.border,
                boxShadow:
                  skin.cardStyle === "elevated"
                    ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                    : "none",
              }}
            >
              {/* Week header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{week.title}</h3>
                <span
                  className="text-sm"
                  style={{ color: skin.colors.textMuted }}
                >
                  {week.sessions.length} session{week.sessions.length !== 1 ? "s" : ""}
                </span>
              </div>

              {week.summary && (
                <p
                  className="text-sm mb-4"
                  style={{ color: skin.colors.textMuted }}
                >
                  {week.summary}
                </p>
              )}

              {/* Sessions */}
              <div className="space-y-2">
                {week.sessions.map((session, sessionIndex) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left transition ${
                      skin.videoFrame === "rounded" ? "rounded-lg" : "rounded"
                    }`}
                    style={{
                      backgroundColor: skin.colors.bg,
                      border: `1px solid ${skin.colors.border}`,
                    }}
                  >
                    <div
                      className={`w-8 h-8 flex items-center justify-center text-sm font-medium ${
                        skin.videoFrame === "rounded" ? "rounded-full" : "rounded"
                      }`}
                      style={{
                        backgroundColor: skin.colors.accent + "20",
                        color: skin.colors.accent,
                      }}
                    >
                      {weekIndex + 1}.{sessionIndex + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.title}</p>
                      {session.summary && (
                        <p
                          className="text-sm truncate"
                          style={{ color: skin.colors.textMuted }}
                        >
                          {session.summary}
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: skin.colors.textMuted }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-6 py-8 text-center"
        style={{ borderTop: `1px solid ${skin.colors.border}` }}
      >
        <p className="text-sm" style={{ color: skin.colors.textMuted }}>
          Powered by Journeyline
        </p>
      </div>
    </div>
  );
}
