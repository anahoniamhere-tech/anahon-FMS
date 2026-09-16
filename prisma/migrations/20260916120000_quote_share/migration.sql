-- Quotation share links (src/quoteShare.ts, QUOTATION-LINKS.md). One row per token ever issued,
-- so a masked log line on the VPS can be traced back and a failed revoke can be retried.
CREATE TABLE "QuoteShare" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "revokedAt" TEXT,
    "revokeReason" TEXT NOT NULL DEFAULT '',
    "revokePending" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "QuoteShare_quotationId_idx" ON "QuoteShare"("quotationId");
