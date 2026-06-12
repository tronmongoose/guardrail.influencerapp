-- AlterTable: persist the actual paid amount per entitlement so the creator
-- dashboard reports real revenue, insensitive to later price edits. Nullable
-- for legacy rows — the metrics reader falls back to program.priceInCents.
ALTER TABLE "Entitlement" ADD COLUMN "amountPaidCents" INTEGER;
