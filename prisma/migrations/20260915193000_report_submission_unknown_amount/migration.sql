-- A submitted amount may be unknown (null, with a note saying why) — never a typed 0 — and a
-- submission may leave its obligation open (15 Sep 2026). SQLite rebuild to relax NOT NULL; the
-- table held no rows on the NAS.
CREATE TABLE "new_DonorReportSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL DEFAULT '',
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "submittedOn" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "asSubmittedNative" REAL,
    "usdPerUnit" REAL,
    "asSubmittedUSD" REAL,
    "asSubmittedJson" TEXT NOT NULL DEFAULT '{}',
    "basis" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "completesObligation" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_DonorReportSubmission" ("id","projectId","activityId","periodStart","periodEnd","submittedOn","evidence","currency","asSubmittedNative","usdPerUnit","asSubmittedUSD","asSubmittedJson","basis","recordedAt","recordedById")
SELECT "id","projectId","activityId","periodStart","periodEnd","submittedOn","evidence","currency","asSubmittedNative","usdPerUnit","asSubmittedUSD","asSubmittedJson","basis","recordedAt","recordedById" FROM "DonorReportSubmission";
DROP TABLE "DonorReportSubmission";
ALTER TABLE "new_DonorReportSubmission" RENAME TO "DonorReportSubmission";
CREATE INDEX "DonorReportSubmission_projectId_idx" ON "DonorReportSubmission"("projectId");
