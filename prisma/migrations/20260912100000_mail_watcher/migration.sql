-- The read-only Gmail watcher's landing table. Minimum fields on purpose:
-- sender, subject, date and a link. No body, no snippet, no attachments.
CREATE TABLE "MailHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'mail',
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TEXT NOT NULL,
    "link" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "assigneeUserId" TEXT,
    "createdAt" TEXT NOT NULL
);
CREATE UNIQUE INDEX "MailHit_messageId_key" ON "MailHit"("messageId");
CREATE INDEX "MailHit_status_idx" ON "MailHit"("status");
