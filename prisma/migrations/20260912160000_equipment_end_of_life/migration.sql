-- What became of an item, replacing "written off" (12 Sep 2026).
--
-- "Written off" was one word for six different things. Sold, given away, thrown away, lost,
-- stolen and returned to its owner are not the same event, and an auditor asking where EQ-007
-- went deserves the real answer. Resources and Assets Policy 017, approved today, also needs
-- two signatures — the Executive Director and the Finance Officer — before the organisation
-- gives up something it owns, so a disposal is proposed by one of them and confirmed by the
-- other. Lost, stolen and returned are events, not decisions: one person records them.
ALTER TABLE "FixedAsset" ADD COLUMN "endKind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "endAt" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "endNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "endAmount" REAL;
ALTER TABLE "FixedAsset" ADD COLUMN "endBy" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "endAs" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "endConfirmedBy" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "endConfirmedAs" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "endConfirmedAt" TEXT;

-- Anything already written off becomes the closest of the new statuses — thrown away, which is
-- what a write-off nearly always meant — keeping the person's own words exactly as they typed
-- them, with a line saying the record predates the two signatures rather than pretending it
-- had them. It counts as confirmed because it was already in force before today.
UPDATE "FixedAsset"
   SET "endKind" = 'broken',
       "endAt" = substr("writtenOffAt", 1, 10),
       "endNote" = CASE WHEN "writeOffReason" = '' THEN 'Written off — registered in error.'
                        ELSE "writeOffReason" END
                   || ' (Recorded as a write-off before Resources and Assets Policy 017 asked for two approvals; migrated 12 September 2026.)',
       "endBy" = "writtenOffBy",
       "endAs" = 'migrated',
       "endConfirmedBy" = "writtenOffBy",
       "endConfirmedAs" = 'migrated',
       "endConfirmedAt" = "writtenOffAt"
 WHERE "writtenOffAt" IS NOT NULL;

-- The writtenOff* columns are deliberately NOT dropped. Nothing reads them any more, and the
-- schema marks them superseded — but the original three values stay on disk exactly as they
-- were written, so the migration above can be checked against its own source.
