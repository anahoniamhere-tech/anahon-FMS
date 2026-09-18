-- A private expiring link to an official paper or a filed policy PDF.
CREATE TABLE "PaperShare" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "docId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "revokedAt" TEXT,
    "revokeReason" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX "PaperShare_docId_idx" ON "PaperShare"("docId");
