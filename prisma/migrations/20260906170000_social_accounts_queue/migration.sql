-- Social desk rebuilt (6 Sep 2026): Pages connected through Meta login, and a publishing queue
-- the server drains itself. The Postiz link column from earlier the same day goes with it.
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "picture" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "igId" TEXT NOT NULL DEFAULT '',
    "igUsername" TEXT NOT NULL DEFAULT '',
    "connectedBy" TEXT NOT NULL DEFAULT '',
    "connectedAt" TEXT NOT NULL,
    "tokenCheckedAt" TEXT NOT NULL DEFAULT '',
    "tokenValid" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "publishAt" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT NOT NULL DEFAULT '',
    "postId" TEXT NOT NULL DEFAULT '',
    "permalink" TEXT NOT NULL DEFAULT '',
    "statsJson" TEXT NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX "SocialPost_state_publishAt_idx" ON "SocialPost"("state", "publishAt");

ALTER TABLE "ContentItem" DROP COLUMN "postizJson";
