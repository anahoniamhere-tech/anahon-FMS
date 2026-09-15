-- Policy 001 §7.1 — the integrity register. Append-only by construction: IntegrityEntry is
-- written once and never updated (even "closed" is a line, not a column), and every later
-- fact is a row in IntegrityLine. Private to the Executive Director; never in loadState.
CREATE TABLE "IntegrityEntry" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "ref"             TEXT NOT NULL,
    "dateReceived"    TEXT NOT NULL,
    "category"        TEXT NOT NULL,
    "summary"         TEXT NOT NULL,
    "peopleConcerned" TEXT NOT NULL,
    "touchesED"       BOOLEAN NOT NULL DEFAULT false,
    "reporterName"    TEXT NOT NULL DEFAULT '',
    "createdBy"       TEXT NOT NULL,
    "createdAt"       TEXT NOT NULL
);
CREATE UNIQUE INDEX "IntegrityEntry_ref_key" ON "IntegrityEntry"("ref");

CREATE TABLE "IntegrityLine" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "entryId"   TEXT NOT NULL,
    "at"        TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "byUserId"  TEXT NOT NULL,
    "byName"    TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);
CREATE INDEX "IntegrityLine_entryId_idx" ON "IntegrityLine"("entryId");
