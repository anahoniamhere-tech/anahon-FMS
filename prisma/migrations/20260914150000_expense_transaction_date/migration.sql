-- The true date of a payment request's transaction (14 Sep 2026).
--
-- Expense had only created_at / approved_at / paid_at, and the ledger rebuild posts on created_at,
-- so a 2024 voucher typed in during the backfill would land in September 2026. Existing rows stay
-- blank on purpose: "not captured" is honest, a date copied from created_at would not be.
ALTER TABLE "Expense" ADD COLUMN "transactionDate" TEXT NOT NULL DEFAULT '';
