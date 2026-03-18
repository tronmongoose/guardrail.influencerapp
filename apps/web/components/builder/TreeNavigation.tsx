"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
}

interface TreeWeekItemProps {
  week: WeekData;
  programId: string;
  videos: YouTubeVideoData[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onUpdate: () => void;
}

interface TreeSessionItemProps {
  session: SessionData;
  programId: string;
  videos: YouTubeVideoData[];
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: () => void;
}

function TreeSessionItem({
  session,
  videos,
  isSelected,
  onSelect,
}: TreeSessionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Find the first WATCH action to get video thumbnail
  const watchAction = session.actions.find((a) => a.type === "WATCH" && a.youtubeVideoId);
  const video = watchAction ? videos.find((v) => v.id === watchAction.youtubeVideoId) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 pl-6 pr-2 py-1.5 cursor-pointer transition-all
        ${isSelected
          ? "bg-teal-50 border-l-2 border-teal-500"
          : "hover:bg-gray-50 border-l-2 border-transparent"
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
        <div className="w-8 h-5 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <span className={`text-xs truncate flex-1 ${isSelected ? "text-gray-900 font-medium" : "text-gray-600"}`}>
        {session.title}
      </span>

      <span className="text-xs text-gray-400">{session.actions.length}</span>
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
}: TreeWeekItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [addingSession, setAddingSession] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: week.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  async function handleReorderSessions(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = week.sessions.findIndex((s) => s.id === active.id);
    const newIndex = week.sessions.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...week.sessions];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    try {
      const res = await fetch(`/api/programs/${programId}/weeks/${week.id}/sessions/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: reordered.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error("Reorder failed");
      onUpdate();
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Week header */}
      <div className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 transition">
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
          className="text-gray-400 hover:text-gray-700"
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

        <span className="text-sm font-medium text-gray-900 flex-1 truncate">
          {week.title}
        </span>

        <span className="text-xs text-gray-400">{week.sessions.length}</span>
      </div>

      {/* Sessions */}
      {expanded && (
        <div className="pb-1">
          {week.sessions.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleReorderSessions}
            >
              <SortableContext
                items={week.sessions.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {week.sessions.map((session) => (
                  <TreeSessionItem
                    key={session.id}
                    session={session}
                    programId={programId}
                    videos={videos}
                    isSelected={selectedSessionId === session.id}
                    onSelect={() => onSelectSession(session.id)}
                    onUpdate={onUpdate}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="pl-8 pr-2 py-2 text-xs text-gray-400 italic">
              No sessions yet
            </div>
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
}: TreeNavigationProps) {
  const [addingWeek, setAddingWeek] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
          title: `Week ${nextWeekNumber}`,
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

  async function handleReorderWeeks(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = weeks.findIndex((w) => w.id === active.id);
    const newIndex = weeks.findIndex((w) => w.id === over.id);
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
      if (!res.ok) throw new Error("Reorder failed");
      onUpdate();
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-100">
      <div className="p-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Program Structure</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {weeks.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-400 mb-3">No weeks yet</p>
            <button
              onClick={handleAddWeek}
              disabled={addingWeek}
              className="text-sm text-teal-600 hover:text-teal-700 transition disabled:opacity-50"
            >
              {addingWeek ? "Adding..." : "+ Add first week"}
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleReorderWeeks}
          >
            <SortableContext
              items={weeks.map((w) => w.id)}
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
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {weeks.length > 0 && (
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleAddWeek}
            disabled={addingWeek}
            className="w-full py-2 text-xs text-gray-400 hover:text-teal-600 border border-dashed border-gray-200 hover:border-teal-400 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1"
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
                Add Week
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
