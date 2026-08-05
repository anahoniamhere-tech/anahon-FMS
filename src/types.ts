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
  /** Which of AnaHon's five programs this project belongs to ("" = unassigned). */
  stream?: string;
}

export interface ProposalBudgetRow { line: string; description: string; amount: number }
export interface ProposalTimelineRow { activity: string; start: string; end: string }
/** Master proposal workspace on an opportunity — adapted into each donor's own template. */
export interface Proposal {
  summary?: string;
  problem?: string;
  solution?: string;
  objectives?: string;
  deliverables?: string;
  outputs?: string;
  outcomes?: string;
  budget?: ProposalBudgetRow[];
  timeline?: ProposalTimelineRow[];
}

/** Funding funnel: an ask BEFORE money lands. Never part of financial data —
 *  graduates to a Project only via bank-proof project creation. */
export interface Opportunity {
  id: string;
  title: string;
  donorId: string;
  stream: string;
  stage: "Prospect" | "Drafting" | "Submitted" | "Awarded" | "Declined";
  amount: number;
  currency: string;
  deadline: string;
  decisionDate: string;
  renewalOfProjectId: string;
  notes: string;
  proposal: Proposal;
}

export interface Donor {
  id: string;
  name: string;
  country: string;
  contactEmail: string;
  notes: string;
}

/** Production stream: a client pays US for services (vs Donor = grants, Vendor = we pay them). */
export interface Client {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  taxId: string;
  notes: string;
  active: boolean;
}

export interface QuotationItem {
  service: string;
  description: string;
  output: string;
  unitPrice: number;
  qty: number;
}

/** A quotation is never income — income exists only when the payment is on a bank statement. */
export interface Quotation {
  id: string;
  quoteNo: string;
  clientId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  validUntil: string;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired" | "Invoiced" | "Paid";
  notes: string;
  items: QuotationItem[];
  terms: { financial?: string; production?: string; technical?: string; extras?: string };
  /** Statement deposit that settled this quote — bank evidence, set via link-payment. */
  paymentTxId: string;
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
  /** True only for parties we ENGAGE under a service agreement, never for suppliers we buy from. */
  engageable?: boolean;
  /** Login email, when this provider is also a system user. Empty for ordinary suppliers. */
  userEmail?: string;
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
  /** Waiver: fewer than 3 quotations, allowed only with a written justification. */
  singleSource?: boolean;
  approvedBy?: string;
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
  /** Set on incoming donor money, which has no voucher to route it to a project. */
  projectId?: string;
  /** Staged from an eBLOM advice PDF, awaiting statement confirmation. Excluded from balances, reports and funding proof. */
  pending?: boolean;
  /** eBLOM advice "Transaction Reference" — dedupe key for re-imports. */
  noticeRef?: string;
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
  /** "Cash" or "Bank Transfer". When "Bank Transfer", bankAccountId says which account. */
  paymentMethod: string;
  contractType: string;
  active: boolean;
  userEmail?: string; // login email for self-service timesheets (Policy 8.5)
  /** Which BLOM sub-account pays this person. Null/absent means cash. */
  bankAccountId?: string;
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

/** Physical petty-cash count. Variance against ledger 1120 = the undocumented gap. */
export interface CashCount {
  id: string;
  date: string;
  countedUSD: number;
  countedBy: string;
  notes: string;
  created_at: string;
}

/** A recurring charge: what renews, when, and out of which account. */
export interface Subscription {
  id: string;
  name: string;
  vendorId: string;
  matchText: string;
  amount: number;
  currency: string;
  cycle: "Monthly" | "Quarterly" | "Annual";
  nextRenewal: string;
  bankAccountId: string;
  projectId: string;
  budgetLineId: string;
  status: "Active" | "Paused" | "Cancelled";
  /** Date someone last confirmed it is still running. */
  verifiedOn?: string;
  notes: string;
  created_at: string;
}

/** One dated, assignable step in a project's life. */
export interface ProjectActivity {
  id: string;
  projectId: string;
  title: string;
  detail: string;
  kind: "Activity" | "Milestone" | "Report" | "Payment";
  dueDate: string;
  assigneeUserId: string;
  status: "Planned" | "In Progress" | "Done" | "Cancelled";
  budgetLineId: string;
  source: string;
  completedOn: string;
  /** Donor timetable shape: "2.1.3", its Result heading, Arabic title, period labels. */
  outlineNo?: string;
  resultGroup?: string;
  titleAr?: string;
  startDate?: string;
  periodsJson?: string;
  created_at: string;
}

export interface AppDoc {
  id: string;
  /** Unique document reference (ANH-DOC-NNNNN) — auto-assigned, master-account edit only. */
  refNo?: string | null;
  filename: string;
  mimeType: string;
  sizeStr: string;
  base64: string;
  // Free-form in practice — the DB holds 28 distinct values ("Handbook", "Digitized Invoice", …).
  category: string;
  linkedRecordType: string;
  linkedRecordId: string;
  /** The person/provider (emp-* / ven-*) this document is about — drives the party file view. */
  partyId?: string | null;
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

/**
 * One piece of content moving through the editorial pipeline (Policies 002 & 005).
 * The enforcement fields — named fact-checker, dual approval slots, legal attestation,
 * checks — are what make "published" mean "policy-compliant".
 */
export interface ContentItem {
  id: string;
  title: string;
  contentType: string;
  stream: string;
  channels: string[];
  brief: string;
  status: "Assigned" | "In Production" | "Fact-Check" | "Editorial Review" | "Approved" | "Published";
  assigneeUserId: string;
  dueDate: string;
  assignedMeetingDate: string;
  reviewedMeetingDate: string;
  factCheckerUserId: string;
  factCheckLog: { source: string; step: string; date: string }[];
  factCheckPassedAt: string;
  checks: Record<string, boolean>;
  legalFlag: boolean;
  legalReviewedBy: string;
  legalReviewNote: string;
  legalRecordedBy: string;
  legalRecordedAt: string;
  pmApprovedBy: string;
  pmApprovedAt: string;
  pdApprovedBy: string;
  pdApprovedAt: string;
  factCheckTag: boolean;
  publishedAt: string;
  corrections: { date: string; nature: string; correction: string; by: string }[];
  created_at: string;
}

/** One held editorial meeting (Policy 002): attendance, direction, decisions. */
export interface EditorialMeeting {
  id: string;
  kind: "Weekly Editorial" | "Daily Production";
  date: string;
  attendees: string[];
  direction: string;
  notes: string;
  recordedBy: string;
  created_at: string;
}

export interface DatabaseState {
  users: { id: string; name: string; email: string; role: string; active: boolean; projectIdsJson?: string; streamScope?: string }[];
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
  opportunities: Opportunity[];
  cashCounts: CashCount[];
  subscriptions: Subscription[];
  projectActivities: ProjectActivity[];
  contentItems: ContentItem[];
  editorialMeetings: EditorialMeeting[];
  clients: Client[];
  quotations: Quotation[];
  orgSettings: OrgSettings;
  fxRates: { EUR: number; LBP: number };
}
