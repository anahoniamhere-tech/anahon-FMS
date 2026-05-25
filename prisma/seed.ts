import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Load the default database structure to fall back on
const DEFAULT_DATABASE = {
  users: [
    { id: "u-1", name: "Saad Matar", email: "anahoniamhere@gmail.com", role: "Super Admin", active: true },
    { id: "u-2", name: "Samer Ghamrawi", email: "samer@anahon.org", role: "Program Director", active: true },
    { id: "u-3", name: "Layale El-Khatib", email: "layale@anahon.org", role: "Finance Officer", active: true },
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
    { id: "don-1", name: "EU Commission (Human Rights Division)", country: "Belgium (EU)", contactEmail: "projects-lebanon@commission.europa.eu", notes: "Requires strict co-financing evidence and timesheets for all payroll allocation." },
    { id: "don-2", name: "National Endowment for Media Innovation (NEMI)", country: "United States", contactEmail: "grants-mena@nemi-gulf.org", notes: "Audit reports must map to USD reporting currency at date of voucher." },
    { id: "don-3", name: "UNICEF MENA Region", country: "Switzerland", contactEmail: "beirut-procurement@unicef.org", notes: "Bidding comparisons required for purchases exceeding 1500 USD." }
  ],
  projects: [
    {
      id: "proj-1",
      name: "Empowering Citizen Space in Tripoli",
      code: "EU-2026-CITIZEN",
      donorId: "don-1",
      budgetUSD: 85000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      fundingType: "Restricted Grant",
      status: "Active"
    },
    {
      id: "proj-2",
      name: "Tripoli Investigative Video Journalism Series",
      code: "NEM-2026-JOURN",
      donorId: "don-2",
      budgetUSD: 60000,
      startDate: "2026-02-01",
      endDate: "2026-11-30",
      fundingType: "Restricted Grant",
      status: "Active"
    },
    {
      id: "proj-3",
      name: "Lebanese Civil Society Leadership Academy",
      code: "UNI-2026-LEADER",
      donorId: "don-3",
      budgetUSD: 45000,
      startDate: "2026-04-01",
      endDate: "2026-10-15",
      fundingType: "Restricted Grant",
      status: "Active"
    },
    {
      id: "proj-unrestricted",
      name: "AnaHon Commercial Production Services",
      code: "ANAHON-COMM",
      donorId: "",
      budgetUSD: 150000,
      startDate: "2025-01-01",
      endDate: "2028-12-31",
      fundingType: "Unrestricted Service",
      status: "Active"
    }
  ],
  budgetLines: [
    { id: "bl-101", projectId: "proj-1", code: "EU-PERS-01", category: "Personnel", description: "Project Coordinator Salary", allocatedUSD: 24000, actualUSD: 10000, committedUSD: 14000 },
    { id: "bl-102", projectId: "proj-1", code: "EU-PROD-02", category: "Production", description: "Short Film Videographer & Editor", allocatedUSD: 36000, actualUSD: 18000, committedUSD: 12000 },
    { id: "bl-103", projectId: "proj-1", code: "EU-TRAV-03", category: "Travel & Per Diem", description: "Tripoli to Akkar Field Visits", allocatedUSD: 10000, actualUSD: 4200, committedUSD: 800 },
    { id: "bl-104", projectId: "proj-1", code: "EU-ADM-04", category: "Administrative Support", description: "Proportional Rent Contribution", allocatedUSD: 15000, actualUSD: 5000, committedUSD: 0 },

    { id: "bl-201", projectId: "proj-2", code: "NEM-RESE-01", category: "Personnel", description: "Investigative Researchers (Tripoli)", allocatedUSD: 18000, actualUSD: 8000, committedUSD: 4000 },
    { id: "bl-202", projectId: "proj-2", code: "NEM-CAMV-02", category: "Production", description: "Camera Kit Sinking Cost Allocation", allocatedUSD: 12000, actualUSD: 11500, committedUSD: 0 },
    { id: "bl-203", projectId: "proj-2", code: "NEM-POST-03", category: "Creative Services", description: "Color Grading & Sound Editing", allocatedUSD: 20000, actualUSD: 6000, committedUSD: 11000 },
    { id: "bl-204", projectId: "proj-2", code: "NEM-AUD-04", category: "Compliance", description: "Required Mid-term Project Audit", allocatedUSD: 10000, actualUSD: 3500, committedUSD: 0 },

    { id: "bl-301", projectId: "proj-3", code: "UNI-TRAI-01", category: "Trainers & Instructors", description: "Expert Sourcing Fees", allocatedUSD: 18000, actualUSD: 6000, committedUSD: 6000 },
    { id: "bl-302", projectId: "proj-3", code: "UNI-MEAL-02", category: "Catering & Event", description: "Youth Workshop Catering (Tripoli)", allocatedUSD: 12000, actualUSD: 4200, committedUSD: 2000 },
    { id: "bl-303", projectId: "proj-3", code: "UNI-TECH-03", category: "Operational Costs", description: "Broadband and Stream Equipments", allocatedUSD: 9000, actualUSD: 2500, committedUSD: 500 },
    { id: "bl-304", projectId: "proj-3", code: "UNI-ADM-04", category: "Overheads", description: "Administrative Cost Pool Allocation", allocatedUSD: 6000, actualUSD: 1500, committedUSD: 0 }
  ],
  vendors: [
    { id: "ven-1", name: "Tripoli Media Hub & Studio S.A.R.L.", category: "Media Production Services", taxId: "24982-LB", bankInfo: "Bank Audi, Al-Tall Branch, Tripoli #38841-8", contact: "info@tripolimediahub.com", active: true, declarationSigned: true, blocked: false },
    { id: "ven-2", name: "Qaddour Generator Network (Tripoli- Mina)", category: "Utilities & Fuel", taxId: "90023-LB", bankInfo: "Cash Only (USD/LBP)", contact: "Abo Al-Noor Qaddour (+961 70 829281)", active: true, declarationSigned: true, blocked: false },
    { id: "ven-3", name: "Halabi Office Printers & Tech", category: "Office Assets & Supplies", taxId: "12311-LB", bankInfo: "BLOM Bank Tripoli Branch", contact: "Fouad Halabi (+961 06 439281)", active: true, declarationSigned: true, blocked: false },
    { id: "ven-4", name: "Al-Salam Catering Tripoli", category: "Event Management & Catering", taxId: "8472-LB", bankInfo: "Bank of Beirut, Mina Tripoli", contact: "Samer Al-Salam (+961 71 289384)", active: true, declarationSigned: true, blocked: false },
    { id: "ven-5", name: "Blacklisted Tech Solutions Lebanon", category: "Banned System Integrators", taxId: "9999-LB", bankInfo: "Banned / Cash Broker", contact: "Discontinued", active: false, declarationSigned: false, blocked: true }
  ],
  expenses: [
    {
      id: "exp-1",
      voucherNo: "PV-2026-001",
      title: "Citoyens Space Launch Trailer Video Shooting",
      purpose: "Retained professional videographer team for capturing initial panels and Tripoli harbor drone clips.",
      vendorId: "ven-1",
      projectId: "proj-1",
      budgetLineId: "bl-102",
      currency: "USD",
      amount: 1400,
      rate: 1,
      convertedAmount: 1400,
      requestorId: "u-4",
      status: "Posted",
      paymentMethod: "Bank Audi Wire Transfer",
      paymentRef: "TRF-AUDI-94821",
      created_at: "2026-05-10T09:00:00Z",
      approved_at: "2026-05-12T11:00:00Z",
      paid_at: "2026-05-13T14:30:00Z",
      comments: [
        { id: "c-1", text: "Approved. All quotes compared perfectly.", author: "Samer Ghamrawi", timestamp: "2026-05-12T11:00:00Z" },
        { id: "c-2", text: "Voucher audited, bank receipt attached.", author: "Layale El-Khatib", timestamp: "2026-05-13T14:30:00Z" }
      ],
      hasAttachment: true
    },
    {
      id: "exp-2",
      voucherNo: "PV-2026-002",
      title: "Generator Subscription Office Mina Month May",
      purpose: "Power backup subscription during peak production hours in Al-Mina area office.",
      vendorId: "ven-2",
      projectId: "proj-unrestricted",
      budgetLineId: "",
      currency: "USD",
      amount: 450,
      rate: 1,
      convertedAmount: 450,
      requestorId: "u-3",
      status: "Paid",
      paymentMethod: "Petty Cash",
      paymentRef: "CSH-MAY-GEN-02",
      created_at: "2026-05-20T08:30:00Z",
      approved_at: "2026-05-20T10:00:00Z",
      paid_at: "2026-05-21T09:15:00Z",
      comments: [
        { id: "c-3", text: "Generator rates increased in El-Mina, justified.", author: "Layale El-Khatib", timestamp: "2026-05-19T08:30:00Z" }
      ],
      hasAttachment: true
    },
    {
      id: "exp-3",
      voucherNo: "PV-2026-003",
      title: "Audio Gear Accessories Upgrade",
      purpose: "Purchased dual-channel lapel microphone kits for regional project interviews.",
      vendorId: "ven-3",
      projectId: "proj-2",
      budgetLineId: "bl-202",
      currency: "EUR",
      amount: 800,
      rate: 1.08,
      convertedAmount: 864,
      requestorId: "u-4",
      status: "Under Finance Review",
      created_at: "2026-05-24T15:20:00Z",
      comments: [],
      hasAttachment: true
    }
  ],
  procurements: [
    {
      id: "pr-1",
      title: "High-Performance Camera Sourcing",
      projectId: "proj-2",
      budgetLineId: "bl-202",
      status: "Approved",
      quotations: [
        { vendorName: "Tripoli Media Hub", amount: 1500, currency: "USD", score: 90, comment: "Preferred technical warranty.", selected: true },
        { vendorName: "Halabi Office Tech", amount: 1650, currency: "USD", score: 85, comment: "Extra battery included but pricing higher.", selected: false },
        { vendorName: "Beirut Audio Hub", amount: 1400, currency: "USD", score: 60, comment: "No maintenance branch in Tripoli, risky delivery.", selected: false }
      ],
      justification: "Selected Tripoli Media Hub due to local maintenance presence and highest quality score despite not being the absolute lowest quote.",
      conflictDeclared: true
    }
  ],
  bankAccounts: [
    { id: "ba-1", name: "Bank Audi Tripoli Base USD", type: "Bank", currency: "USD", accountNo: "389281-22-01-USD", balance: 145000, active: true },
    { id: "ba-2", name: "Bank Audi Tripoli Sub-EUR", type: "Bank", currency: "EUR", accountNo: "389281-22-02-EUR", balance: 27000, active: true },
    { id: "ba-3", name: "Petty Cash Box USD (Layale Vault)", type: "Petty Cash", currency: "USD", accountNo: "Layale - Vault Safe 1", balance: 4200, active: true },
    { id: "ba-4", name: "Petty Cash Box LBP (Layale Cash)", type: "Petty Cash", currency: "LBP", accountNo: "Layale - Vault Drawer 2", balance: 45000000, active: true }
  ],
  bankTransactions: [
    { id: "bt-1", bankAccountId: "ba-1", date: "2026-05-01", description: "Opening Balance", amount: 145000, type: "Deposit", reconciled: true },
    { id: "bt-2", bankAccountId: "ba-1", date: "2026-05-13", description: "PV-2026-001 citizen Video Shooting", amount: 1400, type: "Withdrawal", reconciled: true, voucherNo: "PV-2026-001" },
    { id: "bt-3", bankAccountId: "ba-3", date: "2026-05-21", description: "PV-2026-002 generator office Mina May", amount: 450, type: "Withdrawal", reconciled: false, voucherNo: "PV-2026-002" }
  ],
  journalEntries: [
    {
      id: "je-1",
      journal: "Cash Payments",
      date: "2026-05-13",
      description: "PV-2026-001 citizen video recording - Tripoli Citizen Space",
      referenceNo: "PV-2026-001",
      isPosted: true,
      items: [
        { accountCode: "6120", debit: 1400, credit: 0, projectId: "proj-1", donorId: "don-1" },
        { accountCode: "1100", debit: 0, credit: 1400 }
      ]
    }
  ],
  employees: [
    { id: "emp-1", name: "Ziad Al-Ali", position: "Full-Time Video Coordinator", salary: 2200, allowance: 400, paymentMethod: "Audi Bank Wire", contractType: "Regular Employee", active: true },
    { id: "emp-2", name: "Farah Shami", position: "Tripoli Community Officer", salary: 1800, allowance: 250, paymentMethod: "Audi Bank Wire", contractType: "Employee", active: true },
    { id: "emp-3", name: "Jean Haddad", position: "Lebanese Tax & Audit Advisor", salary: 1500, allowance: 0, paymentMethod: "USD Cash Check", contractType: "Consultant / Part-time", active: true }
  ],
  timesheets: [
    {
      id: "ts-1",
      employeeId: "emp-1",
      month: "2026-05",
      totalDays: 22,
      allocations: [
        { projectId: "proj-1", percentage: 50 },
        { projectId: "proj-2", percentage: 30 },
        { projectId: "proj-unrestricted", percentage: 20 }
      ],
      status: "Approved",
      approvedBy: "Samer Ghamrawi"
    }
  ],
  fixedAssets: [
    {
      id: "asset-1",
      name: "Sony FX6 Camera Body + 24-70 GM Lens Set",
      serialNumber: "SN-93821039",
      fundingProjectId: "proj-2",
      purchaseDate: "2026-02-15",
      cost: 6500,
      currency: "USD",
      usefulLifeYears: 4,
      custodian: "Ziad Al-Ali",
      location: "Main studio Locker 3B",
      condition: "Excellent",
      currentBookValue: 6093,
      depreciationMethod: "Straight Line",
      accumulatedDepreciation: 407
    },
    {
      id: "asset-2",
      name: "MacBook Pro M3 Max 16 inch - edit rig Tripoli",
      serialNumber: "SN-C02R5D3W",
      fundingProjectId: "proj-1",
      purchaseDate: "2026-01-10",
      cost: 3800,
      currency: "USD",
      usefulLifeYears: 3,
      custodian: "Farah Shami",
      location: "Tripoli citizen workspace El-Mina",
      condition: "Excellent",
      currentBookValue: 3325,
      depreciationMethod: "Straight Line",
      accumulatedDepreciation: 475
    }
  ],
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
