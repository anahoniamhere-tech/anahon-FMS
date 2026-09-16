-- Feature requests (drafts/anna-assistant-plan.md §3). Anna drafts them; a person saves them.
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "need" TEXT NOT NULL,
    "door" TEXT NOT NULL DEFAULT '',
    "example" TEXT NOT NULL DEFAULT '',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'New',
    "room" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdName" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
CREATE INDEX "FeatureRequest_createdBy_idx" ON "FeatureRequest"("createdBy");
CREATE INDEX "FeatureRequest_status_idx" ON "FeatureRequest"("status");
