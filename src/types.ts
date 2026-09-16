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
  /** Policy P5 §4.4.4 — "any" channel, or "bank" only as the donor's agreement says. */
  channelRule?: "any" | "bank";
  channelRuleSource?: string;
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
  link: string;
  samples: { url: string; title: string }[];
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
  /** Statement deposits that settled this quote, in linking order — bank evidence, set
   *  via link-payment. A list because a client may pay in tranches (half up front, half
   *  on delivery); the amounts live on the bank lines, never here. */
  paymentTxIds: string[];
  /** "anahon" (default) or "icontent" — the letterhead the quotation is issued under. */
  issuedAs?: "anahon" | "icontent";
  /** Positive amount deducted from the package value; amount is the net total. */
  discountAmount?: number;
  discountLabel?: string;
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
  /** A person or an organisation — "individual" | "organisation", blank until somebody says.
   *  Never inferred from the category string (src/supplierDocs.ts). */
  partyKind?: string;
  /** Login email, when this provider is also a system user. Empty for ordinary suppliers. */
  userEmail?: string;
  /** WhatsApp number, full international form. Empty means no WhatsApp button — see waLink. */
  phone?: string;
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
  /** Who took each step and the seat they wore (phase 7). */
  approvedById?: string; approvedAs?: string;
  paidById?: string;     paidAs?: string;
  postedById?: string;   postedAs?: string;
  comments: Comment[];
  allocations: ProjectAllocation[];
  hasAttachment: boolean;
  /** The approved procurement authorising a purchase above the Policy P5 threshold. */
  procurementId?: string;
  /** What kind of cost this is, in the books' own words (5100 salaries, 7100 rent, 6300
   *  equipment…). Named when the request is raised: the procurement rule needs it then.
   *  Blank on rows raised before this existed. */
  costAccountCode?: string;
  transactionDate?: string;
  /** Policy P11 §6: a payment to a protected source — the title is the code name, no supplier. */
  confidential?: boolean;
  sourceId?: string;
  /** Policy P5 §6.6, computed by the server for every seat. */
  evidence?: "proof" | "reconstructed" | "declaration-unsigned" | "declaration-awaiting-director" | "missing";
  declaration?: { id: string; generatedDocId: string; signedDocId: string; preparedById: string; preparedAt: string; approvedById: string; approvedAs: string; approvedAt: string; madeOn: string } | null;
  /** Why this cost never involved choosing a supplier ("a salary under an employment
   *  contract"), or "" when it did. Derived in loadState from the account the books actually
   *  debited — netted, so a corrected voucher reads where the cost is now — and shipped to
   *  every seat, because deriving it in the browser made the same register read one number to
   *  a director and another to the keeper who cannot see the journal. */
  noSupplierChoice?: string;
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
  /** Waiver: fewer quotations than the purchase calls for, allowed only with a written justification. */
  singleSource?: boolean;
  approvedBy?: string;
  approvedById?: string; approvedAs?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  /** "Petty Cash" is the float (the locked box) and nothing else; the BOB/OMT/Whish/cheque
   *  channels are "Off-bank channel" (Policy P5 §4.4.4). */
  type: "Bank" | "Petty Cash" | "Off-bank channel" | "Cash in transit";
  currency: "USD" | "EUR" | "LBP";
  accountNo: string;
  balance: number;
  active: boolean;
  custodianUserId?: string;
  ledgerCode?: string;
  /** The float's opening date, set by its first count — the cutover for late cash records. */
  openedOn?: string;
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
  /** Evidence for money received outside the bank: channel reference, cheque no., or RC number. */
  evidenceRef?: string;
}

export interface JournalEntry {
  id: string;
  journal: "Cash Receipts" | "Cash Payments" | "Bank" | "General" | "Payroll" | "Depreciation" | "FX Gain/Loss" | "Purchases" | "Adjustment";
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
  /**
   * WhatsApp number in full international form. Part of the personnel file, so the server
   * sends "" to anyone who may not open this person's file — an empty string here means
   * "not on file OR not yours to see", and the interface treats both the same way.
   */
  phone?: string;
  /** When employment began, YYYY-MM-DD. Empty until someone records it. */
  startDate?: string;
}

