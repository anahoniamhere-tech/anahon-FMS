-- Payments to protected sources (Policy 010 §6, 15 Sep 2026). The voucher carries a code name; the
-- identity lives in SourceFile, opened only by the ED and the FO.
ALTER TABLE "Expense" ADD COLUMN "confidential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "sourceId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeName" TEXT NOT NULL,
    "realName" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "idDocument" TEXT NOT NULL DEFAULT '',
    "sanctionsResult" TEXT NOT NULL DEFAULT '',
    "sanctionsNote" TEXT NOT NULL DEFAULT '',
    "sanctionsCheckedAt" TEXT NOT NULL DEFAULT '',
    "sanctionsCheckedBy" TEXT NOT NULL DEFAULT '',
    "docsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "SourceFile_codeName_key" ON "SourceFile"("codeName");
