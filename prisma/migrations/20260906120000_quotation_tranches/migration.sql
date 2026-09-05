-- A quotation can be settled by more than one deposit.
--
-- `paymentTxId` held exactly one bank line, so a production client paying half up front
-- and half on delivery could not be recorded: the second deposit had nowhere to go, and
-- the first one made the quote "Paid" while most of the money was still owed. The link
-- becomes a list of bank-line ids, in the order they were linked.
--
-- No amounts are stored here. A tranche IS its bank line, so the figure lives where the
-- evidence lives and cannot be typed over — the same discipline the single link had.
ALTER TABLE "Quotation" ADD COLUMN "paymentTxIdsJson" TEXT NOT NULL DEFAULT '[]';

-- Carry the existing settlements over as one-tranche lists. Ids are `btx-…` — no quotes
-- or backslashes to escape — so building the JSON by concatenation is safe here.
UPDATE "Quotation" SET "paymentTxIdsJson" = '["' || "paymentTxId" || '"]' WHERE "paymentTxId" <> '';

-- Dropped rather than left behind: a column nothing reads is a column someone eventually
-- writes, and then two answers to "was this paid?" disagree.
ALTER TABLE "Quotation" DROP COLUMN "paymentTxId";
