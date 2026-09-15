-- A donor report as submitted: append-only, one row per submission (a resubmission is a new row).
CREATE TABLE "DonorReportSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL DEFAULT '',
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "submittedOn" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "asSubmittedUSD" REAL NOT NULL,
    "asSubmittedJson" TEXT NOT NULL DEFAULT '{}',
    "basis" TEXT NOT NULL,
    "recordedAt" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX "DonorReportSubmission_projectId_idx" ON "DonorReportSubmission"("projectId");
