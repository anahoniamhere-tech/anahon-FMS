-- The external consultant's reconciliations and month packs (Policy 020 §4.3, §12.1, §12.4). Adds two tables only.
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "statementClosing" REAL NOT NULL,
    "bookClosing" REAL NOT NULL,
    "difference" REAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "preparedById" TEXT NOT NULL,
    "preparedByName" TEXT NOT NULL DEFAULT '',
    "preparedAt" TEXT NOT NULL,
    "reviewDocId" TEXT NOT NULL DEFAULT '',
    "reviewedOn" TEXT NOT NULL DEFAULT '',
    "reviewRecordedById" TEXT NOT NULL DEFAULT '',
    "reviewRecordedAt" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "BankReconciliation_accountId_month_key" ON "BankReconciliation"("accountId", "month");

CREATE TABLE "ConsultantPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "producedAt" TEXT NOT NULL,
    "producedById" TEXT NOT NULL,
    "producedByName" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentsJson" TEXT NOT NULL DEFAULT '[]'
);
