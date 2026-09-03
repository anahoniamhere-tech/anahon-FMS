-- CreateTable
CREATE TABLE "NetworkContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL DEFAULT '',
    "org" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "links" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'Participant',
    "metAt" TEXT NOT NULL DEFAULT '',
    "metOn" TEXT NOT NULL DEFAULT '',
    "stream" TEXT NOT NULL DEFAULT '',
    "followUp" TEXT NOT NULL DEFAULT '',
    "followUpBy" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'New',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Other',
    "purpose" TEXT NOT NULL DEFAULT '',
    "stream" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Evaluating',
    "pricing" TEXT NOT NULL DEFAULT 'Free',
    "owner" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "addedOn" TEXT NOT NULL DEFAULT '',
    "reviewBy" TEXT NOT NULL DEFAULT '',
    "subscriptionId" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "salary" REAL NOT NULL,
    "allowance" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userEmail" TEXT NOT NULL DEFAULT '',
    "bankAccountId" TEXT
);
INSERT INTO "new_Employee" ("active", "allowance", "bankAccountId", "contractType", "id", "name", "paymentMethod", "position", "salary") SELECT "active", "allowance", "bankAccountId", "contractType", "id", "name", "paymentMethod", "position", "salary" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voucherNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "rate" REAL NOT NULL,
    "convertedAmount" REAL NOT NULL,
    "whtAmount" REAL NOT NULL DEFAULT 0,
    "netAmount" REAL NOT NULL DEFAULT 0,
    "requestorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "created_at" TEXT NOT NULL,
    "approved_at" TEXT,
    "paid_at" TEXT,
    "procurementId" TEXT NOT NULL DEFAULT '',
    "commentsJson" TEXT NOT NULL,
    "allocationsJson" TEXT NOT NULL DEFAULT '[]',
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Expense" ("amount", "approved_at", "budgetLineId", "commentsJson", "convertedAmount", "created_at", "currency", "hasAttachment", "id", "paid_at", "paymentMethod", "paymentRef", "procurementId", "projectId", "purpose", "rate", "requestorId", "status", "title", "vendorId", "voucherNo") SELECT "amount", "approved_at", "budgetLineId", "commentsJson", "convertedAmount", "created_at", "currency", "hasAttachment", "id", "paid_at", "paymentMethod", "paymentRef", "procurementId", "projectId", "purpose", "rate", "requestorId", "status", "title", "vendorId", "voucherNo" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE UNIQUE INDEX "Expense_voucherNo_key" ON "Expense"("voucherNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "NetworkContact_metAt_idx" ON "NetworkContact"("metAt");

-- CreateIndex
CREATE INDEX "Tool_category_idx" ON "Tool"("category");

