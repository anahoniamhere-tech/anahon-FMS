-- Who a quotation is issued as (AnaHon Production or iContent Studio) and a quotation-level discount
-- (15 Sep 2026). Existing quotations stay AnaHon with no discount; their amounts do not change.
ALTER TABLE "Quotation" ADD COLUMN "issuedAs" TEXT NOT NULL DEFAULT 'anahon';
ALTER TABLE "Quotation" ADD COLUMN "discountAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN "discountLabel" TEXT NOT NULL DEFAULT '';
