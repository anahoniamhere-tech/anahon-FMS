-- Web push: "it is your turn", on the phone.
--
-- Two changes, one purpose. The Reminder ledger already stops a nightly run re-creating
-- the same calendar event; push needs the same protection for a different channel, and
-- the two must not collide — the calendar cannot carry an undated voucher and a push
-- can, so the same desk item is legitimately owed on both at once. `channel` makes that
-- expressible; the unique key grows to include it. The 66 rows already in the table are
-- calendar rows and the default says so, so nothing is rewritten.
ALTER TABLE "Reminder" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'calendar';
DROP INDEX "Reminder_userId_itemId_key";
CREATE UNIQUE INDEX "Reminder_userId_itemId_channel_key" ON "Reminder"("userId", "itemId", "channel");

-- One row per install that agreed to be notified. The endpoint is the push service's
-- address for that install and is the row's real identity: reinstalling the app produces
-- a new endpoint, and the old row stays until the service answers 404 or 410 and the
-- sender deletes it. p256dh and auth are that install's public key material — they
-- encrypt the payload to the device, and are useless to anyone else.
CREATE TABLE "PushSubscription" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "endpoint"  TEXT NOT NULL,
  "p256dh"    TEXT NOT NULL,
  "auth"      TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
