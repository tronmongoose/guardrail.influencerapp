"use client";

import { useState, useCallback } from "react";
import { MuxVideoPlayer } from "./MuxVideoPlayer";

export interface InlineChainedClip {
  id: string;
  chapterTitle: string;
  startSeconds: number | null;
  endSeconds: number | null;
  youtubeVideo: {
    muxPlaybackId: string | null;
    videoId: string;
    url: string;
    title: string | null;
  };
}

export interface InlineChainedPlayerProps {
  clips: InlineChainedClip[];
  sessionTitle: string;
  onAllComplete: () => void;
}

export function InlineChainedPlayer({
  clips,
  sessionTitle,
  onAllComplete,
}: InlineChainedPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = clips.length;
  const clip = clips[currentIndex];
  const v = clip.youtubeVideo;
  const isLast = currentIndex >= total - 1;

  const handleClipEnd = useCallback(() => {
    if (isLast) {
      onAllComplete();
      return;
    }
    setCurrentIndex((i) => Math.min(i + 1, total - 1));
  }, [isLast, onAllComplete, total]);

  const goToIndex = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      setCurrentIndex(i);
    },
    [total],
  );

  const title = clip.chapterTitle?.trim() || v.title || sessionTitle;
  const blobSrc =
    !v.muxPlaybackId && v.url.includes("blob.vercel-storage.com")
      ? clip.startSeconds != null && clip.endSeconds != null
        ? `${v.url}#t=${Math.floor(clip.startSeconds)},${Math.ceil(clip.endSeconds)}`
        : v.url
      : null;
  const ytStart = clip.startSeconds != null ? `&start=${Math.floor(clip.startSeconds)}` : "";
  const ytEnd = clip.endSeconds != null ? `&end=${Math.ceil(clip.endSeconds)}` : "";

  return (
    <div className="space-y-2">
      {v.muxPlaybackId ? (
        <MuxVideoPlayer
          key={clip.id}
          playbackId={v.muxPlaybackId}
          title={title}
          startSeconds={clip.startSeconds ?? undefined}
          endSeconds={clip.endSeconds ?? undefined}
          autoPlay={currentIndex > 0}
          onClipEnd={handleClipEnd}
        />
      ) : blobSrc ? (
        <div
          className="aspect-video overflow-hidden"
          style={{
            borderRadius: "var(--token-comp-video-radius)",
            border: "var(--token-comp-video-border)",
          }}
        >
          <video
            key={clip.id}
            src={blobSrc}
            title={title}
            className="w-full h-full"
            controls
            playsInline
            autoPlay={currentIndex > 0}
            onTimeUpdate={(e) => {
              if (clip.endSeconds == null) return;
              const el = e.currentTarget;
              if (el.currentTime >= clip.endSeconds) {
                el.pause();
                handleClipEnd();
              }
            }}
            onEnded={handleClipEnd}
          />
        </div>
      ) : (
        <div
          className="aspect-video overflow-hidden"
          style={{
            borderRadius: "var(--token-comp-video-radius)",
            border: "var(--token-comp-video-border)",
          }}
        >
          <iframe
            key={clip.id}
            src={`https://www.youtube.com/embed/${v.videoId}?rel=0&modestbranding=1&iv_load_policy=3${currentIndex > 0 ? "&autoplay=1" : ""}${ytStart}${ytEnd}`}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {total > 1 && (
        <div
          className="flex items-center justify-between gap-3 px-1 text-xs"
          style={{ color: "var(--token-color-text-secondary)" }}
        >
          <button
            type="button"
            onClick={() => goToIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-2 py-1 rounded transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ color: "var(--token-color-text-primary)" }}
            aria-label="Previous part"
          >
            ←
          </button>
          <div className="flex-1 min-w-0 text-center">
            <span className="truncate">{title}</span>
          </div>
          <button
            type="button"
            onClick={() => goToIndex(currentIndex + 1)}
            disabled={isLast}
            className="px-2 py-1 rounded transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ color: "var(--token-color-text-primary)" }}
            aria-label="Next part"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
