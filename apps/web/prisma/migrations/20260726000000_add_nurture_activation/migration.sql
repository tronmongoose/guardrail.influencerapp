-- Activation nurture: unsubscribe flag + per-step send log

-- AlterTable
ALTER TABLE "User" ADD COLUMN "marketingUnsubscribedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NurtureSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurtureSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NurtureSend_userId_step_key" ON "NurtureSend"("userId", "step");

-- CreateIndex
CREATE INDEX "NurtureSend_userId_idx" ON "NurtureSend"("userId");

-- AddForeignKey
ALTER TABLE "NurtureSend" ADD CONSTRAINT "NurtureSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
