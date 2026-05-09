"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video w-full bg-black animate-pulse" />
  ),
});

interface MuxVideoPlayerProps {
  playbackId: string;
  /** JWT signed tokens for protected playback IDs (policy: "signed"). */
  tokens?: { playback: string };
  title?: string;
  className?: string;
  /** Seek to this time on load (seconds). */
  startSeconds?: number;
  /** Pause/fire onClipEnd when playback reaches this time (seconds). */
  endSeconds?: number;
  /** Start playback automatically once the stream is ready and seeked. */
  autoPlay?: boolean;
  /** Called when the clip reaches endSeconds or the video ends naturally. */
  onClipEnd?: () => void;
}

// Max retry attempts for the imperative seek. Prevents an infinite loop if
// startSeconds lies outside the asset's actual seekable range.
const MAX_SEEK_ATTEMPTS = 5;
// Tolerance (seconds) for considering a seek to have landed at startSeconds.
const SEEK_TOLERANCE = 0.5;

export function MuxVideoPlayer({
  playbackId,
  tokens,
  title,
  className = "",
  startSeconds,
  endSeconds,
  autoPlay,
  onClipEnd,
}: MuxVideoPlayerProps) {
  // Ref-callback pattern: `next/dynamic` wraps the component in `React.lazy`,
  // which does not transparently forward refs. Using a state-backed callback
  // ref gives us the real <mux-player> element (an HTMLMediaElement) once it
  // attaches, and re-runs the listener effect when it swaps on remount.
  const [playerEl, setPlayerEl] = useState<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  // UI state for the custom clip-aware control bar (only used when isClipped).
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const clipEndFiredRef = useRef(false);
  const seekVerifiedRef = useRef(false);
  const seekAttemptsRef = useRef(0);

  const isClipped = startSeconds != null || endSeconds != null;
  const clipDuration =
    endSeconds != null && startSeconds != null
      ? Math.max(0, endSeconds - startSeconds)
      : null;
  const relativeTime =
    startSeconds != null
      ? Math.max(0, currentTime - startSeconds)
      : currentTime;
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  useEffect(() => {
    clipEndFiredRef.current = false;
    seekVerifiedRef.current = false;
    seekAttemptsRef.current = 0;
    if (process.env.NODE_ENV !== "production") {
      console.info("[MuxVideoPlayer] mount/clip change", {
        playbackId,
        startSeconds,
        endSeconds,
      });
    }
  }, [playbackId, startSeconds, endSeconds]);

  useEffect(() => {
    if (!playerEl || process.env.NODE_ENV === "production") return;
    const log = (event: string) => () => {
      console.info(`[MuxVideoPlayer] ${event}`, {
        currentTime: playerEl.currentTime,
        duration: playerEl.duration,
        seekableEnd: playerEl.seekable?.length
          ? playerEl.seekable.end(playerEl.seekable.length - 1)
          : null,
        target: { startSeconds, endSeconds },
      });
    };
    const handlers = {
      loadedmetadata: log("loadedmetadata"),
      canplay: log("canplay"),
      seeked: log("seeked"),
      ended: log("ended"),
    };
    for (const [k, h] of Object.entries(handlers)) playerEl.addEventListener(k, h);
    return () => {
      for (const [k, h] of Object.entries(handlers)) playerEl.removeEventListener(k, h);
    };
  }, [playerEl, startSeconds, endSeconds]);

  // Mirror player state into React for the custom control bar — without this
  // our play/pause icon and mute icon would never reflect actual state.
  useEffect(() => {
    if (!playerEl) return;
    const sync = () => {
      setIsPlaying(!playerEl.paused);
      setIsMuted(playerEl.muted || playerEl.volume === 0);
    };
    sync();
    const events = ["play", "pause", "volumechange", "ended"];
    for (const e of events) playerEl.addEventListener(e, sync);
    return () => {
      for (const e of events) playerEl.removeEventListener(e, sync);
    };
  }, [playerEl]);

  // Track fullscreen state — fullscreenchange fires on document, not on the element.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerEl) return;
    if (playerEl.paused) {
      playerEl.play().catch(() => {});
    } else {
      playerEl.pause();
    }
  }, [playerEl]);

  const toggleMute = useCallback(() => {
    if (!playerEl) return;
    playerEl.muted = !playerEl.muted;
  }, [playerEl]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current || typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleScrubChange = useCallback(
    (relSeconds: number) => {
      if (!playerEl || clipDuration == null) return;
      const clamped = Math.max(0, Math.min(clipDuration, relSeconds));
      // Reset clip-end fired flag — if the user scrubs back into the clip,
      // we want the end-pause logic to fire again next time.
      if (clamped < clipDuration - 0.05) clipEndFiredRef.current = false;
      playerEl.currentTime = (startSeconds ?? 0) + clamped;
    },
    [playerEl, clipDuration, startSeconds],
  );

  const attemptSeek = useCallback(() => {
    if (seekVerifiedRef.current || !playerEl) return;
    if (startSeconds == null || startSeconds <= 0) {
      seekVerifiedRef.current = true;
      return;
    }
    if (seekAttemptsRef.current >= MAX_SEEK_ATTEMPTS) return;
    // HLS streams don't expose a usable seekable range until manifest + init
    // segments have loaded. Guard so we don't silently no-op and burn our
    // retry budget on an un-seekable state.
    const seekable = playerEl.seekable;
    if (!seekable || seekable.length === 0) return;
    if (seekable.end(seekable.length - 1) < startSeconds) return;
    seekAttemptsRef.current += 1;
    playerEl.currentTime = startSeconds;
    // Verification happens in the `seeked` handler below.
  }, [playerEl, startSeconds]);

  useEffect(() => {
    if (!playerEl) return;

    const handleTimeUpdate = () => {
      // Track currentTime for the clip-relative overlay UI.
      setCurrentTime(playerEl.currentTime);
      if (endSeconds == null || clipEndFiredRef.current) return;
      if (playerEl.currentTime >= endSeconds) {
        clipEndFiredRef.current = true;
        if (typeof playerEl.pause === "function") playerEl.pause();
        onClipEnd?.();
      }
    };

    const handleLoadedMetadata = () => attemptSeek();
    const handleLoadedData = () => attemptSeek();

    const handleCanPlay = () => {
      attemptSeek();
      if (autoPlay && seekVerifiedRef.current) {
        playerEl.play().catch(() => {
          // Browser autoplay policy may still reject; user sees native play
          // button and can click through.
        });
      }
    };

    const handleSeeked = () => {
      // Once the initial seek has landed, enforce clip bounds: any user-initiated
      // scrub outside [startSeconds, endSeconds] snaps back to the nearest bound.
      // Without this the native scrubber lets learners drag past the clip range
      // and play content outside the assigned slice.
      if (seekVerifiedRef.current) {
        if (endSeconds != null && playerEl.currentTime > endSeconds - 0.05) {
          playerEl.pause();
          playerEl.currentTime = endSeconds;
          if (!clipEndFiredRef.current) {
            clipEndFiredRef.current = true;
            onClipEnd?.();
          }
          return;
        }
        if (startSeconds != null && playerEl.currentTime < startSeconds - SEEK_TOLERANCE) {
          playerEl.currentTime = startSeconds;
          return;
        }
        return;
      }

      if (startSeconds == null) {
        seekVerifiedRef.current = true;
        return;
      }
      if (Math.abs(playerEl.currentTime - startSeconds) < SEEK_TOLERANCE) {
        seekVerifiedRef.current = true;
        if (autoPlay) {
          playerEl.play().catch(() => {});
        }
      } else if (seekAttemptsRef.current < MAX_SEEK_ATTEMPTS) {
        attemptSeek();
      }
    };

    const handleEnded = () => {
      if (clipEndFiredRef.current) return;
      clipEndFiredRef.current = true;
      onClipEnd?.();
    };

    playerEl.addEventListener("timeupdate", handleTimeUpdate);
    playerEl.addEventListener("loadedmetadata", handleLoadedMetadata);
    playerEl.addEventListener("loadeddata", handleLoadedData);
    playerEl.addEventListener("canplay", handleCanPlay);
    playerEl.addEventListener("seeked", handleSeeked);
    playerEl.addEventListener("ended", handleEnded);

    return () => {
      playerEl.removeEventListener("timeupdate", handleTimeUpdate);
      playerEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
      playerEl.removeEventListener("loadeddata", handleLoadedData);
      playerEl.removeEventListener("canplay", handleCanPlay);
      playerEl.removeEventListener("seeked", handleSeeked);
      playerEl.removeEventListener("ended", handleEnded);
    };
  }, [playerEl, startSeconds, endSeconds, autoPlay, attemptSeek, onClipEnd]);

  return (
    <div className={`w-full ${className}`}>
      {/* Hide Mux Player's native chrome for clipped playback. The native UI
          shows the full asset's duration (and full asset's controls) which is
          misleading when only a slice is supposed to play. We use both
          media-chrome CSS variables (which inherit into the shadow DOM and
          hide the underlying control elements) and ::part selectors covering
          the chrome layers Mux Player exposes — top/bottom/center plus their
          *-chrome aliases. */}
      {isClipped && (
        <style>{`
          mux-player {
            --media-control-bar-display: none !important;
            --media-time-display-display: none !important;
            --media-time-range-display: none !important;
            --media-volume-range-display: none !important;
            --media-mute-button-display: none !important;
            --media-play-button-display: none !important;
            --media-fullscreen-button-display: none !important;
            --media-pip-button-display: none !important;
            --media-playback-rate-button-display: none !important;
            --media-captions-button-display: none !important;
            --media-audio-track-menu-button-display: none !important;
            --media-seek-backward-button-display: none !important;
            --media-seek-forward-button-display: none !important;
          }
          mux-player::part(top),
          mux-player::part(bottom),
          mux-player::part(center),
          mux-player::part(top-chrome),
          mux-player::part(bottom-chrome),
          mux-player::part(center-chrome),
          mux-player::part(control-bar),
          mux-player::part(bottom-control-bar),
          mux-player::part(top-control-bar),
          mux-player::part(vertical-layer),
          mux-player::part(gesture-layer) {
            display: none !important;
          }
        `}</style>
      )}
      <div
        ref={containerRef}
        className="aspect-video w-full overflow-hidden relative group"
        style={{
          borderRadius: "var(--token-comp-video-radius)",
          border: "var(--token-comp-video-border)",
          boxShadow: "var(--token-shadow-md)",
          backgroundColor: "#000",
        }}
      >
        <MuxPlayer
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={setPlayerEl as any}
          playbackId={playbackId}
          tokens={tokens}
          streamType="on-demand"
          nohotkeys={isClipped ? true : undefined}
          metadata={{ video_title: title }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={
            {
              "--media-primary-color": "var(--token-color-accent, #6366f1)",
              "--media-secondary-color": "var(--token-color-bg-default, #111827)",
              height: "100%",
              width: "100%",
            } as any
          }
        />

        {/* Click-to-toggle play/pause overlay — covers the player area but
            sits below the custom control bar (lower z-index). Only when clipped. */}
        {isClipped && (
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            className="absolute inset-0 w-full h-full bg-transparent z-10"
            style={{ cursor: "pointer" }}
          />
        )}

        {/* Custom clip-aware control bar — replaces Mux's native bar. */}
        {isClipped && clipDuration != null && (
          <div
            className="absolute bottom-0 left-0 right-0 px-3 pt-8 pb-2 z-20 flex items-center gap-3 text-white"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.0))",
            }}
            // Stop click-through so clicking on controls doesn't toggle play/pause.
            onClick={(e) => e.stopPropagation()}
          >
            {/* Play / Pause */}
            <button
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
              )}
            </button>

            {/* Time display (clip-relative) */}
            <span className="text-xs tabular-nums flex-shrink-0">
              {fmt(Math.min(relativeTime, clipDuration))} / {fmt(clipDuration)}
            </span>

            {/* Scrubber (clip-relative) */}
            <input
              type="range"
              min={0}
              max={clipDuration}
              step={0.1}
              value={Math.min(relativeTime, clipDuration)}
              onChange={(e) => handleScrubChange(Number(e.target.value))}
              aria-label="Clip progress"
              className="flex-1 h-1 cursor-pointer accent-current"
              style={{
                accentColor: "var(--token-color-accent, #6366f1)",
              }}
            />

            {/* Mute toggle */}
            <button
              type="button"
              aria-label={isMuted ? "Unmute" : "Mute"}
              onClick={toggleMute}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition"
            >
              {isMuted ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition"
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
