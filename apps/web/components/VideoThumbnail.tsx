"use client";

import { useCallback, useEffect, useState } from "react";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";

interface VideoLike {
  url?: string | null;
  thumbnailUrl?: string | null;
  muxPlaybackId?: string | null;
  muxUploadId?: string | null;
}

interface VideoThumbnailProps {
  video: VideoLike | null | undefined;
  className: string;
  /** Tailwind size class for the placeholder/icon (e.g. "w-3 h-3", "w-6 h-6") */
  iconSize?: string;
}

function isCanvasExtractable(video: VideoLike): boolean {
  if (!video.url) return false;
  // mux-upload:// is a sentinel for an in-progress upload — not a real source.
  if (video.url.startsWith("mux-upload://")) return false;
  return (
    video.url.includes("blob.vercel-storage.com") ||
    video.url.includes("stream.mux.com") ||
    !!video.muxUploadId
  );
}

/**
 * Resilient video thumbnail with a layered fallback chain:
 *   1. Stored `thumbnailUrl` or Mux thumbnail API URL
 *   2. On <img> error: extract a frame via canvas (uploaded videos only)
 *   3. SVG placeholder
 *
 * Without the fallback, transient Mux 404s and stale stored URLs render as a
 * broken-image icon in the editor — the bug you saw in the screenshot.
 */
export function VideoThumbnail({
  video,
  className,
  iconSize = "w-1/3 h-1/3",
}: VideoThumbnailProps) {
  const thumbUrl = getVideoThumbnailUrl(video);
  const [errored, setErrored] = useState(false);

  // Reset error state if the source changes (e.g. Mux finally finishes processing).
  useEffect(() => {
    setErrored(false);
  }, [thumbUrl]);

  if (thumbUrl && !errored) {
    return (
      <img
        src={thumbUrl}
        alt=""
        className={`object-cover ${className}`}
        onError={() => setErrored(true)}
      />
    );
  }

  if (video && video.url && isCanvasExtractable(video)) {
    return <CanvasFrameThumbnail url={video.url} className={className} iconSize={iconSize} />;
  }

  return <ThumbnailPlaceholder className={className} iconSize={iconSize} />;
}

function ThumbnailPlaceholder({ className, iconSize }: { className: string; iconSize: string }) {
  return (
    <div className={`bg-gray-800 flex items-center justify-center ${className}`}>
      <svg className={`${iconSize} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

function CanvasFrameThumbnail({
  url,
  className,
  iconSize,
}: {
  url: string;
  className: string;
  iconSize: string;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const extract = useCallback(() => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(2, (video.duration || 2) * 0.1);
    };
    video.onerror = () => setFailed(true);
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const aspect = video.videoHeight / (video.videoWidth || 1);
        canvas.width = 320;
        canvas.height = Math.round(320 * aspect) || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setFailed(true);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        setFailed(true);
      }
    };
    video.src = url;
  }, [url]);

  useEffect(() => {
    setThumb(null);
    setFailed(false);
    extract();
  }, [extract]);

  if (failed || !thumb) {
    return <ThumbnailPlaceholder className={className} iconSize={iconSize} />;
  }
  return <img src={thumb} alt="" className={`object-cover ${className}`} />;
}