/**
 * Someone AnaHon may engage but has no contract with yet. Finance receives only id, name and
 * skills, so every other field is optional on the client: absent means "not yours to see".
 */
export interface PoolCandidate {
  id: string;
  name: string;
  skills: string;
  city?: string;
  country?: string;
  languages?: string;
  email?: string;
  phone?: string;
  dayRate?: number | null;
  currency?: string;
  notes?: string;
  created_at?: string;
  /** One per field the person is in. A field head receives only their own field's row, so a
   *  dual-field person arrives without the other field's judgement. Absent for a summary viewer. */
  assessments?: PoolAssessment[];
}

/** A pool entry's standing in one field, set by that field's head or the Executive Director. */
export interface PoolAssessment {
  id: string;
  candidateId: string;
  field: "Editorial" | "Production" | string;
  status: "Prospect" | "Worked with us" | "Not a fit" | string;
  /** 1–5, null until someone has worked with them. */
  rating: number | null;
  note: string;
  assessedBy: string;
  assessedAs: string;
  assessedAt: string;
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
  approvedById?: string; approvedAs?: string;
}

export interface FixedAsset {
  id: string;
  name: string;
  serialNumber: string;
  fundingProjectId: string;
  purchaseDate: string;
  cost: number;
  /** Empty only for a genuine gift — there is no sum to name a currency for. */
  currency: "USD" | "EUR" | "LBP" | "";
  usefulLifeYears: number;
  custodian: string;
  location: string;
  condition: "Excellent" | "Good" | "Needs Repair" | "Damaged";
  currentBookValue: number;
  depreciationMethod: "Straight Line" | "Double Declining";
  accumulatedDepreciation: number;
  /** Policy P5 §9: where the value comes from ("" = not valued yet), fixed USD value and rate. */
  costBasis?: "" | "voucher" | "receipt" | "estimate" | "gift";
  costBasisDocId?: string;
  costBasisNote?: string;
  costUSD?: number;
  costRate?: number;
  valuedById?: string;
  valuedAt?: string;
  /** Computed by the server on every load — never stored. */
  accounting?: { state: "unvalued" | "gift" | "expensed" | "capitalised"; depreciationFrom?: string; accumulated?: number; bookValue?: number };
  /** The grant it was bought on, read from its payment request. */
  grant?: { voucherNo: string; projectCode: string; projectName: string; donorName: string; budgetLine: string } | null;
  /** EQ-001… the sticker number. Null only on rows registered before receiving existed. */
  tag?: string | null;
  brand?: string;
  model?: string;
  specs?: string;
  /** The payment request it was bought on. Empty for a gift or an older purchase. */
  expenseId?: string;
  receivedAt?: string | null;
  receivedBy?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  /** camera/lens/audio/lighting/computer/storage/network/furniture/other — see equipment.ts. */
  kind?: string;
  /** Derived in loadState from the facts on the row — never stored. The desk keys on it. */
  /** Derived in loadState, never stored. The desk keys on it — src/equipment.ts holds the
   *  same list, and scripts/check-desk.ts pins that the two agree. */
  status?: "Registered" | "Received" | "Verified" | "Out" | "Awaiting disposal approval"
    | "Broken — thrown away" | "Sold" | "Given away" | "Lost" | "Stolen" | "Returned to its owner";
  /** What became of it: "" while in use, else one of END_KINDS (src/equipment.ts). A disposal
   *  only takes effect once the second approval is on it — Resources and Assets Policy P7. */
  endKind?: string;
  endAt?: string | null;
  endNote?: string;
  endAmount?: number | null;
  endBy?: string | null;
  endAs?: string | null;
  endConfirmedBy?: string | null;
  endConfirmedAs?: string | null;
  endConfirmedAt?: string | null;
  /** SUPERSEDED by endKind and never read — kept so the original text survives. */
  writtenOffAt?: string | null;
  writtenOffBy?: string | null;
  writeOffReason?: string;
  /** Who has it now (a User.id), what for and until when. Empty while it is in. */
  holderId?: string | null;
  heldFor?: string;
  heldProjectId?: string;
  outAt?: string | null;
  dueBack?: string | null;
  /** When it is next due a physical check; every confirmation sets it. */
  nextCheckDue?: string | null;
  /** Its own log, oldest first — parsed from movementsJson and repairsJson in loadState. */
  movements?: import("./equipment").Movement[];
  repairs?: import("./equipment").Repair[];
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
  bankAccountId?: string;
  counterUserId?: string;
  expectedUSD?: number;
  withoutNotice?: boolean;
  custodianPresent?: boolean;
  explanation?: string;
  journalEntryId?: string;
}

