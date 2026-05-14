"use client";

import { useState, useCallback, useRef } from "react";
import { VideoPlayer } from "@/components/viewer/VideoPlayer";
import { MuxVideoPlayer } from "@/components/viewer/MuxVideoPlayer";
import { ChapterRail } from "@/components/viewer/ChapterRail";
import { ActionsPanel, type ViewerAction } from "@/components/viewer/ActionsPanel";
import { TransitionOverlay, type TransitionStyle } from "@/components/viewer/TransitionOverlay";
import {
  ContentOverlay,
  type ContentOverlayItem,
  type OverlayKind,
  type OverlayPositionType,
} from "@/components/viewer/ContentOverlay";
import { ViewerNav } from "@/components/viewer/ViewerNav";
import { BrandedTransitionScreen } from "@/components/viewer/BrandedTransitionScreen";
import { SimpleTransitionScreen } from "@/components/viewer/SimpleTransitionScreen";
import { stripWrappingQuotes } from "@/lib/strip-quotes";

// --- Types ---

export interface ViewerClip {
  id: string;
  youtubeVideoId: string;
  /** Fallback for uploaded videos without Mux transcoding (Vercel Blob) */
  blobUrl?: string;
  /** Mux playback ID — set once video.asset.ready fires. "ready" = playable; "waiting" = processing; "errored" = failed */
  muxPlaybackId?: string;
  muxStatus?: string;
  /** JWT playback token — required when the Mux asset uses "signed" policy. */
  muxToken?: string;
  title: string;
  chapterTitle: string;
  chapterDescription?: string;
  thumbnailUrl?: string;
  startSeconds?: number;
  endSeconds?: number;
  durationSeconds?: number;
  transitionType: string;
  transitionDurationMs: number;
}

export interface ViewerOverlay {
  id: string;
  type: string;
  content: Record<string, unknown>;
  clipOrderIndex?: number;
  triggerAtSeconds?: number;
  durationMs: number;
  position: string;
}

export interface SessionViewerProps {
  programId: string;
  programTitle?: string;
  session: {
    id: string;
    title: string;
    summary: string | null;
    keyTakeaways: string[];
  };
  clips: ViewerClip[];
  overlays: ViewerOverlay[];
  actions: ViewerAction[];
  autoAdvance: boolean;
  userId: string;
  transitionMode?: "NONE" | "SIMPLE" | "BRANDED";
  hideTransition?: boolean;
}

type PlaybackState = "LOADING" | "INTRO" | "PLAYING" | "TRANSITIONING" | "OUTRO" | "ENDED";

// --- Component ---

