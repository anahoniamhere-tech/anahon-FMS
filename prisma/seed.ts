import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Load the default database structure to fall back on
const DEFAULT_DATABASE = {
  users: [
    // POLICY 4.2 — Authorized signatories. Saad Matar is Primary (Program Director),
    // Marwan El Cheikh is Secondary (Finance Officer). No account holds both authorities:
    // Policy 4.3 forbids one person initiating, approving, and executing the same transaction.
    { id: "u-1", name: "Saad Matar", email: "anahoniamhere@gmail.com", role: "Program Director", active: true },
    { id: "u-2", name: "Marwan El Cheikh", email: "marwan@anahon.org", role: "Finance Officer", active: true },
    // Capital partner (equity accounts 3200/3400, pt-2) — not an officer under Policy 4.2, so no approval authority.
    { id: "u-3", name: "Samer Ghamrawi", email: "samer@anahon.org", role: "Auditor / Read-Only Reviewer", active: true },
    { id: "u-4", name: "Tarek Rifai", email: "tarek@anahon.org", role: "Project Lead", active: true },
    { id: "u-5", name: "Mona Merhabi", email: "mona@anahon.org", role: "HR / Payroll Officer", active: true },
    { id: "u-6", name: "External Auditor", email: "auditor@deloitte.com", role: "Auditor / Read-Only Reviewer", active: true }
  ],
  orgSettings: {
    profileName: "AnaHon Media Platform",
    legalEntity: "Lebanese Civil Partnership / Civil Company",
    vesselCode: "Tripoli-A109",
    baseCurrency: "USD",
    fiscalYearEnd: "12-31",
    vatRate: 11,
    approvalThresholdUSD: 5000,
    allowSubProjectAllocation: true
  },
  fxRates: {
    EUR: 1.08,
    LBP: 0.000011 // Fixed rate: ~90,000 LBP to 1 USD
  },
  accounts: [
    { code: "1000", name: "Assets", type: "Asset", currency: "USD", reportingGroup: "Non-current Assets", balance: 0, active: true },
    { code: "1100", name: "Bank - USD (Audi Tripoli)", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Cash & Cash Equivalents", balance: 145000, active: true },
    { code: "1110", name: "Bank - EUR (Audi)", type: "Asset", currency: "EUR", parent: "1000", reportingGroup: "Cash & Cash Equivalents", balance: 27000, active: true },
    { code: "1120", name: "Petty Cash - USD", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Cash & Cash Equivalents", balance: 4200, active: true },
    { code: "1130", name: "Petty Cash - LBP", type: "Asset", currency: "LBP", parent: "1000", reportingGroup: "Cash & Cash Equivalents", balance: 45000000, active: true },
    { code: "1210", name: "Donor Receivable", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Accounts Receivable", balance: 12000, active: true },
    { code: "1400", name: "Staff Advances", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Other Assets", balance: 500, active: true },
    { code: "1510", name: "Fixed Assets - Cameras & Equipment", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Property, Plant & Equipment", balance: 18500, active: true },
    { code: "1520", name: "Fixed Assets - Office Tech Laptops", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Property, Plant & Equipment", balance: 7400, active: true },
    { code: "1590", name: "Accumulated Depreciation", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Property, Plant & Equipment", balance: -3200, active: true },

    { code: "2000", name: "Liabilities", type: "Liability", currency: "USD", reportingGroup: "Current Liabilities", balance: 0, active: true },
    { code: "2100", name: "Accounts Payable - Vendors", type: "Liability", currency: "USD", parent: "2000", reportingGroup: "Trade Payables", balance: 3400, active: true },
    { code: "2300", name: "Payroll Payable", type: "Liability", currency: "USD", parent: "2000", reportingGroup: "Accrued Liabilities", balance: 0, active: true },
    { code: "2310", name: "Payroll Tax Payable (MoF Chapter 3)", type: "Liability", currency: "USD", parent: "2000", reportingGroup: "Tax Liabilities", balance: 940, active: true },
    { code: "2320", name: "Social Security (CNSS) Statutory Liability", type: "Liability", currency: "USD", parent: "2000", reportingGroup: "CNSS Liabilities", balance: 1420, active: true },
    { code: "2400", name: "Deferred Grant Income", type: "Liability", currency: "USD", parent: "2000", reportingGroup: "Deferred Incomes", balance: 110000, active: true },

    { code: "3000", name: "Equity & Partner Accounts", type: "Equity", currency: "USD", reportingGroup: "Owner's Equity", balance: 0, active: true },
    { code: "3100", name: "Partner Capital - Saad Matar", type: "Equity", currency: "USD", parent: "3000", reportingGroup: "Capital Contributions", balance: 30000, active: true },
    { code: "3200", name: "Partner Capital - Samer Ghamrawi", type: "Equity", currency: "USD", parent: "3000", reportingGroup: "Capital Contributions", balance: 20000, active: true },
    { code: "3300", name: "Partner Drawings - Saad Matar", type: "Equity", currency: "USD", parent: "3000", reportingGroup: "Partner Draws", balance: -1200, active: true },
    { code: "3400", name: "Partner Drawings - Samer Ghamrawi", type: "Equity", currency: "USD", parent: "3000", reportingGroup: "Partner Draws", balance: -800, active: true },
    { code: "3500", name: "Retained Earnings / Accumulated Surplus", type: "Equity", currency: "USD", parent: "3000", reportingGroup: "Equity Reserves", balance: 14740, active: true },

    { code: "4000", name: "Revenues", type: "Revenue", currency: "USD", reportingGroup: "Revenues", balance: 0, active: true },
    { code: "4100", name: "Restricted Grant Income", type: "Revenue", currency: "USD", parent: "4000", reportingGroup: "Donor Grant Income", balance: 85000, active: true },
    { code: "4200", name: "Service Agreement Revenue", type: "Revenue", currency: "USD", parent: "4000", reportingGroup: "Commercial Revenue", balance: 24000, active: true },
    { code: "4300", name: "Production Media Services Revenue", type: "Revenue", currency: "USD", parent: "4000", reportingGroup: "Commercial Revenue", balance: 15500, active: true },
    { code: "4500", name: "Foreign Exchange Gain", type: "Revenue", currency: "USD", parent: "4000", reportingGroup: "FX Adjustment", balance: 1200, active: true },

    { code: "5000", name: "Personnel Costs", type: "Expense", currency: "USD", reportingGroup: "Operating Expenses", balance: 0, active: true },
    { code: "5100", name: "Salaries and Compensation", type: "Expense", currency: "USD", parent: "5000", reportingGroup: "Personnel Costs", balance: 45000, active: true },
    { code: "5110", name: "Employer CNSS Contribution", type: "Expense", currency: "USD", parent: "5000", reportingGroup: "Personnel Costs", balance: 5200, active: true },
    { code: "5120", name: "Freelancers Agreements (Tripoli)", type: "Expense", currency: "USD", parent: "5000", reportingGroup: "Freelancer Fees", balance: 12400, active: true },
    { code: "5130", name: "Consultants - Technical Advisors", type: "Expense", currency: "USD", parent: "5000", reportingGroup: "Consulting Fees", balance: 8900, active: true },

    { code: "6000", name: "Direct Project Costs", type: "Expense", currency: "USD", reportingGroup: "Operational Costs", balance: 0, active: true },
    { code: "6100", name: "Production Costs - Video Capturing", type: "Expense", currency: "USD", parent: "6000", reportingGroup: "Direct Project Cost", balance: 14200, active: true },
    { code: "6200", name: "Travel, Fuel & Per Diem (Tripoli to Beirut)", type: "Expense", currency: "USD", parent: "6000", reportingGroup: "Direct Project Cost", balance: 3400, active: true },
    { code: "6300", name: "Project Equipment & Tools purchases", type: "Expense", currency: "USD", parent: "6000", reportingGroup: "Equipment Cost", balance: 5200, active: true },
    { code: "6400", name: "Software License Subscriptions (Adobe, Canva)", type: "Expense", currency: "USD", parent: "6000", reportingGroup: "Software", balance: 1600, active: true },

    { code: "7000", name: "Admin and Overheads", type: "Expense", currency: "USD", reportingGroup: "Operating Overheads", balance: 0, active: true },
    { code: "7100", name: "Office Rent - Tripoli El-Mina", type: "Expense", currency: "USD", parent: "7000", reportingGroup: "Admin Overhead", balance: 12000, active: true },
    { code: "7200", name: "Utilities - Generator and Water", type: "Expense", currency: "USD", parent: "7000", reportingGroup: "Admin Overhead", balance: 4100, active: true },
    { code: "7400", name: "Bank Charges & Commissions", type: "Expense", currency: "USD", parent: "7000", reportingGroup: "Bank Fees", balance: 650, active: true },
    { code: "7500", name: "Audit Fees - Annual Review", type: "Expense", currency: "USD", parent: "7000", reportingGroup: "Compliance Overhead", balance: 3500, active: true },
    { code: "7700", name: "Foreign Exchange Loss", type: "Expense", currency: "USD", parent: "7000", reportingGroup: "FX Adjustment", balance: 940, active: true }
  ],
  donors: [
    { id: "don-1", name: "Thomson Reuters Foundation", country: "United Kingdom", contactEmail: "projects@thomsonreuters.com", notes: "" }
  ],
  projects: [
    {
      id: "proj-trf",
      name: "Thomson Reuters Foundation (TRF)",
      code: "TRF-2026",
      donorId: "don-1",
      budgetUSD: 10020,
      startDate: "2026-02-10",
      endDate: "2026-06-30",
      fundingType: "Restricted Grant",
      status: "Active"
    }
  ],
  budgetLines: [
    { id: "bl-1", projectId: "proj-trf", code: "A.1.1", category: "Personnel", description: "Program director", allocatedUSD: 1560 },
    { id: "bl-2", projectId: "proj-trf", code: "A.1.2", category: "Personnel", description: "Finance officer", allocatedUSD: 1200 },
    { id: "bl-3", projectId: "proj-trf", code: "A.1.3", category: "Personnel", description: "Graphic designer", allocatedUSD: 1200 },
    { id: "bl-4", projectId: "proj-trf", code: "B.1.1", category: "Contractors/Freelancers", description: "Podcasters", allocatedUSD: 900 },
    { id: "bl-5", projectId: "proj-trf", code: "B.1.2", category: "Contractors/Freelancers", description: "Film makers", allocatedUSD: 2800 },
    { id: "bl-6", projectId: "proj-trf", code: "B.1.3", category: "Contractors/Freelancers", description: "Content creators", allocatedUSD: 800 },
    { id: "bl-7", projectId: "proj-trf", code: "C.1.3", category: "Travel", description: "Domestic transportation", allocatedUSD: 600 },
    { id: "bl-8", projectId: "proj-trf", code: "D.1.1", category: "Other Costs", description: "AI tools", allocatedUSD: 360 },
    { id: "bl-9", projectId: "proj-trf", code: "D.1.3", category: "Other Costs", description: "Internet data", allocatedUSD: 600 }
  ],
  vendors: [
    { id: "ven-1", name: "Assem Nairab", category: "Graphic Designer / Service Provider", taxId: "N/A", bankInfo: "Cash", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-2", name: "Maysaa Riz", category: "Service Provider", taxId: "N/A", bankInfo: "Cash", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-3", name: "Omar", category: "Service Provider", taxId: "N/A", bankInfo: "Cash", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-4", name: "Bilal Leila", category: "Service Provider", taxId: "N/A", bankInfo: "Cash", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-5", name: "VIP Taxi", category: "Transportation", taxId: "N/A", bankInfo: "Cash", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-6", name: "Jawhar Cell", category: "Telecommunications", taxId: "N/A", bankInfo: "Cash", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-7", name: "Higgsfield", category: "Software Subscriptions", taxId: "N/A", bankInfo: "Card", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-8", name: "Google One", category: "Software Subscriptions", taxId: "N/A", bankInfo: "Card", contact: "N/A", active: true, declarationSigned: true, blocked: false },
    { id: "ven-9", name: "Anthropic, PBC - Claude", category: "Software Subscriptions", taxId: "N/A", bankInfo: "Card", contact: "N/A", active: true, declarationSigned: true, blocked: false }
  ],
  expenses: [
    { id: "exp-1", voucherNo: "PV-TRF-001", title: "Higgsfield Sub", purpose: "AI Video Generation", vendorId: "ven-7", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 15, rate: 1, convertedAmount: 15, whtAmount: 1.13, netAmount: 13.87, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-001", created_at: "2026-06-23T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-3", voucherNo: "PV-TRF-003", title: "Google AI Ultra", purpose: "Google One Ultra", vendorId: "ven-8", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 99.99, rate: 1, convertedAmount: 99.99, whtAmount: 7.50, netAmount: 92.49, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-003", created_at: "2026-06-21T11:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-4", voucherNo: "PV-TRF-004", title: "Claude Pro", purpose: "Anthropic Subscription", vendorId: "ven-9", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 20.00, rate: 1, convertedAmount: 20.00, whtAmount: 1.50, netAmount: 18.50, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-004", created_at: "2026-06-15T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true }
  ],
  procurements: [],
  bankAccounts: [
    { id: "ba-1", name: "TRF Base USD", type: "Bank", currency: "USD", accountNo: "TRF-USD-01", balance: 5029.43, active: true }
  ],
  bankTransactions: [
    { id: "bt-1", bankAccountId: "ba-1", date: "2026-02-26", description: "TRF Incoming Transfer", amount: 2000.00, type: "Deposit", reconciled: true },
    { id: "bt-2", bankAccountId: "ba-1", date: "2026-06-09", description: "TRF Incoming Transfer", amount: 3029.43, type: "Deposit", reconciled: true }
  ],
  journalEntries: [
    { id: "je-1", journal: "General Journal", date: "2026-06-23", description: "PV-TRF-001 Higgsfield WHT", referenceNo: "PV-TRF-001", isPosted: true, itemsJson: JSON.stringify([{ accountCode: "6400", debit: 15, credit: 0, projectId: "proj-trf" }, { accountCode: "1100", debit: 0, credit: 13.87, projectId: "proj-trf" }, { accountCode: "2310", debit: 0, credit: 1.13, projectId: "proj-trf" }]) },
    { id: "je-2", journal: "General Journal", date: "2026-06-21", description: "PV-TRF-003 Google Ultra WHT", referenceNo: "PV-TRF-003", isPosted: true, itemsJson: JSON.stringify([{ accountCode: "6400", debit: 99.99, credit: 0, projectId: "proj-trf" }, { accountCode: "1100", debit: 0, credit: 92.49, projectId: "proj-trf" }, { accountCode: "2310", debit: 0, credit: 7.50, projectId: "proj-trf" }]) },
    { id: "je-3", journal: "General Journal", date: "2026-06-15", description: "PV-TRF-004 Claude Pro WHT", referenceNo: "PV-TRF-004", isPosted: true, itemsJson: JSON.stringify([{ accountCode: "6400", debit: 20.00, credit: 0, projectId: "proj-trf" }, { accountCode: "1100", debit: 0, credit: 18.50, projectId: "proj-trf" }, { accountCode: "2310", debit: 0, credit: 1.50, projectId: "proj-trf" }]) }
  ],
  employees: [
    { id: "emp-1", name: "Saad Matar", position: "Program Director", salary: 0, allowance: 0, paymentMethod: "Bank Wire", contractType: "Regular Employee", active: true },
    { id: "emp-2", name: "Marwan El Cheikh", position: "Finance Officer", salary: 0, allowance: 0, paymentMethod: "Bank Wire", contractType: "Regular Employee", active: true },
    { id: "emp-3", name: "Sally Kayyali", position: "Graphic Designer", salary: 0, allowance: 0, paymentMethod: "Bank Wire", contractType: "Regular Employee", active: true }
  ],
  timesheets: [
    { id: "ts-1", employeeId: "emp-1", month: "2026-02", totalDays: 20, allocationsJson: "[]", status: "Approved" },
    { id: "ts-2", employeeId: "emp-1", month: "2026-03", totalDays: 21, allocationsJson: "[]", status: "Approved" },
    { id: "ts-3", employeeId: "emp-2", month: "2026-02", totalDays: 20, allocationsJson: "[]", status: "Approved" },
    { id: "ts-4", employeeId: "emp-2", month: "2026-03", totalDays: 21, allocationsJson: "[]", status: "Approved" },
    { id: "ts-5", employeeId: "emp-3", month: "2026-02", totalDays: 20, allocationsJson: "[]", status: "Approved" },
    { id: "ts-6", employeeId: "emp-3", month: "2026-03", totalDays: 21, allocationsJson: "[]", status: "Approved" }
  ],
  fixedAssets: [],
  partnerAccounts: [
    { id: "pt-1", partnerName: "Saad Matar", capitalBalance: 30000, loansToCompany: 5000, drawingsBalance: 1200, currentAccountBalance: 33800 },
    { id: "pt-2", partnerName: "Samer Ghamrawi", capitalBalance: 20000, loansToCompany: 0, drawingsBalance: 800, currentAccountBalance: 19200 }
  ],
  documents: [
    {
      id: "doc-1",
      filename: "Videography_Agreement_EU_Citizen_Tripoli_Media.pdf",
      mimeType: "application/pdf",
      sizeStr: "2.4 MB",
      base64: "dGVzdCBjb250ZW50",
      category: "Contract",
      linkedRecordType: "Expense",
      linkedRecordId: "exp-1",
      created_at: "2026-05-10T09:12:00Z"
    },
    {
      id: "doc-proj-1",
      filename: "EU_Commission_Empowering_Citizen_Space_MoU.pdf",
      mimeType: "application/pdf",
      sizeStr: "4.8 MB",
      base64: "dGVzdCBjb250ZW50",
      category: "Contract",
      linkedRecordType: "Project",
      linkedRecordId: "proj-1",
      created_at: "2026-01-02T10:00:00Z"
    }
  ],
  auditLogs: [
    { id: "log-1", userId: "u-1", userName: "Saad Matar", action: "System Seed", details: "AnaHon fully audit-compliant accounting framework initialized.", timestamp: "2026-05-25T02:18:22Z" }
  ],
  complianceTasks: [
    { id: "cr-1", title: "Quarterly MoF Chapter 3 Payroll Tax filing", category: "Tax", dueDate: "2026-07-15", status: "Pending", notes: "Requires certification from certified Lebanese accountant." },
    { id: "cr-2", title: "EU citizen project Interim Report delivery", category: "Donor Report", dueDate: "2026-06-30", status: "Pending", notes: "Ensure timesheets are fully compiled for personnel sub-lines." },
    { id: "cr-3", title: "CNSS Employee subscription report", category: "Tax", dueDate: "2026-06-15", status: "Pending", notes: " Tripoli National Social Security file #89281-9" }
  ]
};

async function main() {
  console.log("Starting SQLite Prisma Seeder...");

  // Load existing JSON database if present, to preserve user state
  let dbData = DEFAULT_DATABASE;
  const dbPath = path.join(process.cwd(), "dev_db.json");
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, "utf-8");
      dbData = JSON.parse(content);
      console.log("Loaded existing dev_db.json file for migration data.");
    } catch (err) {
      console.error("Failed to read dev_db.json, falling back to clean seed data:", err);
    }
  }

  // Wipe all existing tables in dev.db to prevent key duplicates during re-seeding
  await prisma.auditLog.deleteMany();
  await prisma.appDoc.deleteMany();
  await prisma.partnerAccount.deleteMany();
  await prisma.fixedAsset.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.procurement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.project.deleteMany();
  await prisma.donor.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.orgSettings.deleteMany();
  await prisma.fxRates.deleteMany();
  await prisma.complianceTask.deleteMany();

  console.log("All existing database rows cleared.");

  // 1. Users
  console.log("Seeding Users...");
  for (const u of dbData.users) {
    await prisma.user.create({ data: u });
  }

  // 2. OrgSettings
  console.log("Seeding OrgSettings...");
  await prisma.orgSettings.create({
    data: {
      profileName: dbData.orgSettings.profileName,
      legalEntity: dbData.orgSettings.legalEntity,
      vesselCode: dbData.orgSettings.vesselCode,
      baseCurrency: dbData.orgSettings.baseCurrency,
      fiscalYearEnd: dbData.orgSettings.fiscalYearEnd,
      vatRate: dbData.orgSettings.vatRate,
      approvalThresholdUSD: dbData.orgSettings.approvalThresholdUSD,
      allowSubProjectAllocation: dbData.orgSettings.allowSubProjectAllocation
    }
  });

  // 3. FxRates
  console.log("Seeding FxRates...");
  await prisma.fxRates.create({
    data: {
      EUR: dbData.fxRates.EUR,
      LBP: dbData.fxRates.LBP
    }
  });

  // 4. Accounts
  console.log("Seeding Accounts...");
  for (const a of dbData.accounts) {
    await prisma.account.create({ data: a });
  }

  // 5. Donors
  console.log("Seeding Donors...");
  for (const d of dbData.donors) {
    await prisma.donor.create({ data: d });
  }

  // 6. Projects
  console.log("Seeding Projects...");
  for (const p of dbData.projects) {
    await prisma.project.create({ data: p });
  }

  // 7. BudgetLines
  console.log("Seeding BudgetLines...");
  for (const bl of dbData.budgetLines) {
    await prisma.budgetLine.create({ data: bl });
  }

  // 8. Vendors
  console.log("Seeding Vendors...");
  for (const v of dbData.vendors) {
    await prisma.vendor.create({ data: v });
  }

  // 9. Expenses
  console.log("Seeding Expenses...");
  for (const e of dbData.expenses) {
    await prisma.expense.create({
      data: {
        id: e.id,
        voucherNo: e.voucherNo,
        title: e.title,
        purpose: e.purpose,
        vendorId: e.vendorId,
        projectId: e.projectId,
        budgetLineId: e.budgetLineId,
        currency: e.currency,
        amount: e.amount,
        rate: e.rate,
        convertedAmount: e.convertedAmount,
        requestorId: e.requestorId,
        status: e.status,
        paymentMethod: e.paymentMethod,
        paymentRef: e.paymentRef,
        created_at: e.created_at,
        approved_at: e.approved_at,
        paid_at: e.paid_at,
        commentsJson: JSON.stringify(e.comments || []),
        hasAttachment: e.hasAttachment
      }
    });
  }

  // 10. Procurements
  console.log("Seeding Procurements...");
  for (const pr of dbData.procurements) {
    await prisma.procurement.create({
      data: {
        id: pr.id,
        title: pr.title,
        projectId: pr.projectId,
        budgetLineId: pr.budgetLineId,
        status: pr.status,
        quotationsJson: JSON.stringify(pr.quotations || []),
        justification: pr.justification,
        conflictDeclared: pr.conflictDeclared
      }
    });
  }

  // 11. BankAccounts
  console.log("Seeding BankAccounts...");
  for (const ba of dbData.bankAccounts) {
    await prisma.bankAccount.create({ data: ba });
  }

  // 12. BankTransactions
  console.log("Seeding BankTransactions...");
  for (const bt of dbData.bankTransactions) {
    await prisma.bankTransaction.create({ data: bt });
  }

  // 13. JournalEntries
  console.log("Seeding JournalEntries...");
  for (const je of dbData.journalEntries) {
    await prisma.journalEntry.create({
      data: {
        id: je.id,
        journal: je.journal,
        date: je.date,
        description: je.description,
        referenceNo: je.referenceNo,
        isPosted: je.isPosted,
        itemsJson: JSON.stringify(je.items || [])
      }
    });
  }

  // 14. Employees
  console.log("Seeding Employees...");
  for (const emp of dbData.employees) {
    await prisma.employee.create({ data: emp });
  }

  // 15. Timesheets
  console.log("Seeding Timesheets...");
  for (const ts of dbData.timesheets) {
    await prisma.timesheet.create({
      data: {
        id: ts.id,
        employeeId: ts.employeeId,
        month: ts.month,
        totalDays: ts.totalDays,
        allocationsJson: JSON.stringify(ts.allocations || []),
        status: ts.status,
        approvedBy: ts.approvedBy
      }
    });
  }

  // 16. FixedAssets
  console.log("Seeding FixedAssets...");
  for (const fa of dbData.fixedAssets) {
    await prisma.fixedAsset.create({ data: fa });
  }

  // 17. PartnerAccounts
  console.log("Seeding PartnerAccounts...");
  for (const pa of dbData.partnerAccounts) {
    await prisma.partnerAccount.create({ data: pa });
  }

  // 18. AppDocs
  console.log("Seeding AppDocs...");
  for (const doc of dbData.documents) {
    await prisma.appDoc.create({ data: doc });
  }

  // 19. AuditLogs
  console.log("Seeding AuditLogs...");
  for (const log of dbData.auditLogs) {
    await prisma.auditLog.create({ data: log });
  }

  // 20. ComplianceTasks
  console.log("Seeding ComplianceTasks...");
  for (const task of dbData.complianceTasks) {
    await prisma.complianceTask.create({ data: task });
  }

  console.log("SQLite database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error during database seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
