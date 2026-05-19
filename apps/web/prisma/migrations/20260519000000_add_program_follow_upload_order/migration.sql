-- Adds Program.followUploadOrder to control whether the AI-decide path
-- traverses source videos in upload order (true) or lets the LLM choose
-- the across-video sequence (false, current behaviour). Wizard surfaces
-- this as a sub-option under "Let AI decide" when videoCount >= 3.

ALTER TABLE "Program" ADD COLUMN "followUploadOrder" BOOLEAN NOT NULL DEFAULT false;
