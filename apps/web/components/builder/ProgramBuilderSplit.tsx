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
}

export function ProgramBuilderSplit({
  programId,
  weeks,
  videos,
  onUpdate,
  pacingMode,
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
  const { selectedSession, selectedWeek } = useMemo(() => {
    for (const week of weeks) {
      const session = week.sessions.find((s) => s.id === selectedSessionId);
      if (session) {
        return { selectedSession: session as SessionData & { keyTakeaways?: string[] }, selectedWeek: week };
      }
    }
    return { selectedSession: null, selectedWeek: null };
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] rounded-xl overflow-hidden border border-gray-800">
      {/* Mobile: Program Structure button bar */}
      <div className="md:hidden flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-800" style={{ background: "#111118" }}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-teal-400 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          Program Structure
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left panel - Tree Navigation (desktop only) */}
        <div className="hidden md:block w-80 flex-shrink-0">
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
                    ? "Add a week to get started"
                    : "Tap Program Structure to pick a session"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
