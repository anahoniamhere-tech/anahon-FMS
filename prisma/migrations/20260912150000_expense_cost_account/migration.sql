-- What kind of cost a payment request is, said when it is raised (12 Sep 2026).
--
-- Until now the answer only existed after posting, in the journal entry — which is why a
-- salary over the procurement threshold was still asked for three quotations at the form:
-- at that moment nothing on the record knew it was a salary. The voucher now carries the
-- expense account it belongs to, so the same fact serves the procurement rule, the
-- missing-documents counter and the ledger posting instead of being derived three ways.
ALTER TABLE "Expense" ADD COLUMN "costAccountCode" TEXT NOT NULL DEFAULT '';
