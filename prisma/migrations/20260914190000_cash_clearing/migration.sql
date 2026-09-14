-- Cash clearing — withdrawals for approved payment requests (Saad, 14 Sep 2026).
-- No existing balance is touched: one account and one cash account are added, both at 0.

ALTER TABLE "CashTopUp" ADD COLUMN "sourceDrawId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CashDraw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceAccountId" TEXT NOT NULL,
    "transitAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amountUSD" REAL NOT NULL,
    "amountSource" REAL NOT NULL,
    "linksJson" TEXT NOT NULL DEFAULT '[]',
    "returnsJson" TEXT NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL DEFAULT '',
    "recordedAt" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL DEFAULT '',
    "journalEntryId" TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO "Account" ("code","name","type","currency","parent","reportingGroup","balance","active")
VALUES ('1127','Cash in Transit — drawn for approved payment requests','Asset','USD','1000','Cash & Cash Equivalents',0,true);

INSERT OR IGNORE INTO "BankAccount" ("id","name","type","currency","accountNo","balance","active","custodianUserId","ledgerCode","openedOn")
VALUES ('ba-cash-transit','Cash in transit — withdrawn for approved payment requests','Cash in transit','USD','transit',0,true,'','1127','');
