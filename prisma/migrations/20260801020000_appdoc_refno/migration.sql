-- Unique document reference for every registered document. Auto-assigned;
-- editable only by the master account.
ALTER TABLE "AppDoc" ADD COLUMN "refNo" TEXT;
CREATE UNIQUE INDEX "AppDoc_refNo_key" ON "AppDoc"("refNo");
