-- Add ON DELETE CASCADE to SessionClip.youtubeVideoId so deleting a Program
-- doesn't fail with an FK constraint error. Before this migration, the
-- Program → YouTubeVideo cascade and the Program → ... → CompositeSession →
-- SessionClip cascade could race in a way that left SessionClip rows
-- referencing about-to-be-deleted YouTubeVideo rows, throwing P2003.
--
-- Surfaced by the upload-test harness when DELETE /api/programs/[id] was
-- called on a successfully-generated program (which had populated SessionClip
-- rows). Same bug would hit any creator deleting a completed program in prod.

-- DropForeignKey
ALTER TABLE "SessionClip" DROP CONSTRAINT "SessionClip_youtubeVideoId_fkey";

-- AddForeignKey
ALTER TABLE "SessionClip" ADD CONSTRAINT "SessionClip_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
