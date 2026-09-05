-- Phase 6: the reminder ledger.
--
-- Without a record of what was already sent, a nightly push re-creates the same event
-- every night: sixty duplicates in a fortnight and a calendar nobody trusts again. One
-- row per (person, desk item) remembers the Google event it became, so the next run
-- updates that event instead of making another, and cancels it when the work leaves the
-- desk. `state` is 'active' or 'cancelled'; a cancelled row is kept, not deleted, so the
-- history of what was pushed survives.
CREATE TABLE "Reminder" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "itemId"        TEXT NOT NULL,
  "googleEventId" TEXT,
  "calendarId"    TEXT NOT NULL DEFAULT 'primary',
  "title"         TEXT NOT NULL,
  "whenDate"      TEXT NOT NULL,
  "state"         TEXT NOT NULL DEFAULT 'active',
  "createdAt"     TEXT NOT NULL,
  "updatedAt"     TEXT NOT NULL
);
CREATE UNIQUE INDEX "Reminder_userId_itemId_key" ON "Reminder"("userId", "itemId");
CREATE INDEX "Reminder_userId_state_idx" ON "Reminder"("userId", "state");
