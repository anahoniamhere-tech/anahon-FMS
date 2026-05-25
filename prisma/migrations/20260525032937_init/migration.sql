-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Account" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "parent" TEXT,
    "reportingGroup" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "notes" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "budgetUSD" REAL NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "fundingType" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "allocatedUSD" REAL NOT NULL,
    "actualUSD" REAL NOT NULL DEFAULT 0,
    "committedUSD" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "bankInfo" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "declarationSigned" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Expense" (
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
    "requestorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "created_at" TEXT NOT NULL,
    "approved_at" TEXT,
    "paid_at" TEXT,
    "commentsJson" TEXT NOT NULL,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Procurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "quotationsJson" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "conflictDeclared" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "balance" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "voucherNo" TEXT
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journal" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "itemsJson" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "salary" REAL NOT NULL,
    "allowance" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "allocationsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvedBy" TEXT
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "fundingProjectId" TEXT NOT NULL,
    "purchaseDate" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "custodian" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "currentBookValue" REAL NOT NULL,
    "depreciationMethod" TEXT NOT NULL,
    "accumulatedDepreciation" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "PartnerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerName" TEXT NOT NULL,
    "capitalBalance" REAL NOT NULL,
    "loansToCompany" REAL NOT NULL,
    "drawingsBalance" REAL NOT NULL,
    "currentAccountBalance" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "AppDoc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeStr" TEXT NOT NULL,
    "base64" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "linkedRecordType" TEXT NOT NULL,
    "linkedRecordId" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ComplianceTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'settings',
    "profileName" TEXT NOT NULL,
    "legalEntity" TEXT NOT NULL,
    "vesselCode" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "fiscalYearEnd" TEXT NOT NULL,
    "vatRate" REAL NOT NULL,
    "approvalThresholdUSD" REAL NOT NULL,
    "allowSubProjectAllocation" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "FxRates" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'rates',
    "EUR" REAL NOT NULL,
    "LBP" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_voucherNo_key" ON "Expense"("voucherNo");
