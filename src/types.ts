export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface ProjectAllocation {
  projectId: string;
  budgetLineId: string;
  percentage: number;
  amount: number;
}

export interface BudgetLine {
  id: string;
  projectId: string;
  code: string;
  category: string;
  description: string;
  allocatedUSD: number;
  actualUSD: number;
  committedUSD: number;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  donorId: string;
  budgetUSD: number;
  startDate: string;
  endDate: string;
  fundingType: "Restricted Grant" | "Unrestricted Service";
  status: "Active" | "Completed" | "Pending";
}

export interface Donor {
  id: string;
  name: string;
  country: string;
  contactEmail: string;
  notes: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  taxId: string;
  bankInfo: string;
  contact: string;
  active: boolean;
  declarationSigned: boolean;
  blocked: boolean;
}

export interface Expense {
  id: string;
  voucherNo: string;
  title: string;
  purpose: string;
  vendorId: string;
  projectId: string;
  budgetLineId: string;
  currency: "USD" | "EUR" | "LBP";
  amount: number;
  rate: number;
  convertedAmount: number;
  whtAmount: number;
  netAmount: number;
  requestorId: string;
  status: "Draft" | "Submitted" | "Under Finance Review" | "Returned for Correction" | "Approved" | "Paid" | "Posted" | "Cancelled";
  paymentMethod?: string;
  paymentRef?: string;
  created_at: string;
  approved_at?: string;
  paid_at?: string;
  comments: Comment[];
  allocations: ProjectAllocation[];
  hasAttachment: boolean;
}

export interface Procurement {
  id: string;
  title: string;
  projectId: string;
  budgetLineId: string;
  status: "Draft" | "Under Evaluation" | "Approved" | "Ordered" | "Completed";
  quotations: {
    vendorName: string;
    amount: number;
    currency: string;
    score: number;
    comment: string;
    selected: boolean;
  }[];
  justification: string;
  conflictDeclared: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  type: "Bank" | "Petty Cash";
  currency: "USD" | "EUR" | "LBP";
  accountNo: string;
  balance: number;
  active: boolean;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  type: "Deposit" | "Withdrawal";
  reconciled: boolean;
  voucherNo?: string;
}

export interface JournalEntry {
  id: string;
  journal: "Cash Receipts" | "Cash Payments" | "Bank" | "General" | "Payroll" | "Depreciation" | "FX Gain/Loss";
  date: string;
  description: string;
  referenceNo: string;
  isPosted: boolean;
  items: {
    accountCode: string;
    debit: number;
    credit: number;
    projectId?: string;
    donorId?: string;
  }[];
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  salary: number;
  allowance: number;
  paymentMethod: string;
  contractType: string;
  active: boolean;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  month: string;
  totalDays: number;
  allocations: {
    projectId: string;
    percentage: number;
  }[];
  status: "Draft" | "Submitted" | "Approved" | "Locked";
  approvedBy?: string;
}

export interface FixedAsset {
  id: string;
  name: string;
  serialNumber: string;
  fundingProjectId: string;
  purchaseDate: string;
  cost: number;
  currency: "USD" | "EUR" | "LBP";
  usefulLifeYears: number;
  custodian: string;
  location: string;
  condition: "Excellent" | "Good" | "Needs Repair" | "Damaged";
  currentBookValue: number;
  depreciationMethod: "Straight Line" | "Double Declining";
  accumulatedDepreciation: number;
}

export interface PartnerAccount {
  id: string;
  partnerName: string;
  capitalBalance: number;
  loansToCompany: number;
  drawingsBalance: number;
  currentAccountBalance: number;
}

export interface AppDoc {
  id: string;
  filename: string;
  mimeType: string;
  sizeStr: string;
  base64: string;
  category: "Voucher" | "Contract" | "Receipt" | "AuditFile";
  linkedRecordType: string;
  linkedRecordId: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface ComplianceTask {
  id: string;
  title: string;
  category: "Tax" | "Donor Report" | "Licensing" | "Audit Support";
  dueDate: string;
  status: "Pending" | "Done" | "Overdue";
  notes: string;
}

export interface OrgSettings {
  profileName: string;
  legalEntity: string;
  vesselCode: string;
  baseCurrency: "USD";
  fiscalYearEnd: string;
  vatRate: number;
  approvalThresholdUSD: number;
  allowSubProjectAllocation: boolean;
}

export interface Account {
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  currency: "USD" | "EUR" | "LBP";
  parent?: string;
  reportingGroup: string;
  balance: number;
  active: boolean;
}

export interface DatabaseState {
  users: { id: string; name: string; email: string; role: string; active: boolean }[];
  accounts: Account[];
  donors: Donor[];
  projects: Project[];
  budgetLines: BudgetLine[];
  vendors: Vendor[];
  expenses: Expense[];
  procurements: Procurement[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  employees: Employee[];
  timesheets: Timesheet[];
  fixedAssets: FixedAsset[];
  partnerAccounts: PartnerAccount[];
  documents: AppDoc[];
  auditLogs: AuditLog[];
  complianceTasks: ComplianceTask[];
  orgSettings: OrgSettings;
  fxRates: { EUR: number; LBP: number };
}
