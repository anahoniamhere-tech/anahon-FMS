-- Single-source waiver: fewer than 3 quotations allowed only with a written justification.
ALTER TABLE "Procurement" ADD COLUMN "singleSource" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Procurement" ADD COLUMN "approvedBy" TEXT NOT NULL DEFAULT '';
-- Each >USD 300 voucher names the procurement that authorises it (was: any approved RFQ
-- on the project opened the door for every voucher on that project).
ALTER TABLE "Expense" ADD COLUMN "procurementId" TEXT NOT NULL DEFAULT '';
