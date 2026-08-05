-- Bank evidence for quotations: the statement deposit that settled a client quote.
ALTER TABLE "Quotation" ADD COLUMN "paymentTxId" TEXT NOT NULL DEFAULT '';
