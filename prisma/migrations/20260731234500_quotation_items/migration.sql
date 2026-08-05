-- Quotation line items + standard terms (from the real AnaHon Production template in Drive)
ALTER TABLE "Quotation" ADD COLUMN "itemsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Quotation" ADD COLUMN "termsJson" TEXT NOT NULL DEFAULT '{}';
