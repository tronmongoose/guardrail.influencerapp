"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimal YouTube IFrame API type surface (avoids @types/youtube dependency)
interface YTPlayer {
  getCurrentTime: () => number;
  pauseVideo: () => void;
  destroy: () => void;
  loadVideoById: (opts: {
    videoId: string;
    startSeconds?: number;
    endSeconds?: number;
  }) => void;
}

interface YTPlayerEvent {
  data: number;
}

// YouTube player state constants
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_ENDED = 0;

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, any>;
          events?: Record<string, any>;
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface VideoPlayerProps {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onClipEnd?: () => void;
  onReady?: () => void;
  onError?: (errorCode: number) => void;
  onPause?: () => void;
  className?: string;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  return apiLoadPromise;
}

export function VideoPlayer({
  videoId,
  startSeconds,
  endSeconds,
  onTimeUpdate,
  onClipEnd,
  onReady,
  onError,
  onPause,
  className = "",
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isReady, setIsReady] = useState(false);

  const startPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;

      const currentTime = player.getCurrentTime();
      onTimeUpdate?.(currentTime);

      if (endSeconds != null && currentTime >= endSeconds) {
        player.pauseVideo();
        if (pollRef.current) clearInterval(pollRef.current);
        onClipEnd?.();
      }
    }, 250);
  }, [endSeconds, onTimeUpdate, onClipEnd]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Initialize player
  useEffect(() => {
    let destroyed = false;

    async function init() {
      await loadYouTubeAPI();
      if (destroyed || !containerRef.current) return;

      // Create a unique div inside the container for the iframe
      const playerDiv = document.createElement("div");
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          start: startSeconds ? Math.floor(startSeconds) : undefined,
          end: endSeconds ? Math.ceil(endSeconds) : undefined,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            setIsReady(true);
            onReady?.();
          },
          onStateChange: (event: YTPlayerEvent) => {
            if (destroyed) return;
            switch (event.data) {
              case YT_PLAYING:
                startPoll();
                break;
              case YT_PAUSED:
                stopPoll();
                onPause?.();
                break;
              case YT_ENDED:
                stopPoll();
                onClipEnd?.();
                break;
            }
          },
          onError: (event: YTPlayerEvent) => {
            onError?.(event.data);
          },
        },
      });
    }

    init();

    return () => {
      destroyed = true;
      stopPoll();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load new video when videoId changes (after initial mount)
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    playerRef.current.loadVideoById({
      videoId,
      startSeconds: startSeconds ?? 0,
      endSeconds: endSeconds ?? undefined,
    });
  }, [videoId, startSeconds, endSeconds, isReady]);

  return (
    <div
      ref={containerRef}
      className={`aspect-video w-full overflow-hidden ${className}`}
      style={{
        borderRadius: "var(--token-comp-video-radius)",
        border: "var(--token-comp-video-border)",
        boxShadow: "var(--token-shadow-md)",
      }}
    />
  );
}
