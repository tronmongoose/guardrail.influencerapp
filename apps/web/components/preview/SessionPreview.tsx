"use client";

import type { Skin } from "@/lib/skins";
import type { SessionData } from "@/components/builder";
import { stripWrappingQuotes } from "@/lib/strip-quotes";
import { MuxVideoPlayer } from "@/components/viewer/MuxVideoPlayer";

interface SessionPreviewProps {
  session: SessionData & { keyTakeaways?: string[] };
  skin: Skin;
  onBack: () => void;
}

export function SessionPreview({ session, skin, onBack }: SessionPreviewProps) {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: skin.colors.bg, color: skin.colors.text }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          backgroundColor: skin.colors.bgSecondary,
          borderBottom: `1px solid ${skin.colors.border}`,
        }}
      >
        <button
          onClick={onBack}
          className="p-1 transition"
          style={{ color: skin.colors.textMuted }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold truncate">{stripWrappingQuotes(session.title)}</h1>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Video hero — playable Mux player when available, static thumbnail fallback otherwise */}
        {(() => {
          // Scene-mode: use first composite clip; classic-mode: use first WATCH action
          const firstClip = session.compositeSession?.clips?.[0];
          const watchAction = session.actions.find((a) => a.type === "WATCH");
          if (!firstClip && !watchAction) return null;

          const muxId =
            firstClip?.youtubeVideo?.muxPlaybackId ??
            watchAction?.muxPlaybackId ??
            watchAction?.youtubeVideo?.muxPlaybackId ??
            null;
          const videoTitle = firstClip?.chapterTitle ?? watchAction?.title ?? "Video";

          if (muxId) {
            return (
              <div
                className={`overflow-hidden ${skin.videoFrame === "rounded" ? "rounded-xl" : "rounded"}`}
              >
                <MuxVideoPlayer playbackId={muxId} title={videoTitle} />
              </div>
            );
          }

          const thumbnailUrl =
            firstClip?.youtubeVideo?.thumbnailUrl ??
            watchAction?.youtubeVideo?.thumbnailUrl ??
            (watchAction?.youtubeVideo?.videoId
              ? `https://img.youtube.com/vi/${watchAction.youtubeVideo.videoId}/hqdefault.jpg`
              : null);

          return (
            <div
              className={`relative aspect-video overflow-hidden ${
                skin.videoFrame === "rounded" ? "rounded-xl" : "rounded"
              }`}
              style={{ backgroundColor: "#000" }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={videoTitle}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: skin.colors.bgSecondary }}
                />
              )}
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: skin.colors.accent }}
                >
                  <svg
                    className="w-7 h-7 ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    style={{ color: "#fff" }}
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Session info */}
        {session.summary && (
          <div>
            <p style={{ color: skin.colors.textMuted }}>{session.summary}</p>
          </div>
        )}

        {/* Key takeaways */}
        {session.keyTakeaways && session.keyTakeaways.length > 0 && (
          <div
            className={`p-4 ${skin.videoFrame === "rounded" ? "rounded-xl" : "rounded"}`}
            style={{
              backgroundColor: skin.colors.accent + "10",
              border: `1px solid ${skin.colors.accent}30`,
            }}
          >
            <h3
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ color: skin.colors.accent }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Key Takeaways
            </h3>
            <ul className="space-y-2">
              {session.keyTakeaways.map((takeaway, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span style={{ color: skin.colors.accent }}>•</span>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions list */}
        <div>
          <h3 className="font-semibold mb-3">Your Tasks</h3>
          <div className="space-y-3">
            {session.actions.map((action, index) => {
              const typeColors: Record<string, string> = {
                WATCH: skin.colors.accent,
                READ: skin.colors.textMuted,
                DO: "#eab308",
                REFLECT: "#ec4899",
              };
              const typeColor = typeColors[action.type] || skin.colors.textMuted;

              return (
                <div
                  key={action.id}
                  className={`p-4 ${skin.videoFrame === "rounded" ? "rounded-xl" : "rounded"}`}
                  style={{
                    backgroundColor: skin.colors.bgSecondary,
                    border: `1px solid ${skin.colors.border}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 flex-shrink-0 flex items-center justify-center border-2 ${
                        skin.videoFrame === "rounded" ? "rounded-full" : "rounded"
                      }`}
                      style={{ borderColor: typeColor }}
                    >
                      <span className="text-xs font-medium" style={{ color: typeColor }}>
                        {index + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-medium uppercase"
                          style={{ color: typeColor }}
                        >
                          {action.type}
                        </span>
                      </div>
                      <p className="font-medium">{action.title}</p>
                      {action.instructions && (
                        <p
                          className="text-sm mt-1"
                          style={{ color: skin.colors.textMuted }}
                        >
                          {action.instructions}
                        </p>
                      )}
                      {action.type === "REFLECT" && action.reflectionPrompt && (
                        <div
                          className={`mt-3 p-3 ${
                            skin.videoFrame === "rounded" ? "rounded-lg" : "rounded"
                          }`}
                          style={{
                            backgroundColor: skin.colors.bg,
                            border: `1px dashed ${skin.colors.border}`,
                          }}
                        >
                          <p
                            className="text-sm italic"
                            style={{ color: skin.colors.textMuted }}
                          >
                            &ldquo;{action.reflectionPrompt}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Complete button */}
        <button
          className={`w-full py-3 font-semibold transition ${
            skin.videoFrame === "rounded" ? "rounded-xl" : "rounded"
          }`}
          style={{
            backgroundColor:
              skin.buttonStyle === "outline" ? "transparent" : skin.colors.accent,
            color:
              skin.buttonStyle === "outline" ? skin.colors.accent : skin.colors.bg,
            border:
              skin.buttonStyle === "outline"
                ? `2px solid ${skin.colors.accent}`
                : "none",
          }}
        >
          Mark Session Complete
        </button>
      </div>
    </div>
  );
}
