"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Spinner } from "@/components/ui/spinner";
import type { WeekData, SessionData, YouTubeVideoData } from "./StructureBuilder";

interface TreeNavigationProps {
  programId: string;
  weeks: WeekData[];
  videos: YouTubeVideoData[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onUpdate: () => void;
  pacingMode: "DRIP_BY_WEEK" | "UNLOCK_ON_COMPLETE";
}

interface TreeWeekItemProps {
  week: WeekData;
  programId: string;
  videos: YouTubeVideoData[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onUpdate: () => void;
  groupLabel: string;
}

interface TreeSessionItemProps {
  session: SessionData;
  weekId: string;
  videos: YouTubeVideoData[];
  isSelected: boolean;
  onSelect: () => void;
}

function TreeSessionItem({ session, weekId, videos, isSelected, onSelect }: TreeSessionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id, data: { type: "session", weekId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const watchAction = session.actions.find((a) => a.type === "WATCH" && a.youtubeVideoId);
  const video = watchAction ? videos.find((v) => v.id === watchAction.youtubeVideoId) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 pl-6 pr-2 py-1.5 cursor-pointer transition-all
        ${isSelected
          ? "bg-teal-900/30 border-l-2 border-teal-500"
          : "hover:bg-gray-800/50 border-l-2 border-transparent"
        }
      `}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-300 hover:text-gray-500 touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {video?.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="w-8 h-5 object-cover rounded flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-5 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <span className={`text-xs truncate flex-1 ${isSelected ? "text-white font-medium" : "text-gray-400"}`}>
        {session.title}
      </span>

      <span className="text-xs text-gray-400">{session.actions.length}</span>
    </div>
  );
}

function WeekDropZone({ weekId }: { weekId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-${weekId}` });
  return (
    <div
      ref={setNodeRef}
      className={`pl-8 pr-2 py-2 text-xs italic transition-colors ${
        isOver ? "text-teal-400 bg-teal-900/10" : "text-gray-600"
      }`}
    >
      {isOver ? "Drop here" : "No sessions yet"}
    </div>
  );
}

function TreeWeekItem({
  week,
  programId,
  videos,
  selectedSessionId,
  onSelectSession,
  onUpdate,
  groupLabel,
}: TreeWeekItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [addingSession, setAddingSession] = useState(false);
  const [editing, setEditing] = useState(false);
  // Show the stored title but swap "Week" prefix to groupLabel for display
  const displayTitle = week.title.replace(/^Week\b/i, groupLabel);
  const [titleInput, setTitleInput] = useState(displayTitle);

  // Keep input in sync when external data refreshes
  useEffect(() => {
    if (!editing) setTitleInput(displayTitle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.title, groupLabel]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: week.id, data: { type: "week" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleSaveTitle() {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === displayTitle) {
      setTitleInput(displayTitle);
      setEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/programs/${programId}/weeks/${week.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdate();
    } catch (err) {
      console.error("Save failed:", err);
      setTitleInput(displayTitle);
    } finally {
      setEditing(false);
    }
  }

  async function handleAddSession() {
    setAddingSession(true);
    try {
      const nextOrderIndex = week.sessions.length > 0
        ? Math.max(...week.sessions.map((s) => s.orderIndex)) + 1
        : 0;

      const res = await fetch(`/api/programs/${programId}/weeks/${week.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Session ${week.sessions.length + 1}`,
          orderIndex: nextOrderIndex,
        }),
      });
      if (!res.ok) throw new Error("Failed to add session");
      onUpdate();
    } catch (err) {
      console.error("Failed to add session:", err);
    } finally {
      setAddingSession(false);
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Week header */}
      <div className="flex items-center gap-2 px-2 py-2 hover:bg-gray-800/50 transition">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-300 hover:text-gray-500 touch-none"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-300"
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {editing ? (
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") { setTitleInput(displayTitle); setEditing(false); }
            }}
            autoFocus
            className="flex-1 bg-transparent border-b border-teal-500 text-white text-sm focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={() => { setTitleInput(displayTitle); setEditing(true); }}
            className="flex-1 text-left text-sm font-medium text-white hover:text-teal-400 transition truncate"
            title="Click to rename"
          >
            {displayTitle}
          </button>
        )}

        <span className="text-xs text-gray-400">{week.sessions.length}</span>
      </div>

