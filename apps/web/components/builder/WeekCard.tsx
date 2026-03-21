"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
} from "@dnd-kit/sortable";
import { SessionCard } from "./SessionCard";
import { Spinner } from "@/components/ui/spinner";
import type { WeekData, YouTubeVideoData } from "./StructureBuilder";

interface WeekCardProps {
  week: WeekData;
  programId: string;
  videos: YouTubeVideoData[];
  onUpdate: () => void;
}

export function WeekCard({ week, programId, videos, onUpdate }: WeekCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(week.title);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function handleSaveTitle() {
    if (!title.trim() || title === week.title) {
      setTitle(week.title);
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/programs/${programId}/weeks/${week.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdate();
    } catch (err) {
      console.error("Save failed:", err);
      setTitle(week.title);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${week.title}"? This will delete all sessions and actions in this week.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/programs/${programId}/weeks/${week.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      onUpdate();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddSession() {
    setAddingSession(true);
    try {
      const nextOrderIndex = week.sessions.length > 0
        ? Math.max(...week.sessions.map(s => s.orderIndex)) + 1
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
    <div
      ref={setNodeRef}
      style={style}
      className="bg-surface-card border border-surface-border rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-dark border-b border-surface-border">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-500 hover:text-gray-300 touch-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <span className="text-xs text-neon-cyan font-medium">Week {week.weekNumber}</span>

        {editing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
            autoFocus
            className="flex-1 bg-transparent border-b border-neon-cyan text-white text-sm focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-white text-sm font-medium hover:text-neon-cyan transition"
          >
            {week.title}
          </button>
        )}

        {saving && <Spinner size="sm" />}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-500 hover:text-red-400 transition disabled:opacity-50"
        >
          {deleting ? (
            <Spinner size="sm" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-3">
          {week.sessions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500 mb-2">No sessions yet</p>
              <button
                onClick={handleAddSession}
                disabled={addingSession}
                className="text-xs text-neon-cyan hover:underline disabled:opacity-50"
              >
                {addingSession ? "Adding..." : "+ Add session"}
              </button>
            </div>
          ) : (
            <>
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
                    <SessionCard
                      key={session.id}
                      session={session}
                      programId={programId}
                      videos={videos}
                      onUpdate={onUpdate}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <button
                onClick={handleAddSession}
                disabled={addingSession}
                className="w-full py-2 border border-dashed border-surface-border rounded-lg text-xs text-gray-400 hover:border-neon-cyan hover:text-neon-cyan transition disabled:opacity-50"
              >
                {addingSession ? "Adding..." : "+ Add session"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
