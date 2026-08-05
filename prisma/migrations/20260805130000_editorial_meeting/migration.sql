-- Policy 002 defines the weekly editorial meeting (Programs Director chairs; Production
-- Manager and Project Officers attend; agenda reviews last week and plans the coming one)
-- and the daily production meeting. The content register derives the agenda; this table
-- records what derivation can't know — attendance, the week's direction, decisions taken.
CREATE TABLE "EditorialMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'Weekly Editorial',
    "date" TEXT NOT NULL,
    "attendeesJson" TEXT NOT NULL DEFAULT '[]',
    "direction" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);
CREATE UNIQUE INDEX "EditorialMeeting_kind_date_key" ON "EditorialMeeting"("kind", "date");
