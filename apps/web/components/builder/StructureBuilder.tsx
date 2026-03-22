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
} from "@dnd-kit/sortable";
import { WeekCard } from "./WeekCard";
import { Spinner } from "@/components/ui/spinner";

export interface ActionData {
  id: string;
  title: string;
  type: "WATCH" | "READ" | "DO" | "REFLECT";
  instructions: string | null;
  reflectionPrompt: string | null;
  youtubeVideoId: string | null;
  orderIndex: number;
}

export interface ClipData {
  id: string;
  youtubeVideoId: string;
  youtubeVideo?: { id: string; title: string | null; thumbnailUrl: string | null };
  startSeconds: number | null;
  endSeconds: number | null;
  orderIndex: number;
  transitionType: string;
  chapterTitle: string | null;
  chapterDescription: string | null;
}

export interface OverlayData {
  id: string;
  type: string;
  orderIndex: number;
}

export interface CompositeSessionData {
  id: string;
  clips: ClipData[];
  overlays: OverlayData[];
}

export interface SessionData {
  id: string;
  title: string;
  summary: string | null;
  keyTakeaways?: string[];
  orderIndex: number;
  actions: ActionData[];
  compositeSession?: CompositeSessionData | null;
}

export interface WeekData {
  id: string;
  title: string;
  summary: string | null;
  weekNumber: number;
  sessions: SessionData[];
}

export interface YouTubeVideoData {
  id: string;
  videoId: string;
  title: string | null;
  thumbnailUrl: string | null;
}

interface StructureBuilderProps {
  programId: string;
  weeks: WeekData[];
  videos: YouTubeVideoData[];
  onUpdate: () => void;
}

export function StructureBuilder({
  programId,
  weeks,
  videos,
  onUpdate,
}: StructureBuilderProps) {
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
        ? Math.max(...weeks.map(w => w.weekNumber)) + 1
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

    // Reorder the weeks
    const reordered = [...weeks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    try {
      const res = await fetch(`/api/programs/${programId}/weeks/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekIds: reordered.map(w => w.id) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Reorder failed (${res.status}): ${body.error ?? "unknown"}`);
      }
      onUpdate();
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  }

  if (weeks.length === 0) {
    return (
      <div className="bg-surface-card border border-dashed border-surface-border rounded-xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 mb-4">Start building your program structure</p>
        <button
          onClick={handleAddWeek}
          disabled={addingWeek}
          className="btn-neon px-5 py-2.5 rounded-lg text-surface-dark text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {addingWeek ? (
            <>
              <Spinner size="sm" color="pink" />
              Adding...
            </>
          ) : (
            "+ Add First Week"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <WeekCard
              key={week.id}
              week={week}
              programId={programId}
              videos={videos}
              onUpdate={onUpdate}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={handleAddWeek}
        disabled={addingWeek}
        className="w-full py-3 border border-dashed border-surface-border rounded-xl text-sm text-gray-400 hover:border-neon-cyan hover:text-neon-cyan transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {addingWeek ? (
          <>
            <Spinner size="sm" />
            Adding...
          </>
        ) : (
          "+ Add Week"
        )}
      </button>
    </div>
  );
}
