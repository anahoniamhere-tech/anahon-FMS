-- Petty cash float — draft Policy 020 §4.4, Saad's decisions of 14 Sep 2026.
-- No UPDATE below touches a balance. The only rows given a balance are new, and they open at 0:
-- the opening float is the first physical count, recorded afterwards.

ALTER TABLE "BankAccount" ADD COLUMN "custodianUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BankAccount" ADD COLUMN "ledgerCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BankAccount" ADD COLUMN "openedOn" TEXT NOT NULL DEFAULT '';

-- Late records (Saad, 14 Sep 2026): every entry keeps its true date AND when and by whom it was
-- recorded. Empty on everything written before today — unknown, not invented.
ALTER TABLE "JournalEntry" ADD COLUMN "recordedAt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JournalEntry" ADD COLUMN "recordedById" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BankTransaction" ADD COLUMN "recordedAt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BankTransaction" ADD COLUMN "recordedById" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CashCount" ADD COLUMN "bankAccountId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CashCount" ADD COLUMN "counterUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CashCount" ADD COLUMN "expectedUSD" REAL NOT NULL DEFAULT 0;
ALTER TABLE "CashCount" ADD COLUMN "withoutNotice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CashCount" ADD COLUMN "custodianPresent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CashCount" ADD COLUMN "explanation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CashCount" ADD COLUMN "journalEntryId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CashTopUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountUSD" REAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "raisedByName" TEXT NOT NULL DEFAULT '',
    "raisedAt" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL DEFAULT '',
    "decidedByName" TEXT NOT NULL DEFAULT '',
    "decidedAt" TEXT NOT NULL DEFAULT '',
    "queryNote" TEXT NOT NULL DEFAULT '',
    "journalEntryId" TEXT NOT NULL DEFAULT ''
);

-- The float's own ledger account, and where count differences wait for review.
INSERT OR IGNORE INTO "Account" ("code","name","type","currency","parent","reportingGroup","balance","active")
VALUES ('1125','Petty Cash Float (locked box)','Asset','USD','1000','Cash & Cash Equivalents',0,true);
INSERT OR IGNORE INTO "Account" ("code","name","type","currency","parent","reportingGroup","balance","active")
VALUES ('2920','Petty Cash Count Differences — pending Executive Director review','Liability','USD',NULL,'Suspense',0,true);

-- 1120 keeps every posting and its balance; only its name now says what it is.
UPDATE "Account" SET "name" = 'Cash clearing — historical, to be reconciled by the external consultant' WHERE "code" = '1120';

-- The four "Petty Cash" rows were the off-bank channels. Retyped FIRST, so the box inserted
-- below is the only account of the float type.
UPDATE "BankAccount" SET "type" = 'Off-bank channel', "ledgerCode" = '1120' WHERE "type" = 'Petty Cash';
UPDATE "BankAccount" SET "ledgerCode" = '1100' WHERE "id" = 'ba-blom-usd';
UPDATE "BankAccount" SET "ledgerCode" = '1110' WHERE "id" = 'ba-blom-eur';

-- The box. Custodian is the Finance Officer, resolved by seat at migration time rather than
-- a user id typed into SQL.
INSERT OR IGNORE INTO "BankAccount" ("id","name","type","currency","accountNo","balance","active","custodianUserId","ledgerCode")
VALUES ('ba-petty-float','Petty cash float — locked box, held by the Finance Officer','Petty Cash','USD','box',0,true,
  COALESCE((SELECT "id" FROM "User" WHERE "role" = 'Finance Officer' AND "active" = true ORDER BY "id" LIMIT 1), ''),
  '1125');
