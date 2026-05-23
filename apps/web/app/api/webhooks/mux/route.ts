import { NextRequest, NextResponse, after } from "next/server";
import { getMux, isMuxConfigured } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { analyzeUploadedVideoWithGemini } from "@guide-rail/ai";

export async function POST(req: NextRequest) {
  if (!isMuxConfigured()) {
    return NextResponse.json({ error: "Mux not configured" }, { status: 501 });
  }

  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn({ operation: "mux.webhook.missing_secret" });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  // Raw body required for signature verification — do NOT use req.json()
  const body = await req.text();

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Verify signature and parse event in one call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    const mux = getMux();
    event = mux.webhooks.unwrap(body, headers, webhookSecret);
  } catch (err) {
    logger.error({ operation: "mux.webhook.signature_failed" }, err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType: string = event.type ?? "";

  switch (eventType) {
    case "video.upload.asset_created": {
      // Bridge: the upload has been ingested and an asset has been created.
      // The event.data is a Mux Upload object:
      //   event.data.id        = the upload ID  (matches YouTubeVideo.muxUploadId / Action.muxUploadId)
      //   event.data.asset_id  = the new asset ID to store as muxAssetId
      const uploadId: string = event.data?.id ?? "";
      const assetId: string = event.data?.asset_id ?? "";

      if (!uploadId || !assetId) {
        logger.warn({
          operation: "mux.webhook.upload_asset_created.missing_ids",
          uploadId,
          assetId,
        });
        break;
      }

      // Check Action first (lesson-level uploads)
      const action = await prisma.action.findFirst({
        where: { muxUploadId: uploadId },
      });

      if (action) {
        await prisma.action.update({
          where: { id: action.id },
          data: { muxAssetId: assetId },
        });
        logger.info({
          operation: "mux.webhook.upload_asset_created",
          actionId: action.id,
          uploadId,
          assetId,
        });
        break;
      }

      // Check YouTubeVideo (wizard program-level uploads)
      const ytVideo = await prisma.youTubeVideo.findFirst({
        where: { muxUploadId: uploadId },
      });

      if (ytVideo) {
        await prisma.youTubeVideo.update({
          where: { id: ytVideo.id },
          data: { muxAssetId: assetId },
        });
        logger.info({
          operation: "mux.webhook.upload_asset_created.youtube_video",
          youtubeVideoId: ytVideo.id,
          uploadId,
          assetId,
        });
        break;
      }

      logger.warn({
        operation: "mux.webhook.upload_asset_created.no_record_found",
        uploadId,
        assetId,
      });
      break;
    }

    case "video.asset.ready": {
      // Asset is fully processed and playable.
      const assetId: string = event.data?.id ?? "";
      const playbackId: string = event.data?.playback_ids?.[0]?.id ?? "";
      const uploadId: string = event.data?.upload_id ?? "";

      if (!assetId || !playbackId) {
        logger.warn({
          operation: "mux.webhook.asset_ready.missing_ids",
          assetId,
          playbackId,
        });
        break;
      }

      // Check Action first by muxAssetId, then fall back to muxUploadId
      let action = await prisma.action.findFirst({
        where: { muxAssetId: assetId },
      });
      if (!action && uploadId) {
        action = await prisma.action.findFirst({
          where: { muxUploadId: uploadId },
        });
      }

      if (action) {
        await prisma.action.update({
          where: { id: action.id },
          data: {
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            muxStatus: "ready",
          },
        });
        logger.info({
          operation: "mux.webhook.asset_ready",
          actionId: action.id,
          assetId,
          playbackId,
          lookupBy: action.muxAssetId ? "assetId" : "uploadId",
        });
        break;
      }

      // Check YouTubeVideo by muxAssetId, then fall back to muxUploadId
      let ytVideo = await prisma.youTubeVideo.findFirst({
        where: { muxAssetId: assetId },
      });
      if (!ytVideo && uploadId) {
        ytVideo = await prisma.youTubeVideo.findFirst({
          where: { muxUploadId: uploadId },
        });
      }

      if (ytVideo) {
        await prisma.youTubeVideo.update({
          where: { id: ytVideo.id },
          data: {
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            muxStatus: "ready",
            url: `https://stream.mux.com/${playbackId}`,
          },
        });
        logger.info({
          operation: "mux.webhook.asset_ready.youtube_video",
          youtubeVideoId: ytVideo.id,
          assetId,
          playbackId,
          lookupBy: ytVideo.muxAssetId ? "assetId" : "uploadId",
        });
        // Gemini analysis runs on video.asset.static_renditions.ready below,
        // not here — the capped-1080p.mp4 file doesn't exist yet at this
        // point even though mp4_support was set at upload time. Firing
        // Gemini here produces a 404 on the rendition URL. See 9th-degree-
        // healing 2026-05-22 incident in OPEN-FINDINGS.md.
        break;
      }

      logger.warn({
        operation: "mux.webhook.asset_ready.no_record_found",
        assetId,
        uploadId,
      });
      break;
    }

    case "video.asset.static_renditions.ready": {
      // Mux finished rendering the capped-1080p.mp4 static file. Only now
      // is the URL we hand to Gemini actually downloadable. Trigger video
      // analysis from here.
      const assetId: string = event.data?.id ?? "";
      if (!assetId) {
        logger.warn({ operation: "mux.webhook.static_renditions_ready.missing_asset_id" });
        break;
      }

      const ytVideo = await prisma.youTubeVideo.findFirst({
        where: { muxAssetId: assetId },
      });
      if (!ytVideo) {
        // video.asset.ready usually fires first and writes muxAssetId. If we
        // miss the lookup here it likely means this asset belongs to an
        // Action (not a YouTubeVideo) or the asset_ready handler hasn't
        // landed yet — both are acceptable, just no-op.
        logger.info({
          operation: "mux.webhook.static_renditions_ready.no_ytvideo",
          assetId,
        });
        break;
      }

      const playbackId = ytVideo.muxPlaybackId;
      if (!playbackId) {
        logger.warn({
          operation: "mux.webhook.static_renditions_ready.no_playback_id",
          ytVideoId: ytVideo.id,
        });
        break;
      }

      // Skip if analysis already exists — duplicate webhook deliveries or
      // re-runs of an asset that's already been processed.
      const existing = await prisma.videoAnalysis.findUnique({
        where: { youtubeVideoId: ytVideo.id },
        select: { id: true },
      });
      if (existing) {
        logger.info({
          operation: "mux.webhook.static_renditions_ready.analysis_exists",
          ytVideoId: ytVideo.id,
        });
        break;
      }

      const videoTitle = ytVideo.title ?? "Untitled";
      const videoRecordId = ytVideo.id;
      const mp4Url = `https://stream.mux.com/${playbackId}/capped-1080p.mp4`;

      after(async () => {
        try {
          logger.info({ operation: "mux.webhook.gemini_analysis_start", ytVideoId: videoRecordId, mp4Url });
          const analysis = await analyzeUploadedVideoWithGemini(mp4Url, videoTitle, "video/mp4");

          await prisma.videoAnalysis.upsert({
            where: { youtubeVideoId: videoRecordId },
            create: {
              youtubeVideoId: videoRecordId,
              summary: analysis.summary,
              fullTranscript: analysis.fullTranscript ?? null,
              segments: analysis.segments as unknown as Prisma.InputJsonValue,
              topics: analysis.topics as unknown as Prisma.InputJsonValue,
              keyMoments: analysis.keyMoments as unknown as Prisma.InputJsonValue ?? undefined,
              people: analysis.people as unknown as Prisma.InputJsonValue ?? undefined,
              durationSeconds: analysis.durationSeconds ?? null,
            },
            update: {
              summary: analysis.summary,
              fullTranscript: analysis.fullTranscript ?? null,
              segments: analysis.segments as unknown as Prisma.InputJsonValue,
              topics: analysis.topics as unknown as Prisma.InputJsonValue,
              keyMoments: analysis.keyMoments as unknown as Prisma.InputJsonValue ?? undefined,
              people: analysis.people as unknown as Prisma.InputJsonValue ?? undefined,
              durationSeconds: analysis.durationSeconds ?? null,
              analyzedAt: new Date(),
            },
          });

          if (analysis.fullTranscript) {
            await prisma.youTubeVideo.update({
              where: { id: videoRecordId },
              data: { transcript: analysis.fullTranscript, durationSeconds: analysis.durationSeconds ?? undefined },
            });
          }

          logger.info({
            operation: "mux.webhook.gemini_analysis_complete",
            ytVideoId: videoRecordId,
            topics: analysis.topics.length,
            transcriptChars: analysis.fullTranscript?.length ?? 0,
          });
        } catch (err) {
          logger.error({ operation: "mux.webhook.gemini_analysis_failed", ytVideoId: videoRecordId }, err);
        }
      });

      break;
    }

    case "video.asset.errored": {
      const assetId: string = event.data?.id ?? "";

      if (!assetId) break;

      const action = await prisma.action.findFirst({
        where: { muxAssetId: assetId },
      });

      if (action) {
        await prisma.action.update({
          where: { id: action.id },
          data: { muxStatus: "errored" },
        });
        logger.warn({
          operation: "mux.webhook.asset_errored",
          actionId: action.id,
          assetId,
        });
        break;
      }

      // Also handle YouTubeVideo errored state
      const ytVideo = await prisma.youTubeVideo.findFirst({
        where: { muxAssetId: assetId },
      });

      if (ytVideo) {
        await prisma.youTubeVideo.update({
          where: { id: ytVideo.id },
          data: { muxStatus: "errored" },
        });
        logger.warn({
          operation: "mux.webhook.asset_errored.youtube_video",
          youtubeVideoId: ytVideo.id,
          assetId,
        });
      }
      break;
    }

    case "video.track.ready": {
      // No-op: Gemini analysis now runs on video.asset.ready via the MP4 static rendition.
      // Mux caption tracks are no longer used for transcription.
      break;
    }

    default:
      logger.info({
        operation: "mux.webhook.unhandled_event",
        eventType,
      });
  }

  return NextResponse.json({ received: true });
}
