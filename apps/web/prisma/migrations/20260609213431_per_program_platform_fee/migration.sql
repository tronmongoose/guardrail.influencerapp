-- AlterTable: per-program platform fee on Program
ALTER TABLE "Program" ADD COLUMN "platformFeePaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Program" ADD COLUMN "platformFeeSessionId" TEXT;
ALTER TABLE "Program" ADD COLUMN "platformFeePaidAt" TIMESTAMP(3);

-- CreateIndex: idempotency on Stripe session id
CREATE UNIQUE INDEX "Program_platformFeeSessionId_key" ON "Program"("platformFeeSessionId");
