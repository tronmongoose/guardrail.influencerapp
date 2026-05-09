"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { VideoThumbnail } from "@/components/VideoThumbnail";

function isUploadedVideo(video: YouTubeVideoData): boolean {
  return (
    video.url.includes("blob.vercel-storage.com") ||
    video.url.startsWith("mux-upload://") ||
    !!video.muxUploadId
  );
}

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
  programTransitionMode?: "NONE" | "SIMPLE" | "BRANDED";
}

export function SessionDetailPanel({
  session,
  week,
  programId,
  videos,
  onUpdate,
  programTransitionMode = "NONE",
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [hideTransition, setHideTransition] = useState(session.hideTransition ?? false);

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

  async function handleToggleHideTransition(val: boolean) {
    setHideTransition(val);
    try {
      await fetch(`/api/programs/${programId}/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideTransition: val }),
      });
      onUpdate();
    } catch (err) {
      console.error("Save hideTransition failed:", err);
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

  function getVideoMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return "video/mp4";
  }

  async function handleVideoUpload(file: File) {
    setUploadError(null);
    setUploadProgress(0);

    let highWater = 0;
    const simId = setInterval(() => {
      const next = Math.min(85, highWater + (85 - highWater) * 0.015);
      if (next > highWater) {
        highWater = next;
        setUploadProgress(Math.round(highWater));
      }
    }, 250);

    try {
      // Step 1: Get a Mux direct upload URL
      const tokenRes = await fetch("/api/mux/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to get upload URL");
      }

      const { uploadId, uploadUrl } = (await tokenRes.json()) as {
        uploadId: string;
        uploadUrl: string;
      };

      // Step 2: PUT file directly to Mux — never touches the Next.js server.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const next = Math.min(89, Math.round((event.loaded / event.total) * 89));
            if (next > highWater) {
              highWater = next;
              setUploadProgress(highWater);
            }
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed with status ${xhr.status}`));
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", getVideoMimeType(file.name));
        xhr.send(file);
      });

      clearInterval(simId);
      setUploadProgress(92);

      const res = await fetch(`/api/programs/${programId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "mux-upload", muxUploadId: uploadId, title: file.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save video");
      }
      const newVideo = await res.json();

      setUploadProgress(97);

      // Create a WATCH action linking to the new video
      const nextOrderIndex = session.actions.length > 0
        ? Math.max(...session.actions.map((a) => a.orderIndex)) + 1
        : 0;
      const actionRes = await fetch(`/api/programs/${programId}/sessions/${session.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Watch: ${newVideo.title || file.name.replace(/\.[^/.]+$/, "")}`,
          type: "WATCH",
          orderIndex: nextOrderIndex,
          youtubeVideoId: newVideo.id,
        }),
      });
      if (!actionRes.ok) throw new Error("Video uploaded but failed to create Watch action");

      setUploadProgress(null);
      onUpdate();
    } catch (err) {
      clearInterval(simId);
      setUploadProgress(null);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
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

  // Hide zero-duration "marker" clips (e.g. 2:10–2:10) from the curriculum
  // editor. These came from older generations where the distributor split a
  // source video into a real clip plus a collapsed second range; the row is
  // unplayable and shows up as a duplicate pointing at the same video.
  // Fixed upstream for new generations — this filter keeps existing programs
  // looking clean without needing a backfill.
  const rawClips = session.compositeSession?.clips ?? [];
  const clips = rawClips.filter((c) => {
    if (c.startSeconds == null || c.endSeconds == null) return true;
    return c.endSeconds > c.startSeconds;
  });
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
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#111118" }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
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
                    className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <VideoThumbnail
                      video={clipVideo}
                      className="w-10 h-6 rounded flex-shrink-0"
                      iconSize="w-3 h-3"
                    />
                    {clip.transitionType && clip.transitionType !== "NONE" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-200 flex-shrink-0">
                        {clip.transitionType}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
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
          <div className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-700 rounded-xl">
            <VideoThumbnail
              video={video}
              className="w-28 h-16 rounded-lg flex-shrink-0"
              iconSize="w-6 h-6"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {video.title || "Untitled Video"}
              </p>
              <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isUploadedVideo(video)
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-blue-50 text-blue-600"
              }`}>
                {isUploadedVideo(video) ? "Uploaded Video" : "YouTube Video"}
              </span>
            </div>
          </div>
        ) : (
          /* No video — upload prompt */
          <div>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".mp4,.webm,.mov"
              multiple={false}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVideoUpload(file);
                e.target.value = "";
              }}
            />
            {uploadProgress !== null ? (
              <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Uploading video…</span>
                  <span className="text-xs text-gray-400">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 p-5 bg-gray-900 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:border-orange-500 hover:text-orange-400 transition"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs font-medium">Upload video</span>
                <span className="text-[10px] text-gray-600">MP4, WebM, MOV</span>
              </button>
            )}
            {uploadError && (
              <p className="mt-2 text-xs text-red-500">{uploadError}</p>
            )}
          </div>
        )}


        {/* Summary */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
            <label className="text-sm font-medium text-white">
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
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none"
          />
        </div>

        {/* Key Takeaways */}
        <KeyTakeawaysEditor
          takeaways={session.keyTakeaways || []}
          onChange={handleSaveTakeaways}
        />

        {/* Lesson Transitions — only shown when program has transitions enabled */}
        {programTransitionMode !== "NONE" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div>
                <label className="text-sm font-medium text-white">Lesson Transitions</label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {programTransitionMode === "BRANDED" ? "Branded title card + outro" : "Play / next-lesson buttons"} shown to learners
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleHideTransition(!hideTransition)}
                className={`
                  relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                  transition-colors duration-200 focus:outline-none
                  ${hideTransition ? "bg-gray-700" : "bg-teal-500"}
                `}
                aria-pressed={!hideTransition}
                aria-label="Toggle transition for this lesson"
              >
                <span
                  className={`
                    pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0
                    transition duration-200
                    ${hideTransition ? "translate-x-0" : "translate-x-4"}
                  `}
                />
              </button>
            </div>

            {!hideTransition && (
              <div className="space-y-2">
                {/* Opening preview */}
                <div className="rounded-lg border border-gray-700 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border-b border-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400 font-medium">Opening</span>
                  </div>
                  <div className="px-4 py-3 bg-gray-900/60 space-y-1">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-teal-400">Now Playing</p>
                    <p className="text-sm font-semibold text-white leading-snug">{session.title}</p>
                    {(session.keyTakeaways ?? [])[0] && (
                      <p className="text-xs text-gray-400">{(session.keyTakeaways ?? [])[0]}</p>
                    )}
                  </div>
                </div>

                {/* Closing preview */}
                <div className="rounded-lg border border-gray-700 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border-b border-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400 font-medium">Closing</span>
                  </div>
                  <div className="px-4 py-3 bg-gray-900/60 space-y-1.5">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-teal-400">Lesson Complete</p>
                    <p className="text-sm font-semibold text-white leading-snug">{session.title}</p>
                    {(session.keyTakeaways ?? []).length > 0 && (
                      <ul className="space-y-0.5">
                        {(session.keyTakeaways ?? []).map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                            <span className="mt-1 h-1 w-1 rounded-full bg-teal-400 flex-shrink-0" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-gray-600 text-center">
                  Preview uses your selected skin colors in the learner view
                </p>
              </div>
            )}

            {hideTransition && (
              <p className="text-xs text-gray-500 py-1">
                Transitions are hidden for this lesson. Learners will go straight to the video.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
            <label className="text-sm font-medium text-white">Actions</label>
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
                className={`py-2 text-xs rounded-lg border bg-gray-900 transition disabled:opacity-50 ${
                  type === "WATCH"
                    ? "border-blue-800 text-blue-400 hover:bg-blue-900/30 hover:border-blue-600"
                    : type === "REFLECT"
                    ? "border-purple-800 text-purple-400 hover:bg-purple-900/30 hover:border-purple-600"
                    : type === "DO"
                    ? "border-amber-800 text-amber-400 hover:bg-amber-900/30 hover:border-amber-600"
                    : "border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-500"
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
