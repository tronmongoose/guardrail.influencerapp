"use client";

import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Spinner } from "@/components/ui/spinner";
import { AiAssistButton } from "@/components/ui/AiAssistButton";
import type { ActionData, YouTubeVideoData } from "./StructureBuilder";

interface ActionItemProps {
  action: ActionData;
  programId: string;
  videos: YouTubeVideoData[];
  onUpdate: () => void;
}

const TYPE_PILL = {
  WATCH: "bg-blue-50 text-blue-700",
  READ: "bg-gray-100 text-gray-600",
  DO: "bg-amber-50 text-amber-700",
  REFLECT: "bg-purple-50 text-purple-700",
};

const TYPE_LABELS = {
  WATCH: "WATCH",
  READ: "READ",
  DO: "PRACTICE",
  REFLECT: "REFLECT",
};

export function ActionItem({ action, programId, videos, onUpdate }: ActionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(action.title);
  const [type, setType] = useState(action.type);
  const [instructions, setInstructions] = useState(action.instructions || "");
  const [reflectionPrompt, setReflectionPrompt] = useState(action.reflectionPrompt || "");
  const [selectedVideoId, setSelectedVideoId] = useState(action.youtubeVideoId || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showVideoSelector, setShowVideoSelector] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Debounced auto-save
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges =
      title !== action.title ||
      type !== action.type ||
      instructions !== (action.instructions || "") ||
      reflectionPrompt !== (action.reflectionPrompt || "") ||
      selectedVideoId !== (action.youtubeVideoId || "");

    if (hasChanges && expanded) {
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
  }, [title, type, instructions, reflectionPrompt, selectedVideoId]);

  async function handleSave() {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/programs/${programId}/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          instructions: instructions.trim() || null,
          reflectionPrompt: reflectionPrompt.trim() || null,
          youtubeVideoId: selectedVideoId || null,
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

  async function handleDelete() {
    if (!confirm("Delete this action?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/programs/${programId}/actions/${action.id}`, {
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

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-100 rounded-lg bg-white"
    >
      {/* Collapsed view */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-300 hover:text-gray-500 touch-none"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_PILL[action.type]}`}>
          {TYPE_LABELS[action.type]}
        </span>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-xs text-gray-700 hover:text-gray-900 transition truncate"
        >
          {action.title}
        </button>

        {saving && <Spinner size="sm" />}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-300 hover:text-red-400 transition disabled:opacity-50"
        >
          {deleting ? (
            <Spinner size="sm" />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Expanded edit view */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100">
          <div>
            <label className="text-[10px] text-gray-400 uppercase">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ActionData["type"])}
              className="w-full mt-0.5 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-900 focus:outline-none focus:border-teal-500"
            >
              <option value="WATCH">Watch</option>
              <option value="READ">Read</option>
              <option value="DO">Do</option>
              <option value="REFLECT">Reflect</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-gray-400 uppercase">Instructions</label>
              <AiAssistButton
                value={instructions}
                type="action_instructions"
                context={`${action.type} action: ${title}`}
                onEnhance={(enhanced) => setInstructions(enhanced)}
              />
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="What should the learner do?"
              className="w-full mt-0.5 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {type === "REFLECT" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-gray-400 uppercase">Reflection Prompt</label>
                <AiAssistButton
                  value={reflectionPrompt}
                  type="reflection_prompt"
                  context={`${title}`}
                  onEnhance={(enhanced) => setReflectionPrompt(enhanced)}
                />
              </div>
              <textarea
                value={reflectionPrompt}
                onChange={(e) => setReflectionPrompt(e.target.value)}
                rows={2}
                placeholder="What question should they answer?"
                className="w-full mt-0.5 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
          )}

          {type === "WATCH" && (
            <div>
              <label className="text-[10px] text-gray-400 uppercase">Video</label>
              {selectedVideo ? (
                <div className="flex items-center gap-2 mt-0.5 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {selectedVideo.thumbnailUrl && (
                    <img
                      src={selectedVideo.thumbnailUrl}
                      alt=""
                      className="w-12 h-8 rounded object-cover"
                    />
                  )}
                  <span className="flex-1 text-xs text-gray-700 truncate">
                    {selectedVideo.title || selectedVideo.videoId}
                  </span>
                  <button
                    onClick={() => setSelectedVideoId("")}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowVideoSelector(true)}
                  className="w-full mt-0.5 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-teal-400 hover:text-teal-600 transition"
                >
                  + Attach Video
                </button>
              )}

              {/* Video selector dropdown */}
              {showVideoSelector && (
                <div className="mt-1 bg-white border border-gray-200 rounded-lg max-h-40 overflow-y-auto shadow-sm">
                  {videos.length === 0 ? (
                    <p className="p-2 text-xs text-gray-400">No videos added to program</p>
                  ) : (
                    videos.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => {
                          setSelectedVideoId(video.id);
                          setShowVideoSelector(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 transition"
                      >
                        {video.thumbnailUrl && (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="w-10 h-6 rounded object-cover"
                          />
                        )}
                        <span className="flex-1 text-left text-xs text-gray-700 truncate">
                          {video.title || video.videoId}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
