-- Opening values with their basis, and missing-receipt declarations (Policy 020 §6.6, §9 — 15 Sep 2026).
--
-- Every existing item keeps costBasis '' — not valued yet. The 13 live items all have cost 0 and were
-- shown as gifts; they are not gifts, they are waiting for the financial consultant's opening values.
ALTER TABLE "FixedAsset" ADD COLUMN "costBasis" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "costBasisDocId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "costBasisNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "costUSD" REAL NOT NULL DEFAULT 0;
ALTER TABLE "FixedAsset" ADD COLUMN "costRate" REAL NOT NULL DEFAULT 0;
ALTER TABLE "FixedAsset" ADD COLUMN "valuedById" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "valuedAt" TEXT NOT NULL DEFAULT '';

CREATE TABLE "MissingReceiptDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "payeeName" TEXT NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "paidFor" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "madeOn" TEXT NOT NULL,
    "generatedDocId" TEXT NOT NULL,
    "signedDocId" TEXT NOT NULL DEFAULT '',
    "preparedById" TEXT NOT NULL,
    "preparedAt" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL DEFAULT '',
    "approvedAs" TEXT NOT NULL DEFAULT '',
    "approvedAt" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "MissingReceiptDeclaration_expenseId_key" ON "MissingReceiptDeclaration"("expenseId");
