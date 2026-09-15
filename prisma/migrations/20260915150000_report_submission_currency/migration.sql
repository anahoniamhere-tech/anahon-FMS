-- A donor report's figure is kept in the currency it was reported in (Saad, 15 Sep 2026).
-- asSubmittedUSD becomes derived and nullable; SQLite needs a rebuild to relax NOT NULL.
-- Existing rows (none on 15 Sep 2026) keep their figure as a USD report.
CREATE TABLE "new_DonorReportSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL DEFAULT '',
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "submittedOn" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "asSubmittedNative" REAL NOT NULL,
    "usdPerUnit" REAL,
    "asSubmittedUSD" REAL,
    "asSubmittedJson" TEXT NOT NULL DEFAULT '{}',
    "basis" TEXT NOT NULL,
    "recordedAt" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_DonorReportSubmission" ("id","projectId","activityId","periodStart","periodEnd","submittedOn","evidence","currency","asSubmittedNative","usdPerUnit","asSubmittedUSD","asSubmittedJson","basis","recordedAt","recordedById")
SELECT "id","projectId","activityId","periodStart","periodEnd","submittedOn","evidence",'USD',"asSubmittedUSD",1,"asSubmittedUSD","asSubmittedJson","basis","recordedAt","recordedById" FROM "DonorReportSubmission";
DROP TABLE "DonorReportSubmission";
ALTER TABLE "new_DonorReportSubmission" RENAME TO "DonorReportSubmission";
CREATE INDEX "DonorReportSubmission_projectId_idx" ON "DonorReportSubmission"("projectId");
