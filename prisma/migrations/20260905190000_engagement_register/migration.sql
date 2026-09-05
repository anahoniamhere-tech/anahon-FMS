-- The events and engagements register.
--
-- Until now an event existed only as free text repeated on each person's contact row:
-- "ICFJ AI Boot Camp — Istanbul", typed four times, with no dates, no cost, no record of
-- what came of it, and no way to list what we attended this year. Training we deliver
-- lived somewhere else entirely, as timeline steps inside a project, so the two never met.
--
-- One record covers both directions — `ourPart` says whether we attended or delivered —
-- and `projectId` is nullable on purpose: an engagement that belongs to no project is
-- simply an engagement, which is most of the useful ones.
CREATE TABLE "Engagement" (
  "id"         TEXT PRIMARY KEY,
  "title"      TEXT NOT NULL,
  "kind"       TEXT NOT NULL DEFAULT 'Conference',
  "ourPart"    TEXT NOT NULL DEFAULT 'Attended',
  "org"        TEXT NOT NULL DEFAULT '',
  "place"      TEXT NOT NULL DEFAULT '',
  "startDate"  TEXT NOT NULL DEFAULT '',
  "endDate"    TEXT NOT NULL DEFAULT '',
  "stream"     TEXT NOT NULL DEFAULT '',
  -- The project this belongs to, when it belongs to one. Null is the normal case.
  "projectId"  TEXT,
  "outcome"    TEXT NOT NULL DEFAULT '',
  "notes"      TEXT NOT NULL DEFAULT '',
  "created_at" TEXT NOT NULL
);
CREATE INDEX "Engagement_startDate_idx" ON "Engagement"("startDate");
CREATE INDEX "Engagement_projectId_idx" ON "Engagement"("projectId");

-- A contact now points at the engagement instead of repeating its name. metAt stays as
-- the label for rows written before this, and for a meeting that never became a record.
ALTER TABLE "NetworkContact" ADD COLUMN "engagementId" TEXT;
CREATE INDEX "NetworkContact_engagementId_idx" ON "NetworkContact"("engagementId");
