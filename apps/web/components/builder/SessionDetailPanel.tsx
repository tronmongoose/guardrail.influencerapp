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

interface VideoSuggestions {
  description: string;
  keyTakeaways: string[];
  actions: Array<{ type: "DO" | "REFLECT"; title: string }>;
}

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
  const [suggestions, setSuggestions] = useState<VideoSuggestions | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);

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

  async function fetchSuggestions() {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await fetch(
        `/api/programs/${programId}/sessions/${session.id}/ai-suggest`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSuggestions(data.suggestions as VideoSuggestions);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function analyzeVideo() {
    if (!video) return;
    setAnalyzingVideo(true);
    setSuggestError(null);
    try {
      const res = await fetch(
        `/api/programs/${programId}/videos/${video.id}/analyze`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      // Analysis complete — automatically fetch suggestions
      await fetchSuggestions();
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzingVideo(false);
    }
  }

  async function acceptSuggestedDescription() {
    if (!suggestions) return;
    setSummary(suggestions.description);
  }

  async function acceptSuggestedTakeaways() {
    if (!suggestions) return;
    await handleSaveTakeaways(suggestions.keyTakeaways);
    onUpdate();
  }

  async function acceptSuggestedAction(action: { type: "DO" | "REFLECT"; title: string }) {
    setAddingAction(true);
    try {
      const nextOrderIndex =
        session.actions.length > 0
          ? Math.max(...session.actions.map((a) => a.orderIndex)) + 1
          : 0;
      const res = await fetch(
        `/api/programs/${programId}/sessions/${session.id}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: action.title, type: action.type, orderIndex: nextOrderIndex }),
        }
      );
      if (!res.ok) throw new Error("Failed to add action");
      onUpdate();
    } catch (err) {
      console.error("Failed to add suggested action:", err);
    } finally {
      setAddingAction(false);
    }
  }

  async function acceptAllSuggestions() {
    if (!suggestions) return;
    setSummary(suggestions.description);
    await handleSaveTakeaways(suggestions.keyTakeaways);
    for (const action of suggestions.actions) {
      await acceptSuggestedAction(action);
    }
    setSuggestions(null);
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
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">{week.title}</span>
          <div className="flex items-center gap-2">
            {saving && <Spinner size="sm" />}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-gray-400 hover:text-red-500 transition disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Session"}
            </button>
          </div>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-xl font-semibold bg-transparent text-gray-900 focus:outline-none placeholder:text-gray-300"
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
                <span className="text-xs font-medium text-teal-600">Scene-Based Lesson</span>
                <span className="text-xs text-gray-400">
                  {clips.length} clip{clips.length !== 1 ? "s" : ""} &middot; {formatTime(totalClipSeconds)}
                </span>
              </div>
              {overlays.length > 0 && (
                <span className="text-xs text-gray-400">
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
                    className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    {clip.transitionType && clip.transitionType !== "NONE" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-200 flex-shrink-0">
                        {clip.transitionType}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {clip.chapterTitle || clipVideo?.title || "Untitled clip"}
                      </p>
                      {clipVideo?.title && clip.chapterTitle && (
                        <p className="text-xs text-gray-400 truncate">{clipVideo.title}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTime(clip.startSeconds ?? 0)} – {formatTime(clip.endSeconds ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : video ? (
          /* Video card */
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="w-28 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-28 h-16 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {video.title || "Untitled Video"}
              </p>
              <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                YouTube Video
              </span>
            </div>
          </div>
        ) : null}

        {/* AI suggestions panel */}
        {(video || hasClips) && (
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-teal-100">
              <span className="text-xs font-medium text-teal-700">✨ Suggest from video</span>
              <div className="flex items-center gap-2">
                {suggestions && (
                  <button
                    onClick={() => setSuggestions(null)}
                    className="text-xs text-teal-500 hover:text-teal-700 transition"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  onClick={suggestions ? acceptAllSuggestions : fetchSuggestions}
                  disabled={suggestLoading || analyzingVideo}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-50"
                >
                  {suggestLoading ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating…
                    </>
                  ) : suggestions ? (
                    "Accept all"
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
            </div>

            {(suggestError || analyzingVideo) && (
              <div className="px-4 py-3 space-y-2">
                {analyzingVideo ? (
                  <div className="flex items-center gap-2 text-xs text-teal-700">
                    <svg className="w-3 h-3 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing video with Gemini… this may take up to a minute
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-red-500">{suggestError}</p>
                    {suggestError?.includes("No video analysis available") && video && (
                      <button
                        onClick={analyzeVideo}
                        className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 transition"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Analyze video now
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {suggestions && (
              <div className="divide-y divide-teal-100">
                {/* Suggested description */}
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Description</span>
                    <button
                      onClick={acceptSuggestedDescription}
                      className="text-[10px] font-medium text-teal-600 hover:text-teal-800 underline transition"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{suggestions.description}</p>
                </div>

                {/* Suggested takeaways */}
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Key Takeaways</span>
                    <button
                      onClick={acceptSuggestedTakeaways}
                      className="text-[10px] font-medium text-teal-600 hover:text-teal-800 underline transition"
                    >
                      Apply
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {suggestions.keyTakeaways.map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <span className="text-teal-400 mt-0.5 flex-shrink-0">•</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested actions */}
                <div className="px-4 py-3 space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Actions</span>
                  {suggestions.actions.map((action, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold uppercase flex-shrink-0 ${action.type === "DO" ? "text-amber-600" : "text-purple-600"}`}>
                          {action.type === "DO" ? "Practice" : "Reflect"}
                        </span>
                        <span className="text-xs text-gray-700 truncate">{action.title}</span>
                      </div>
                      <button
                        onClick={() => acceptSuggestedAction(action)}
                        disabled={addingAction}
                        className="text-[10px] font-medium text-teal-600 hover:text-teal-800 underline transition flex-shrink-0 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
            <label className="text-sm font-medium text-gray-900">
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
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none"
          />
        </div>

        {/* Key Takeaways */}
        <KeyTakeawaysEditor
          takeaways={session.keyTakeaways || []}
          onChange={handleSaveTakeaways}
        />

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
            <label className="text-sm font-medium text-gray-900">Actions</label>
            <span className="text-xs text-gray-400">{session.actions.length} items</span>
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
                    ? "border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                    : type === "REFLECT"
                    ? "border-purple-100 text-purple-600 hover:bg-purple-50 hover:border-purple-300"
                    : type === "DO"
                    ? "border-amber-100 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                + {type === "DO" ? "Practice" : type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
