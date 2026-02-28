"use client";

import { useState, useEffect, useRef } from "react";
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
import { ActionItem } from "./ActionItem";
import { KeyTakeawaysEditor } from "./KeyTakeawaysEditor";
import { Spinner } from "@/components/ui/spinner";
import { AiAssistButton } from "@/components/ui/AiAssistButton";
import type { SessionData, YouTubeVideoData, WeekData } from "./StructureBuilder";

interface SessionDetailPanelProps {
  session: SessionData & { keyTakeaways?: string[] };
  week: WeekData;
  programId: string;
  videos: YouTubeVideoData[];
  onUpdate: () => void;
}

export function SessionDetailPanel({
  session,
  week,
  programId,
  videos,
  onUpdate,
}: SessionDetailPanelProps) {
  const [title, setTitle] = useState(session.title);
  const [summary, setSummary] = useState(session.summary || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingAction, setAddingAction] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync with external changes
  useEffect(() => {
    setTitle(session.title);
    setSummary(session.summary || "");
  }, [session.id, session.title, session.summary]);

  // Debounced auto-save for title/summary
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges =
      title !== session.title || summary !== (session.summary || "");

    if (hasChanges) {
      saveTimeoutRef.current = setTimeout(() => {
        handleSave();
      }, 800);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, summary]);

  async function handleSave() {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/programs/${programId}/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdate();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTakeaways(takeaways: string[]) {
    try {
      const res = await fetch(`/api/programs/${programId}/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyTakeaways: takeaways }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdate();
    } catch (err) {
      console.error("Save takeaways failed:", err);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${session.title}"? This will delete all actions in this session.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/programs/${programId}/sessions/${session.id}`, {
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

  async function handleAddAction(type: "WATCH" | "READ" | "DO" | "REFLECT") {
    setAddingAction(true);
    try {
      const nextOrderIndex = session.actions.length > 0
        ? Math.max(...session.actions.map((a) => a.orderIndex)) + 1
        : 0;

      const typeLabels = {
        WATCH: "Watch",
        READ: "Read",
        DO: "Practice",
        REFLECT: "Reflect",
      };

      const res = await fetch(`/api/programs/${programId}/sessions/${session.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${typeLabels[type]}: New ${type.toLowerCase()} action`,
          type,
          orderIndex: nextOrderIndex,
        }),
      });
      if (!res.ok) throw new Error("Failed to add action");
      onUpdate();
    } catch (err) {
      console.error("Failed to add action:", err);
    } finally {
      setAddingAction(false);
    }
  }

  async function handleReorderActions(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = session.actions.findIndex((a) => a.id === active.id);
    const newIndex = session.actions.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...session.actions];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const items = reordered.map((a, idx) => ({
      id: a.id,
      orderIndex: idx,
    }));

    try {
      const res = await fetch(`/api/programs/${programId}/sessions/${session.id}/actions/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Reorder failed");
      onUpdate();
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  }

  // Find the first WATCH action to display video info
  const watchAction = session.actions.find((a) => a.type === "WATCH" && a.youtubeVideoId);
  const video = watchAction ? videos.find((v) => v.id === watchAction.youtubeVideoId) : null;

  const clips = session.compositeSession?.clips ?? [];
  const overlays = session.compositeSession?.overlays ?? [];
  const hasClips = clips.length > 0;

  const totalClipSeconds = clips.reduce((sum, c) => {
    const start = c.startSeconds ?? 0;
    const end = c.endSeconds ?? 0;
    return sum + Math.max(0, end - start);
  }, 0);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="h-full flex flex-col bg-surface-dark overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{week.title}</span>
          <div className="flex items-center gap-2">
            {saving && <Spinner size="sm" />}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-gray-500 hover:text-neon-pink transition disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Session"}
            </button>
          </div>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-xl font-semibold bg-transparent text-white focus:outline-none placeholder:text-gray-600"
          placeholder="Session title"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Scene-based clip summary */}
        {hasClips ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neon-cyan">Scene-Based Lesson</span>
                <span className="text-xs text-gray-500">
                  {clips.length} clip{clips.length !== 1 ? "s" : ""} &middot; {formatTime(totalClipSeconds)}
                </span>
              </div>
              {overlays.length > 0 && (
                <span className="text-xs text-gray-500">
                  {overlays.length} overlay{overlays.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {clips.map((clip, i) => {
                const clipVideo = clip.youtubeVideo ?? videos.find((v) => v.id === clip.youtubeVideoId);
                return (
                  <div
                    key={clip.id}
                    className="flex items-center gap-3 px-3 py-2 bg-surface-card rounded-lg border border-surface-border"
                  >
                    <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{i + 1}</span>
                    {clip.transitionType && clip.transitionType !== "NONE" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 flex-shrink-0">
                        {clip.transitionType}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {clip.chapterTitle || clipVideo?.title || "Untitled clip"}
                      </p>
                      {clipVideo?.title && clip.chapterTitle && (
                        <p className="text-xs text-gray-500 truncate">{clipVideo.title}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatTime(clip.startSeconds ?? 0)} – {formatTime(clip.endSeconds ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : video ? (
          /* Video thumbnail (if available, non-scene session) */
          <div className="flex items-start gap-4 p-4 bg-surface-card rounded-lg border border-surface-border">
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="w-32 h-20 rounded object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {video.title || "Untitled Video"}
              </p>
              <p className="text-xs text-gray-500 mt-1">YouTube Video</p>
            </div>
          </div>
        ) : null}

        {/* Summary */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Description
            </label>
            <AiAssistButton
              value={summary}
              type="session_summary"
              context={`${week.title} — ${session.title}`}
              onEnhance={(enhanced) => setSummary(enhanced)}
            />
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="What will learners accomplish in this session?"
            className="w-full px-4 py-3 bg-surface-card border border-surface-border rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none"
          />
        </div>

        {/* Key Takeaways */}
        <KeyTakeawaysEditor
          takeaways={session.keyTakeaways || []}
          onChange={handleSaveTakeaways}
        />

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-300">Actions</label>
            <span className="text-xs text-gray-500">{session.actions.length} items</span>
          </div>

          {session.actions.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleReorderActions}
            >
              <SortableContext
                items={session.actions.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mb-3">
                  {session.actions.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      programId={programId}
                      videos={videos}
                      onUpdate={onUpdate}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add action buttons */}
          <div className="grid grid-cols-4 gap-2">
            {(["WATCH", "READ", "DO", "REFLECT"] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleAddAction(type)}
                disabled={addingAction}
                className={`py-2 text-xs rounded-lg border transition disabled:opacity-50 ${
                  type === "WATCH"
                    ? "border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan"
                    : type === "REFLECT"
                    ? "border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10 hover:border-neon-pink"
                    : type === "DO"
                    ? "border-neon-yellow/30 text-neon-yellow hover:bg-neon-yellow/10 hover:border-neon-yellow"
                    : "border-gray-600 text-gray-400 hover:bg-gray-600/10 hover:border-gray-500"
                }`}
              >
                + {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
