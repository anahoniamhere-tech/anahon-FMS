-- An item registered in error, and the two honest ways out of it (12 Sep 2026).
--
-- Delete is for a mistake nobody has confirmed: the row goes, but its number is kept.
-- Write-off is for an item somebody physically confirmed — that confirmation is evidence a
-- second person saw the thing, and evidence is not deleted. It is marked, with a reason, and
-- left in the record where anyone can still read it.
ALTER TABLE "FixedAsset" ADD COLUMN "writtenOffAt" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "writtenOffBy" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "writeOffReason" TEXT NOT NULL DEFAULT '';

-- What the register has removed. It exists so a sticker number is never issued twice: the
-- series counts from the highest tag EVER issued, and a deleted row still counts. It also
-- means a deletion leaves something behind besides a line in the audit log.
CREATE TABLE "RemovedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "removedAt" TEXT NOT NULL,
    "removedBy" TEXT NOT NULL,
    "removedByName" TEXT NOT NULL
);
CREATE UNIQUE INDEX "RemovedAsset_tag_key" ON "RemovedAsset"("tag");
