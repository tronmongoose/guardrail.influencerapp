-- AlterTable
ALTER TABLE "LearnerSessionProgress" ADD COLUMN "watchedClipIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
