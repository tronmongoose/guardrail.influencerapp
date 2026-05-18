-- Today's two schema changes captured as a single migration so future
-- deploys apply them via `prisma migrate deploy` rather than relying on
-- a manual `prisma db push` against each environment.
--
-- 1. New LearnerSessionProgress table for server-side WATCH-step completion
--    (previously only tracked in browser localStorage).
-- 2. Cascade-delete on LearnerProgress's user + action FKs so program
--    regeneration's Week.deleteMany → Session → Action chain no longer
--    trips a FK constraint when orphan progress rows reference soon-to-be-
--    deleted Actions.
--
-- Already applied to both prod and dev via `prisma db push` earlier; this
-- migration is recorded as applied on both via `prisma migrate resolve
-- --applied`, so the next `migrate deploy` no-ops it.

-- CreateTable
CREATE TABLE "LearnerSessionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerSessionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnerSessionProgress_userId_idx" ON "LearnerSessionProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerSessionProgress_userId_sessionId_key" ON "LearnerSessionProgress"("userId", "sessionId");

-- AddForeignKey
ALTER TABLE "LearnerSessionProgress" ADD CONSTRAINT "LearnerSessionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerSessionProgress" ADD CONSTRAINT "LearnerSessionProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey + AddForeignKey: LearnerProgress.user now cascades
ALTER TABLE "LearnerProgress" DROP CONSTRAINT "LearnerProgress_userId_fkey";
ALTER TABLE "LearnerProgress" ADD CONSTRAINT "LearnerProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey + AddForeignKey: LearnerProgress.action now cascades
ALTER TABLE "LearnerProgress" DROP CONSTRAINT "LearnerProgress_actionId_fkey";
ALTER TABLE "LearnerProgress" ADD CONSTRAINT "LearnerProgress_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