export function SessionViewer({
  programId,
  programTitle,
  session,
  clips,
  overlays,
  actions,
  autoAdvance,
  userId,
  transitionMode = "NONE",
  hideTransition = false,
}: SessionViewerProps) {
  const effectiveMode = hideTransition || clips.length === 0 ? "NONE" : transitionMode;
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("LOADING");
  const [activeOverlay, setActiveOverlay] = useState<ContentOverlayItem | null>(null);
  // Once the user has initiated playback on clip 1, subsequent clips autoplay.
  // Clip 1 still requires a user gesture to satisfy browser autoplay policy.
  const [hasStarted, setHasStarted] = useState(false);
  const shownOverlayIds = useRef(new Set<string>());

  const currentClip = clips[currentClipIndex];
  const hasClips = clips.length > 0;

  // --- Overlay trigger logic ---
  const checkOverlays = useCallback(
    (currentTime: number) => {
      for (const overlay of overlays) {
        if (shownOverlayIds.current.has(overlay.id)) continue;
        if (overlay.clipOrderIndex != null && overlay.clipOrderIndex !== currentClipIndex) continue;
        if (overlay.triggerAtSeconds != null && currentTime < overlay.triggerAtSeconds) continue;

        shownOverlayIds.current.add(overlay.id);
        setActiveOverlay({
          id: overlay.id,
          type: overlay.type as OverlayKind,
          content: overlay.content,
          durationMs: overlay.durationMs,
          position: overlay.position as OverlayPositionType,
        });
        break;
      }
    },
    [overlays, currentClipIndex]
  );

  // --- Playback handlers ---
  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (playbackState === "PLAYING") {
        checkOverlays(currentTime);
      }
    },
    [playbackState, checkOverlays]
  );

  const advanceToNextClip = useCallback(() => {
    const nextIndex = currentClipIndex + 1;
    if (nextIndex < clips.length) {
      setCurrentClipIndex(nextIndex);
      setPlaybackState("PLAYING");
    } else {
      setPlaybackState("ENDED");
    }
  }, [currentClipIndex, clips.length]);

  const handleClipEnd = useCallback(() => {
    setHasStarted(true);
    const isLastClip = currentClipIndex >= clips.length - 1;

    if (!autoAdvance || isLastClip) {
      if (isLastClip && effectiveMode !== "NONE") {
        setPlaybackState("OUTRO");
      } else {
        setPlaybackState("ENDED");
      }
      return;
    }

    const nextClip = clips[currentClipIndex + 1];
    const transitionType = (nextClip?.transitionType ?? "NONE") as TransitionStyle;
    const transitionDuration = nextClip?.transitionDurationMs ?? 0;

    if (transitionType === "NONE" || transitionDuration === 0) {
      advanceToNextClip();
    } else {
      setPlaybackState("TRANSITIONING");
    }
  }, [autoAdvance, currentClipIndex, clips, advanceToNextClip, effectiveMode]);

  const handleTransitionComplete = useCallback(() => {
    advanceToNextClip();
  }, [advanceToNextClip]);

  const handleChapterJump = useCallback((index: number) => {
    setHasStarted(true);
    setCurrentClipIndex(index);
    setPlaybackState("PLAYING");
  }, []);

  const handlePlayerReady = useCallback(() => {
    if (effectiveMode !== "NONE") {
      setPlaybackState("INTRO");
    } else {
      setPlaybackState("PLAYING");
    }
  }, [effectiveMode]);

  const handleIntroComplete = useCallback(() => {
    setPlaybackState("PLAYING");
  }, []);

  const handleOutroComplete = useCallback(() => {
    setPlaybackState("ENDED");
  }, []);

  const handleDismissOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  // Get transition info for the current transition
  const nextClipForTransition = clips[currentClipIndex + 1];
  const transitionStyle = (nextClipForTransition?.transitionType ?? "NONE") as TransitionStyle;
  const transitionDurationMs = nextClipForTransition?.transitionDurationMs ?? 0;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        backgroundColor: "var(--token-color-bg-default)",
        color: "var(--token-color-text-primary)",
      }}
    >
      <ViewerNav
        programId={programId}
        programTitle={programTitle}
        sessionTitle={stripWrappingQuotes(session.title)}
        currentClip={currentClipIndex}
        totalClips={clips.length}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Video + overlays area */}
        <div className="flex flex-1 flex-col">
          {hasClips ? (
            <div className="relative w-full">
              {currentClip.muxPlaybackId ? (
                // Mux-hosted video — with timestamp-based clip playback
                <MuxVideoPlayer
                  key={currentClip.id}
                  playbackId={currentClip.muxPlaybackId}
                  tokens={currentClip.muxToken ? { playback: currentClip.muxToken } : undefined}
                  title={currentClip.title}
                  startSeconds={currentClip.startSeconds}
                  endSeconds={currentClip.endSeconds}
                  autoPlay={hasStarted || currentClipIndex > 0}
                  onClipEnd={handleClipEnd}
                  className="w-full"
                />
              ) : (
                // YouTube video (default)
                <VideoPlayer
                  videoId={currentClip.youtubeVideoId}
                  startSeconds={currentClip.startSeconds}
                  endSeconds={currentClip.endSeconds}
                  onTimeUpdate={handleTimeUpdate}
                  onClipEnd={handleClipEnd}
                  onReady={handlePlayerReady}
                  className="w-full"
                />
              )}
              <TransitionOverlay
                active={playbackState === "TRANSITIONING"}
                style={transitionStyle}
                durationMs={transitionDurationMs}
                onComplete={handleTransitionComplete}
              />
              <ContentOverlay
                overlay={activeOverlay}
                onDismiss={handleDismissOverlay}
              />

              {/* Session intro screen */}
              {playbackState === "INTRO" && effectiveMode === "BRANDED" && (
                <BrandedTransitionScreen
                  variant="intro"
                  sessionTitle={stripWrappingQuotes(session.title)}
                  keyTakeaways={session.keyTakeaways}
                  onComplete={handleIntroComplete}
                />
              )}
              {playbackState === "INTRO" && effectiveMode === "SIMPLE" && (
                <SimpleTransitionScreen
                  variant="intro"
                  sessionTitle={stripWrappingQuotes(session.title)}
                  onComplete={handleIntroComplete}
                />
              )}

              {/* Session outro screen */}
              {playbackState === "OUTRO" && effectiveMode === "BRANDED" && (
                <BrandedTransitionScreen
                  variant="outro"
                  sessionTitle={stripWrappingQuotes(session.title)}
                  keyTakeaways={session.keyTakeaways}
                  onComplete={handleOutroComplete}
                />
              )}
              {playbackState === "OUTRO" && effectiveMode === "SIMPLE" && (
                <SimpleTransitionScreen
                  variant="outro"
                  sessionTitle={stripWrappingQuotes(session.title)}
                  onComplete={handleOutroComplete}
                />
              )}
            </div>
          ) : (
            <div
              className="flex aspect-video w-full items-center justify-center"
              style={{
                backgroundColor: "var(--token-color-bg-elevated)",
                borderRadius: "var(--token-comp-video-radius)",
              }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--token-color-text-secondary)" }}
              >
                No video clips in this session
              </p>
            </div>
          )}

          {/* Mobile chapter rail (below video) */}
          <ChapterRail
            clips={clips.map((c) => ({
              id: c.id,
              chapterTitle: c.chapterTitle,
              chapterDescription: c.chapterDescription,
              thumbnailUrl: c.thumbnailUrl,
              // Prefer the clip-range duration (endSeconds - startSeconds)
              // over the source asset's full durationSeconds — otherwise a
              // 30s slice of a 28-min video displays "28:22" in the rail.
              durationSeconds:
                c.startSeconds != null && c.endSeconds != null
                  ? Math.max(0, c.endSeconds - c.startSeconds)
                  : c.durationSeconds,
            }))}
            currentIndex={currentClipIndex}
            onJump={handleChapterJump}
          />

          {/* Session info + actions (below video on all screens) */}
          <div className="flex-1 space-y-6 p-4 md:p-6">
            {/* Session summary */}
            {session.summary && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--token-color-text-secondary)" }}
              >
                {session.summary}
              </p>
            )}

            {/* Key takeaways */}
            {session.keyTakeaways.length > 0 && (
              <div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: "var(--token-color-text-secondary)" }}
                >
                  Key Takeaways
                </h3>
                <ul className="space-y-1.5">
                  {session.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "var(--token-color-accent)" }}
                      />
                      <span style={{ color: "var(--token-color-text-primary)" }}>
                        {takeaway}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ended state */}
            {playbackState === "ENDED" && hasClips && (
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  backgroundColor: "var(--token-color-bg-elevated)",
                  border: "1px solid var(--token-color-border-subtle)",
                }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--token-color-accent)" }}>
                  Session complete
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--token-color-text-secondary)" }}
                >
                  Complete the actions below to finish this session.
                </p>
              </div>
            )}

            {/* Actions panel */}
            <ActionsPanel actions={actions} userId={userId} />
          </div>
        </div>

        {/* Desktop chapter rail (sidebar) */}
        <div className="hidden md:flex w-64 flex-shrink-0">
          <ChapterRail
            clips={clips.map((c) => ({
              id: c.id,
              chapterTitle: c.chapterTitle,
              chapterDescription: c.chapterDescription,
              thumbnailUrl: c.thumbnailUrl,
              // Prefer the clip-range duration (endSeconds - startSeconds)
              // over the source asset's full durationSeconds — otherwise a
              // 30s slice of a 28-min video displays "28:22" in the rail.
              durationSeconds:
                c.startSeconds != null && c.endSeconds != null
                  ? Math.max(0, c.endSeconds - c.startSeconds)
                  : c.durationSeconds,
            }))}
            currentIndex={currentClipIndex}
            onJump={handleChapterJump}
          />
        </div>
      </div>
    </div>
  );
}
