import { prisma } from "@/lib/prisma";
import { getCurrentUserForProgram, getEntitlement } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { resolveTokens } from "@/lib/resolve-tokens";
import { isMuxSigningConfigured, signMuxPlaybackId, getMux, isMuxConfigured } from "@/lib/mux";
import { SkinThemeProvider } from "@/components/skins/SkinThemeProvider";
import { SkinDecorationLayer } from "@/components/skins/SkinDecorationLayer";
import { SessionViewer } from "./viewer";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ programId: string; sessionId: string }>;
}) {
  const { programId, sessionId } = await params;

  const user = await getCurrentUserForProgram(programId);
  if (!user) redirect("/");

  // Fetch session + program in one query to check creator ownership
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      week: {
        include: {
          program: true,
        },
      },
      actions: {
        orderBy: { orderIndex: "asc" },
        include: {
          youtubeVideo: true,
          progress: { where: { userId: user.id } },
        },
      },
      compositeSession: {
        include: {
          clips: {
            orderBy: { orderIndex: "asc" },
            include: { youtubeVideo: true },
          },
          overlays: {
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });

  if (!session) notFound();

  const program = session.week.program;
  if (program.id !== programId) notFound();

  // Creators can always view their own program's sessions (even unpublished)
  const isCreator = program.creatorId === user.id;

  if (!isCreator) {
    if (!program.published) notFound();

    const entitlement = await getEntitlement(user.id, programId);
    if (!entitlement || entitlement.status !== "ACTIVE") {
      redirect("/");
    }

    // Check week-level access for learners
    let currentWeek: number;
    if (program.pacingMode === "DRIP_BY_WEEK") {
      const daysSinceEnrollment = Math.floor(
        (Date.now() - entitlement.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      currentWeek = Math.min(
        Math.floor(daysSinceEnrollment / 7) + 1,
        program.durationWeeks
      );
    } else {
      currentWeek = entitlement.currentWeek;
    }

    if (session.week.weekNumber > currentWeek) {
      redirect(`/learn/${programId}`);
    }
  }

  const tokens = await resolveTokens(program);

  // Build clip playlist: use CompositeSession clips if available,
  // otherwise fall back to WATCH actions' videos
  const clips = session.compositeSession?.clips ?? [];
  const overlays = session.compositeSession?.overlays ?? [];
  const autoAdvance = session.compositeSession?.autoAdvance ?? true;

  // Fallback: auto-build playlist from WATCH actions if no composite
  const fallbackClips =
    clips.length === 0
      ? session.actions
          .filter((a) => a.type === "WATCH" && (a.youtubeVideo || a.muxPlaybackId || a.muxStatus))
          .map((a, i) => ({
            id: `fallback-${a.id}`,
            compositeSessionId: "",
            youtubeVideoId: a.youtubeVideo?.id ?? "",
            youtubeVideo: a.youtubeVideo ?? { id: "", videoId: "", url: "", title: a.title, thumbnailUrl: null, durationSeconds: null, muxPlaybackId: null },
            startSeconds: null,
            endSeconds: null,
            orderIndex: i,
            transitionType: "NONE" as const,
            transitionDurationMs: 0,
            chapterTitle: a.title,
            chapterDescription: null,
            // Mux fields threaded from the Action record
            muxPlaybackId: a.muxPlaybackId ?? undefined,
            muxStatus: a.muxStatus ?? undefined,
          }))
      : [];

  const finalClips = clips.length > 0 ? clips : fallbackClips;

  // Pre-generate signed JWT tokens for every unique Mux playback ID so the
  // player can stream signed assets without any client-side API calls.
  // Tokens are scoped to 12 hours and generated on every page render.
  const muxPlaybackTokens: Record<string, string> = {};
  if (isMuxSigningConfigured()) {
    const playbackIds = [
      ...new Set(
        finalClips
          .map((c) => {
            const pid =
              (c as { muxPlaybackId?: string }).muxPlaybackId ??
              c.youtubeVideo?.muxPlaybackId ??
              null;
            return pid;
          })
          .filter((id): id is string => !!id)
      ),
    ];
    await Promise.all(
      playbackIds.map(async (pid) => {
        try {
          muxPlaybackTokens[pid] = await signMuxPlaybackId(pid);
        } catch {
          // Non-critical — if signing fails the player falls back gracefully.
        }
      })
    );
  }

  return (
    <SkinThemeProvider tokens={tokens}>
      <SkinDecorationLayer skinId={program.skinId} />
      <SessionViewer
        programId={programId}
        programTitle={program.title}
        session={{
          id: session.id,
          title: session.title,
          summary: session.summary,
          keyTakeaways: session.keyTakeaways,
        }}
        clips={await Promise.all(finalClips.map(async (c) => {
          const ytVideo = c.youtubeVideo;

          // muxPlaybackId is the single source of truth for player selection.
          // Action-level fields take priority (direct Action uploads); fall back to
          // YouTubeVideo-level fields (SessionDetailPanel / wizard uploads).
          let muxPlaybackId =
            (c as { muxPlaybackId?: string }).muxPlaybackId ??
            ytVideo.muxPlaybackId ??
            undefined;

          // If muxPlaybackId is missing but the video has a Mux upload, resolve it
          // from the Mux API. This handles local dev (no webhooks) and race conditions.
          const muxUploadIdRaw = (ytVideo as { muxUploadId?: string | null }).muxUploadId;
          if (!muxPlaybackId && muxUploadIdRaw && isMuxConfigured()) {
            try {
              const mux = getMux();
              let assetId = (ytVideo as { muxAssetId?: string | null }).muxAssetId;
              if (!assetId) {
                const upload = await mux.video.uploads.retrieve(muxUploadIdRaw);
                assetId = upload.asset_id ?? null;
              }
              if (assetId) {
                const asset = await mux.video.assets.retrieve(assetId);
                if (asset.status === "ready" && asset.playback_ids?.[0]?.id) {
                  muxPlaybackId = asset.playback_ids[0].id;
                  // Persist for next load
                  await prisma.youTubeVideo.update({
                    where: { id: ytVideo.id },
                    data: { muxPlaybackId, muxAssetId: assetId, muxStatus: "ready", url: `https://stream.mux.com/${muxPlaybackId}` },
                  });
                }
              }
            } catch {
              // Non-fatal — video will show as "processing"
            }
          }

          // muxUploadId lives on YouTubeVideo for panel/wizard uploads.
          const muxUploadId = (ytVideo as { muxUploadId?: string | null }).muxUploadId;

          // Derive muxStatus from muxPlaybackId (authoritative) rather than from url.
          const muxStatus =
            (c as { muxStatus?: string }).muxStatus ??
            (muxPlaybackId
              ? "ready"
              : muxUploadId != null
              ? "waiting"
              : undefined);

          // Set blobUrl for legacy Blob-uploaded videos (no Mux context).
          const blobUrl =
            !muxPlaybackId &&
            !muxUploadId &&
            ytVideo.url.includes("blob.vercel-storage.com")
              ? ytVideo.url
              : undefined;

          return {
            id: c.id,
            youtubeVideoId: ytVideo.videoId,
            muxPlaybackId,
            muxStatus,
            muxToken: muxPlaybackId ? muxPlaybackTokens[muxPlaybackId] : undefined,
            blobUrl,
            title: c.chapterTitle ?? session.title,
            chapterTitle: c.chapterTitle ?? session.title,
            chapterDescription: c.chapterDescription ?? undefined,
            thumbnailUrl: ytVideo.thumbnailUrl ?? undefined,
            startSeconds: c.startSeconds ?? undefined,
            endSeconds: c.endSeconds ?? undefined,
            durationSeconds: ytVideo.durationSeconds ?? undefined,
            transitionType: c.transitionType,
            transitionDurationMs: c.transitionDurationMs,
          };
        }))}
        overlays={overlays.map((o) => ({
          id: o.id,
          type: o.type,
          content: o.content as Record<string, unknown>,
          clipOrderIndex: o.clipOrderIndex ?? undefined,
          triggerAtSeconds: o.triggerAtSeconds ?? undefined,
          durationMs: o.durationMs,
          position: o.position,
        }))}
        actions={session.actions.map((a) => ({
          id: a.id,
          title:
            a.type === "WATCH" && a.youtubeVideo?.title
              ? a.youtubeVideo.title
              : a.title,
          type: a.type,
          instructions: a.instructions,
          reflectionPrompt: a.reflectionPrompt,
          completed: a.progress[0]?.completed ?? false,
          reflectionText: a.progress[0]?.reflectionText ?? undefined,
        }))}
        autoAdvance={autoAdvance}
        userId={user.id}
        transitionMode={program.transitionMode ?? "NONE"}
        hideTransition={session.hideTransition ?? false}
      />
    </SkinThemeProvider>
  );
}
