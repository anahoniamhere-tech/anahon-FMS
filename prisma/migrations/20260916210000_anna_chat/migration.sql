-- Anna's saved conversations (drafts/anna-assistant-plan.md, decision B). Private to their owner.
CREATE TABLE "AnnaChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "messages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
CREATE INDEX "AnnaChat_userId_idx" ON "AnnaChat"("userId");
