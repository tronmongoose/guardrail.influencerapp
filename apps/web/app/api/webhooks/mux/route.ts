import { NextRequest, NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getMux, isMuxConfigured } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  after(() => Sentry.flush(2000));

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
      // Mux finished rendering the capped-1080p.mp4 static file. Flip a
      // readiness flag so the generate-async job (which holds the bounded
      // Gemini-concurrency semaphore) can pick this video up. We deliberately
      // do NOT call Gemini from the webhook: it would race the route's own
      // calls, double-spend tokens, and bypass the per-job concurrency cap
      // that protects Gemini's RPM limits when a creator uploads 20 videos at
      // once.
      const assetId: string = event.data?.id ?? "";
      if (!assetId) {
        logger.warn({ operation: "mux.webhook.static_renditions_ready.missing_asset_id" });
        break;
      }

      const ytVideo = await prisma.youTubeVideo.findFirst({
        where: { muxAssetId: assetId },
        select: { id: true, muxStaticRenditionReadyAt: true },
      });
      if (!ytVideo) {
        // Asset belongs to an Action (lesson-level upload) or asset_ready
        // hasn't landed yet — both acceptable, just no-op.
        logger.info({
          operation: "mux.webhook.static_renditions_ready.no_ytvideo",
          assetId,
        });
        break;
      }

      if (ytVideo.muxStaticRenditionReadyAt) {
        // Duplicate webhook delivery — idempotent, just no-op.
        break;
      }

      await prisma.youTubeVideo.update({
        where: { id: ytVideo.id },
        data: { muxStaticRenditionReadyAt: new Date() },
      });

      logger.info({
        operation: "mux.webhook.static_renditions_ready",
        ytVideoId: ytVideo.id,
        assetId,
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
