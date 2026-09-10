-- The receipt number becomes a field of the record instead of living only inside the
-- filename and the HTML body. Existing receipts are backfilled from their filenames
-- (2026_RECEIPT_RC-001-2026_....html), so the series continues unbroken.
ALTER TABLE "AppDoc" ADD COLUMN "receiptNo" TEXT;
ALTER TABLE "AppDoc" ADD COLUMN "receiptSigned" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AppDoc"
   SET "receiptNo" = replace(substr("filename", instr("filename", 'RC-'), 11), '-2', '/2')
 WHERE "category" = 'Cash Receipt' AND instr("filename", 'RC-') > 0;
