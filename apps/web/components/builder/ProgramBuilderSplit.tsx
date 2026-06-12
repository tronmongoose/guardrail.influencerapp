"use client";

import { useState, useMemo } from "react";
import { TreeNavigation } from "./TreeNavigation";
import { SessionDetailPanel } from "./SessionDetailPanel";
import type { WeekData, YouTubeVideoData, SessionData } from "./StructureBuilder";

interface ProgramBuilderSplitProps {
  programId: string;
  weeks: WeekData[];
  videos: YouTubeVideoData[];
  onUpdate: () => void;
  pacingMode: "DRIP_BY_WEEK" | "UNLOCK_ON_COMPLETE";
  programTransitionMode?: "NONE" | "SIMPLE" | "BRANDED";
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function ProgramBuilderSplit({
  programId,
  weeks,
  videos,
  onUpdate,
  pacingMode,
  programTransitionMode = "NONE",
  onRegenerate,
  regenerating = false,
}: ProgramBuilderSplitProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    // Auto-select first session if available
    if (weeks.length > 0 && weeks[0].sessions.length > 0) {
      return weeks[0].sessions[0].id;
    }
    return null;
  });

  // Find the selected session and its parent week
  const { selectedSession, selectedWeek, lessonNumber, sessionNumber, sessionCount } = useMemo(() => {
    for (let wi = 0; wi < weeks.length; wi++) {
      const week = weeks[wi];
      const si = week.sessions.findIndex((s) => s.id === selectedSessionId);
      if (si !== -1) {
        return {
          selectedSession: week.sessions[si] as SessionData & { keyTakeaways?: string[] },
          selectedWeek: week,
          lessonNumber: wi + 1,
          sessionNumber: si + 1,
          sessionCount: week.sessions.length,
        };
      }
    }
    return { selectedSession: null, selectedWeek: null, lessonNumber: 0, sessionNumber: 0, sessionCount: 0 };
  }, [weeks, selectedSessionId]);

  // If selected session was deleted, select next available
  const handleUpdate = () => {
    onUpdate();

    // Check if selected session still exists after update
    if (selectedSessionId) {
      const stillExists = weeks.some((w) =>
        w.sessions.some((s) => s.id === selectedSessionId)
      );
      if (!stillExists) {
        // Find next available session
        for (const week of weeks) {
          if (week.sessions.length > 0) {
            setSelectedSessionId(week.sessions[0].id);
            return;
          }
        }
        setSelectedSessionId(null);
      }
    }
  };

  const regenerateButton = onRegenerate ? (
    <div className="px-3 py-2 border-b border-gray-800 bg-gray-950">
      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg font-medium bg-pink-900/20 text-pink-400 border border-pink-800 hover:bg-pink-900/40 transition disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {regenerating ? "Regenerating…" : "Regenerate with AI"}
      </button>
    </div>
  ) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] rounded-xl overflow-hidden border border-gray-800">
      {/* Mobile: Program Structure breadcrumb bar */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label={
          selectedSession && selectedWeek
            ? `Open program structure, currently on Lesson ${lessonNumber} of ${weeks.length}, Session ${sessionNumber} of ${sessionCount}`
            : "Open program structure to pick a lesson"
        }
        className="md:hidden flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3.5 border-b border-teal-500/30 bg-teal-500/5 active:bg-teal-500/10 transition text-left w-full"
        style={{ background: "linear-gradient(to right, rgba(20, 184, 166, 0.08), rgba(20, 184, 166, 0.03))" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/30 flex-shrink-0">
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-teal-400 font-semibold">
              Program Structure
            </div>
            <div className="text-sm font-medium text-white truncate">
              {selectedSession && selectedWeek
                ? `LESSON ${lessonNumber} of ${weeks.length} · Session ${sessionNumber} of ${sessionCount}`
                : "Tap to pick a lesson"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-teal-400 flex-shrink-0">
          <span className="text-xs font-medium">Browse</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-80 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {regenerateButton}
            <div className="flex-1 min-h-0">
              <TreeNavigation
                programId={programId}
                weeks={weeks}
                videos={videos}
                selectedSessionId={selectedSessionId}
                onSelectSession={(id) => {
                  setSelectedSessionId(id);
                  setSidebarOpen(false);
                }}
                onUpdate={handleUpdate}
                pacingMode={pacingMode}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left panel - Tree Navigation (desktop only) */}
        <div className="hidden md:flex md:flex-col w-80 flex-shrink-0">
          {regenerateButton}
          <div className="flex-1 min-h-0">
            <TreeNavigation
              programId={programId}
              weeks={weeks}
              videos={videos}
              selectedSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
              onUpdate={handleUpdate}
              pacingMode={pacingMode}
            />
          </div>
        </div>

        {/* Right panel - Session Detail */}
        <div className="flex-1 min-w-0">
          {selectedSession && selectedWeek ? (
            <SessionDetailPanel
              key={selectedSession.id}
              session={selectedSession}
              week={selectedWeek}
              programId={programId}
              videos={videos}
              onUpdate={handleUpdate}
              programTransitionMode={programTransitionMode}
            />
          ) : (
            <div className="h-full flex items-center justify-center" style={{ background: "#111118" }}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm mb-1">No session selected</p>
                <p className="text-gray-600 text-xs">
                  {weeks.length === 0
                    ? "Add a lesson to get started"
                    : "Tap the bar above to pick a lesson"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
