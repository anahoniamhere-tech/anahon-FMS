-- Editorial pipeline (Policies 002 & 005): every piece of content is assigned in a daily
-- production meeting, produced, independently fact-checked with a source log (checker must
-- differ from author), dual-approved by the Production Manager AND Programs Director (two
-- distinct users), legally attested when flagged, and published carrying the fact-checked
-- tag; corrections append after publish with nature and date. The register enforces the
-- signed policies — it does not invent workflow.
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'Post',
    "stream" TEXT NOT NULL DEFAULT '',
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "brief" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Assigned',
    "assigneeUserId" TEXT NOT NULL DEFAULT '',
    "dueDate" TEXT NOT NULL DEFAULT '',
    "assignedMeetingDate" TEXT NOT NULL DEFAULT '',
    "reviewedMeetingDate" TEXT NOT NULL DEFAULT '',
    "factCheckerUserId" TEXT NOT NULL DEFAULT '',
    "factCheckJson" TEXT NOT NULL DEFAULT '[]',
    "factCheckPassedAt" TEXT NOT NULL DEFAULT '',
    "checksJson" TEXT NOT NULL DEFAULT '{}',
    "legalFlag" BOOLEAN NOT NULL DEFAULT false,
    "legalReviewedBy" TEXT NOT NULL DEFAULT '',
    "legalReviewNote" TEXT NOT NULL DEFAULT '',
    "legalRecordedBy" TEXT NOT NULL DEFAULT '',
    "legalRecordedAt" TEXT NOT NULL DEFAULT '',
    "pmApprovedBy" TEXT NOT NULL DEFAULT '',
    "pmApprovedAt" TEXT NOT NULL DEFAULT '',
    "pdApprovedBy" TEXT NOT NULL DEFAULT '',
    "pdApprovedAt" TEXT NOT NULL DEFAULT '',
    "factCheckTag" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TEXT NOT NULL DEFAULT '',
    "correctionsJson" TEXT NOT NULL DEFAULT '[]',
    "created_at" TEXT NOT NULL
);