/** A top-up of the petty-cash float (Policy P5 §4.4.1). */
// Cash withdrawn from the bank for approved payment requests, held on 1127 until they are paid.
export interface CashDraw {
  id: string;
  sourceAccountId: string;
  transitAccountId: string;
  date: string;
  amountUSD: number;
  amountSource: number;
  linksJson: string;   // [{ expenseId, voucherNo, netUSD }]
  returnsJson: string; // redeposits of the leftover
  note: string;
  recordedAt: string;
  recordedById: string;
  recordedByName: string;
  journalEntryId: string;
}

export interface CashTopUp {
  id: string;
  bankAccountId: string;
  sourceAccountId: string;
  kind: "replenish" | "establish";
  amountUSD: number;
  reason: string;
  itemsJson: string;
  status: "Raised" | "Queried" | "Approved";
  raisedById: string;
  raisedByName: string;
  raisedAt: string;
  decidedById: string;
  decidedByName: string;
  decidedAt: string;
  queryNote: string;
  sourceDrawId: string; // set when a withdrawal's leftover tops up the float
  journalEntryId: string;
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
  /** sha256 of the bytes — identical files share it, so duplicates collapse. */
  contentHash?: string;
  /** Editable description shown in the materials library. */
  note?: string;
  /** Receipt series number (Cash Receipt only) — RC-nnn/year, stored on the record. */
  receiptNo?: string | null;
  /** True on the client's signed scan: the same receipt, never a second entry in the log. */
  receiptSigned?: boolean;
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
  /** Free text: the live register uses Donor, Governance, Tax and Travel. */
  category: string;
  dueDate: string;
  status: "Pending" | "Done";
  notes: string;
  /** Whose turn it is. Empty = the master account's own checklist. */
  assigneeUserId?: string;
  createdBy?: string;
}

/**
 * One labelled Gmail message the watcher noticed — the minimum needed to decide whether
 * to go and read it. There is no body and no snippet here by design: open it in Gmail.
 * Nothing becomes a record until a person confirms it.
 */
export interface MailHit {
  id: string;
  /** Gmail's message id; the dedup key. Health rows use "watcher-error-YYYY-MM-DD". */
  messageId: string;
  threadId: string;
  /** "mail" = a real message; "watcher" = the watcher could not see the mailbox. */
  kind: "mail" | "watcher";
  sender: string;
  subject: string;
  receivedAt: string;
  /** Opens the thread in Gmail. Empty for health rows. */
  link: string;
  status: "Pending" | "Done";
  /** Whose turn it is to look. Empty = the master account's own list. */
  assigneeUserId?: string;
  createdAt: string;
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
 * One piece of content moving through the editorial pipeline (Policies P3 & P4).
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
  pmApprovedAs?: string;
  pdApprovedBy: string;
  pdApprovedAt: string;
  pdApprovedAs?: string;
  rehearsal?: boolean;         // a walk-through in several seats; never leaves the FMS (11 Sep 2026)
  assigneeAs?: string;         // rehearsal: the author's seat
  factCheckerAs?: string;      // rehearsal: the fact-checker's seat
  factCheckTag: boolean;
  publishedAt: string;
  websiteUrl?: string;         // live page on the website, set by the publish hook
  retractedAt?: string;        // taken off the website (record stays)
  retractReason?: string;
  coverPath?: string;          // vault-relative cover image (GENERAL/Cover/…)
  coverProvider?: string;      // higgsfield | gemini | upload
  corrections: { date: string; nature: string; correction: string; by: string }[];
  materials: { label: string; url: string; kind: "link" | "photo" | "video" | "doc" }[];
  drafts: { label: string; kind: string; text: string; date: string; by: string }[];
  aiAssisted: boolean;
  aiDisclosed: boolean;
  created_at: string;
}