      {/* Sessions */}
      {expanded && (
        <div className="pb-1">
          {week.sessions.length > 0 ? (
            <SortableContext
              items={week.sessions.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {week.sessions.map((session) => (
                <TreeSessionItem
                  key={session.id}
                  session={session}
                  weekId={week.id}
                  videos={videos}
                  isSelected={selectedSessionId === session.id}
                  onSelect={() => onSelectSession(session.id)}
                />
              ))}
            </SortableContext>
          ) : (
            <WeekDropZone weekId={week.id} />
          )}

          <button
            onClick={handleAddSession}
            disabled={addingSession}
            className="w-full pl-8 pr-2 py-1.5 text-left text-xs text-gray-400 hover:text-teal-600 transition disabled:opacity-50 flex items-center gap-1"
          >
            {addingSession ? (
              <>
                <Spinner size="sm" />
                Adding...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add session
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function TreeNavigation({
  programId,
  weeks,
  videos,
  selectedSessionId,
  onSelectSession,
  onUpdate,
  pacingMode,
}: TreeNavigationProps) {
  const [addingWeek, setAddingWeek] = useState(false);

  const groupLabel = pacingMode === "UNLOCK_ON_COMPLETE" ? "Lesson" : "Week";
  const weekIds = weeks.map((w) => w.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function findWeekForSession(sessionId: string): WeekData | undefined {
    return weeks.find((w) => w.sessions.some((s) => s.id === sessionId));
  }

  async function handleAddWeek() {
    setAddingWeek(true);
    try {
      const nextWeekNumber = weeks.length > 0
        ? Math.max(...weeks.map((w) => w.weekNumber)) + 1
        : 1;

      const res = await fetch(`/api/programs/${programId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${groupLabel} ${nextWeekNumber}`,
          weekNumber: nextWeekNumber,
        }),
      });
      if (!res.ok) throw new Error("Failed to add week");
      onUpdate();
    } catch (err) {
      console.error("Failed to add week:", err);
    } finally {
      setAddingWeek(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeType = active.data.current?.type;

    if (activeType === "week") {
      // Only reorder if over another week
      if (!weekIds.includes(overId)) return;

      const oldIndex = weeks.findIndex((w) => w.id === activeId);
      const newIndex = weeks.findIndex((w) => w.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...weeks];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      try {
        const res = await fetch(`/api/programs/${programId}/weeks/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekIds: reordered.map((w) => w.id) }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(`Reorder failed (${res.status}): ${body.error ?? "unknown"}`);
        }
        onUpdate();
      } catch (err) {
        console.error("Reorder failed:", err);
      }
    } else if (activeType === "session") {
      const sourceWeek = findWeekForSession(activeId);
      if (!sourceWeek) return;

      // Determine target week
      let targetWeek: WeekData | undefined;
      let targetSessionId: string | undefined;

      if (overId.startsWith("drop-")) {
        // Dropped onto empty week drop zone
        targetWeek = weeks.find((w) => w.id === overId.slice(5));
      } else if (weekIds.includes(overId)) {
        // Dropped near a week header — move to end of that week
        targetWeek = weeks.find((w) => w.id === overId);
      } else {
        // Dropped onto another session
        targetWeek = findWeekForSession(overId);
        if (targetWeek) targetSessionId = overId;
      }

      if (!targetWeek) return;

      if (sourceWeek.id === targetWeek.id) {
        // Same week — reorder (only if landed on a specific session, not the week header)
        if (!targetSessionId) return;

        const oldIndex = sourceWeek.sessions.findIndex((s) => s.id === activeId);
        const newIndex = sourceWeek.sessions.findIndex((s) => s.id === targetSessionId);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = [...sourceWeek.sessions];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        try {
          const res = await fetch(
            `/api/programs/${programId}/weeks/${sourceWeek.id}/sessions/reorder`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionIds: reordered.map((s) => s.id) }),
            }
          );
          if (!res.ok) throw new Error("Reorder failed");
          onUpdate();
        } catch (err) {
          console.error("Reorder failed:", err);
        }
      } else {
        // Different week — move session
        try {
          const res = await fetch(`/api/programs/${programId}/sessions/${activeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekId: targetWeek.id }),
          });
          if (!res.ok) throw new Error("Move failed");
          onUpdate();
        } catch (err) {
          console.error("Move failed:", err);
        }
      }
    }
  }

  return (
    <div className="h-full flex flex-col border-r border-gray-800" style={{ background: "#111118" }}>
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Program Structure</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {weeks.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-400 mb-3">No {groupLabel.toLowerCase()}s yet</p>
            <button
              onClick={handleAddWeek}
              disabled={addingWeek}
              className="text-sm text-teal-600 hover:text-teal-700 transition disabled:opacity-50"
            >
              {addingWeek ? "Adding..." : `+ Add first ${groupLabel.toLowerCase()}`}
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={weekIds}
              strategy={verticalListSortingStrategy}
            >
              {weeks.map((week) => (
                <TreeWeekItem
                  key={week.id}
                  week={week}
                  programId={programId}
                  videos={videos}
                  selectedSessionId={selectedSessionId}
                  onSelectSession={onSelectSession}
                  onUpdate={onUpdate}
                  groupLabel={groupLabel}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {weeks.length > 0 && (
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={handleAddWeek}
            disabled={addingWeek}
            className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-xs text-gray-400 hover:border-teal-600 hover:text-teal-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {addingWeek ? (
              <>
                <Spinner size="sm" />
                Adding...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add {groupLabel}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
