-- Money received or paid outside the bank (Policy 020 §4.4.4, §4.4.5 — Saad, 14 Sep 2026).
-- No existing balance is touched: accounts are added at 0 and 1120 is renamed only.

ALTER TABLE "Project" ADD COLUMN "channelRule" TEXT NOT NULL DEFAULT 'any';
ALTER TABLE "Project" ADD COLUMN "channelRuleSource" TEXT NOT NULL DEFAULT '';

UPDATE "Account" SET "name" = 'Cash awaiting vouchers — drawn or received before the float opened, not cash in the box' WHERE "code" = '1120';

INSERT OR IGNORE INTO "Account" ("code","name","type","currency","parent","reportingGroup","balance","active") VALUES
  ('1141','Off-bank — BOB Finance (USD)','Asset','USD','1000','Cash & Cash Equivalents',0,true),
  ('1142','Off-bank — OMT (USD)','Asset','USD','1000','Cash & Cash Equivalents',0,true),
  ('1143','Off-bank — Whish (USD)','Asset','USD','1000','Cash & Cash Equivalents',0,true),
  ('1144','Off-bank — cheques received, not yet cashed (USD)','Asset','USD','1000','Cash & Cash Equivalents',0,true),
  ('1145','Off-bank — cash received (USD)','Asset','USD','1000','Cash & Cash Equivalents',0,true),
  ('1150','Deposits on their way to the bank','Asset','USD','1000','Cash & Cash Equivalents',0,true),
  ('4900','Other income','Revenue','USD','4000','Other Income',0,true);

-- One account per channel and currency. Another currency is another row here, with its own code.
INSERT OR IGNORE INTO "BankAccount" ("id","name","type","currency","accountNo","balance","active","custodianUserId","ledgerCode","openedOn") VALUES
  ('ba-ch-bob-usd','BOB Finance (USD)','Off-bank channel','USD','BOB Finance',0,true,'','1141',''),
  ('ba-ch-omt-usd','OMT (USD)','Off-bank channel','USD','OMT',0,true,'','1142',''),
  ('ba-ch-whish-usd','Whish (USD)','Off-bank channel','USD','Whish',0,true,'','1143',''),
  ('ba-ch-cheques-usd','Cheques received (USD)','Off-bank channel','USD','Cheque',0,true,'','1144',''),
  ('ba-ch-cash-usd','Cash received (USD)','Off-bank channel','USD','Cash',0,true,'','1145','');

ALTER TABLE "BankTransaction" ADD COLUMN "evidenceRef" TEXT NOT NULL DEFAULT '';
