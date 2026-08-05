-- Project.stream: which of AnaHon's five programs this project belongs to
ALTER TABLE "Project" ADD COLUMN "stream" TEXT NOT NULL DEFAULT '';

-- Opportunity: the funding funnel BEFORE money lands. Separate table by design —
-- never joined into financial reports or balances.
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "donorId" TEXT NOT NULL DEFAULT '',
    "stream" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deadline" TEXT NOT NULL DEFAULT '',
    "decisionDate" TEXT NOT NULL DEFAULT '',
    "renewalOfProjectId" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT ''
);
