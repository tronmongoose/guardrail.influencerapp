/**
 * Resolves the best available thumbnail URL for a video.
 * Priority: stored thumbnailUrl → Mux thumbnail API → null
 */
export function getVideoThumbnailUrl(
  video: {
    thumbnailUrl?: string | null;
    muxPlaybackId?: string | null;
  } | null | undefined
): string | null {
  if (!video) return null;
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.muxPlaybackId)
    // time=10 (not 2) skips past intro title cards which were rendering as
    // flat monotone thumbnails (cmqhgei3m… 2026-06-17). Mux gracefully
    // returns the last frame for videos shorter than the requested time,
    // so 10s is safe even for very short clips.
    return `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=10&width=320`;
  return null;
}
