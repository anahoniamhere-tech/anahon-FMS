-- The stored social series (7 Sep 2026): one row per platform per period, written by hand or off
-- an export, never by the live Meta pull — Meta refuses any page-insights window over 93 days, so
-- lifetime reach had no home in the app and was being quoted to funders from PDFs in Drive.
-- Counts are nullable: a platform that does not report a metric must read "—", never 0.
CREATE TABLE "SocialPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "followers" INTEGER,
    "followersGained" INTEGER,
    "reach" INTEGER,
    "impressions" INTEGER,
    "views" INTEGER,
    "interactions" INTEGER,
    "basis" TEXT NOT NULL DEFAULT 'unknown',
    "source" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);