/** One held editorial meeting (Policy P3): attendance, direction, decisions. */
export interface EditorialMeeting {
  id: string;
  kind: "Weekly Editorial" | "Daily Production";
  date: string;
  attendees: string[];
  direction: string;
  notes: string;
  minutes: string;
  topics: { topic: string; note: string; assigneeName?: string; assigneeUserId?: string }[];
  recordedBy: string;
  created_at: string;
}

/** An event or engagement — attended or delivered. `projectId` is empty for the many that belong to none. */
export interface Engagement {
  id: string;
  title: string;
  kind: string;
  ourPart: string;
  org: string;
  place: string;
  startDate: string;
  endDate: string;
  stream: string;
  projectId?: string;
  outcome: string;
  notes: string;
  created_at: string;
}

export interface NetworkContact {
  id: string;
  name: string;
  nameAr: string;
  org: string;
  role: string;
  country: string;
  email: string;
  phone: string;
  links: string;
  kind: string;
  metAt: string;
  /** The engagement record, when the meeting has one; metAt stays as the label otherwise. */
  engagementId?: string;
  metOn: string;
  stream: string;
  followUp: string;
  followUpBy: string;
  status: string;
  notes: string;
  created_at: string;
}

export interface Tool {
  id: string;
  name: string;
  url: string;
  category: string;
  purpose: string;
  stream: string;
  status: string;
  pricing: string;
  owner: string;
  source: string;
  addedOn: string;
  reviewBy: string;
  subscriptionId: string;
  notes: string;
  created_at: string;
}

export interface DatabaseState {
  siteUrl?: string;            // the website's public address (from SITE_PUBLIC_URL) — header link
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
  /** Policy P11 §6 — the quarterly review, sent to the ED and the Finance Officer only. */
  confidentialReview?: { count: number; totalUSD: number; bySource: { codeName: string; count: number; totalUSD: number; lastDate: string }[]; lastReviewedOn: string; due: boolean } | null;
  partnerAccounts: PartnerAccount[];
  documents: AppDoc[];
  auditLogs: AuditLog[];
  /** How many rows the archive really holds — auditLogs carries only the newest 500. */
  auditLogTotal?: number;
  complianceTasks: ComplianceTask[];
  mailHits: MailHit[];
  opportunities: Opportunity[];
  cashCounts: CashCount[];
  cashTopUps: CashTopUp[];
  cashDraws: CashDraw[];
  subscriptions: Subscription[];
  projectActivities: ProjectActivity[];
  /** Donor reports as submitted — append-only (src/lateCosts.ts). */
  donorReportSubmissions?: { id: string; projectId: string; activityId: string; periodStart: string; periodEnd: string; submittedOn: string; evidence: string; currency: string; asSubmittedNative: number | null; usdPerUnit: number | null; note: string; completesObligation: boolean; asSubmittedUSD: number | null; asSubmittedJson: string; basis: string; recordedAt: string; recordedById: string }[];
  contentItems: ContentItem[];
  editorialMeetings: EditorialMeeting[];
  clients: Client[];
  quotations: Quotation[];
  networkContacts: NetworkContact[];
  /** The freelancer pool. Sent whole to the personnel-file roles, as name + skills to managers,
   *  and as [] to everyone else — see poolViewFor in personnelDocs.ts. */
  poolCandidates?: PoolCandidate[];
  engagements: Engagement[];
  tools: Tool[];
  orgSettings: OrgSettings;
  fxRates: { EUR: number; LBP: number };
}
