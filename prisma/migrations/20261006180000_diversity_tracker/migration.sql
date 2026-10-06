-- The diversity tracker (Editorial Standards Handbook ed.7, live 6 Oct 2026):
-- P3 §4.1 step 2 logs every piece, §2.5 "checked, not assumed", §4.3 reviews it monthly
-- and plans a major local issue as a coverage package.
--
-- Its own table rather than columns on ContentItem: half the history it inherits from the
-- FPU sheet is iContent reels published on Instagram and Facebook, which never went through
-- the editorial chain and must not be invented as register entries to hold a log row.
CREATE TABLE "DiversityEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    -- the newsroom piece this logs, when there is one; NULL for imported history
    "contentItemId" TEXT,
    "loggedOn" TEXT NOT NULL,                      -- YYYY-MM-DD, the month the review reads
    "title" TEXT NOT NULL DEFAULT '',              -- history only; a linked piece carries its own
    "description" TEXT NOT NULL DEFAULT '',
    "programmeText" TEXT NOT NULL DEFAULT '',      -- the sheet's own words ("AnaHon - SKF") — never forced onto a STREAM
    "contentTypeText" TEXT NOT NULL DEFAULT '',
    "authorText" TEXT NOT NULL DEFAULT '',
    "formatText" TEXT NOT NULL DEFAULT '',
    "statusText" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    -- §4.1 step 2, the logged facts
    "mainSubject" TEXT NOT NULL DEFAULT '',        -- woman | man | mixed | not-person
    "mentionedWomen" TEXT NOT NULL DEFAULT '',     -- '' | none | yes | a whole number
    "mentionedMen" TEXT NOT NULL DEFAULT '',
    "expertWomen" TEXT NOT NULL DEFAULT '',
    "expertMen" TEXT NOT NULL DEFAULT '',
    "groupsJson" TEXT NOT NULL DEFAULT '[]',       -- VULNERABLE_GROUPS keys, or ["none"] for a recorded none
    "notes" TEXT NOT NULL DEFAULT '',
    "imported" BOOLEAN NOT NULL DEFAULT false,     -- came from the FPU sheet, not typed at the desk
    "recordedBy" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);
-- One log per piece: the gate asks "does this piece have one", which only answers if there is at most one.
CREATE UNIQUE INDEX "DiversityEntry_contentItemId_key" ON "DiversityEntry"("contentItemId");
CREATE INDEX "DiversityEntry_loggedOn_idx" ON "DiversityEntry"("loggedOn");

-- §4.3: a major local issue is planned as a package of angles, not a single piece.
-- No gate anywhere refuses a piece for lacking one — the policy plans, it does not refuse.
CREATE TABLE "CoveragePackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "issue" TEXT NOT NULL DEFAULT '',              -- the issue in one sentence
    "stream" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Planned',      -- Planned | Running | Done
    "anglesJson" TEXT NOT NULL DEFAULT '[]',       -- [{angle, format, contentItemId}] — seeded with §4.3's four
    "createdBy" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);

-- A piece may belong to one package.
ALTER TABLE "ContentItem" ADD COLUMN "packageId" TEXT NOT NULL DEFAULT '';
-- §4.3: the one gap the planning meeting names for the month ahead.
ALTER TABLE "EditorialMeeting" ADD COLUMN "diversityGap" TEXT NOT NULL DEFAULT '';
