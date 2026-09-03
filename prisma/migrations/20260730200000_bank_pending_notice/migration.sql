-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "voucherNo" TEXT,
    "projectId" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "noticeRef" TEXT
);
INSERT INTO "new_BankTransaction" ("amount", "bankAccountId", "date", "description", "id", "projectId", "reconciled", "type", "voucherNo") SELECT "amount", "bankAccountId", "date", "description", "id", "projectId", "reconciled", "type", "voucherNo" FROM "BankTransaction";
DROP TABLE "BankTransaction";
ALTER TABLE "new_BankTransaction" RENAME TO "BankTransaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

