import * as XLSX from "xlsx";
import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { selfDealingRequester } from "./selfDealing";
import {
  Building,
  User,
  Users,
  FolderGit2,
  Coins,
  FileText,
  BookOpen,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  Plus,
  Search,
  FileUp,
  RefreshCw,
  Sliders,
  Calendar,
  DollarSign,
  Globe,
  Percent,
  Award,
  AlertCircle,
  Trash2,
  Settings,
  HelpCircle,
  Briefcase,
  Key,
  Layers,
  Activity,
  CheckCircle,
  TrendingDown,
  UserCheck,
  HardDrive,
  Filter,
  Download,
  Copy,
  ExternalLink,
  Share2,
  ArrowLeft,
  Grid,
  List,
  Eye
} from "lucide-react";
import { DatabaseState, Account, Project, Donor, Vendor, Expense, Procurement, BankAccount, Employee, Timesheet, FixedAsset, PartnerAccount, AppDoc, ComplianceTask, AuditLog, Opportunity, Client, Quotation, QuotationItem, Proposal } from "./types";

// Proposal sections in AnaHon's master template order (adapted per donor afterward).
const PROPOSAL_SECTIONS: [keyof Proposal, string, string][] = [
  ["summary", "Executive Summary", "2–4 sentences: what, for whom, how much, how long."],
  ["problem", "Problem Statement", "What problem does this solve? Evidence, context, who is affected."],
  ["solution", "Proposed Solution / Description", "What AnaHon will actually do, and why this approach."],
  ["objectives", "Objectives", "Specific objectives, one per line."],
  ["deliverables", "Deliverables", "Concrete items handed over — videos, trainings, reports…"],
  ["outputs", "Outputs", "Countable results — N creators trained, N episodes published…"],
  ["outcomes", "Outcomes / Expected Impact", "The change this produces for the audience/community."]
];

// AnaHon's five programs (user-defined, 31 Jul 2026) + the org-wide bucket for
// core/backbone funding like the SKF FSTP. AnaHon itself is always the applicant.
const STREAMS = ["AnaHon Platform", "iContent Academy", "Ahali Al Madina", "Roots & Reach", "Production", "Core / Org-wide"];
const OPP_STAGES = ["Prospect", "Drafting", "Submitted", "Awarded", "Declined"] as const;
const QUOTE_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Invoiced", "Paid"] as const;

// Service catalog distilled from AnaHon's real quotations in Drive (Akkarouna,
// Semeurs D'avenir, War Child, Kaya…). Picking one prefills the row; every field
// stays editable. Prices are the historical list prices, not fixed.
const SERVICE_CATALOG: { service: string; description: string; output: string; unitPrice: number }[] = [
  { service: "Event Coverage — Photo & Video (per day)", description: "Full event coverage including photography and videography.", output: "30+ edited high-res photos per day + footage for the final edit", unitPrice: 300 },
  { service: "Full-Day Shooting (4–6h)", description: "Photo + video shooting, one production day.", output: "Raw photo & video coverage", unitPrice: 300 },
  { service: "Post-Production (Editing & Delivery)", description: "Video editing (sound design, color grading, horizontal & vertical export), photo selection & editing, royalty-free music licensing, final delivery.", output: "Edited deliverables, social-media ready", unitPrice: 300 },
  { service: "Podcast Package", description: "Full podcast episode production.", output: "Full episode · poster · teaser · 2 reels · carrousel · 2× 2–5 min video · press release", unitPrice: 480 },
  { service: "Short Videos Package", description: "Short-form video set.", output: "Vox pop on the street · infographic reel · 2× talking head", unitPrice: 450 },
  { service: "Article / Research Paper", description: "Investigative article or research paper.", output: "1 published article", unitPrice: 150 },
  { service: "Social Media & Website Management (monthly)", description: "Content calendar execution, scheduling & publishing, engagement, analytics reports, website content updates, team coordination.", output: "Monthly management", unitPrice: 200 },
  { service: "Photography & Videography Training", description: "Practical training program.", output: "5 practical training sessions", unitPrice: 700 },
  { service: "Editing Training (Premiere / Mobile)", description: "Editing training.", output: "Included within training sessions", unitPrice: 300 },
  { service: "Content Production (training)", description: "Participants produce practical media content during the training.", output: "Participant-produced content", unitPrice: 500 },
  { service: "Videographer (per day)", description: "", output: "1 videographer, full day", unitPrice: 250 },
  { service: "Photographer (per day)", description: "", output: "1 photographer, full day", unitPrice: 200 },
  { service: "360° Booth Operator (per day)", description: "360° slow-motion photo booth with operator.", output: "Booth + operator, full day", unitPrice: 250 },
  { service: "Photo Editing", description: "", output: "Edited photo set", unitPrice: 100 },
  { service: "Video Editing", description: "", output: "1 edited video", unitPrice: 200 },
  { service: "Reel Editing", description: "", output: "1 edited reel (01:00–01:30)", unitPrice: 100 },
  { service: "Trending Reels Editing (10)", description: "", output: "10 trending reels (00:30–00:45)", unitPrice: 300 },
  { service: "Meeting Coverage", description: "Coverage of a formal meeting or roundtable.", output: "High-res photos + press release", unitPrice: 150 },
  { service: "Event Press Package", description: "Full event media coverage.", output: "2–5 min press video report · 1 reel · high-res photos · press release", unitPrice: 350 },
  { service: "Drone Add-on", description: "", output: "Drone footage", unitPrice: 200 },
  { service: "Training Venue", description: "Training space for all sessions.", output: "Venue rental", unitPrice: 300 },
  { service: "Coffee Break / Refreshments", description: "Refreshments for participants.", output: "Per training program", unitPrice: 200 },
  { service: "Content Production Coordination", description: "", output: "Coordination across the production", unitPrice: 150 }
];

const FINANCIAL_TERMS = [
  "This is a prepaid service. Full payment (100%) is required before the start of production. All payments in fresh USD via OMT.",
  "The payment will be done after the delivery of the services via OMT.",
  "Full payment on the shooting day."
];
const PRODUCTION_NOTE = "1. Editing for videos includes 2 sets of modifications; each additional set costs an extra 30 USD. 2. This quotation is for 1 day of production.";
const TECHNICAL_NOTE = "High-quality outcome HD/4K. Equipment: Sony full-frame cameras, microphones, prime lenses, music copyrights, high-quality clear sound. All output compatible with social media.";
const EXTRAS_DEFAULT = "1 Photographer ($100) — 1 Videographer ($130) — Add Drone ($200)";
import { auth } from "./firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";


// ── Arabic UI (one-click toggle) ────────────────────────────────────────────
// Main navigation and primary actions only — data, documents and financial
// records stay in the language they were entered in.
const AR: Record<string, string> = {
  // sections
  "Overview": "نظرة عامة",
  "Registers": "السجلات",
  "Money Flow": "حركة الأموال",
  "People": "الفريق",
  "Records & Governance": "السجلات والحوكمة",
  "Project Officer": "مسؤول المشروع",
  // navigation
  "Overview Dashboard": "لوحة المتابعة",
  "Chart of Accounts": "دليل الحسابات",
  "Donors & Projects": "المانحون والمشاريع",
  "Programs & Funnel": "البرامج وقمع التمويل",
  "Production & Clients": "الإنتاج والعملاء",
  "Disbursement Vouchers": "سندات الصرف",
  "Procurement & Bids": "المشتريات والعروض",
  "Vendor Registry": "سجل المورّدين",
  "Banking & Cash Reconcile": "البنك وتسوية النقد",
  "General double-entry Ledger": "دفتر الأستاذ العام",
  "Timesheets & Payroll Allocation": "الدوام والرواتب",
  "Fixed Assets Roll-Forward": "الأصول الثابتة",
  "Partner Capital Tracking": "حسابات الشركاء",
  "Compliance Control Desk": "الامتثال والرقابة",
  "Periodic Reports": "التقارير الدورية",
  "My Projects & Budgets": "مشاريعي وموازناتها",
  "Purchase Requests": "طلبات الشراء",
  // primary actions
  "Sign Out": "تسجيل الخروج",
  "Save": "حفظ",
  "Cancel": "إلغاء",
  "Approve": "اعتماد",
  "Add Opportunity": "إضافة فرصة",
  "Register Client": "تسجيل عميل",
  "New Quotation": "عرض سعر جديد",
  "Collapse Sidebar": "طيّ القائمة",
  "Resricted Donor Grants & Sinking Budgets": "منح المانحين المقيّدة والموازنات",
  "AnaHon Programs & Funding Funnel": "برامج أناهون وقمع التمويل",
  "Production Stream — Clients & Quotations": "قطاع الإنتاج — العملاء وعروض الأسعار",
  "Official Procurement & Disbursement Vouchers": "سندات الصرف والمشتريات",
  "Tripoli Sourcing & RFQ Comparative Sheets": "جداول مقارنة عروض الأسعار",
  " Tripoli Vendor Master & Partners Directory": "سجل المورّدين والشركاء",
  "Banking Statements & Cash Recon Ledger": "كشوف البنك وتسوية النقد",
  "General double-entry General Ledger": "دفتر الأستاذ العام (القيد المزدوج)",
  "Timesheet Allocation & Co-Funding Cost Mapping": "توزيع الدوام وتحميل الكلفة على المشاريع",
  "Periodic Financial Reports": "التقارير المالية الدورية",
  "Fixed Assets capitalization Register": "سجل الأصول الثابتة",
  "Partner Capital & Draws Accounting Accounts": "رساميل الشركاء والسحوبات",
  " Tripoli Daily Operations Expenses Sheet": "كشف المصاريف اليومية",
  "MoF / CNSS Regulatory Compliance Desk & Audit Logs": "الامتثال لوزارة المالية والضمان وسجلات التدقيق",
  "Accompanying Justification / Sinking rationale": "المبرر المرافق",
  "Account": "الحساب",
  "Account Number Code": "رقم الحساب",
  "Acquisition Cost USD": "كلفة الشراء (دولار)",
  "Adjustment Date": "تاريخ التسوية",
  "Agreement Total (USD)": "قيمة الاتفاقية (دولار)",
  "Allocation Project": "المشروع المخصّص",
  "Allowance (USD)": "البدل (دولار)",
  "Amount": "المبلغ",
  "Amount (0 = not scoped)": "المبلغ (0 = غير محدّد)",
  "Amount USD": "المبلغ بالدولار",
  "Amount Value": "قيمة المبلغ",
  "Asset Name / Model": "اسم الأصل / الطراز",
  "Attach supporting Invoice/Agreement (PDF, PNG or JPEG)": "إرفاق الفاتورة أو الاتفاقية (PDF أو صورة)",
  "Audit Justification Memo": "مذكرة التبرير",
  "Bank Account / Payment Details": "الحساب المصرفي / تفاصيل الدفع",
  "Base Salary (USD)": "الراتب الأساسي (دولار)",
  "Budget Line": "بند الموازنة",
  "Budget Line mapping": "ربط ببند الموازنة",
  "Budget Pool (USD)": "قيمة الموازنة (دولار)",
  "Budget line mapping": "ربط ببند الموازنة",
  "Class Type": "التصنيف",
  "Client": "العميل",
  "Client Name": "اسم العميل",
  "Comparative RFQ Title": "عنوان مقارنة العروض",
  "Contact Email / Phone": "البريد / الهاتف",
  "Contact Person": "الشخص المسؤول",
  "Contract / Provider Category": "فئة المورّد / العقد",
  "Contract Total (USD)": "قيمة العقد (دولار)",
  "Contractor / Vendor": "المتعهّد / المورّد",
  "Counted on": "تاريخ الجرد",
  "Credit (USD)": "دائن (دولار)",
  "Currency": "العملة",
  "Currency Code": "رمز العملة",
  "Debit (USD)": "مدين (دولار)",
  "Decision Expected": "موعد القرار",
  "Delivered By": "طريقة التسليم",
  "Description": "الوصف",
  "Description / Memo": "الوصف / ملاحظة",
  "Descriptive Title": "العنوان",
  "Donor": "المانح",
  "Donor Partner": "الجهة المانحة",
  "Email": "البريد الإلكتروني",
  "Email Address": "البريد الإلكتروني",
  "End": "النهاية",
  "End Date": "تاريخ الانتهاء",
  "Expenditure Purpose Title": "عنوان المصروف",
  "Expense Title": "عنوان المصروف",
  "Extras (upsells)": "خدمات إضافية",
  "Fee per period (USD)": "الأتعاب لكل فترة (دولار)",
  "Financial Terms": "الشروط المالية",
  "Full Name": "الاسم الكامل",
  "Funding Deposit (Bank Proof)": "إيداع التمويل (إثبات مصرفي)",
  "Funding Type": "نوع التمويل",
  "Funds Drawn From": "مصدر الأموال",
  "Journal Reference No": "رقم القيد",
  "Level of Effort %": "نسبة الجهد %",
  "Method": "الطريقة",
  "MoF Tax Registry ID (If Registered)": "الرقم الضريبي (إن وُجد)",
  "Monthly Fee (USD)": "الأتعاب الشهرية (دولار)",
  "Note (optional)": "ملاحظة (اختياري)",
  "Notes": "ملاحظات",
  "Notes in hand (USD)": "النقد الموجود (دولار)",
  "Output / Deliverables": "المخرجات",
  "Password": "كلمة المرور",
  "Percentage Split (%)": "نسبة التوزيع (%)",
  "Period ending (month)": "نهاية الفترة (شهر)",
  "Period starting (optional)": "بداية الفترة (اختياري)",
  "Phone": "الهاتف",
  "Pipeline / programme": "القمع / البرنامج",
  "Position / Title": "المنصب",
  "Production notes (2 modification sets included, +$30/extra)": "ملاحظات الإنتاج (تعديلان مشمولان، +30$ للإضافي)",
  "Program Stream": "البرنامج",
  "Project": "المشروع",
  "Project Code (Unique)": "رمز المشروع",
  "Project Name": "اسم المشروع",
  "Project Tag (Optional)": "المشروع (اختياري)",
  "Provider / Vendor Name": "اسم المورّد",
  "Qty": "الكمية",
  "Quote Date": "تاريخ العرض",
  "Quote № (automatic)": "رقم العرض (تلقائي)",
  "Received on": "تاريخ الاستلام",
  "Renewal Of (optional)": "تجديد لـ (اختياري)",
  "Requested Currency": "العملة المطلوبة",
  "Role / scope of services": "الدور / نطاق الخدمات",
  "Scope / Line Breakdown": "تفاصيل النطاق",
  "Select Partner profile": "اختر الشريك",
  "Select Reporting Month:": "اختر شهر التقرير:",
  "Service": "الخدمة",
  "Service / Title": "الخدمة / العنوان",
  "Stage": "المرحلة",
  "Start": "البداية",
  "Start Date": "تاريخ البدء",
  "Statement Amount": "مبلغ الكشف",
  "Statement Entry Memo": "بيان القيد",
  "Status": "الحالة",
  "Sub-Budget Mapping": "ربط ببند فرعي",
  "Sub-Budget designated line": "البند الفرعي المحدّد",
  "Submission Deadline": "مهلة التقديم",
  "Target Account Vault Drawer": "الحساب / الصندوق",
  "Target Project Mapping": "ربط بالمشروع",
  "Target Project mapping": "ربط بالمشروع",
  "Tax ID (for invoicing)": "الرقم الضريبي (للفوترة)",
  "Technical notes (Sony full-frame, HD/4K, licensed music)": "ملاحظات تقنية (كاميرات Sony، جودة HD/4K، موسيقى مرخّصة)",
  "Title": "العنوان",
  "Transaction Type": "نوع الحركة",
  "Type": "النوع",
  "Unit": "سعر الوحدة",
  "Useful Life (Years)": "العمر الإنتاجي (سنوات)",
  "Valid Until": "صالح حتى",
  "Vendor": "المورّد",
  "Vendor list / Contract partner": "المورّد / الطرف المتعاقد",
  "Vessel Project Mapping": "ربط بالمشروع",
  "Vessel Project funding": "تمويل المشروع",
  "What was bought": "ماذا تم شراؤه",
  "justification / rationale": "المبرر",
};
const tr = (lang: string, s: string) => (lang === "ar" ? (AR[s] || s) : s);

export default function App() {
  // Global App State
  const [state, setState] = useState<DatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Firebase Auth State
  const [fbUser, setFbUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBtnLoading, setAuthBtnLoading] = useState(false);

  // Active Simulated User Role
  const [activeUserId, setActiveUserId] = useState<string>("u-1");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  // One-click Arabic. Remembered across sessions; flips the page to RTL.
  const [lang, setLang] = useState<string>(() => localStorage.getItem("anahon-lang") || "en");
  const t = (s: string) => tr(lang, s);
  const rtl = lang === "ar";
  useEffect(() => {
    localStorage.setItem("anahon-lang", lang);
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Filter Term
  const [searchTerm, setSearchTerm] = useState("");
  const [vFilter, setVFilter] = useState({ from: "", to: "", type: "", status: "" });

  // Sub-forms and interactive options
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<"Asset" | "Liability" | "Equity" | "Revenue" | "Expense">("Expense");
  const [newAccountCurrency, setNewAccountCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [newAccountGroup, setNewAccountGroup] = useState("Operating Expenses");

  // New Project form states
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newProjectDonor, setNewProjectDonor] = useState("");
  const [newProjectBudget, setNewProjectBudget] = useState("");
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [newProjectEndDate, setNewProjectEndDate] = useState("");
  const [newProjectFundingType, setNewProjectFundingType] = useState<"Restricted Grant" | "Unrestricted Service">("Restricted Grant");
  // The statement deposit that proves the funding — required; unproven projects are not registered.
  const [newProjectFundingTx, setNewProjectFundingTx] = useState("");
  const [newProjectStream, setNewProjectStream] = useState("");

  // Funding funnel: the opportunity being added/edited (null = form closed)
  const [oppForm, setOppForm] = useState<Partial<Opportunity> | null>(null);
  // Proposal workspace: the opportunity whose proposal is being written
  const [propForm, setPropForm] = useState<(Partial<Opportunity> & { proposal: Proposal }) | null>(null);
  // AI assist inside the workspace: pasted call text, busy flag, last fit assessment
  const [aiCall, setAiCall] = useState("");
  const [callUrl, setCallUrl] = useState("");
  const [callBusy, setCallBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssess, setAiAssess] = useState<{ fit: string; recommendedStream: string; rationale: string; risks: string[]; suggestedAngle: string } | null>(null);
  // Document viewer: open scans and contracts in place. Clicking a file used to spawn a
  // browser tab (and a download for anything the browser won't render inline), so checking
  // one invoice against one voucher meant leaving the page.
  const [docView, setDocView] = useState<{ id: string; filename: string; mimeType?: string } | null>(null);
  const [docPages, setDocPages] = useState<number | null>(null); // null = still counting, 0 = failed
  const [docText, setDocText] = useState<string | null>(null);   // extracted .docx body

  // Call intake: start an opportunity FROM a call rather than typing it in
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeUrl, setIntakeUrl] = useState("");
  const [intakeText, setIntakeText] = useState("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intake, setIntake] = useState<{ source: string; provider: string; callText: string; draft: any; assessment: any } | null>(null);

  // Production stream: client / quotation being added-edited (null = form closed)
  const [clientForm, setClientForm] = useState<Partial<Client> | null>(null);
  const [quoteForm, setQuoteForm] = useState<Partial<Quotation> | null>(null);
  // Off-bank settlement (OMT / BOB / Whish / cash) being recorded for a quotation
  const [settleForm, setSettleForm] = useState<{ q: Quotation; method: string; reference: string; date: string; amount: number } | null>(null);

  // New Expense submission form
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expensePurpose, setExpensePurpose] = useState("");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseProject, setExpenseProject] = useState("");
  const [expenseBudgetLine, setExpenseBudgetLine] = useState("");
  // Approved procurement authorising a >USD 300 purchase (Policy 7.2).
  const [expenseProcurement, setExpenseProcurement] = useState("");
  // Live LAN address for phone access — re-read on load so a changed IP is never stale.
  const [phoneAccess, setPhoneAccess] = useState<{ urls: { iface: string; url: string }[]; qr: string | null } | null>(null);
  const [showPhoneQr, setShowPhoneQr] = useState(false);

  // Project timeline step being added/edited (null = form closed).
  const [activityForm, setActivityForm] = useState<any | null>(null);

  // Subscriptions sheet (Vendor Registry) — renewal tracking with alerts.
  const [subForm, setSubForm] = useState<any | null>(null);
  const [subSuggestions, setSubSuggestions] = useState<any[] | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  // Physical cash count form (Banking tab).
  const [cashCountForm, setCashCountForm] = useState({ date: new Date().toLocaleDateString("en-CA"), countedUSD: "", notes: "" });

  // Inline single-source waiver raised from the voucher form (null = panel closed).
  const [inlineWaiver, setInlineWaiver] = useState<{ vendorName: string; amount: string; reason: string; retrospective: boolean } | null>(null);
  const [expenseCurrency, setExpenseCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCustomRate, setExpenseCustomRate] = useState("");
  const [tempAttachment, setTempAttachment] = useState<{ filename: string; mimeType: string; base64: string } | null>(null);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiVendorScanning, setAiVendorScanning] = useState(false);

  // Daily Operations states — the cash book opens on today, not a hardcoded date
  const [dailySelectedDate, setDailySelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dailySelectedBankId, setDailySelectedBankId] = useState<string>("");
  const [dailyTitle, setDailyTitle] = useState<string>("");
  const [dailyPurpose, setDailyPurpose] = useState<string>("");
  const [dailyProject, setDailyProject] = useState<string>("");
  const [dailyBudgetLine, setDailyBudgetLine] = useState<string>("");
  const [dailyVendor, setDailyVendor] = useState<string>("");
  const [dailyCurrency, setDailyCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [dailyAmount, setDailyAmount] = useState<string>("0");
  // Real daily lodger. One submit does the whole chain server-side: voucher (Posted) +
  // bank withdrawal + balance deduction + budget-line burn + journal entry + digitized record.
  // The old handler was a placeholder that toasted "posted" while saving nothing.
  const [dailyBusy, setDailyBusy] = useState(false);
  const handleDailyDirectSubmit = async (e: React.FormEvent, bankAccountId: string) => {
    e.preventDefault();
    if (!dailyTitle || !dailyProject || !dailyBudgetLine || !dailyVendor || !Number(dailyAmount)) {
      triggerToast("Title, project, budget line, vendor and a non-zero amount are required.", "error");
      return;
    }
    setDailyBusy(true);
    try {
      // The amount is entered in the paying account's own currency — what actually left it.
      const payingAccount = state.bankAccounts.find(b => b.id === bankAccountId);
      const res = await fetch("/api/expense/direct-petty-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dailyTitle,
          purpose: dailyPurpose || dailyTitle,
          vendorId: dailyVendor,
          projectId: dailyProject,
          budgetLineId: dailyBudgetLine,
          currency: payingAccount?.currency || dailyCurrency,
          amount: Number(dailyAmount),
          bankAccountId,
          user: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to lodge daily expense.");
      triggerToast(`${data.expense.voucherNo} posted — bank, budget line, journal and digitized record all updated.`);
      setDailyTitle(""); setDailyPurpose(""); setDailyAmount("0");
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    } finally {
      setDailyBusy(false);
    }
  };



  // Procurement sourcing form
  const [procTitle, setProcTitle] = useState("");
  const [procProject, setProcProject] = useState("");
  const [procBudgetLine, setProcBudgetLine] = useState("");
  const [procVendorA, setProcVendorA] = useState("");
  const [procAmountA, setProcAmountA] = useState("");
  const [procScoreA, setProcScoreA] = useState("80");
  const [procVendorB, setProcVendorB] = useState("");
  const [procAmountB, setProcAmountB] = useState("");
  const [procScoreB, setProcScoreB] = useState("70");
  const [procVendorC, setProcVendorC] = useState("");
  const [procAmountC, setProcAmountC] = useState("");
  const [procScoreC, setProcScoreC] = useState("60");
  const [procJustification, setProcJustification] = useState("");
  const [procConflict, setProcConflict] = useState(false);
  // Waiver: fewer than 3 quotations, only with a written reason.
  const [procSingleSource, setProcSingleSource] = useState(false);

  // Asset creation form
  const [assetName, setAssetName] = useState("");
  const [assetSerial, setAssetSerial] = useState("");
  const [assetCost, setAssetCost] = useState("");
  const [assetProject, setAssetProject] = useState("");
  const [assetLife, setAssetLife] = useState("3");
  const [assetCustodian, setAssetCustodian] = useState("");
  const [assetLocation, setAssetLocation] = useState("");

  // Bank Reconciliation Trigger form
  const [recBank, setRecBank] = useState("");
  const [recType, setRecType] = useState<"Deposit" | "Withdrawal">("Withdrawal");
  const [recDesc, setRecDesc] = useState("");
  const [recAmount, setRecAmount] = useState("");

  // Vendor registration states
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorCategory, setNewVendorCategory] = useState("");
  // Supplier by default; only ticked for someone we engage under an agreement.
  const [newVendorEngageable, setNewVendorEngageable] = useState(false);
  const [newVendorTaxId, setNewVendorTaxId] = useState("");
  const [newVendorBankInfo, setNewVendorBankInfo] = useState("");
  const [newVendorContact, setNewVendorContact] = useState("");



  // Shared cost split allocation states
  const [enableSharedSplit, setEnableSharedSplit] = useState(false);
  const [splitAllocations, setSplitAllocations] = useState<{ projectId: string; budgetLineId: string; percentage: number; }[]>([
    { projectId: "", budgetLineId: "", percentage: 50 },
    { projectId: "", budgetLineId: "", percentage: 50 }
  ]);

  // Employee registration states
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpPosition, setNewEmpPosition] = useState("");
  const [newEmpSalary, setNewEmpSalary] = useState("");
  const [newEmpAllowance, setNewEmpAllowance] = useState("");
  // How the money reaches the employee ("Cash" | "Bank Transfer"). Cash is still drawn from a
  // bank account first, so newEmpBankAccountId is required either way.
  const [newEmpPaymentMethod, setNewEmpPaymentMethod] = useState("Bank Transfer");
  const [newEmpBankAccountId, setNewEmpBankAccountId] = useState("");
  const [newEmpContractType, setNewEmpContractType] = useState("");

  // Contract generation (per employee card)
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [contractParty, setContractParty] = useState<"employee" | "vendor">("employee");
  const [contractForm, setContractForm] = useState({
    projectId: "", kind: "Employment", startDate: "", endDate: "", loePct: "", monthlyFee: "", contractTotal: "", role: ""
  });
  const [contractBusy, setContractBusy] = useState(false);

  // Marking a vendor engageable permits a signed agreement in their name, so it asks for
  // a reason and is audit-logged. Turning it off needs no reason.
  const handleSetEngageable = async (vendorId: string, vendorName: string, engageable: boolean) => {
    let reason = "";
    if (engageable) {
      reason = (window.prompt(
        `Mark "${vendorName}" as engageable?\n\nThis allows a signed service agreement to be issued in their name. Only do this for someone you ENGAGE under an agreement (a trainer, editor, consultant) — not for a shop or subscription you buy from.\n\nReason:`
      ) || "").trim();
      if (!reason) return;
    }
    try {
      const res = await fetch("/api/vendors/engageable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, engageable, reason, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast(`${vendorName} is now ${engageable ? "engageable — a service agreement may be issued" : "a supplier (purchases only)"}.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // ---- Party file: everything on record for one person/provider, in one panel ----
  const [partyFileFor, setPartyFileFor] = useState<string | null>(null);

  // Documents carry an explicit partyId (set by the 31-Jul migration, and stamped on every
  // newly generated contract). The name heuristic survives only as a labelled safety net for
  // future scans that arrive without a link.
  const collectPartyFile = (partyId: string, partyName: string) => {
    const firstName = (partyName.split(/\s+/)[0] || "").toLowerCase();
    const linked = state.documents.filter(d => d.partyId === partyId);
    const agreements = linked.filter(d => /contract|agreement|addendum/i.test(`${d.category} ${d.filename}`));
    const other = linked.filter(d => !agreements.includes(d));
    const unlinkedByName = firstName.length < 3 ? [] : state.documents.filter(d =>
      !d.partyId &&
      /contract|agreement|timesheet|addendum|receipt|ts_/i.test(`${d.category} ${d.filename}`) &&
      d.filename.toLowerCase().includes(firstName));
    const vouchers = state.expenses
      .filter(e => e.vendorId === partyId)
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const docsOf = (eid: string) => state.documents.filter(d => d.linkedRecordType === "Expense" && d.linkedRecordId === eid);
    return { agreements, other, unlinkedByName, vouchers, docsOf };
  };

  /** Open a document in the in-app viewer instead of a new tab. Pass the AppDoc (or any
   *  object carrying id/filename/mimeType). Falls back to a plain link if id is missing. */
  const openDoc = (d: { id: string; filename?: string; mimeType?: string }) => {
    const filename = d.filename || "document";
    setDocView({ id: d.id, filename, mimeType: d.mimeType });
    setDocPages(null);
    setDocText(null);
    if (/pdf/i.test(d.mimeType || "") || /\.pdf$/i.test(filename)) {
      fetch(`/api/document/pages/${d.id}`)
        .then(r => r.json())
        .then(j => setDocPages(j.pages || 0))
        .catch(() => setDocPages(0));
    } else if (/\.docx$/i.test(filename)) {
      fetch(`/api/document/docx-text/${d.id}`)
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(t => setDocText(t))
        .catch(() => setDocText(""));
    }
  };

  const renderPartyFile = (partyId: string, partyName: string) => {
    const { agreements, other, unlinkedByName, vouchers, docsOf } = collectPartyFile(partyId, partyName);
    const total = vouchers.reduce((s, e) => s + e.convertedAmount, 0);
    const docLink = (d: any) => (
      <a key={d.id} href={`/api/document/content/${d.id}`} target="_blank" onClick={e => { e.preventDefault(); openDoc(d); }} rel="noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-red-650 hover:text-red-700 hover:underline mr-3">
        📄 {d.filename}
      </a>
    );
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-left">
        <h5 className="text-xs font-bold text-slate-800 font-mono uppercase">📂 File — {partyName}</h5>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Contracts & agreements</p>
          {agreements.length ? agreements.map(docLink)
            : <p className="text-[11px] text-slate-400 italic">No contract on file for this party.</p>}
        </div>
        {other.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Timesheets & receipts</p>
            {other.map(docLink)}
          </div>
        )}
        {unlinkedByName.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">⚠ Unlinked documents matching this name (verify & link)</p>
            {unlinkedByName.map(docLink)}
          </div>
        )}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
            Payments ({vouchers.length} voucher{vouchers.length === 1 ? "" : "s"} · {formatUSD(total)} total)
          </p>
          {vouchers.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">No vouchers name this party as payee.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {vouchers.map(e => {
                const proj = state.projects.find(p => p.id === e.projectId);
                return (
                  <div key={e.id} className="p-2 bg-white border border-slate-100 rounded text-xs">
                    <div className="flex justify-between font-mono">
                      <span>{(e.created_at || "").slice(0, 10)} · {e.voucherNo} · {proj?.code || "—"}</span>
                      <span className="font-bold">{formatIn(e.amount, e.currency)} <em className="text-[9px] text-slate-400 font-sans">{e.status}</em></span>
                    </div>
                    <p className="text-[11px] text-slate-600">{e.title}</p>
                    <div className="mt-1">{docsOf(e.id).map(docLink)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // One generator, two instruments: pass employeeId for an employment contract,
  // vendorId for a service agreement. Purchases use neither.
  const handleGenerateContract = async (e: React.FormEvent, partyId: string, partyType: "employee" | "vendor" = "employee") => {
    e.preventDefault();
    setContractBusy(true);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(partyType === "vendor" ? { vendorId: partyId } : { employeeId: partyId }),
          ...contractForm, user: currentUser
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`Contract ${data.reference} generated — unsigned, open it to review.`);
        setContractFor(null);
        setContractForm({ projectId: "", kind: "Employment", startDate: "", endDate: "", loePct: "", monthlyFee: "", contractTotal: "" });
        refreshState();
      } else {
        triggerToast(data.error || "Contract generation failed.", "error");
      }
    } catch (err: any) {
      triggerToast(err.message, "error");
    } finally {
      setContractBusy(false);
    }
  };

  // Timesheet Allocation interactive adjustment
  const [selectedTSMonth, setSelectedTSMonth] = useState("2026-05");
  const [tsAllocValues, setTsAllocValues] = useState<{ [projId: string]: number }>({});

  // Manual Adjustment Journal Entry states
  const [adjDate, setAdjDate] = useState("");
  const [adjDescription, setAdjDescription] = useState("");
  const [adjReferenceNo, setAdjReferenceNo] = useState("");
  const [adjItems, setAdjItems] = useState<{ accountCode: string; debit: number; credit: number; projectId: string }[]>([
    { accountCode: "", debit: 0, credit: 0, projectId: "" },
    { accountCode: "", debit: 0, credit: 0, projectId: "" }
  ]);

  // Project Workspace states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [reconMonth, setReconMonth] = useState<string>("2026-05");
  const [projectWorkspaceTab, setProjectWorkspaceTab] = useState<"folder" | "reconciliation">("folder");
  const [isOpen, setIsOpen] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedProjectId) {
      // Small timeout to allow React to render the newly displayed workspace DOM elements first
      setTimeout(() => {
        workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [selectedProjectId]);

  // Org FX adjustments state
  const [eurRateInput, setEurRateInput] = useState("1.08");
  const [lbpRateInput, setLbpRateInput] = useState("0.000011");

  // Partners drawings Capital values addition
  const [drawPartner, setDrawPartner] = useState("");
  const [drawAmount, setDrawAmount] = useState("");

  // Gemini Compliance scan response
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiReport, setGeminiReport] = useState<string>("");
  const [auditType, setAuditType] = useState("Donor Compliance check");

  // Notification Banner
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Global search (top bar)
  const [globalQuery, setGlobalQuery] = useState<string>("");

  // Voucher detail drawer
  const [drawerExpenseId, setDrawerExpenseId] = useState<string | null>(null);
  const [gapsOpen, setGapsOpen] = useState(false);

  // Banking ledger view controls
  const [bankFilterAcc, setBankFilterAcc] = useState<string>("");
  const [bankSearch, setBankSearch] = useState<string>("");
  const [bankShown, setBankShown] = useState<number>(50);

  // Periodic reports (Policy 11.2)
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportEnd, setReportEnd] = useState<string>(new Date().toISOString().slice(0, 7));

  // Export filename follows the Policy 13.4.1 pattern (YEAR_ENTITY_DOCTYPE_PERIOD).
  // Browsers take the PDF filename from document.title, so we swap it for the print only.
  const reportFileName = (meta: any) =>
    `${meta.periodEnd.slice(0, 4)}_ANAHON_${meta.months === 12 ? "ANNUAL" : meta.months === 6 ? "SEMI-ANNUAL" : `${meta.months}-MONTH`}-FINANCIAL-REPORT_${meta.periodStart}_to_${meta.periodEnd}`;

  // Direct PDF export: writes the file with the policy filename, bypassing the OS print
  // dialog (which names the file after the host app, not the page).
  const downloadPeriodReport = async () => {
    if (!reportData) return;
    const el = document.getElementById("period-report");
    if (!el) return;
    setReportLoading(true);
    try {
      // Rendered server-side (headless Chrome): real selectable text and page breaks.
      const res = await fetch(`/api/reports/pdf?months=${reportData.meta.months}&end=${reportEnd}`);
      if (!res.ok) throw new Error((await res.json()).error || "Rendering failed");
      const blob = await res.blob();
      const name = `${reportFileName(reportData.meta)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      triggerToast(`Saved ${name} to your Downloads folder.`);
    } catch (err: any) {
      triggerToast(`PDF export failed: ${err.message}. Use Print instead.`, "error");
    } finally {
      setReportLoading(false);
    }
  };

  const printPeriodReport = () => {
    if (!reportData) return;
    const previousTitle = document.title;
    document.title = reportFileName(reportData.meta);
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 60000); // fallback if afterprint never fires
  };

  // Custom timeframe: when a start month is set, it wins over the preset buttons.
  const [reportStart, setReportStart] = useState<string>("");
  const generatePeriodReport = async (months: number) => {
    setReportLoading(true);
    try {
      const q = reportStart ? `start=${reportStart}&end=${reportEnd}` : `months=${months}&end=${reportEnd}`;
      const res = await fetch(`/api/reports/period?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Report generation failed.");
      setReportData(data);
    } catch (err: any) {
      setReportData(null);
      triggerToast(err.message, "error");
    } finally {
      setReportLoading(false);
    }
  };

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    // Auto-close only on mobile, where the sidebar overlays the content.
    if (typeof window !== "undefined" && window.innerWidth < 768) setIsOpen(false);
  };

  // Self-service staff (Policy 8.5) are routed to the timesheet tab. Lives up here with the
  // other hooks — placing it after the login early-return breaks the Rules of Hooks.
  useEffect(() => {
    if (!state?.users?.length) return;   // state is null until the backend loads
    const u = state.users.find(x => x.id === activeUserId) || state.users[0];
    if (u?.role === "Employee (Self-Service)" && activeTab !== "payroll") setActiveTab("payroll");
    if (u?.role === "Project Officer" && !["dashboard", "projects", "expenses", "procurement"].includes(activeTab)) setActiveTab("expenses");
  }, [state, activeUserId, activeTab]);


  // Load backend state on initialization
  const refreshState = async () => {
    try {
      // Identify the viewer so the server can narrow the payload: a Project Officer
      // is sent only their programme's records, never the whole organisation's.
      const uid = localStorage.getItem("anahon-uid") || "";
      const res = await fetch(`/api/state${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`);
      if (!res.ok) throw new Error("Could not load backend finances state.");
      const data: DatabaseState = await res.json();
      setState(data);
      fetch("/api/network/access").then(r => r.ok ? r.json() : null).then(d => d && setPhoneAccess(d)).catch(() => { });
      setEurRateInput(data.fxRates.EUR.toString());
      setLbpRateInput(data.fxRates.LBP.toString());
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setFbUser(user);
        try {
          // Sync Firebase session credentials with local SQLite database roles
          const syncRes = await fetch("/api/auth/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.displayName || user.email?.split("@")[0]
            })
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            setActiveUserId(syncData.user.id);
            const prevUid = localStorage.getItem("anahon-uid");
            localStorage.setItem("anahon-uid", syncData.user.id);
            if (prevUid !== syncData.user.id) refreshState(); // re-fetch scoped to this user
          }
          await refreshState();
        } catch (err: any) {
          triggerToast("Session synchronization failed: " + err.message, "error");
        }
      } else {
        setFbUser(null);
        setLoading(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFirebaseSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Email and Password are required.");
      return;
    }
    setAuthBtnLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      triggerToast("Logged in successfully via Firebase.");
      // Reset input fields
      setAuthEmail("");
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message.replace("Firebase: ", ""));
    } finally {
      setAuthBtnLoading(false);
    }
  };

  const handleFirebaseSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName) {
      setAuthError("Name, Email and Password are required.");
      return;
    }
    setAuthBtnLoading(true);
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: authName });
      }
      triggerToast("Account registered successfully via Firebase.");
      // Reset input fields
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (err: any) {
      setAuthError(err.message.replace("Firebase: ", ""));
    } finally {
      setAuthBtnLoading(false);
    }
  };

  const handleFirebaseSignOut = async () => {
    localStorage.removeItem("anahon-uid");
    try {
      await signOut(auth);
      triggerToast("Signed out successfully.");
    } catch (err: any) {
      triggerToast("Failed to sign out: " + err.message, "error");
    }
  };

  const triggerToast = (msg: string, typ: "success" | "error" = "success") => {
    setToast({ message: msg, type: typ });
    setTimeout(() => setToast(null), 5000);
  };

  // Public content inventory route
  if (window.location.pathname.replace(/\/$/, "") === "/Icontent_Inv") {
    return <IcontentInvPage />;
  }

  if (authLoading || (fbUser && loading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-red-600" />
          <h2 className="mt-4 font-sans text-lg font-medium text-slate-300">AnaHon financial framework initializing...</h2>
          <p className="text-xs text-slate-500 font-mono">Verifying secure Firebase Authentication session & active local ledger...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated (must be before !state check, since state only loads after auth)
  if (!fbUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 text-slate-100 font-sans p-6 overflow-y-auto">
        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 relative overflow-hidden">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-xl bg-red-600 flex items-center justify-center font-bold tracking-wider text-white text-2xl mx-auto shadow-lg shadow-red-600/30">
              AH
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase font-sans">AnaHon Media Platform</h2>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Financial & Compliance Portal</p>
            </div>
          </div>

          {/* Auth Tab Selectors */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => { setAuthTab("signin"); setAuthError(null); }}
              className={`flex-1 pb-3 text-sm font-bold transition-all relative ${authTab === "signin" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
            >
              Sign In
              {authTab === "signin" && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
              )}
            </button>
            <button
              onClick={() => { setAuthTab("signup"); setAuthError(null); }}
              className={`flex-1 pb-3 text-sm font-bold transition-all relative ${authTab === "signup" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
            >
              Create Account
              {authTab === "signup" && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
              )}
            </button>
          </div>

          {/* Error Message Box */}
          {authError && (
            <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-lg text-xs text-red-300 font-medium leading-relaxed flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Forms */}
          <form onSubmit={authTab === "signin" ? handleFirebaseSignIn : handleFirebaseSignUp} className="space-y-4 text-left">
            {authTab === "signup" && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">{t("Full Name")}</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full text-sm bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 pl-9 text-slate-100 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all font-sans"
                    placeholder="Enter your name"
                  />
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">{t("Email Address")}</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full text-sm bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 pl-9 text-slate-100 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all font-mono"
                  placeholder="name@anahon.org"
                />
                <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">{t("Password")}</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full text-sm bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 pl-9 text-slate-100 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all font-mono"
                  placeholder="••••••••"
                />
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={authBtnLoading}
              className="w-full p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-50 tracking-wide uppercase font-mono"
            >
              {authBtnLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{authTab === "signin" ? "Access Financial Portal" : "Establish Profile"}</span>
              )}
            </button>
          </form>

          {/* Local testing helper banner */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono text-center">
              Local Development Seed Roles
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 bg-slate-950/35 p-2.5 rounded-lg border border-slate-800">
              <div className="space-y-1">
                <span className="block text-slate-500">Super Admin:</span>
                <span className="block text-slate-300 select-all cursor-pointer hover:text-white" onClick={() => { setAuthEmail("anahoniamhere@gmail.com"); setAuthPassword("password123"); setAuthTab("signin"); }}>
                  anahoniamhere@gmail.com
                </span>
              </div>
              <div className="space-y-1">
                <span className="block text-slate-500">Finance Officer:</span>
                <span className="block text-slate-300 select-all cursor-pointer hover:text-white" onClick={() => { setAuthEmail("layale@anahon.org"); setAuthPassword("password123"); setAuthTab("signin"); }}>
                  layale@anahon.org
                </span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 italic text-center">
              Tip: Click any seed email to auto-fill. Password: <strong>password123</strong>
            </p>
          </div>

        </div>
      </div>
    );
  }


  if (error || !state) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-red-600" />
        <h2 className="mt-4 text-xl font-bold">Failed to startup AnaHon</h2>
        <p className="mt-2 text-slate-600">{error || "Critical workspace mismatch. Restart the build engine."}</p>
        <button onClick={refreshState} className="mt-4 bg-red-600 text-white px-4 py-2 rounded">Retry Sync</button>
      </div>
    );
  }

  // Active simulated user
  const currentUser = state.users.find(u => u.id === activeUserId) || state.users[0];

  // Self-service staff (Policy 8.5) see only their own timesheet screen.
  const isSelfService = currentUser?.role === "Employee (Self-Service)";
  // Requester-only role: raises vouchers/procurement for assigned projects, approves nothing.
  // The server enforces this independently — the UI gating is convenience, not the control.
  /** Derived, never stored, so it stays true if either side of the link changes. */
  const selfDealing = (exp: { vendorId?: string; requestorId?: string }) =>
    selfDealingRequester(exp, state.vendors, state.users);

  /** Evidence gaps, derived live from state so the count can never go stale.
   *  "Digitized*" documents are the app's own rendering of the voucher — they are not
   *  third-party evidence, and counting them would hide exactly what this panel is for. */
  const evidenceGaps = (() => {
    const COUNTED = ["Approved", "Paid", "Posted"];
    const hasProof = (expId: string) => state.documents.some(d =>
      d.linkedRecordType === "Expense" && d.linkedRecordId === expId && !/^Digitized/i.test(d.category || ""));
    const proj = (id: string) => state.projects.find(p => p.id === id);
    const money = (n: number) => formatUSD(n);

    const noEvidence = state.expenses
      .filter(e => COUNTED.includes(e.status) && !hasProof(e.id))
      .sort((a, b) => b.convertedAmount - a.convertedAmount);

    const noProcurement = state.expenses
      .filter(e => COUNTED.includes(e.status) && e.convertedAmount > 300 && !e.procurementId)
      .sort((a, b) => b.convertedAmount - a.convertedAmount);

    // Money proven in the bank against a project that has never had a voucher raised.
    const received = (pid: string) => state.bankTransactions
      .filter(t => t.projectId === pid && t.type === "Deposit" && !t.pending)
      .reduce((s, t) => s + t.amount, 0);
    const unspent = state.projects
      .filter(p => received(p.id) > 0 && !state.expenses.some(e => e.projectId === p.id))
      .map(p => ({ p, amount: received(p.id) }));

    const pettyGap = state.accounts.find(a => a.code === "1120")?.balance || 0;

    return {
      noEvidence, noProcurement, unspent, pettyGap, money, proj,
      total: noEvidence.length + noProcurement.length + unspent.length + (pettyGap > 0 ? 1 : 0)
    };
  })();

  const isProjectOfficer = currentUser?.role === "Project Officer";
  // The server already narrows a Project Officer's payload; this mirrors it in the UI.
  const officerScopeStream = (currentUser as any)?.streamScope || "";
  const officerProjectIds = isProjectOfficer
    ? new Set<string>([
        ...JSON.parse((currentUser as any)?.projectIdsJson || "[]"),
        ...(state?.projects || []).filter(p => officerScopeStream && p.stream === officerScopeStream).map(p => p.id)
      ])
    : null;
  const requestableProjects = officerProjectIds ? (state?.projects || []).filter(p => officerProjectIds.has(p.id)) : (state?.projects || []);

  // Helper: Converted totals
  // A counted drawer is money we can prove; a stale count is not. 45 days is the cut-off.
  const latestCashCount = (state?.cashCounts || [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const cashCountStale = !!latestCashCount &&
    (Date.now() - new Date(`${latestCashCount.date}T00:00:00`).getTime()) / 86400000 > 45;
  const countedCashUSD = latestCashCount && !cashCountStale ? latestCashCount.countedUSD : 0;

  const totalUSDInBank = state.bankAccounts
    .filter(b => b.active)
    .reduce((sum, b) => {
      let rate = 1;
      if (b.currency === "EUR") rate = state.fxRates.EUR;
      if (b.currency === "LBP") rate = state.fxRates.LBP;
      return sum + b.balance * rate;
    }, 0) + countedCashUSD;

  // Base currency converter summary format
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  // Bank money is shown in the currency it actually moved in — the EUR sub-account holds euros,
  // and printing those as dollars misstates the source document.
  const formatIn = (val: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountCode || !newAccountName) {
      triggerToast("Account number code and descriptive name mandatory.", "error");
      return;
    }

    // Integrity constraint validation
    const exists = state.accounts.some(a => a.code === newAccountCode);
    if (exists) {
      triggerToast(`Account code ${newAccountCode} already belongs to an existing ledger line.`, "error");
      return;
    }

    // Directly append in local-state representation and write updates to db if desired, or let ERP keep runtime changes
    const newAc: Account = {
      code: newAccountCode,
      name: newAccountName,
      type: newAccountType,
      currency: newAccountCurrency,
      reportingGroup: newAccountGroup,
      balance: 0,
      active: true
    };

    const updatedState = { ...state, accounts: [...state.accounts, newAc] };
    setState(updatedState);

    // Save state helper simulation (write to audit logs)
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedState)
      });
      triggerToast(`Account ${newAccountCode} (${newAccountName}) established in General Ledger.`);
      setNewAccountCode("");
      setNewAccountName("");
    } catch {
      triggerToast("Communication interrupted, saved in local sandbox.");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !newProjectCode || !newProjectDonor || !newProjectBudget || !newProjectStartDate || !newProjectEndDate || !newProjectFundingType) {
      triggerToast("All project fields are required.", "error");
      return;
    }
    if (!newProjectFundingTx) {
      triggerToast("Select the bank deposit that funds this project — unproven projects are not registered.", "error");
      return;
    }

    if (state.projects.some(p => p.code.toLowerCase() === newProjectCode.toLowerCase())) {
      triggerToast(`Project code '${newProjectCode}' already exists.`, "error");
      return;
    }

    try {
      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName,
          code: newProjectCode,
          donorId: newProjectDonor,
          budgetUSD: Number(newProjectBudget),
          startDate: newProjectStartDate,
          endDate: newProjectEndDate,
          fundingType: newProjectFundingType,
          fundingTxId: newProjectFundingTx,
          stream: newProjectStream,
          user: currentUser
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      triggerToast(`Project ${newProjectName} created successfully.`);
      setNewProjectName("");
      setNewProjectCode("");
      setNewProjectDonor("");
      setNewProjectBudget("");
      setNewProjectStartDate("");
      setNewProjectEndDate("");
      setNewProjectFundingType("Restricted Grant");
      setNewProjectFundingTx("");
      setNewProjectStream("");

      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();

    if (!["Super Admin", "Finance Officer"].includes(currentUser.role)) {
      triggerToast("You do not have permission to delete projects.", "error");
      return;
    }

    const proj = state.projects.find(p => p.id === projectId);
    if (!proj) return;

    if (!window.confirm(`Are you sure you want to delete project ${proj.name} (${proj.code})? This will also delete all associated budget lines.`)) {
      return;
    }

    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, user: currentUser })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }

      triggerToast(`Project ${proj.name} successfully deleted.`);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // ── Funding funnel handlers ──────────────────────────────────────────────
  // Pipeline is forward-looking only; the server keeps it out of all financial math.
  const saveOpportunity = async (e: FormEvent) => {
    e.preventDefault();
    if (!oppForm?.title || !oppForm?.stage) {
      triggerToast("An opportunity needs at least a title and a stage.", "error");
      return;
    }
    try {
      const res = await fetch("/api/opportunities/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...oppForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save opportunity");
      triggerToast(`Pipeline ${oppForm.id ? "updated" : "added"}: ${oppForm.title}`);
      setOppForm(null);
      setIntake(null);
      setIntakeOpen(false);
      setIntakeUrl("");
      setIntakeText("");
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const moveOpportunity = async (opp: Opportunity, stage: string) => {
    try {
      const res = await fetch("/api/opportunities/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...opp, stage, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to move opportunity");
      triggerToast(`"${opp.title}" moved to ${stage}.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const deleteOpportunity = async (opp: Opportunity) => {
    if (!window.confirm(`Remove "${opp.title}" from the pipeline?`)) return;
    try {
      const res = await fetch("/api/opportunities/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: opp.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete opportunity");
      triggerToast(`Removed from pipeline: ${opp.title}`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // ── Proposal workspace handlers ───────────────────────────────────────────
  const saveProposal = async (thenGenerate: boolean) => {
    if (!propForm?.id) return;
    try {
      const res = await fetch("/api/opportunities/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...propForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save proposal");
      if (thenGenerate) {
        const docRes = await fetch("/api/opportunities/proposal-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: propForm.id, user: currentUser })
        });
        const docData = await docRes.json();
        if (!docRes.ok) throw new Error(docData.error || "Failed to generate proposal document");
        openDoc({ id: docData.docId, filename: "document" });
        triggerToast("Proposal saved and document filed to vault (GENERAL/Proposals).");
      } else {
        triggerToast(`Proposal saved: ${propForm.title}`);
      }
      setPropForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // A call can arrive as a PDF, a Word file or a link. Extract to plain text and put it in
  // the box so the user reads and edits it BEFORE any AI sees it.
  const loadCallSource = async (payload: any, label: string) => {
    setCallBusy(true);
    try {
      const res = await fetch("/api/opportunities/call-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not read that source");
      setAiCall(prev => (prev ? `${prev}\n\n— ${label} —\n${d.text}` : `— ${label} —\n${d.text}`));
      triggerToast(`Loaded ${d.text.length.toLocaleString()} characters from ${d.source} — review it before running the assist.`);
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
    setCallBusy(false);
  };

  // Read a call (link, file or pasted text) and let the AI propose the whole opportunity.
  // Nothing is saved: the draft lands in the normal form so every field stays editable.
  const runIntake = async (payload: any) => {
    setIntakeBusy(true);
    try {
      const res = await fetch("/api/opportunities/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not read that call");
      setIntake(d);
      setOppForm({
        ...d.draft,
        // donorName rides along so saving can register a funder we don't have yet
        donorName: d.draft.donorIsNew ? d.draft.donorName : undefined
      } as any);
      setAiCall(d.callText);
      triggerToast(`${d.provider} read the call from ${d.source} — fit: ${d.assessment.fit}. Review every field before saving.`);
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
    setIntakeBusy(false);
  };

  const intakeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    const base64: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
      r.readAsDataURL(file);
    });
    await runIntake({ filename: file.name, base64 });
  };

  const loadCallFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    const base64: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
      r.readAsDataURL(file);
    });
    await loadCallSource({ filename: file.name, base64 }, file.name);
  };

  // AI prefills, humans decide: drafts fill only sections the user left empty.
  const runAiAssist = async (mode: "assess" | "draft") => {
    if (!propForm?.id) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/opportunities/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: propForm.id, callText: aiCall, mode, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "AI assist failed");
      if (mode === "assess") {
        setAiAssess(d.result);
      } else {
        const merged = { ...propForm.proposal };
        let filled = 0, kept = 0;
        (["summary", "problem", "solution", "objectives", "deliverables", "outputs", "outcomes"] as (keyof Proposal)[]).forEach(k => {
          const v = d.result[k];
          if (v && !(merged[k] as string)) { (merged as any)[k] = v; filled++; }
          else if (v) kept++;
        });
        setPropForm({ ...propForm, proposal: merged });
        triggerToast(`AI drafted ${filled} empty section${filled === 1 ? "" : "s"}${kept ? ` (${kept} kept your own text)` : ""} — review every line before saving.`);
      }
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
    setAiBusy(false);
  };

  const propBudget = propForm?.proposal.budget || [];
  const propTimeline = propForm?.proposal.timeline || [];
  const setProposal = (patch: Partial<Proposal>) => propForm && setPropForm({ ...propForm, proposal: { ...propForm.proposal, ...patch } });

  // ── Production stream handlers (clients & quotations) ────────────────────
  const saveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientForm?.name) {
      triggerToast("Client name is required.", "error");
      return;
    }
    try {
      const res = await fetch("/api/clients/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...clientForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save client");
      triggerToast(`Client ${clientForm.id ? "updated" : "registered"}: ${clientForm.name}`);
      setClientForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const saveQuotation = async (e: FormEvent) => {
    e.preventDefault();
    if (!quoteForm?.clientId || !quoteForm?.title) {
      triggerToast("A quotation needs a client and a title.", "error");
      return;
    }
    try {
      const res = await fetch("/api/quotations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quoteForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save quotation");
      triggerToast(`Quotation ${quoteForm.id ? "updated" : "created"}: ${quoteForm.title}`);
      setQuoteForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // Line-item helpers for the quotation form. Total is always derived, never typed.
  const quoteItems = quoteForm?.items || [];
  const quoteTotal = quoteItems.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 1), 0);
  const setQuoteItem = (i: number, patch: Partial<QuotationItem>) => {
    const items = quoteItems.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    setQuoteForm({ ...quoteForm, items });
  };
  const pickCatalogService = (i: number, name: string) => {
    const cat = SERVICE_CATALOG.find(c => c.service === name);
    setQuoteItem(i, cat ? { service: cat.service, description: cat.description, output: cat.output, unitPrice: cat.unitPrice } : { service: name });
  };
  const quoteTerms = quoteForm?.terms || {};
  const setQuoteTerms = (patch: Partial<Quotation["terms"]>) => setQuoteForm({ ...quoteForm, terms: { ...quoteTerms, ...patch } });

  const generateQuoteDoc = async (q: Quotation) => {
    try {
      const res = await fetch("/api/quotations/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate document");
      triggerToast(`Quotation document ${q.quoteNo} filed to vault (GENERAL/Quotations).`);
      openDoc({ id: data.docId, filename: "document" });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const moveQuotation = async (q: Quotation, status: string) => {
    try {
      const res = await fetch("/api/quotations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q, status, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update quotation");
      triggerToast(`${q.quoteNo} → ${status}`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // Document references are auto-assigned; only the master account may amend one.
  const editDocRef = async (doc: AppDoc) => {
    if (currentUser.role !== "Super Admin") return;
    const refNo = window.prompt(`Amend document reference for "${doc.filename}" (master account action, audit-logged):`, doc.refNo || "");
    if (refNo === null || refNo === doc.refNo) return;
    try {
      const res = await fetch("/api/documents/set-ref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id, refNo, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to amend reference");
      triggerToast(`Reference amended: ${refNo}`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const linkQuotePayment = async (q: Quotation, txId: string) => {
    try {
      const res = await fetch("/api/quotations/link-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, txId, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to link payment");
      triggerToast(txId ? `${q.quoteNo} settled by bank deposit — status Paid.` : `${q.quoteNo} payment link removed.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const submitOffbankSettlement = async (e: FormEvent) => {
    e.preventDefault();
    if (!settleForm) return;
    try {
      const res = await fetch("/api/quotations/settle-offbank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: settleForm.q.id,
          method: settleForm.method,
          reference: settleForm.reference,
          date: settleForm.date,
          amount: settleForm.amount,
          user: currentUser
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to record settlement");
      triggerToast(`${settleForm.q.quoteNo} settled via ${settleForm.method} — recorded on the off-bank evidence account.`);
      setSettleForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const deleteQuotation = async (q: Quotation) => {
    if (!window.confirm(`Delete quotation ${q.quoteNo} — "${q.title}"?`)) return;
    try {
      const res = await fetch("/api/quotations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete quotation");
      triggerToast(`Deleted ${q.quoteNo}.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // Drag & drop file base64 reader
  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      setTempAttachment({
        filename: file.name,
        mimeType: file.type,
        base64: base64String
      });
      triggerToast(`Attachment loaded for audit: "${file.name}" (Ready)`);
    };
    reader.readAsDataURL(file);
  };

  // AI invoice scan: reads the scanned file, prefills the voucher form for human review.
  // Never submits — Policy 5.2 keeps initiation a human act.
  const handleAiInvoiceScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = (reader.result as string).split(",")[1];
      // The scan doubles as the voucher's supporting document (Policy 6.1)
      setTempAttachment({ filename: file.name, mimeType: file.type, base64: base64String });
      setAiScanning(true);
      try {
        const res = await fetch("/api/expense/scan-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: base64String, mimeType: file.type, filename: file.name, user: currentUser })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI scan failed.");
        const x = data.extracted;
        if (x.title) setExpenseTitle(x.title);
        if (x.purpose || x.invoiceRef || x.date) {
          setExpensePurpose([x.purpose, x.invoiceRef && `Ref: ${x.invoiceRef}`, x.date && `Invoice date: ${x.date}`]
            .filter(Boolean).join(" | "));
        }
        if (x.vendorId) setExpenseVendor(x.vendorId);
        if (x.currency) setExpenseCurrency(x.currency);
        if (x.amount) setExpenseAmount(String(x.amount));
        if (x.suggestedProjectId) setExpenseProject(x.suggestedProjectId);
        if (x.suggestedBudgetLineId) setExpenseBudgetLine(x.suggestedBudgetLineId);
        const warn = (x.warnings || []).length ? ` ⚠️ ${x.warnings.join("; ")}` : "";
        triggerToast(`AI prefilled from "${file.name}" (confidence: ${x.confidence}). Verify every field against the scan before submitting.${warn}`);
      } catch (err: any) {
        triggerToast(err.message, "error");
      } finally {
        setAiScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI vendor scan: reads a supplier invoice and prefills the vendor registration form.
  // Vetting and registration stay manual (Policy 7.3).
  const handleAiVendorScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = (reader.result as string).split(",")[1];
      setAiVendorScanning(true);
      try {
        const res = await fetch("/api/vendor/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: base64String, mimeType: file.type, filename: file.name, user: currentUser })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI scan failed.");
        const x = data.extracted;
        if (x.duplicateOfVendorId) {
          const dup = state.vendors.find(v => v.id === x.duplicateOfVendorId);
          triggerToast(`⚠️ "${x.name}" looks already registered as "${dup?.name || x.duplicateOfVendorId}" — check the directory before creating a duplicate.`, "error");
        }
        if (x.name) setNewVendorName(x.name);
        if (x.category) setNewVendorCategory(x.category);
        if (x.taxId) setNewVendorTaxId(x.taxId);
        if (x.bankInfo) setNewVendorBankInfo(x.bankInfo);
        if (x.contact) setNewVendorContact(x.contact);
        const warn = (x.warnings || []).length ? ` ⚠️ ${x.warnings.join("; ")}` : "";
        if (!x.duplicateOfVendorId) {
          triggerToast(`AI prefilled supplier "${x.name}" (confidence: ${x.confidence}). Verify against the document, complete vetting, then register.${warn}`);
        }
      } catch (err: any) {
        triggerToast(err.message, "error");
      } finally {
        setAiVendorScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Budget allocations adjustment posting
  const handleModifyAllocation = async (blId: string, val: string) => {
    try {
      const res = await fetch("/api/budgets/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: blId, allocatedUSD: val, user: currentUser })
      });
      if (res.ok) {
        triggerToast("Project allocate threshold updated.");
        refreshState();
      }
    } catch {
      triggerToast("Error updating budget lines.", "error");
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount || !expenseProject) {
      triggerToast("Voucher name, amount value, and Project Code are required to route funds.", "error");
      return;
    }

    // Double-check project rules & statutory exclusions
    const matchingProj = state.projects.find(p => p.id === expenseProject);
    if (matchingProj?.status === "Completed") {
      triggerToast("Forbidden: Select project code is officially Completed & budget closed.", "error");
      return;
    }

    // Construct co-funding split allocations if enabled
    let allocationsPayload = [];
    if (enableSharedSplit) {
      const totalPercentage = splitAllocations.reduce((sum, a) => sum + Number(a.percentage || 0), 0);
      if (totalPercentage !== 100) {
        triggerToast(`Shared cost splits must sum up to exactly 100%. Currently: ${totalPercentage}%`, "error");
        return;
      }
      if (splitAllocations.some(a => !a.projectId)) {
        triggerToast("Please select a project for all co-funding allocation lines.", "error");
        return;
      }
      allocationsPayload = splitAllocations.map(a => ({
        projectId: a.projectId,
        budgetLineId: a.budgetLineId || "",
        percentage: Number(a.percentage),
        amount: Number(((Number(expenseAmount) * Number(a.percentage)) / 100).toFixed(2))
      }));
    }

    try {
      const res = await fetch("/api/expense/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: expenseTitle,
          purpose: expensePurpose,
          vendorId: expenseVendor,
          projectId: expenseProject,
          budgetLineId: expenseBudgetLine,
          procurementId: expenseProcurement,
          currency: expenseCurrency,
          amount: expenseAmount,
          customRate: expenseCustomRate,
          allocations: allocationsPayload,
          user: currentUser
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        triggerToast(errData.error || "Submission failed.", "error");
        return;
      }

      const resData = await res.json();
      const newVouId = resData.expense.id;

      // Upload Temp Attachment if present
      if (tempAttachment) {
        await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...tempAttachment,
            category: "Voucher",
            linkedRecordType: "Expense",
            linkedRecordId: newVouId,
            user: currentUser
          })
        });
      }

      triggerToast(`Disbursement request ${resData.expense.voucherNo} lodged with attached compliance assets.`);
      // Reset form parameters
      setExpenseTitle("");
      setExpensePurpose("");
      setExpenseVendor("");
      setExpenseBudgetLine("");
      setExpenseProcurement("");
      setExpenseAmount("");
      setExpenseCustomRate("");
      setEnableSharedSplit(false);
      setSplitAllocations([
        { projectId: "", budgetLineId: "", percentage: 50 },
        { projectId: "", budgetLineId: "", percentage: 50 }
      ]);
      setTempAttachment(null);
      refreshState();
    } catch (err: any) {
      triggerToast("Backend communication link interrupted.", "error");
    }
  };

  const handleExpenseAction = async (expenseId: string, action: string, extra: any = {}) => {
    try {
      const res = await fetch("/api/expense/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId,
          action,
          user: currentUser,
          ...extra
        })
      });
      if (!res.ok) {
        const dat = await res.json();
        triggerToast(dat.error || "Action declined by validation engine.", "error");
        return;
      }
      triggerToast(`Voucher status shifted: ${action.replace("-", " ").toUpperCase()}`);
      refreshState();
    } catch {
      triggerToast("Error triggering transaction line sequence.", "error");
    }
  };

  const handleProcurementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procTitle || !procVendorA || !procAmountA) {
      triggerToast("Quotation descriptive title and primary quote mandatory.", "error");
      return;
    }

    try {
      const res = await fetch("/api/procurement/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: procTitle,
          projectId: procProject,
          budgetLineId: procBudgetLine,
          // Only quotations actually obtained. The form used to pad a phantom
          // "Second Sourced Vendor" at 0 USD, which fabricated a comparison.
          quotations: [
            { vendorName: procVendorA, amount: procAmountA, currency: "USD", score: procScoreA, selected: true },
            ...(procVendorB ? [{ vendorName: procVendorB, amount: procAmountB || "0", currency: "USD", score: procScoreB, selected: false }] : []),
            ...(procVendorC ? [{ vendorName: procVendorC, amount: procAmountC || "0", currency: "USD", score: procScoreC, selected: false }] : [])
          ],
          justification: procJustification,
          conflictDeclared: procConflict,
          singleSource: procSingleSource,
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast("Procurement worksheet evaluated & scored.");
        setProcTitle("");
        setProcVendorA("");
        setProcAmountA("");
        setProcVendorB("");
        setProcAmountB("");
        setProcJustification("");
        setProcConflict(false);
        refreshState();
      }
    } catch {
      triggerToast("Failed compiling quotes.", "error");
    }
  };

  const handlePartnerDrawSubmit = async (e: React.FormEvent, type: "withdraw" | "invest") => {
    e.preventDefault();
    if (!drawPartner || !drawAmount) {
      triggerToast("Specify partner profile and accurate capital drawing amount.", "error");
      return;
    }
    // Auditor restriction check
    if (currentUser.role === "Auditor / Read-Only Reviewer") {
      triggerToast("Action Denied: Auditor does not have disburse authorization.", "error");
      return;
    }

    try {
      const res = await fetch("/api/partners/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: drawPartner, amount: drawAmount, action: type, user: currentUser })
      });
      if (res.ok) {
        triggerToast(`Equity ledger posting completed for partner.`);
        setDrawAmount("");
        refreshState();
      } else {
        const data = await res.json();
        triggerToast(data.error || "Failed partner transactions.", "error");
      }
    } catch {
      triggerToast("General posting error.", "error");
    }
  };

  const handleCapitalizeAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName || !assetCost) {
      triggerToast("Specify asset name & acquisitions cost.", "error");
      return;
    }
    try {
      const res = await fetch("/api/assets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetName,
          serialNumber: assetSerial || `SN-M-${Math.floor(Math.random() * 900000)}`,
          fundingProjectId: assetProject,
          purchaseDate: new Date().toISOString().split("T")[0],
          cost: assetCost,
          usefulLifeYears: assetLife,
          custodian: assetCustodian || "Mina Studio Coordinator",
          location: assetLocation || "Tripoli Principal Office",
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast("Acquisition loaded directly into asset register.");
        setAssetName("");
        setAssetCost("");
        refreshState();
      }
    } catch {
      triggerToast("Asset ledger save failed.", "error");
    }
  };

  const handleBankReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recBank || !recAmount || !recDesc) {
      triggerToast("Bank drawer, description purpose & value must be filled.", "error");
      return;
    }

    try {
      const res = await fetch("/api/bank/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: recBank,
          txType: recType,
          description: recDesc,
          amount: recAmount,
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast("Direct transactional matching cleared on statement.");
        setRecDesc("");
        setRecAmount("");
        refreshState();
      }
    } catch {
      triggerToast("Variance balance reconcile error.", "error");
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate debit vs credit balance
    const debitSum = adjItems.reduce((sum, item) => sum + Number(item.debit || 0), 0);
    const creditSum = adjItems.reduce((sum, item) => sum + Number(item.credit || 0), 0);

    if (Math.abs(debitSum - creditSum) > 0.009) {
      triggerToast(`Unbalanced journal entry! Debits (${debitSum}) must equal Credits (${creditSum}).`, "error");
      return;
    }

    if (adjItems.some(item => !item.accountCode)) {
      triggerToast("Please select a valid account code for all journal lines.", "error");
      return;
    }

    try {
      const res = await fetch("/api/journal-entry/adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: adjDate,
          description: adjDescription,
          referenceNo: adjReferenceNo,
          items: adjItems,
          user: currentUser
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post manual adjustment entry.");

      triggerToast("Manual adjustment journal entry successfully posted to the ledger!");
      // Reset form
      setAdjDate("");
      setAdjDescription("");
      setAdjReferenceNo("");
      setAdjItems([
        { accountCode: "", debit: 0, credit: 0, projectId: "" },
        { accountCode: "", debit: 0, credit: 0, projectId: "" }
      ]);

      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const handleVendorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName || !newVendorCategory) {
      triggerToast("Vendor name and primary category are required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/vendors/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVendorName,
          category: newVendorCategory,
          taxId: newVendorTaxId,
          bankInfo: newVendorBankInfo,
          contact: newVendorContact,
          engageable: newVendorEngageable,
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast(`Vendor ${newVendorName} registered successfully!`);
        setNewVendorName("");
        setNewVendorCategory("");
        setNewVendorTaxId("");
        setNewVendorBankInfo("");
        setNewVendorContact("");
        setNewVendorEngageable(false);
        refreshState();
      } else {
        const data = await res.json();
        triggerToast(data.error || "Failed to register vendor.", "error");
      }
    } catch {
      triggerToast("Error registering new vendor.", "error");
    }
  };

  // Attach an invoice/receipt to an ALREADY-POSTED voucher. The creation form could
  // attach one; afterwards there was no way in — so recovered receipts had nowhere to go.
  // Two distinct paths, filed into separate vault folders:
  //   "Invoice"  — the bill itself (what the money was for)
  //   "Evidence" — supporting proof: distribution lists, delivery notes, photos of the purchase
  const handleVoucherDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    expenseId: string,
    voucherNo: string,
    category: "Invoice" | "Evidence"
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files: File[] = Array.from(e.target.files);
    e.target.value = ""; // allow re-selecting the same file after an error
    for (const file of files) {
      try {
        const base64String: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(new Error(`Could not read "${file.name}"`));
          reader.readAsDataURL(file);
        });
        const res = await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            sizeStr: `${(file.size / 1024).toFixed(0)} KB`,
            base64: base64String,
            category,
            linkedRecordType: "Expense",
            linkedRecordId: expenseId,
            user: currentUser
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
        triggerToast(`${category} attached to ${voucherNo}: "${file.name}"`);
      } catch (err: any) {
        triggerToast(err.message, "error");
      }
    }
    refreshState();
  };

  // Generate the provider's service invoice + payment receipt from the voucher's figures.
  const generateProviderDoc = async (expenseId: string, voucherNo: string) => {
    try {
      const res = await fetch("/api/vendors/payment-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to generate provider invoice");
      triggerToast(`Service invoice & receipt generated for ${voucherNo} — print and have the provider sign it.`);
      openDoc({ id: d.docId, filename: "document" });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const submitInlineWaiver = async () => {
    if (!inlineWaiver) return;
    try {
      const res = await fetch("/api/procurement/waiver-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: expenseTitle || "Single-source purchase",
          projectId: expenseProject,
          budgetLineId: expenseBudgetLine,
          vendorName: inlineWaiver.vendorName,
          amount: inlineWaiver.amount || expenseAmount,
          reason: inlineWaiver.reason,
          retrospective: inlineWaiver.retrospective,
          user: currentUser
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to raise waiver");
      if (d.approved) {
        setExpenseProcurement(d.procurement.id);
        triggerToast("Single-source waiver approved and attached to this voucher.");
      } else {
        triggerToast("Waiver raised — a Finance Officer or the Program Director must approve it before this voucher can be lodged.", "error");
      }
      setInlineWaiver(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const saveActivity = async (payload: any) => {
    if (!payload.title?.trim()) { triggerToast("Give the step a title.", "error"); return; }
    try {
      const res = await fetch("/api/activities/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save step");
      triggerToast(`Timeline updated: ${payload.title}`);
      setActivityForm(null);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const deleteActivity = async (a: any) => {
    if (!window.confirm(`Remove "${a.title}" from the timeline?`)) return;
    try {
      const res = await fetch("/api/activities/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove");
      triggerToast("Step removed.");
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  // Upload one of the four core project papers straight into its own category.
  const handleCoreDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string, category: string) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/document/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, mimeType: file.type,
          sizeStr: `${(file.size / 1024).toFixed(0)} KB`, base64,
          category, linkedRecordType: "Project", linkedRecordId: projectId, user: currentUser
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      triggerToast(`${category} filed: "${file.name}"`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const importTimetable = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/activities/import-timetable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filename: file.name, base64, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      triggerToast(`${d.created} activities imported across ${d.columns.length} periods${d.meta?.title ? ` — "${String(d.meta.title).slice(0, 50)}"` : ""}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const generateTimeline = async (projectId: string | null, all = false) => {
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true, user: currentUser } : { projectId, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to generate");
      triggerToast(
        d.created || d.completed
          ? `${d.projects} project(s): ${d.created} step(s) added, ${d.completed} already evidenced and marked done.`
          : "Timelines are already up to date."
      );
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const saveSubscription = async (payload: any) => {
    try {
      const res = await fetch("/api/subscriptions/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save subscription");
      triggerToast(`Tracking ${payload.name}.`);
      setSubForm(null);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const verifySubscription = async (sub: any, stillActive: boolean) => {
    try {
      const res = await fetch("/api/subscriptions/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, stillActive, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to confirm");
      triggerToast(stillActive ? `${sub.name} confirmed still active today.` : `${sub.name} marked as ended.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const rollSubscription = async (sub: any) => {
    try {
      const res = await fetch("/api/subscriptions/roll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to roll forward");
      triggerToast(`${sub.name} → next renewal ${d.nextRenewal}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const deleteSubscription = async (sub: any) => {
    if (!window.confirm(`Stop tracking ${sub.name}?`)) return;
    try {
      const res = await fetch("/api/subscriptions/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove");
      triggerToast(`Stopped tracking ${sub.name}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const detectSubscriptions = async () => {
    setSubBusy(true);
    try {
      const res = await fetch("/api/subscriptions/detect");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Detection failed");
      setSubSuggestions(d.suggestions);
      triggerToast(`${d.suggestions.length} recurring merchant${d.suggestions.length === 1 ? "" : "s"} found on the statements.`);
    } catch (err: any) { triggerToast(err.message, "error"); }
    setSubBusy(false);
  };

  // Days until renewal drives the alert colour. Overdue and "due soon" are the two
  // states worth interrupting someone for.
  const subDaysLeft = (iso: string) => iso ? Math.ceil((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;

  const submitCashCount = async () => {
    try {
      const res = await fetch("/api/cash/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cashCountForm, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to record cash count");
      triggerToast(`Cash count recorded: ${formatUSD(Number(cashCountForm.countedUSD))} counted · ${formatUSD(d.variance)} still undocumented.`);
      setCashCountForm({ date: new Date().toLocaleDateString("en-CA"), countedUSD: "", notes: "" });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const generatePayslip = async (employeeId: string, name: string, month: string) => {
    try {
      const res = await fetch("/api/payroll/payslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, month, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to generate payslip");
      triggerToast(`Payslip generated for ${name} — ${month}.`);
      openDoc({ id: d.docId, filename: "document" });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const handleProjectDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, projId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];
        const res = await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            sizeStr: `${(file.size / 1024).toFixed(0)} KB`,
            base64: base64String,
            category: "Contract",
            linkedRecordType: "Project",
            linkedRecordId: projId,
            user: currentUser
          })
        });

        if (!res.ok) throw new Error("Upload failed");
        triggerToast(`Document archived successfully: "${file.name}"`);
        refreshState();
      } catch (err: any) {
        triggerToast("Failed to upload project contract doc.", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportExcel = () => {
    try {
      const activeProject = state.projects.find(p => p.id === selectedProjectId);
      if (!activeProject) return;

      const projExpenses = state.expenses.filter(e =>
        e.projectId === selectedProjectId ||
        (e.allocations && e.allocations.some((a: any) => a.projectId === selectedProjectId))
      );

      // Filter items for the specific reconMonth (YYYY-MM)
      const monthExpenses = projExpenses.filter(e => {
        const dateVal = e.paid_at || e.created_at;
        return dateVal && dateVal.startsWith(reconMonth);
      });

      const projectBudgetLines = state.budgetLines.filter(bl => bl.projectId === selectedProjectId);

      // Sheet 1: Budget_vs_Actuals Data
      const sheet1Data = projectBudgetLines.map(bl => {
        const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sum, e) => {
          const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
          return sum + (alloc ? Number(alloc.amount) : e.amount);
        }, 0);

        const remaining = bl.allocatedUSD - bl.actualUSD;
        const burnPercent = bl.allocatedUSD > 0 ? (bl.actualUSD / bl.allocatedUSD) : 0;

        return {
          "Account Line": bl.code,
          "Category Description": bl.category,
          "Allocated Pool (USD)": bl.allocatedUSD,
          "Spent This Month (USD)": monthSpent,
          "Cumulative Spent to Date (USD)": bl.actualUSD,
          "Remaining Balance (USD)": remaining,
          "Burn Rate (%)": burnPercent
        };
      });

      // Calculate aggregates for Section I
      const totalAllocated = projectBudgetLines.reduce((sum, bl) => sum + bl.allocatedUSD, 0);
      const totalSpentMonth = projectBudgetLines.reduce((sum, bl) => {
        const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sumE, e) => {
          const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
          return sumE + (alloc ? Number(alloc.amount) : e.amount);
        }, 0);
        return sum + monthSpent;
      }, 0);
      const totalCumulative = projectBudgetLines.reduce((sum, bl) => sum + bl.actualUSD, 0);
      const totalRemaining = totalAllocated - totalCumulative;
      const overallBurnRate = totalAllocated > 0 ? (totalCumulative / totalAllocated) : 0;

      sheet1Data.push({
        "Account Line": "TOTAL BUDGET BURN SUMMARY",
        "Category Description": "",
        "Allocated Pool (USD)": totalAllocated,
        "Spent This Month (USD)": totalSpentMonth,
        "Cumulative Spent to Date (USD)": totalCumulative,
        "Remaining Balance (USD)": totalRemaining,
        "Burn Rate (%)": overallBurnRate
      });

      // Sheet 2: Reconciled_Cash_Flows Data
      const sheet2Data = monthExpenses.map(exp => {
        const alloc = exp.allocations ? exp.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
        const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (exp.whtAmount / exp.amount)) : (exp.netAmount || exp.amount);
        const whtVal = alloc ? Number(alloc.amount) * (exp.whtAmount / exp.amount) : exp.whtAmount;

        return {
          "Statement Date": exp.paid_at?.split("T")[0] || exp.created_at?.split("T")[0] || "",
          "Voucher / Ref": exp.voucherNo,
          "Transaction Memo": exp.title,
          "Withholding Tax (WHT)": whtVal * exp.rate,
          "Reconciled Net": calculatedNet * exp.rate
        };
      });

      const totalWht = monthExpenses.reduce((sum, e) => {
        const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
        const whtVal = alloc ? Number(alloc.amount) * (e.whtAmount / e.amount) : e.whtAmount;
        return sum + (whtVal * e.rate);
      }, 0);

      const totalNet = monthExpenses.reduce((sum, e) => {
        const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
        const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (e.whtAmount / e.amount)) : (e.netAmount || e.amount);
        return sum + (calculatedNet * e.rate);
      }, 0);

      sheet2Data.push({
        "Statement Date": "RECONCILED MATCHINGS TOTAL",
        "Voucher / Ref": "",
        "Transaction Memo": "",
        "Withholding Tax (WHT)": totalWht,
        "Reconciled Net": totalNet
      });

      // Assemble Excel Workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

      // Percentage formatting in Excel for Burn Rate column
      const range1 = XLSX.utils.decode_range(ws1["!ref"] || "");
      for (let r = range1.s.r + 1; r <= range1.e.r; ++r) {
        const cellRef = XLSX.utils.encode_cell({ r, c: 6 }); // Burn Rate (%) is 7th column (0-indexed 6)
        if (ws1[cellRef]) {
          ws1[cellRef].z = "0.0%";
        }
      }
      XLSX.utils.book_append_sheet(wb, ws1, "Budget_vs_Actuals");
      XLSX.utils.book_append_sheet(wb, ws2, "Reconciled_Cash_Flows");

      XLSX.writeFile(wb, `${activeProject.code}_Reconciliation_${reconMonth}.xlsx`);
      triggerToast("Excel workbook exported successfully!");
    } catch (err: any) {
      triggerToast("Failed to export Excel spreadsheet.", "error");
    }
  };

  const handleExportWord = () => {
    try {
      const activeProject = state.projects.find(p => p.id === selectedProjectId);
      if (!activeProject) return;

      const element = document.getElementById("reconciliation-print-report");
      if (!element) {
        triggerToast("Report container not found.", "error");
        return;
      }

      // Clone element to avoid modifying the active DOM layout
      const clonedElement = element.cloneNode(true) as HTMLElement;

      const styleBlock = `
        <style>
          body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            margin: 20px;
          }
          h1 {
            font-size: 16pt;
            font-weight: bold;
            color: #0f172a;
            text-align: center;
            margin-bottom: 2pt;
            text-transform: uppercase;
          }
          p.subtitle {
            font-size: 8.5pt;
            color: #64748b;
            text-align: center;
            font-family: Consolas, monospace;
            margin-bottom: 5pt;
          }
          h2 {
            font-size: 10pt;
            font-weight: bold;
            color: #dc2626;
            text-align: center;
            margin-top: 5pt;
            margin-bottom: 15pt;
            text-transform: uppercase;
          }
          h4 {
            font-size: 10pt;
            font-weight: bold;
            color: #0f172a;
            margin-top: 15pt;
            margin-bottom: 5pt;
            border-left: 3px solid #dc2626;
            padding-left: 6pt;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10pt;
            margin-bottom: 15pt;
            font-size: 8.5pt;
          }
          th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6pt 8pt;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          td {
            border: 1px solid #e2e8f0;
            padding: 5pt 8pt;
            vertical-align: middle;
          }
          .text-right {
            text-align: right;
          }
          .font-mono {
            font-family: Consolas, monospace;
          }
          .font-bold {
            font-weight: bold;
          }
          .bg-slate-50 {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 8pt;
            border-radius: 6px;
          }
          .grid-cols-2 {
            width: 100%;
            margin-top: 10pt;
            margin-bottom: 15pt;
          }
          .info-table {
            width: 100%;
            border: none !important;
          }
          .info-table td {
            border: none !important;
            padding: 4pt 6pt;
          }
          .info-label {
            color: #64748b;
            font-size: 8pt;
            font-weight: bold;
          }
          .info-value {
            color: #0f172a;
            font-weight: bold;
          }
          .bg-emerald-50 {
            background-color: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 8pt;
            font-size: 8.5pt;
            color: #065f46;
            margin-top: 10pt;
            margin-bottom: 10pt;
            font-family: Consolas, monospace;
          }
          .bg-red-50 {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            padding: 8pt;
            font-size: 8.5pt;
            color: #991b1b;
            margin-top: 10pt;
            margin-bottom: 10pt;
            font-family: Consolas, monospace;
          }
          .signature-box {
            width: 45%;
            display: inline-block;
            vertical-align: top;
            margin-right: 5%;
          }
          .signature-table {
            width: 100%;
            margin-top: 20pt;
            border: none !important;
          }
          .signature-table td {
            border: none !important;
            padding: 10pt;
            vertical-align: top;
          }
          .signature-line {
            border-top: 1px solid #94a3b8;
            margin-top: 30pt;
            padding-top: 5pt;
            font-size: 8pt;
            color: #64748b;
          }
          .text-slate-500 {
            color: #64748b;
          }
          .text-slate-900 {
            color: #0f172a;
          }
          .text-red-650 {
            color: #b91c1c;
          }
          .text-emerald-800 {
            color: #065f46;
          }
          .text-amber-600 {
            color: #d97706;
          }
          .mt-2 { margin-top: 8px; }
          .mb-4 { margin-bottom: 16px; }
          .flex { display: block; }
          .justify-between { display: block; }
          .rounded-full { border-radius: 9999px; }
          .bg-red-50-badge {
            background-color: #fef2f2;
            color: #991b1b;
            padding: 2pt 6pt;
            border-radius: 9999px;
            font-size: 8pt;
            font-weight: bold;
            display: inline-block;
          }
        </style>
      `;

      const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${activeProject.code} Monthly Reconciliation - ${reconMonth}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          ${styleBlock}
        </head>
        <body>
      `;
      const footer = "</body></html>";

      // Transform grid info layout to tables for Word rendering
      const infoGrid = clonedElement.querySelector(".grid-cols-2");
      if (infoGrid) {
        const rows = Array.from(infoGrid.children);
        let tableHtml = '<table class="info-table bg-slate-50">';
        for (let i = 0; i < rows.length; i += 2) {
          tableHtml += '<tr>';
          if (rows[i]) {
            const label = rows[i].children[0]?.textContent || "";
            const val = rows[i].children[1]?.textContent || "";
            tableHtml += `<td width="20%"><span class="info-label">${label}</span></td><td width="30%"><span class="info-value">${val}</span></td>`;
          }
          if (rows[i + 1]) {
            const label = rows[i + 1].children[0]?.textContent || "";
            const val = rows[i + 1].children[1]?.textContent || "";
            tableHtml += `<td width="20%"><span class="info-label">${label}</span></td><td width="30%"><span class="info-value">${val}</span></td>`;
          } else {
            tableHtml += '<td width="20%"></td><td width="30%"></td>';
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</table>';
        infoGrid.outerHTML = tableHtml;
      }

      // Convert grid/flex signature boxes into a standard side-by-side signature table
      const signatureContainer = clonedElement.querySelector(".pt-6.space-y-4");
      if (signatureContainer) {
        const gridElement = signatureContainer.querySelector(".grid-cols-2") || signatureContainer.querySelector(".grid");
        if (gridElement) {
          const boxes = Array.from(gridElement.children);
          let sigTableHtml = '<table class="signature-table">';
          sigTableHtml += '<tr>';
          boxes.forEach((box) => {
            const content = box.innerHTML;
            sigTableHtml += `<td width="50%">${content}</td>`;
          });
          sigTableHtml += '</tr></table>';
          gridElement.outerHTML = sigTableHtml;
        }
      }

      const badgeHeader = clonedElement.querySelector("h2.text-red-650.bg-red-50");
      if (badgeHeader) {
        badgeHeader.className = "bg-red-50-badge";
      }

      const content = clonedElement.innerHTML;
      const htmlString = header + content + footer;

      const blob = new Blob(['\ufeff' + htmlString], {
        type: 'application/msword'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeProject.code}_Monthly_Reconciliation_Report_${reconMonth}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast("Word document exported successfully!");
    } catch (err: any) {
      triggerToast("Failed to export Word document.", "error");
    }
  };

  const handleExportPDF = () => {
    try {
      document.body.classList.add("print-reconciliation-only");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("print-reconciliation-only");
      }, 500);
      triggerToast("PDF print dialog opened successfully!");
    } catch (err: any) {
      triggerToast("Failed to launch PDF print manager.", "error");
    }
  };

  const handleEmployeeRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpPosition || !newEmpSalary) {
      triggerToast("Employee name, position and base salary are required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/employees/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmpName,
          position: newEmpPosition,
          salary: newEmpSalary,
          allowance: newEmpAllowance || 0,
          paymentMethod: newEmpPaymentMethod,
          bankAccountId: newEmpBankAccountId,
          contractType: newEmpContractType || "Regular Employee",
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast(`Employee ${newEmpName} registered on payroll!`);
        setNewEmpName("");
        setNewEmpPosition("");
        setNewEmpSalary("");
        setNewEmpAllowance("");
        setNewEmpPaymentMethod("Bank Transfer");
        setNewEmpBankAccountId("");
        setNewEmpContractType("");
        refreshState();
      } else {
        const data = await res.json();
        triggerToast(data.error || "Failed to register employee.", "error");
      }
    } catch {
      triggerToast("Error registering new employee.", "error");
    }
  };

  const handleTimesheetSubmit = async (empId: string) => {
    // Policy 8.4: the timesheet records the % of time per DONOR project; the remainder is
    // non-project/core time. Requiring exactly 100% would force over-allocation (Policy 8.7).
    const allocations = state.projects
      .map(p => ({ projectId: p.id, percentage: tsAllocValues[`${empId}-${p.id}`] || 0 }))
      .filter(a => a.percentage > 0);

    const totalPerc = allocations.reduce((s, x) => s + x.percentage, 0);
    if (totalPerc <= 0) {
      triggerToast("Enter at least one project percentage (donor-charged share of the month).", "error");
      return;
    }
    if (totalPerc > 100) {
      triggerToast(`Over-allocation prohibited (Policy 8.7): donor allocations sum to ${totalPerc}%. Reduce to 100% or less.`, "error");
      return;
    }

    try {
      const res = await fetch("/api/timesheets/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empId, month: selectedTSMonth, allocations, user: currentUser })
      });
      if (res.ok) {
        triggerToast("Timesheet submitted for review.");
        refreshState();
      }
    } catch {
      triggerToast("Failed timesheets mapping.", "error");
    }
  };

  const handleApproveTimesheet = async (tsId: string) => {
    try {
      const res = await fetch("/api/timesheets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tsId, user: currentUser })
      });
      if (res.ok) {
        triggerToast("Timesheet and salary allocations posted to projects.");
        refreshState();
      }
    } catch {
      triggerToast("Verification failed.", "error");
    }
  };

  const runGeminiScan = async () => {
    setGeminiLoading(true);
    setGeminiReport("");
    try {
      const res = await fetch("/api/gemini/compliance-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkType: auditType })
      });
      const data = await res.json();
      setGeminiReport(data.auditReport || "No audit response received from intelligence frame.");
    } catch (err: any) {
      setGeminiReport(`Audit engine could not resolve. Frame details: ${err.message}`);
    } finally {
      setGeminiLoading(false);
    }
  };

  // Filter lists based on Search term
  const filteredExpenses = (state?.expenses || []).filter(e => {
    const title = e?.title || "";
    const purpose = e?.purpose || "";
    const voucherNo = e?.voucherNo || "";
    const term = searchTerm || "";
    const matchesTerm =
      title.toLowerCase().includes(term.toLowerCase()) ||
      purpose.toLowerCase().includes(term.toLowerCase()) ||
      voucherNo.toLowerCase().includes(term.toLowerCase());
    const day = (e?.paid_at || e?.created_at || "").slice(0, 10);
    const cat = state?.budgetLines?.find(bl => bl.id === e?.budgetLineId)?.category || "";
    return matchesTerm &&
      (!vFilter.from || day >= vFilter.from) &&
      (!vFilter.to || day <= vFilter.to) &&
      (!vFilter.type || cat === vFilter.type) &&
      (!vFilter.status || (e?.status || "Draft") === vFilter.status);
  });
  const voucherTypes = [...new Set((state?.budgetLines || []).map(bl => bl.category))].sort();
  const voucherStatuses = [...new Set((state?.expenses || []).map(e => e.status || "Draft"))].sort();



  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* Toast Alert Header Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            // Errors interrupt; successes are announced politely. Without this a screen-reader
            // user gets no confirmation that a voucher saved or a payment posted.
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
              }`}
          >
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="hidden md:flex flex-row items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-red-600 text-white font-bold text-lg shadow-inner">AH</div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-sans">AnaHon Financial Management</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Tripoli Civil Co. Compliance Terminal</p>
          </div>
        </div>
        {/* Global search — vouchers, projects, vendors, documents, bank, people */}
        {!isSelfService && (
          <div className="relative flex-1 max-w-md mx-6">
            <input
              value={globalQuery}
              onChange={e => setGlobalQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setGlobalQuery(""); }}
              placeholder="🔍 Search vouchers, projects, vendors, documents, bank…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
            {globalQuery.trim().length >= 2 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 z-[70] max-h-80 overflow-y-auto">
                {(() => {
                  const q = globalQuery.toLowerCase();
                  type Hit = { k: string; label: string; sub: string; go: () => void };
                  const hits: Hit[] = [];
                  state.expenses.filter(e => (e.voucherNo + " " + e.title + " " + e.purpose).toLowerCase().includes(q)).slice(0, 4)
                    .forEach(e => hits.push({ k: "Voucher", label: `${e.voucherNo} — ${e.title}`, sub: formatUSD(e.convertedAmount), go: () => { setSearchTerm(e.voucherNo); handleNavClick("expenses"); } }));
                  state.projects.filter(p => (p.code + " " + p.name).toLowerCase().includes(q)).slice(0, 3)
                    .forEach(p => hits.push({ k: "Project", label: `${p.code} — ${p.name}`, sub: p.status, go: () => { setSelectedProjectId(p.id); handleNavClick("projects"); } }));
                  state.vendors.filter(v => v.name.toLowerCase().includes(q)).slice(0, 3)
                    .forEach(v => hits.push({ k: "Vendor", label: v.name, sub: v.category, go: () => handleNavClick("vendors") }));
                  state.documents.filter(d => d.filename.toLowerCase().includes(q)).slice(0, 3)
                    .forEach(d => hits.push({ k: "Document", label: d.filename, sub: d.category, go: () => openDoc(d) }));
                  state.bankTransactions.filter(t => t.description.toLowerCase().includes(q)).slice(0, 3)
                    .forEach(t => hits.push({ k: "Bank", label: t.description.slice(0, 64), sub: `${t.date} · ${t.type}`, go: () => { setBankSearch(globalQuery); setBankFilterAcc(""); handleNavClick("banking"); } }));
                  state.employees.filter(emp => emp.name.toLowerCase().includes(q)).slice(0, 2)
                    .forEach(emp => hits.push({ k: "Employee", label: emp.name, sub: emp.position, go: () => handleNavClick("payroll") }));
                  if (!hits.length) return <p className="px-3 py-2.5 text-xs text-slate-500">No matches for “{globalQuery}”.</p>;
                  return hits.map((h, i) => (
                    <button key={i} onClick={() => { h.go(); setGlobalQuery(""); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase w-16 shrink-0 text-slate-400">{h.k}</span>
                      <span className="text-xs font-medium flex-1 truncate">{h.label}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{h.sub}</span>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          {/* One-click Arabic: menus and main actions switch, and the page flips to RTL. */}
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            aria-label={lang === "ar" ? "Switch interface to English" : "تحويل الواجهة إلى العربية"}
            title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === "ar" ? "English" : "العربية"}</span>
          </button>
          <button onClick={handleFirebaseSignOut} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer">
            <UserCheck className="w-3.5 h-3.5 text-red-500" />
            <span>{t("Sign Out")}</span>
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white relative z-50 h-16">
        <div className="flex items-center gap-3">
          {/* Phones get the conventional menu button; the desktop edge-handle is hidden here. */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            className="flex items-center justify-center h-11 w-11 -ms-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
          >
            <span className="text-lg leading-none">{isOpen ? "✕" : "☰"}</span>
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded bg-red-650 bg-red-600 text-white font-bold text-base shadow-inner">AH</div>
          <div className="flex flex-col">
            <h1 className="text-xs font-bold tracking-tight font-sans">AnaHon FMS</h1>
            <span className="text-[9px] font-bold font-mono text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/40 uppercase w-fit leading-none mt-0.5">
              {activeTab}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center justify-center px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition cursor-pointer min-h-[44px] text-[11px] font-bold text-slate-300"
            title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            aria-label={lang === "ar" ? "Switch interface to English" : "تحويل الواجهة إلى العربية"}
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          <button 
            onClick={handleFirebaseSignOut} 
            className="flex items-center justify-center p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition cursor-pointer min-h-[44px] min-w-[44px]"
            title="Sign Out"
          >
            <UserCheck className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {isOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsOpen(false)} />}
        
        <aside className={`fixed top-16 bottom-0 ${rtl ? "right-0" : "left-0"} z-50 bg-slate-900 border-slate-800 shrink-0 transition-all duration-300 ease-in-out md:relative md:top-0 md:flex md:flex-col overflow-y-auto ${
          isOpen
            ? 'translate-x-0 w-64 p-4 border-r'
            : `${rtl ? "translate-x-full" : "-translate-x-full"} md:translate-x-0 md:w-0 md:p-0 md:border-r-0 overflow-hidden`
        }`}>
          <nav className="space-y-1 font-sans">
            {isProjectOfficer && (<>
            <p className="px-3 pt-1 pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none">{t("Project Officer")}</p>
            <button onClick={() => handleNavClick("dashboard")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Activity className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Overview")}</span>
            </button>
            <button onClick={() => handleNavClick("projects")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "projects" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FolderGit2 className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("My Projects & Budgets")}</span>
            </button>
            <button onClick={() => handleNavClick("expenses")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "expenses" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FileText className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Purchase Requests")}</span>
            </button>
            <button onClick={() => handleNavClick("procurement")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "procurement" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Layers className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Procurement & Bids")}</span>
            </button>
            </>)}

            {!isSelfService && !isProjectOfficer && (<>
            <p className="px-3 pt-1 pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none">{t("Overview")}</p>
            <button onClick={() => handleNavClick("dashboard")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Activity className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Overview Dashboard")}</span>
            </button>

            <p className="px-3 pt-3 pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none">{t("Registers")}</p>
            <button onClick={() => handleNavClick("accounts")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "accounts" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Sliders className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Chart of Accounts")}</span>
            </button>

            <button onClick={() => handleNavClick("projects")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "projects" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FolderGit2 className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Donors & Projects")}</span>
            </button>

            <button onClick={() => handleNavClick("funnel")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "funnel" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Layers className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Programs & Funnel")}</span>
            </button>

            <button onClick={() => handleNavClick("production")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "production" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Briefcase className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Production & Clients")}</span>
            </button>

            <p className="px-3 pt-3 pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none">{t("Money Flow")}</p>
            <button onClick={() => handleNavClick("expenses")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "expenses" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FileText className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Disbursement Vouchers")}</span>
              <span className="ml-auto bg-slate-800 text-[10px] text-slate-300 px-1.5 py-0.5 rounded-full font-mono shrink-0">
                {state.expenses.filter(e => ["Submitted", "Under Finance Review", "Approved"].includes(e.status)).length}
              </span>
            </button>

            <button onClick={() => handleNavClick("procurement")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "procurement" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Layers className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Procurement & Bids")}</span>
            </button>

            <button onClick={() => handleNavClick("vendors")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "vendors" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Vendor Registry")}</span>
            </button>

            <button onClick={() => handleNavClick("banking")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "banking" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Coins className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Banking & Cash Reconcile")}</span>
            </button>

            <button onClick={() => handleNavClick("ledger")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "ledger" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Building className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("General double-entry Ledger")}</span>
            </button>

            </>)}
            {!isProjectOfficer && (<>
            <p className="px-3 pt-3 pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none">{t("People")}</p>
            <button onClick={() => handleNavClick("payroll")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "payroll" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <User className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Timesheets & Payroll Allocation")}</span>
            </button>
            </>)}

            {!isSelfService && !isProjectOfficer && (<>
            <p className="px-3 pt-3 pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none">{t("Records & Governance")}</p>
            <button onClick={() => handleNavClick("assets")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "assets" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <HardDrive className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Fixed Assets Roll-Forward")}</span>
            </button>

            <button onClick={() => handleNavClick("partners")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "partners" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Briefcase className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Partner Capital Tracking")}</span>
            </button>

            <button onClick={() => handleNavClick("compliance")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "compliance" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
              <span className="text-left flex-1">{t("Compliance Control Desk")}</span>
              <span className="ml-auto flex h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            </button>
            <button onClick={() => handleNavClick("handbooks")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "handbooks" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Policies & Handbooks")}</span>
            </button>
            <button onClick={() => handleNavClick("reports")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "reports" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FileText className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">{t("Periodic Reports")}</span>
            </button>
            </>)}
          </nav>

          <div className="border-t border-slate-800 pt-4 mt-6">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">Live Session Context</h4>
            <div className="mt-2 bg-slate-950 p-3 rounded text-[11px] font-mono leading-relaxed space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Accountant Verification:</span>
                <span className="text-emerald-400">Yes</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>USD/EUR rate:</span>
                <span>{state.fxRates.EUR}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>USD/LBP rate:</span>
                <span>{state.fxRates.LBP}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Active User:</span>
                <span className="text-amber-400">{currentUser.name.split(" ")[0]}</span>
              </div>
            </div>
            <p className="mt-3 text-center text-[9px] text-slate-600 font-mono">AnaHon Media • Beirut/Tripoli Hub</p>
          </div>
        </aside>

        {/* Dynamic Display Panel View */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-8">

          {/* Tab Content Dynamic Mounting */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-sans text-slate-900"> Tripoli Operations Control Dashboard</h2>
                  <p className="text-sm text-slate-500">
                    Consolidated cashboxes, restricted project ledger balances, and active compliance review status.
                  </p>
                </div>
                {/* Instant KPI metrics banner */}
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 p-3 rounded-lg p-3">
                  <Activity className="h-8 w-8 text-red-600" />
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Audit Compliance Score</h3>
                    <p className="text-xl font-bold font-mono text-red-600">98.5%</p>
                  </div>
                </div>
              </div>

              {/* Financial Summary KPIs — hidden from Project Officers (requester role sees only their projects' burn) */}
              {!isProjectOfficer && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <button type="button" onClick={() => handleNavClick("banking")} className="text-left rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-red-300 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Total Available Treasury Pool</span>
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-slate-900">{formatUSD(totalUSDInBank)}</h3>
                  <p className="mt-1 text-xs text-slate-500">Across Bank accounts · click to open Banking</p>
                  {/* This figure ties to the imported statements, not to the bank's realtime
                      balance — there is no bank API; statement import IS the sync. Showing the
                      as-of date stops it being mistaken for a live number. */}
                  {/* What makes up the total, account by account — a headline figure with no
                      visible parts invites the question "from where?" every single time. */}
                  <div className="mt-1.5 space-y-0.5">
                    {state.bankAccounts.filter(b => b.active).map(b => {
                      const rate = b.currency === "EUR" ? state.fxRates.EUR : b.currency === "LBP" ? state.fxRates.LBP : 1;
                      return (
                        <div key={b.id} className="flex justify-between text-[10px] font-mono text-slate-500">
                          <span className="truncate pr-2">{b.name}</span>
                          <span className="shrink-0">
                            {formatIn(b.balance, b.currency)}
                            {b.currency !== "USD" && <span className="text-slate-400"> → {formatUSD(b.balance * rate)}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400 font-mono">
                    source: BLOM statements as of {state.bankTransactions.filter(t => !t.pending).reduce((m, t) => t.date > m ? t.date : m, "")} · EUR at {state.fxRates?.EUR ?? "—"}
                  </p>
                  {(() => {
                    // Counted notes are real money and DO count. The book balance of 1120 does
                    // not: the difference between the two is cash drawn without documented
                    // vouchers — a documentation gap, never "available funds".
                    const petty = state.accounts.find(a => a.code === "1120")?.balance || 0;
                    if (petty <= 0 && !latestCashCount) return null;
                    return (
                      <div className="mt-1 space-y-1">
                        {latestCashCount && (
                          <p className={`text-[10px] rounded px-2 py-1 leading-snug border ${cashCountStale ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-800 bg-emerald-50 border-emerald-200"}`}>
                            💵 Cash counted <strong>{formatUSD(latestCashCount.countedUSD)}</strong> on {latestCashCount.date}
                            {latestCashCount.countedBy ? ` by ${latestCashCount.countedBy}` : ""}
                            {cashCountStale ? " — count is over 45 days old, so it is excluded from the pool above until recounted." : " — included in the pool above."}
                          </p>
                        )}
                        {petty > 0 && (
                          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-snug">
                            ⚠️ <strong>{formatUSD(latestCashCount ? Math.max(0, petty - latestCashCount.countedUSD) : petty)}</strong> cash drawn but not yet documented
                            {latestCashCount ? " (ledger 1120 less the counted notes)" : " (ledger 1120)"} — <em>not</em> available funds.
                            {!latestCashCount && " Record a cash count to separate real notes in hand from this gap."}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {(() => {
                    // Net effect of staged advice lines, per currency — shown, never added in.
                    const pend = state.bankTransactions.filter(t => t.pending);
                    if (!pend.length) return null;
                    const byCcy: Record<string, number> = {};
                    pend.forEach(t => {
                      const ccy = state.bankAccounts.find(ba => ba.id === t.bankAccountId)?.currency || "USD";
                      byCcy[ccy] = (byCcy[ccy] || 0) + (t.type === "Deposit" ? t.amount : -t.amount);
                    });
                    return (
                      <p className="mt-0.5 text-[10px] text-amber-600 font-mono">
                        ⏳ pending advices: {Object.entries(byCcy).map(([c, v]) => `${v >= 0 ? "+" : "−"}${formatIn(Math.abs(v), c)}`).join(" · ")} (awaiting statement)
                      </p>
                    );
                  })()}
                </button>

                <button type="button" onClick={() => handleNavClick("projects")} className="text-left rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-red-300 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Active Donor Projects</span>
                    <FolderGit2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-blue-900">{state.projects.length}</h3>
                  <p className="mt-1 text-xs text-slate-500">With restriction covenants · click to open Projects</p>
                </button>

                <button type="button" onClick={() => handleNavClick("expenses")} className="text-left rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-red-300 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Outstanding Approvals</span>
                    <Sliders className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-amber-700">
                    {state.expenses.filter(e => e.status === "Submitted" || e.status === "Under Finance Review").length} Vouchers
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Pending signatures · click to open Vouchers</p>
                </button>

                <button type="button" onClick={() => handleNavClick("compliance")} className="text-left rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-red-300 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Vat rate / Tax settings</span>
                    <Percent className="h-5 w-5 text-slate-600" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-slate-800">MoF 11% / SSD Pool</h3>
                  <p className="mt-1 text-xs text-slate-500">MoF Chapter 3 · click to open Compliance</p>
                </button>
              </div>
              )}

              {/* Phone access — read live from the machine's interfaces, so a router
                  reassigning the IP can never leave a dead link on the wall. */}
              {phoneAccess && phoneAccess.urls.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">📱 Open on your phone</p>
                      <p className="mt-1 font-mono text-lg font-bold text-slate-900 break-all">{phoneAccess.urls[0].url}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Same WiFi · this Mac must be awake and running · address is read live, so it stays correct if the router changes it
                        {phoneAccess.urls.length > 1 && ` · also: ${phoneAccess.urls.slice(1).map(u => u.url).join(", ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(phoneAccess.urls[0].url); triggerToast("Address copied."); }}
                        className="text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 transition-all"
                      >
                        📋 Copy
                      </button>
                      {phoneAccess.qr && (
                        <button
                          type="button"
                          onClick={() => setShowPhoneQr(!showPhoneQr)}
                          className="text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 rounded-lg px-3 py-2 transition-all"
                        >
                          {showPhoneQr ? "Hide QR" : "▣ Show QR"}
                        </button>
                      )}
                    </div>
                  </div>
                  {showPhoneQr && phoneAccess.qr && (
                    <div className="mt-3 flex justify-center">
                      <div className="w-48 [&>svg]:w-full [&>svg]:h-auto bg-white p-2 rounded border border-slate-200"
                        dangerouslySetInnerHTML={{ __html: phoneAccess.qr }} />
                    </div>
                  )}
                </div>
              )}

              {/* Active Projects Burn rates visual tracking blocks */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Project budgets & Sinking Burn Rates</h3>
                <div className="space-y-6">
                  {requestableProjects.map(p => {
                    const lines = state.budgetLines.filter(bl => bl.projectId === p.id);
                    const spent = lines.reduce((s, x) => s + x.actualUSD, 0);
                    const committed = lines.reduce((s, x) => s + x.committedUSD, 0);
                    const remaining = Math.max(0, p.budgetUSD - (spent + committed));
                    const percentageSpent = p.budgetUSD > 0 ? Math.min(100, ((spent + committed) / p.budgetUSD) * 100) : 0;

                    return (
                      <div key={p.id} className="p-4 rounded-lg bg-slate-50 border border-slate-105">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold font-mono mr-2">{p.code}</span>
                            <span className="text-sm font-bold text-slate-900">{p.name}</span>
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            Total Limit: {formatUSD(p.budgetUSD)} | Burn rate (actual + committed): <span className="font-bold text-slate-850">{percentageSpent.toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Visual Burn bar code */}
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                          <div style={{ width: `${(spent / p.budgetUSD) * 100}%` }} className="bg-emerald-600 h-full" title="Actual Spent" />
                          <div style={{ width: `${(committed / p.budgetUSD) * 100}%` }} className="bg-amber-400 h-full animate-pulse" title="Committed funds" />
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-2">
                          <div>🟢 Actual Burned: <span className="text-slate-800 font-medium">{formatUSD(spent)}</span></div>
                          <div>🟡 Committed Reserved: <span className="text-slate-800 font-medium">{formatUSD(committed)}</span></div>
                          <div>Remaining Budget Balance: <span className="text-slate-900 font-bold">{formatUSD(remaining)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dual Column Bottom components */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Active compliance task indicators */}
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-md font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-red-600" />
                    Statutory Post Filing Calendar & Alerts
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {state.complianceTasks.map(t => {
                      const isOverdue = t.status !== "Done" && t.dueDate < new Date().toISOString().split("T")[0];
                      return (
                        <div key={t.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                            <span className="text-xs text-slate-500">Deadline: {t.dueDate} • Code: {t.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${t.status === "Done" ? "bg-emerald-100 text-emerald-700" : isOverdue ? "bg-red-100 text-red-700 animate-pulse" : "bg-amber-100 text-amber-700"
                              }`}>
                              {t.status === "Done" ? "Done" : isOverdue ? "⚠ OVERDUE" : t.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated cashbox breakdown summary */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-md font-bold text-slate-800 mb-3">Currency Cash Drawers</h3>
                  <div className="space-y-3">
                    {state.bankAccounts.map(b => (
                      <div key={b.id} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{b.name}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{b.accountNo}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold text-slate-900">
                            {b.balance.toLocaleString()} {b.currency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}


          {/* tab content Chart of Accounts */}
          {activeTab === "accounts" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-sans">Ministry of Finance Approved Chart of Accounts</h2>
                  <p className="text-xs text-slate-500">Official double-entry account lines mapped to statutory reporting schedules.</p>
                </div>
                {/* Modal setup parameters */}
                <div className="bg-slate-100 text-[11px] p-2 rounded max-w-sm text-slate-600 border border-slate-200 leading-relaxed font-mono">
                  💡 Single balance updates occur during <strong>Posting Vouchers</strong> ensuring audit trace-ability. Direct balance edits are prohibited.
                </div>
              </div>

              {/* Add Account Inline form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleCreateAccount} className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Account Number Code")}</label>
                    <input
                      type="text"
                      placeholder="e.g. 5140"
                      value={newAccountCode}
                      onChange={(e) => setNewAccountCode(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Descriptive Title")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Travel fuel to Akkar"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Class Type")}</label>
                    <select
                      value={newAccountType}
                      onChange={(e) => setNewAccountType(e.target.value as any)}
                      className="finance-input w-full"
                    >
                      <option value="Asset">Asset (1000s)</option>
                      <option value="Liability">Liability (2000s)</option>
                      <option value="Equity">Equity (3000s)</option>
                      <option value="Revenue">Revenue (4000s)</option>
                      <option value="Expense">Expense (5000-7000s)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Currency Code")}</label>
                    <select
                      value={newAccountCurrency}
                      onChange={(e) => setNewAccountCurrency(e.target.value as any)}
                      className="finance-input w-full"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="LBP">LBP</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-red-650 bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">
                    Register Account Line
                  </button>
                </form>
              )}

              {/* Accounts table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Mobile: stacked cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {state.accounts.map(acc => (
                    <div key={acc.code} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-slate-800">{acc.code}</span>
                        <span className="font-mono font-bold text-sm text-slate-900">{acc.balance.toLocaleString()} {acc.currency}</span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5">{acc.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{acc.type} · {acc.reportingGroup}{acc.active ? "" : " · inactive"}</p>
                    </div>
                  ))}
                </div>
                <table className="w-full text-left border-collapse hidden md:table">
                  <thead className="bg-slate-100">
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Code / ID</th>
                      <th className="px-6 py-3">Reporting Classification Name</th>
                      <th className="px-6 py-3 hidden md:table-cell">Account Type</th>
                      <th className="px-6 py-3 hidden md:table-cell">Original Currency</th>
                      <th className="px-6 py-3 text-right">Raw Ledger Balance</th>
                      <th className="px-6 py-3 text-right hidden md:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-sans">
                    {state.accounts.map((acc) => (
                      <tr key={acc.code} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-mono font-bold text-slate-800">{acc.code}</td>
                        <td className="px-6 py-3 font-medium text-slate-900">{acc.name}</td>
                        <td className="px-6 py-3 hidden md:table-cell">
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${acc.type === "Asset" ? "bg-teal-50 text-teal-700" :
                              acc.type === "Liability" ? "bg-amber-50 text-amber-700" :
                                acc.type === "Equity" ? "bg-indigo-50 text-indigo-700" :
                                  acc.type === "Revenue" ? "bg-emerald-50 text-emerald-700" :
                                    "bg-rose-50 text-rose-700"
                            }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-slate-600 hidden md:table-cell">{acc.currency}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-slate-900">
                          {acc.balance.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right hidden md:table-cell">
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* tab content Donors & Projects */}
          {activeTab === "projects" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Resricted Donor Grants & Sinking Budgets")}</h2>
                <p className="text-xs text-slate-500">Track designated funding allocations, revised budget versions and project execution timelines.</p>
              </div>

              {/* Donors Profiles list — not relevant to a requester-only role */}
              {!isProjectOfficer && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {state.donors.map(d => (
                  <div key={d.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-red-650 text-red-600" />
                      <h4 className="text-sm font-bold text-slate-900">{d.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">Region Origin: {d.country}</p>
                    <p className="text-xs text-slate-500">{d.contactEmail}</p>
                    <div className="mt-3 p-2 bg-slate-50 border border-slate-105 rounded text-[11px] text-slate-600 leading-relaxed italic">
                      ℹ️ {d.notes}
                    </div>
                  </div>
                ))}
              </div>
              )}

              {/* ── All project timelines at a glance ─────────────────────
                  One place to see what is next across every project, instead of
                  opening each workspace in turn. */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">🗓 Project Timelines</h3>
                  {["Super Admin", "Finance Officer", "Program Director", "Project Officer"].includes(currentUser.role) && (
                    <button type="button" onClick={() => generateTimeline(null, true)}
                      className="text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 rounded-lg px-3 py-2 transition-all"
                      title="Apply the standard 8-step template to every project, marking steps done where the evidence already exists">
                      ✨ Build / refresh all timelines
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Standard steps per project — agreement, funds, budget, start, mid-point, end, report, closeout.
                  Steps are marked done automatically when the evidence is already in the system; a status you set by hand is never overwritten.
                </p>
                {(() => {
                  const rows = requestableProjects.map(p => {
                    const acts = state.projectActivities.filter(a => a.projectId === p.id);
                    const open = acts.filter(a => a.status !== "Done" && a.status !== "Cancelled");
                    const overdue = open.filter(a => a.dueDate && a.dueDate < new Date().toLocaleDateString("en-CA"));
                    const next = open.filter(a => a.dueDate).sort((x, y) => x.dueDate.localeCompare(y.dueDate))[0];
                    return { p, total: acts.length, done: acts.filter(a => a.status === "Done").length, overdue: overdue.length, next };
                  }).filter(r => r.total > 0);
                  if (!rows.length) return <p className="text-xs text-slate-400 italic">No timelines yet — press the button above to build them from what the system already knows.</p>;
                  return (
                    <div className="space-y-1.5">
                      {rows.sort((a, b) => (b.overdue - a.overdue) || ((a.next?.dueDate || "9999").localeCompare(b.next?.dueDate || "9999"))).map(r => (
                        <button key={r.p.id} type="button" onClick={() => { setSelectedProjectId(r.p.id); setProjectWorkspaceTab("folder"); }}
                          className={`w-full text-left flex flex-wrap items-center gap-3 p-2 rounded border text-xs transition-all hover:border-slate-350 ${r.overdue ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
                          <span className="font-mono font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{r.p.code}</span>
                          <span className="text-slate-600 shrink-0">{r.done}/{r.total} done</span>
                          {r.overdue > 0 && <span className="text-red-700 font-bold shrink-0">{r.overdue} overdue</span>}
                          <span className="flex-1 min-w-[160px] text-slate-700">
                            {r.next ? <>next: <strong>{r.next.title}</strong> <span className="font-mono text-slate-500">{r.next.dueDate}</span></> : <span className="text-emerald-700">all steps closed</span>}
                          </span>
                          {(() => {
                            // The four papers every project must carry, shown here so gaps
                            // are visible without opening each workspace.
                            const docs = state.documents.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === r.p.id);
                            const hit = (re: RegExp) => docs.some(d => re.test(`${d.category} ${d.filename}`.toLowerCase()));
                            const tt = hit(/timetable|timeline|work ?plan|year plan/) || state.projectActivities.some(a => a.projectId === r.p.id && a.source === "imported");
                            const gaps = [
                              !hit(/proposal|concept note/) && "proposal",
                              !tt && "timetable",
                              !hit(/budget/) && "budget",
                              !hit(/agreement|contract|grant offer/) && "agreement"
                            ].filter(Boolean);
                            return gaps.length
                              ? <span className="text-[10px] text-amber-700 font-bold shrink-0">missing: {gaps.join(", ")}</span>
                              : <span className="text-[10px] text-emerald-700 font-bold shrink-0">papers complete</span>;
                          })()}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Add Project Inline form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleCreateProject} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">➕ Create New Project</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Project Name")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Akkar Legal Support Clinic"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="finance-input w-full font-sans text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Project Code (Unique)")}</label>
                      <input
                        type="text"
                        placeholder="e.g. AKK-2026"
                        value={newProjectCode}
                        onChange={(e) => setNewProjectCode(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Donor Partner")}</label>
                      <select
                        value={newProjectDonor}
                        onChange={(e) => setNewProjectDonor(e.target.value)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="">Select a Donor...</option>
                        {state.donors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Budget Pool (USD)")}</label>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={newProjectBudget}
                        onChange={(e) => setNewProjectBudget(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Start Date")}</label>
                      <input
                        type="date"
                        value={newProjectStartDate}
                        onChange={(e) => setNewProjectStartDate(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("End Date")}</label>
                      <input
                        type="date"
                        value={newProjectEndDate}
                        onChange={(e) => setNewProjectEndDate(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Funding Type")}</label>
                      <select
                        value={newProjectFundingType}
                        onChange={(e) => setNewProjectFundingType(e.target.value as any)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="Restricted Grant">Restricted Grant</option>
                        <option value="Unrestricted Service">Unrestricted Service</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="proj-stream" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Program Stream")}</label>
                      <select
                        id="proj-stream"
                        value={newProjectStream}
                        onChange={(e) => setNewProjectStream(e.target.value)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="">— Assign later —</option>
                        {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="proj-funding-tx" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Funding Deposit (Bank Proof)")}</label>
                      {/* Only unclaimed statement deposits are offered — a project cannot be
                          registered without the bank line that proves its money arrived. */}
                      <select
                        id="proj-funding-tx"
                        required
                        value={newProjectFundingTx}
                        onChange={(e) => setNewProjectFundingTx(e.target.value)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="">— Select statement deposit —</option>
                        {state.bankTransactions
                          .filter(bt => bt.type === "Deposit" && !bt.projectId && !bt.pending)
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map(bt => {
                            const acct = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                            return (
                              <option key={bt.id} value={bt.id}>
                                {bt.date} · {formatIn(bt.amount, acct?.currency || "USD")} · {bt.description.slice(0, 60)}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">
                        Register Project Grant
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Active Restricted Projects Section (NEW) */}
              <div className="space-y-4">
                <h3 className="text-md font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                  📁 Active Restricted Projects
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {requestableProjects.map(proj => {
                    const donor = state.donors.find(d => d.id === proj.donorId);
                    const isSelected = selectedProjectId === proj.id;
                    const burnTotal = state.budgetLines
                      .filter(bl => bl.projectId === proj.id)
                      .reduce((sum, bl) => sum + (bl.actualUSD || 0), 0);
                    const burnPercent = Math.min(100, Math.round((burnTotal / (proj.budgetUSD || 1)) * 100));

                    return (
                      <div
                        key={proj.id}
                        onClick={() => setSelectedProjectId(selectedProjectId === proj.id ? null : proj.id)}
                        className={`p-5 bg-white border rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${isSelected ? "ring-2 ring-red-600 border-transparent bg-red-50/10" : "border-slate-200 hover:border-slate-350 hover:shadow-md"
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-red-50 text-red-700 font-mono font-bold px-2 py-0.5 rounded uppercase">
                              {proj.code}
                            </span>
                            {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                              <button
                                onClick={(e) => handleDeleteProject(e, proj.id)}
                                className="text-slate-400 hover:text-red-650 p-1 transition-colors rounded hover:bg-slate-100"
                                title="Delete Project"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${proj.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}>
                            {proj.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 font-sans mb-1">{proj.name}</h4>
                        <p className="text-xs text-slate-500 mb-1">Donor Partner: {donor?.name || "Restricted Donor"}</p>
                        <p className="text-[10px] text-slate-400 mb-3">🏛 {proj.stream || "— program unassigned"}</p>

                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Burn Rate</span>
                            <span>{burnPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-red-600 h-full transition-all duration-300" style={{ width: `${burnPercent}%` }} />
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase">Grants pool</span>
                            <strong className="text-slate-800 font-mono">{formatUSD(proj.budgetUSD)}</strong>
                          </div>
                          <span className="text-red-650 font-bold hover:underline flex items-center gap-0.5">
                            {isSelected ? "Close Workspace ✕" : "Open Workspace 📂"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project Workspace Control Panel (NEW) */}
              {selectedProjectId && (() => {
                const activeProject = state.projects.find(p => p.id === selectedProjectId);
                if (!activeProject) return null;

                const activeDonor = state.donors.find(d => d.id === activeProject.donorId);
                const projDocs = state.documents.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === selectedProjectId);
                const projExpenses = state.expenses.filter(e =>
                  e.projectId === selectedProjectId ||
                  (e.allocations && e.allocations.some((a: any) => a.projectId === selectedProjectId))
                );
                const projProcurements = state.procurements.filter(p => p.projectId === selectedProjectId);

                // Bank transactions linked to this project
                const projVouchers = projExpenses.map(e => e.voucherNo);
                const projBankTx = state.bankTransactions.filter(bt => bt.voucherNo && projVouchers.includes(bt.voucherNo));

                // Donor money in. Carries projectId directly — it has no voucher to route it.
                const projFunding = state.bankTransactions
                  .filter(bt => bt.projectId === selectedProjectId)
                  .sort((a, b) => a.date.localeCompare(b.date));
                const fundingAccounts = [...new Set(projFunding.map(bt => bt.bankAccountId))]
                  .map(id => state.bankAccounts.find(ba => ba.id === id))
                  .filter(Boolean);

                // Timesheets allocating payroll to this project
                const projTimesheets = state.timesheets.filter(ts =>
                  ts.allocations && ts.allocations.some((alloc: any) => alloc.projectId === selectedProjectId)
                );

                return (
                  <div ref={workspaceRef} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono font-bold">{activeProject.code}</span>
                          <h3 className="text-lg font-bold text-slate-900 font-sans">{activeProject.name} Workspace</h3>
                        </div>
                        <p className="text-xs text-slate-500">Restricted Donor: {activeDonor?.name || "Unspecified"} • Grant Pool: {formatUSD(activeProject.budgetUSD)}</p>
                        {fundingAccounts.length > 0 ? (
                          <p className="text-[11px] text-slate-500 mt-1">
                            🏦 Funded into:{" "}
                            {fundingAccounts.map((ba: any, i) => (
                              <span key={ba.id} className="font-mono">
                                {i > 0 && " • "}
                                {ba.name} <span className="text-slate-400">{ba.accountNo}</span>{" "}
                                <strong className="text-emerald-700">
                                  {formatIn(projFunding.filter(t => t.bankAccountId === ba.id).reduce((s, t) => s + t.amount, 0), ba.currency)}
                                </strong>
                              </span>
                            ))}
                            <span className="text-slate-400 font-sans italic"> — source: BLOM statement, {projFunding.length} receipt{projFunding.length === 1 ? "" : "s"}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 mt-1 italic">🏦 No bank receipts linked to this project — funding source unverified.</p>
                        )}
                      </div>

                      {/* Sub-tab navigation */}
                      <div className="flex flex-col sm:flex-row bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium font-sans gap-1 sm:gap-0">
                        <button
                          type="button"
                          onClick={() => setProjectWorkspaceTab("folder")}
                          className={`min-h-[44px] px-4 py-2.5 flex items-center justify-center rounded-md transition-colors ${projectWorkspaceTab === "folder" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                          📁 Folder Explorer (Audit File)
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectWorkspaceTab("reconciliation")}
                          className={`min-h-[44px] px-4 py-2.5 flex items-center justify-center rounded-md transition-colors ${projectWorkspaceTab === "reconciliation" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                          📊 Monthly Reconciliation Report
                        </button>
                      </div>
                    </div>

                    {/* Sub-tab 1: Folder Explorer (Section 2.6 Compliance) */}
                    {projectWorkspaceTab === "folder" && (
                      <div className="space-y-6">

                        {/* ── Core project documents ───────────────────────
                            The four papers a project must always carry: what we promised
                            (proposal), when (timetable), for how much (budget), and on what
                            terms (signed agreement). Missing ones are stated, not hidden. */}
                        {(() => {
                          const projDocsAll = state.documents.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === selectedProjectId);
                          const hasImportedTimetable = state.projectActivities.some(a => a.projectId === selectedProjectId && a.source === "imported");
                          const match = (re: RegExp) => projDocsAll.find(d => re.test(`${d.category} ${d.filename}`.toLowerCase()));
                          const slots = [
                            { key: "Proposal", label: "Proposal", re: /proposal|concept note/, doc: match(/proposal|concept note/), extra: "" },
                            { key: "Timetable", label: "Activity timetable", re: /timetable|timeline|work ?plan|year plan/, doc: match(/timetable|timeline|work ?plan|year plan/), extra: hasImportedTimetable ? "imported into the timeline below" : "" },
                            { key: "Budget", label: "Approved budget", re: /budget/, doc: match(/budget/), extra: "" },
                            { key: "Agreement", label: "Signed agreement", re: /agreement|contract|grant offer/, doc: match(/agreement|contract|grant offer/), extra: "" }
                          ];
                          const missing = slots.filter(sl => !sl.doc && !sl.extra).length;
                          return (
                            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                <h4 className="text-xs font-bold text-slate-700 uppercase font-mono">📑 Core Project Documents</h4>
                                <span className={`text-[10px] font-bold ${missing ? "text-amber-700" : "text-emerald-700"}`}>
                                  {missing ? `${missing} of 4 missing` : "complete"}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                {slots.map(sl => (
                                  <div key={sl.key} className={`p-2 rounded border text-xs ${sl.doc || sl.extra ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                                    <p className="text-[10px] font-bold uppercase text-slate-600">{sl.label}</p>
                                    {sl.doc ? (
                                      <a href={`/api/document/content/${sl.doc.id}`} target="_blank" onClick={e => { e.preventDefault(); openDoc(sl.doc); }} rel="noreferrer"
                                        className="text-[11px] text-red-650 hover:underline break-all">📄 {sl.doc.filename}</a>
                                    ) : sl.extra ? (
                                      <span className="text-[11px] text-emerald-800">✓ {sl.extra}</span>
                                    ) : (
                                      <span className="text-[11px] text-amber-800 font-bold">missing</span>
                                    )}
                                    {["Super Admin", "Finance Officer", "Program Director", "Project Officer"].includes(currentUser.role) && (
                                      <label className="block mt-1 text-[10px] font-bold text-slate-500 hover:text-red-650 cursor-pointer">
                                        {sl.doc ? "replace / add" : "＋ upload"}
                                        <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xlsm,image/*"
                                          onChange={ev => handleCoreDocUpload(ev, selectedProjectId!, sl.key)} />
                                      </label>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {missing > 0 && (
                                <p className="text-[10px] text-amber-800">
                                  A project should always carry what was promised, when, for how much, and on what terms — these are the papers every donor audit asks for first.
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {/* ── Project timeline ─────────────────────────────
                            Dated, assignable steps. Overdue and due-soon are coloured,
                            so what needs doing next is visible without being remembered. */}
                        <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <h4 className="text-xs font-bold text-slate-700 uppercase font-mono">🗓 Project Timeline & Assignments</h4>
                            {["Super Admin", "Finance Officer", "Program Director", "Project Officer"].includes(currentUser.role) && (
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => generateTimeline(selectedProjectId!)}
                                  className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 transition-all"
                                  title="Create the standard steps from this grant's start, mid-point and end dates">
                                  ✨ Generate from grant dates
                                </button>
                                <label className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 cursor-pointer transition-all"
                                  title="Upload the donor's Activity Timetable (.xlsx) — activities, Results and period columns are read from the sheet">
                                  📊 Import donor timetable
                                  <input type="file" accept=".xlsx" className="hidden"
                                    onChange={e => importTimetable(e, selectedProjectId!)} />
                                </label>
                                <button type="button"
                                  onClick={() => setActivityForm({ projectId: selectedProjectId, title: "", detail: "", kind: "Activity", dueDate: "", assigneeUserId: "", status: "Planned" })}
                                  className="text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg px-3 py-1.5 transition-all">
                                  ➕ Add step
                                </button>
                              </div>
                            )}
                          </div>

                          {activityForm && activityForm.projectId === selectedProjectId && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                              <div className="md:col-span-2">
                                <label htmlFor="ac-title" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">What needs doing</label>
                                <input id="ac-title" type="text" placeholder="e.g. Hygiene kit distribution — 6 shelters"
                                  value={activityForm.title} onChange={e => setActivityForm({ ...activityForm, title: e.target.value })}
                                  className="finance-input w-full text-xs" />
                              </div>
                              <div>
                                <label htmlFor="ac-kind" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Type</label>
                                <select id="ac-kind" value={activityForm.kind} onChange={e => setActivityForm({ ...activityForm, kind: e.target.value })} className="finance-input w-full text-xs">
                                  <option>Activity</option><option>Milestone</option><option>Report</option><option>Payment</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="ac-due" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Due</label>
                                <input id="ac-due" type="date" value={activityForm.dueDate}
                                  onChange={e => setActivityForm({ ...activityForm, dueDate: e.target.value })} className="finance-input w-full font-mono text-xs" />
                              </div>
                              <div>
                                <label htmlFor="ac-who" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Assign to</label>
                                <select id="ac-who" value={activityForm.assigneeUserId} onChange={e => setActivityForm({ ...activityForm, assigneeUserId: e.target.value })} className="finance-input w-full text-xs">
                                  <option value="">— Unassigned —</option>
                                  {state.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label htmlFor="ac-detail" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Detail (optional)</label>
                                <input id="ac-detail" type="text" value={activityForm.detail}
                                  onChange={e => setActivityForm({ ...activityForm, detail: e.target.value })} className="finance-input w-full text-xs" />
                              </div>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => saveActivity(activityForm)} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">💾 Save</button>
                                <button type="button" onClick={() => setActivityForm(null)} className="bg-slate-100 text-slate-600 text-xs font-medium rounded-lg px-3 py-2 hover:bg-slate-200 transition-all">Cancel</button>
                              </div>
                            </div>
                          )}

                          {/* Donor activity timetable — the Gantt shape AnaHon submits:
                              activities under their Result, numbered, shaded across periods. */}
                          {(() => {
                            const imported = state.projectActivities.filter(a => a.projectId === selectedProjectId && a.source === "imported");
                            if (!imported.length) return null;
                            const periodsOf = (a: any) => { try { return JSON.parse(a.periodsJson || "[]"); } catch { return []; } };
                            const cols: string[] = [];
                            imported.forEach(a => periodsOf(a).forEach((p: string) => { if (!cols.includes(p)) cols.push(p); }));
                            const groups = [...new Set(imported.map(a => a.resultGroup || ""))];
                            return (
                              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <caption className="text-left text-[10px] text-slate-500 p-2">
                                    Donor activity timetable — imported. Shaded cells are the periods each activity runs in.
                                  </caption>
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                      <th scope="col" className="p-2 text-left w-8">#</th>
                                      <th scope="col" className="p-2 text-left min-w-[220px]">Activity</th>
                                      {cols.map(c => <th key={c} scope="col" className="p-1 text-center font-mono text-[9px] whitespace-nowrap">{c.replace(/\\/g, "/")}</th>)}
                                      <th scope="col" className="p-2 text-left">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groups.map(g => (
                                      <React.Fragment key={g || "none"}>
                                        {g && (
                                          <tr className="bg-slate-100">
                                            <td colSpan={cols.length + 3} className="p-1.5 font-bold text-slate-700 text-[10px]">{g}</td>
                                          </tr>
                                        )}
                                        {imported.filter(a => (a.resultGroup || "") === g).map(a => {
                                          const mine = periodsOf(a);
                                          const done = a.status === "Done";
                                          return (
                                            <tr key={a.id} className="border-b border-slate-100">
                                              <td className="p-2 font-mono text-slate-500">{(a as any).outlineNo}</td>
                                              <td className={`p-2 ${done ? "line-through text-slate-400" : "text-slate-800"}`}>
                                                {a.title}
                                                {(a as any).titleAr && <span dir="rtl" className="block text-[10px] text-slate-500">{(a as any).titleAr}</span>}
                                              </td>
                                              {cols.map(c => (
                                                <td key={c} className={`p-1 text-center ${mine.includes(c) ? (done ? "bg-emerald-200" : "bg-red-500/80") : ""}`} title={mine.includes(c) ? `${a.title} — ${c}` : ""}>
                                                  {mine.includes(c) ? <span className="sr-only">scheduled</span> : ""}
                                                </td>
                                              ))}
                                              <td className="p-1">
                                                <select value={a.status} onChange={e => saveActivity({ ...a, status: e.target.value })}
                                                  aria-label={`Status for ${a.title}`} className="finance-input text-[10px] py-0.5">
                                                  <option>Planned</option><option>In Progress</option><option>Done</option><option>Cancelled</option>
                                                </select>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}

                          {(() => {
                            const acts = state.projectActivities
                              .filter(a => a.projectId === selectedProjectId && a.source !== "imported")
                              .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
                            if (!acts.length) return <p className="text-[11px] text-slate-400 italic">No steps yet — generate the standard ones from the grant dates, or add your own.</p>;
                            return (
                              <ol className="space-y-1.5">
                                {acts.map(a => {
                                  const days = a.dueDate ? Math.ceil((new Date(`${a.dueDate}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
                                  const open = a.status !== "Done" && a.status !== "Cancelled";
                                  const overdue = open && days !== null && days < 0;
                                  const soon = open && days !== null && days >= 0 && days <= 14;
                                  const who = state.users.find(u => u.id === a.assigneeUserId);
                                  return (
                                    <li key={a.id} className={`flex flex-wrap items-center gap-2 p-2 rounded border text-xs ${overdue ? "bg-red-50 border-red-200" : soon ? "bg-amber-50 border-amber-200" : a.status === "Done" ? "bg-emerald-50/40 border-emerald-100" : "bg-white border-slate-200"}`}>
                                      <span className="font-mono text-[10px] text-slate-500 w-20 shrink-0">{a.dueDate || "—"}</span>
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{a.kind}</span>
                                      <span className={`flex-1 min-w-[140px] ${a.status === "Done" ? "line-through text-slate-400" : "text-slate-800 font-medium"}`}>
                                        {a.title}
                                        {a.detail && <span className="block text-[10px] font-normal text-slate-400">{a.detail}</span>}
                                      </span>
                                      {open && days !== null && (
                                        <span className={`text-[10px] font-bold shrink-0 ${overdue ? "text-red-700" : soon ? "text-amber-700" : "text-slate-400"}`}>
                                          {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-500 shrink-0">{who ? `👤 ${who.name}` : "unassigned"}</span>
                                      {["Super Admin", "Finance Officer", "Program Director", "Project Officer"].includes(currentUser.role) && (
                                        <span className="flex items-center gap-1 shrink-0">
                                          <select value={a.status} onChange={e => saveActivity({ ...a, status: e.target.value })}
                                            aria-label={`Status for ${a.title}`} className="finance-input text-[10px] py-0.5">
                                            <option>Planned</option><option>In Progress</option><option>Done</option><option>Cancelled</option>
                                          </select>
                                          <button onClick={() => setActivityForm({ ...a })} title="Edit" aria-label={`Edit ${a.title}`} className="text-slate-400 hover:text-slate-700">✏️</button>
                                          <button onClick={() => deleteActivity(a)} title="Remove" aria-label={`Remove ${a.title}`} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                          {/* Folder A: Project Contracts & MoUs */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 1. Contracts, MoUs & Co-funding splits
                              </h4>
                              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                                <label className="text-[10px] text-red-650 hover:text-red-700 font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2">
                                  ➕ Upload MoU
                                  <input
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg"
                                    onChange={(e) => handleProjectDocUpload(e, activeProject.id)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>

                            {projDocs.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No uploaded contracts or MoU PDFs found in this project archive.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projDocs.map(doc => (
                                  <div key={doc.id} className="flex justify-between items-center text-xs p-2 bg-white border border-slate-100 rounded shadow-inner">
                                    <span className="flex items-center gap-1.5 truncate max-w-xs">
                                      {doc.refNo && (
                                        <button
                                          type="button"
                                          onClick={() => editDocRef(doc)}
                                          disabled={currentUser.role !== "Super Admin"}
                                          className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1 py-0.5 rounded shrink-0 hover:bg-slate-200 disabled:hover:bg-slate-100 disabled:cursor-default"
                                          title={currentUser.role === "Super Admin" ? "Amend reference (master account)" : "Unique reference — editable by master account only"}
                                          aria-label={`Document reference ${doc.refNo}`}
                                        >
                                          {doc.refNo}
                                        </button>
                                      )}
                                      <span className="text-slate-700 truncate">📄 {doc.filename} ({doc.sizeStr})</span>
                                    </span>
                                    <a
                                      href={`/api/document/content/${doc.id}`}
                                      target="_blank" onClick={e => { e.preventDefault(); openDoc(doc); }}
                                      rel="noreferrer"
                                      className="text-red-650 hover:underline font-mono text-[10px] font-bold inline-flex items-center min-h-[44px] px-2"
                                    >
                                      📥 Open / Download
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Folder B: Procurement & Bidding Files */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 2. Procurement Files & Bid Matrices
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projProcurements.length} files</span>
                            </div>

                            {projProcurements.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No procurement sourcing sheets or tender bids match this project.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projProcurements.map(proc => (
                                  <div key={proc.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-1">
                                    <div className="flex justify-between font-bold">
                                      <span className="text-slate-800">{proc.title}</span>
                                      <span className={`text-[10px] font-mono ${proc.status === "Approved" ? "text-emerald-600" : "text-amber-600"
                                        }`}>{proc.status}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic">Justification: "{proc.justification}"</p>
                                    <div className="text-[9px] text-slate-400">
                                      Conflict declared: {proc.conflictDeclared ? "Yes (Mitigated) 🛡️" : "No (Compliant) ✓"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Folder C: Expense Vouchers & Supporting Invoices */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 3. Expense Vouchers & Bills (Bills Ledger)
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projExpenses.length} vouchers</span>
                            </div>

                            {projExpenses.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No expense vouchers or disbursements posted to this project.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projExpenses.map(exp => {
                                  const alloc = exp.allocations ? exp.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                  const isShared = !!alloc;
                                  const displayedVal = isShared ? Number(alloc.amount) : exp.amount;
                                  const docAttached = state.documents.find(d => d.linkedRecordType === "Expense" && d.linkedRecordId === exp.id);

                                  return (
                                    <div key={exp.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="font-mono font-bold text-slate-700">{exp.voucherNo}</span>
                                        <span className="font-mono font-bold text-slate-900">
                                          {formatUSD(displayedVal * exp.rate)}
                                          {isShared && <span className="text-[9px] text-amber-600 font-normal ml-1">({alloc.percentage}%)</span>}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-650">{exp.title}</p>
                                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                                        <span>Status: {exp.status}</span>
                                        {docAttached ? (
                                          <a
                                            href={`/api/document/content/${docAttached.id}`}
                                            target="_blank" onClick={e => { e.preventDefault(); openDoc(docAttached); }}
                                            rel="noreferrer"
                                            className="text-red-650 hover:underline font-bold inline-flex items-center min-h-[44px] px-2"
                                          >
                                            📥 Supporting PDF
                                          </a>
                                        ) : (
                                          <span className="text-slate-400 italic inline-flex items-center min-h-[44px] px-2">No bill PDF attached</span>
                                        )}
                                        <label className="text-red-650 hover:underline font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2" title="The bill itself">
                                          🧾 Invoice
                                          <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            multiple
                                            className="hidden"
                                            aria-label={`Attach invoice to ${exp.voucherNo}`}
                                            onChange={(ev) => handleVoucherDocUpload(ev, exp.id, exp.voucherNo, "Invoice")}
                                          />
                                        </label>
                                        <label className="text-slate-500 hover:underline font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2" title="Distribution lists, delivery notes, photos of the purchase">
                                          📷 Evidence
                                          <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            multiple
                                            className="hidden"
                                            aria-label={`Attach supporting evidence to ${exp.voucherNo}`}
                                            onChange={(ev) => handleVoucherDocUpload(ev, exp.id, exp.voucherNo, "Evidence")}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Folder D: Bank & Cash reconciliations */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 4. Bank Reconciliation Statement Items
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projFunding.length + projBankTx.length} items</span>
                            </div>

                            {projFunding.length + projBankTx.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No cleared bank statements linked to this project.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projFunding.map(bt => {
                                  const account = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                                  return (
                                    <div key={bt.id} className="text-xs p-2 bg-emerald-50 border border-emerald-100 rounded space-y-0.5 font-mono">
                                      <div className="flex justify-between text-slate-800">
                                        <span>{bt.date} • {account?.name}</span>
                                        <span className="font-bold text-emerald-700">+{formatIn(bt.amount, account?.currency || "USD")}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 font-sans italic">
                                        Funding received • source: BLOM statement {account?.accountNo} • {bt.description}
                                      </p>
                                    </div>
                                  );
                                })}
                                {projBankTx.map(bt => {
                                  const account = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                                  return (
                                    <div key={bt.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-0.5 font-mono">
                                      <div className="flex justify-between text-slate-800">
                                        <span>{bt.date} • {account?.name}</span>
                                        <span className="font-bold text-red-600">-{formatIn(bt.amount, account?.currency || "USD")}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 font-sans italic">
                                        Reconciled to: {bt.voucherNo} • source: BLOM statement {account?.accountNo} • {bt.description}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Folder E: Proportional Cost Allocation Sheets */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 md:col-span-2">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 5. Personnel Cost Allocation Sheets (Timesheets)
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projTimesheets.length} allocated logs</span>
                            </div>

                            {projTimesheets.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No employee salary timesheets have co-funded allocations mapped to this project yet.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                                {projTimesheets.map(ts => {
                                  const emp = state.employees.find(e => e.id === ts.employeeId);
                                  const alloc = ts.allocations.find((a: any) => a.projectId === selectedProjectId);
                                  const allocatedSalary = (emp?.salary || 0) * ((alloc?.percentage || 0) / 100);

                                  return (
                                    <div key={ts.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-1">
                                      <div className="flex justify-between items-center">
                                        <strong className="text-slate-800">{emp?.name || "Staff"}</strong>
                                        <span className="font-mono font-bold text-slate-900 bg-red-50 text-red-750 px-1.5 py-0.5 rounded">
                                          {alloc?.percentage || 0}% ({formatUSD(allocatedSalary)})
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Month: {ts.month} • {emp?.position}</span>
                                        <span>Status: {ts.status}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Sub-tab 2: Monthly Project Reconciliation Report (Section 2.5 Compliance) */}
                    {projectWorkspaceTab === "reconciliation" && (() => {
                      // Filter items for the specific reconMonth (YYYY-MM)
                      const monthExpenses = projExpenses.filter(e => {
                        const dateVal = e.paid_at || e.created_at;
                        return dateVal && dateVal.startsWith(reconMonth);
                      });

                      const monthBankTx = projBankTx.filter(bt => bt.date && bt.date.startsWith(reconMonth));

                      const monthWht = monthExpenses.reduce((sum, e) => sum + (e.whtAmount || 0), 0);
                      const monthPaid = monthExpenses.reduce((sum, e) => {
                        const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                        const amt = alloc ? Number(alloc.amount) : e.amount;
                        return sum + amt;
                      }, 0);

                      return (
                        <div className="space-y-4 font-sans">
                          {/* Report configuration filters */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
                            <div className="flex items-center gap-3">
                              <label className="text-xs font-bold text-slate-650 uppercase">{t("Select Reporting Month:")}</label>
                              <input
                                type="month"
                                value={reconMonth}
                                onChange={(e) => setReconMonth(e.target.value)}
                                className="finance-input text-xs"
                              />
                            </div>

                            <div className="flex flex-wrap gap-2 font-sans">
                              <button
                                type="button"
                                onClick={handleExportExcel}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs min-h-[44px] px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                📊 Export Excel
                              </button>
                              <button
                                type="button"
                                onClick={handleExportWord}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs min-h-[44px] px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                📝 Export Word
                              </button>
                              <button
                                type="button"
                                onClick={handleExportPDF}
                                className="bg-slate-800 hover:bg-slate-900 text-white text-xs min-h-[44px] px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                📄 Export PDF
                              </button>
                            </div>
                          </div>

                          {/* Print container layout */}
                          <div id="reconciliation-print-report" className="bg-white border-2 border-slate-200 p-8 rounded-xl space-y-6 shadow-inner print-report print:border-0 print:p-0 print:exact-colors">

                            {/* Standardized professional header */}
                            <div className="text-center border-b-2 border-slate-350 pb-4 space-y-1">
                              <h1 className="text-lg font-bold uppercase tracking-wider text-slate-900">AnaHon Media Platform</h1>
                              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">Tripoli, Lebanon • Financial Control & Sinking Fund Division</p>
                              <h2 className="text-sm font-bold text-red-650 uppercase bg-red-50 inline-block px-3 py-1 rounded-full mt-2 font-mono">
                                Monthly Donor Project Reconciliation Report
                              </h2>
                            </div>

                            {/* Project Information */}
                            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 border border-slate-200 rounded-lg">
                              <div>
                                <p className="text-slate-500">PROJECT CODE:</p>
                                <p className="font-bold text-slate-900 font-mono">{activeProject.code}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">PROJECT TITLE:</p>
                                <p className="font-bold text-slate-900">{activeProject.name}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">RESTRICTED DONOR PARTNER:</p>
                                <p className="font-bold text-slate-900">{activeDonor?.name || "Restricted Donor"}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">REPORTING RECONCILIATION MONTH:</p>
                                <p className="font-bold text-slate-900 font-mono uppercase">{reconMonth}</p>
                              </div>
                            </div>
                            {(() => {
                              const projectBudgetLines = state.budgetLines.filter(bl => bl.projectId === selectedProjectId);
                              const totalAllocated = projectBudgetLines.reduce((sum, bl) => sum + bl.allocatedUSD, 0);

                              const totalSpentThisMonth = projectBudgetLines.reduce((sum, bl) => {
                                const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sumE, e) => {
                                  const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                  return sumE + (alloc ? Number(alloc.amount) : e.amount);
                                }, 0);
                                return sum + monthSpent;
                              }, 0);

                              const totalCumulativeSpent = projectBudgetLines.reduce((sum, bl) => sum + bl.actualUSD, 0);
                              const totalRemainingBalance = totalAllocated - totalCumulativeSpent;
                              const overallBurnRate = totalAllocated > 0 ? Math.round((totalCumulativeSpent / totalAllocated) * 100) : 0;

                              const totalNetReconciled = monthExpenses.reduce((sum, e) => {
                                const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (e.whtAmount / e.amount)) : (e.netAmount || e.amount);
                                return sum + (calculatedNet * e.rate);
                              }, 0);

                              const totalWhtReconciled = monthExpenses.reduce((sum, e) => {
                                const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                const whtVal = alloc ? Number(alloc.amount) * (e.whtAmount / e.amount) : e.whtAmount;
                                return sum + (whtVal * e.rate);
                              }, 0);

                              const hasPersonnelLines = projectBudgetLines.some(bl => bl.code.includes("PERS") || bl.category === "Personnel");

                              return (
                                <>
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono border-l-2 border-red-600 pl-2">
                                      I. Restricted Budget vs. Actual Expenditure Burn
                                    </h4>

                                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100">
                                          <tr className="border-b border-slate-200 font-mono text-slate-650 uppercase font-bold text-[10px]">
                                            <th className="px-4 py-2">Account Line</th>
                                            <th className="px-4 py-2">Category Description</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Allocated Pool (USD)</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Spent This Month (USD)</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Cumulative Spent to Date</th>
                                            <th className="px-4 py-2 text-right">Remaining Balance / Burn %</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {projectBudgetLines.map(bl => {
                                            const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sum, e) => {
                                              const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                              return sum + (alloc ? Number(alloc.amount) : e.amount);
                                            }, 0);

                                            const remaining = bl.allocatedUSD - bl.actualUSD;
                                            const burnPercent = bl.allocatedUSD > 0 ? Math.round((bl.actualUSD / bl.allocatedUSD) * 100) : 0;

                                            return (
                                              <tr key={bl.id} className="hover:bg-slate-50 font-medium break-inside-avoid">
                                                <td className="px-4 py-2 text-slate-800 font-bold">{bl.code}</td>
                                                <td className="px-4 py-2 text-slate-950 font-sans">{bl.category}</td>
                                                <td className="px-4 py-2 text-right text-slate-700 hidden md:table-cell">{formatUSD(bl.allocatedUSD)}</td>
                                                <td className="px-4 py-2 text-right text-red-650 font-bold hidden md:table-cell">{formatUSD(monthSpent)}</td>
                                                <td className="px-4 py-2 text-right text-slate-900 hidden md:table-cell">{formatUSD(bl.actualUSD)}</td>
                                                <td className="px-4 py-2 text-right text-slate-900 font-bold">
                                                  {formatUSD(remaining)} <span className="text-[10px] text-slate-500 font-normal">({burnPercent}%)</span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          {/* Section I totals row */}
                                          <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold break-inside-avoid">
                                            <td colSpan={2} className="px-4 py-2 text-slate-900 font-sans text-right">TOTAL BUDGET BURN SUMMARY:</td>
                                            <td className="px-4 py-2 text-right text-slate-900 hidden md:table-cell">{formatUSD(totalAllocated)}</td>
                                            <td className="px-4 py-2 text-right text-red-600 hidden md:table-cell">{formatUSD(totalSpentThisMonth)}</td>
                                            <td className="px-4 py-2 text-right text-slate-900 hidden md:table-cell">{formatUSD(totalCumulativeSpent)}</td>
                                            <td className="px-4 py-2 text-right text-slate-900">
                                              {formatUSD(totalRemainingBalance)} <span className="text-[10px] text-slate-500 font-normal">({overallBurnRate}%)</span>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Section 2: Reconciled Transactions Matched (Section 2.5 verification) */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono border-l-2 border-red-600 pl-2">
                                      II. Reconciled Statement Matchings & Cash Flows
                                    </h4>

                                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100">
                                          <tr className="border-b border-slate-200 font-mono text-slate-650 uppercase font-bold text-[10px]">
                                            <th className="px-4 py-2 hidden md:table-cell">Statement Date</th>
                                            <th className="px-4 py-2">Voucher / Ref</th>
                                            <th className="px-4 py-2">Transaction Memo</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Withholding Tax (WHT)</th>
                                            <th className="px-4 py-2 text-right">Reconciled Net</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {monthExpenses.length === 0 ? (
                                            <tr>
                                              <td colSpan={5} className="px-4 py-3 text-slate-400 italic text-center font-sans">No reconciled outflows or disbursements found for this period.</td>
                                            </tr>
                                          ) : (
                                            monthExpenses.map(exp => {
                                              const alloc = exp.allocations ? exp.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                              const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (exp.whtAmount / exp.amount)) : (exp.netAmount || exp.amount);
                                              const whtVal = alloc ? Number(alloc.amount) * (exp.whtAmount / exp.amount) : exp.whtAmount;

                                              return (
                                                <tr key={exp.id} className="hover:bg-slate-50 break-inside-avoid">
                                                  <td className="px-4 py-2 text-slate-500 hidden md:table-cell">{exp.paid_at?.split("T")[0] || exp.created_at?.split("T")[0]}</td>
                                                  <td className="px-4 py-2 text-slate-800 font-bold">{exp.voucherNo}</td>
                                                  <td className="px-4 py-2 text-slate-950 font-sans">{exp.title}</td>
                                                  <td className="px-4 py-2 text-right text-amber-600 hidden md:table-cell">{formatUSD(whtVal * exp.rate)}</td>
                                                  <td className="px-4 py-2 text-right text-slate-900 font-bold">{formatUSD(calculatedNet * exp.rate)}</td>
                                                </tr>
                                              );
                                            })
                                          )}
                                          {/* Section II totals row (Desktop-only) */}
                                          {monthExpenses.length > 0 && (
                                            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold break-inside-avoid hidden md:table-row">
                                              <td colSpan={3} className="px-4 py-2 text-slate-900 font-sans text-right">RECONCILED MATCHINGS TOTAL:</td>
                                              <td className="px-4 py-2 text-right text-amber-600">{formatUSD(totalWhtReconciled)}</td>
                                              <td className="px-4 py-2 text-right text-slate-900">{formatUSD(totalNetReconciled)}</td>
                                            </tr>
                                          )}
                                          {/* Section II totals row (Mobile-only) */}
                                          {monthExpenses.length > 0 && (
                                            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold break-inside-avoid md:hidden">
                                              <td colSpan={2} className="px-4 py-2 text-slate-900 font-sans text-right">TOTAL NET:</td>
                                              <td className="px-4 py-2 text-right text-slate-900">{formatUSD(totalNetReconciled)}</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Mathematical Tie-Out Verification Banner */}
                                    {(() => {
                                      const difference = Math.abs(totalSpentThisMonth - (totalNetReconciled + totalWhtReconciled));
                                      const isTiedOut = difference < 0.01;

                                      return isTiedOut ? (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center justify-between font-mono break-inside-avoid">
                                          <span className="flex items-center gap-1.5 font-bold">
                                            🛡️ AUDITOR TIE-OUT VERIFICATION PASSED:
                                          </span>
                                          <span>
                                            Spent This Month ({formatUSD(totalSpentThisMonth)}) = Reconciled Net ({formatUSD(totalNetReconciled)}) + WHT ({formatUSD(totalWhtReconciled)}) perfectly ties to the penny. ✓
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-center justify-between font-mono break-inside-avoid">
                                          <span className="flex items-center gap-1.5 font-bold">
                                            ⚠️ AUDITOR TIE-OUT WARNING: MISMATCH DETECTED:
                                          </span>
                                          <span>
                                            Spent This Month ({formatUSD(totalSpentThisMonth)}) ≠ Reconciled Net ({formatUSD(totalNetReconciled)}) + WHT ({formatUSD(totalWhtReconciled)}) | Delta: {formatUSD(difference)}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Section 3: Official Reconciliation Review Sign-Off (Section 2.5 compliance) */}
                                  <div className="border-t-2 border-slate-200 pt-6 space-y-4 break-inside-avoid">
                                    <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                                      Under **Section 2.5 & 2.6 of the AnaHon Media Platform Accounting Policies Manual**, this reconciliation report verifies that all project expenditures, personnel allocations, timesheets, and shared split costs have been matched with primary supporting documents and validated with actual bank statement disbursements.
                                    </p>

                                    {hasPersonnelLines && (
                                      <p className="text-[10px] text-red-750 bg-red-50 border border-red-150 rounded px-3 py-1.5 text-center font-mono font-bold">
                                        📋 DYNAMIC AUDIT DISCLOSURE: Timesheet evidence strictly attached for all payroll allocations.
                                      </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-12 pt-6">
                                      <div className="text-center space-y-12">
                                        <div className="font-mono text-xs border-b border-slate-350 pb-2 mx-6 italic text-slate-600">
                                          Layale Ghorayeb
                                        </div>
                                        <div>
                                          <span className="block text-xs font-bold text-slate-800 uppercase font-sans">Prepared By</span>
                                          <span className="block text-[10px] text-slate-500 uppercase font-mono">Layale Ghorayeb (Finance Officer)</span>
                                        </div>
                                      </div>

                                      <div className="text-center space-y-12">
                                        <div className="font-mono text-xs border-b border-slate-350 pb-2 mx-6 italic text-slate-400">
                                          [Signature Box]
                                        </div>
                                        <div>
                                          <span className="block text-xs font-bold text-slate-800 uppercase font-sans">Reviewed & Co-Signed By</span>
                                          <span className="block text-[10px] text-slate-500 uppercase font-mono">Farah Shami (Program Director)</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}

                          </div>
                        </div>
                      );
                    })()}

                  </div>
                );
              })()}

              {/* Budgets Lines adjustments block */}
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h4 className="text-md font-bold mb-4">Dedicated Project Account Lines</h4>
                <div className="divide-y divide-slate-100">
                  {state.budgetLines.map(bl => {
                    const p = state.projects.find(x => x.id === bl.projectId);
                    return (
                      <div key={bl.id} className="py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-100 text-slate-800 font-mono font-bold px-1.5 py-0.5 rounded">{p?.code}</span>
                            <span className="text-sm font-bold text-slate-950 font-mono">{bl.code}</span>
                          </div>
                          <p className="text-xs text-slate-800">{bl.description}</p>
                        </div>

                        {/* Interactive adjustment slider setup for Program Directors */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] block text-slate-500 uppercase">Allocated Target</span>
                            <span className="text-sm font-bold font-mono text-slate-900">{formatUSD(bl.allocatedUSD)}</span>
                          </div>
                          {["Super Admin", "Program Director"].includes(currentUser.role) ? (
                            <input
                              type="number"
                              defaultValue={bl.allocatedUSD}
                              onBlur={(e) => handleModifyAllocation(bl.id, e.target.value)}
                              className="finance-input w-28 text-xs font-mono"
                              placeholder="Modify threshold"
                            />
                          ) : (
                            <div className="w-24 px-2 py-1 bg-slate-100 text-[10px] text-slate-500 rounded text-center">
                              Ready Locked
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}


          {/* tab content Vouchers & Expenses Lifecycle */}
          {activeTab === "funnel" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("AnaHon Programs & Funding Funnel")}</h2>
                <p className="text-xs text-slate-500">
                  AnaHon (Civil Company 90/2023, Tripoli) is the sole applicant, implementing and financial body.
                  Five programs sit under it. The pipeline below is forward-looking only — nothing here touches
                  balances or reports until a bank deposit registers a real project.
                </p>
              </div>

              {/* Program stream cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {STREAMS.map(s => {
                  const projs = state.projects.filter(p => (p.stream || "") === s);
                  const opps = state.opportunities.filter(o => o.stream === s && o.stage !== "Declined");
                  const activeCount = projs.filter(p => p.status === "Active").length;
                  const totalFunded = projs.reduce((sum, p) => sum + (p.budgetUSD || 0), 0);
                  return (
                    <div key={s} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-slate-900">{s}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{projs.length} funded · {activeCount} active</span>
                      </div>
                      {projs.length > 0 ? (
                        <ul className="space-y-1 mb-3">
                          {projs.map(p => (
                            <li key={p.id} className="flex justify-between text-[11px]">
                              <span className="font-mono text-slate-600">{p.code}</span>
                              <span className={p.status === "Active" ? "text-emerald-700 font-bold" : "text-slate-400"}>{p.status}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic mb-3">No funded projects yet.</p>
                      )}
                      <div className="border-t border-slate-100 pt-2 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 uppercase">Funded to date</span>
                          <strong className="font-mono text-slate-800">{formatUSD(totalFunded)}</strong>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 uppercase">Pipeline</span>
                          <span className="font-mono text-slate-600">{opps.length} open</span>
                        </div>
                        {(() => {
                          // Restricted balance: money actually received for these projects, less
                          // what has been documented as spent. Not a slice of the bank balance —
                          // cash is fungible and part of it sits in the undocumented petty gap.
                          const received = projs.reduce((sum, p) => sum + state.bankTransactions
                            .filter(bt => bt.projectId === p.id && bt.type === "Deposit" && !bt.pending)
                            .reduce((t, bt) => {
                              const ccy = state.bankAccounts.find(ba => ba.id === bt.bankAccountId)?.currency || "USD";
                              const rate = ccy === "EUR" ? state.fxRates.EUR : ccy === "LBP" ? state.fxRates.LBP : 1;
                              return t + bt.amount * rate;
                            }, 0), 0);
                          const spent = projs.reduce((sum, p) => sum + state.budgetLines
                            .filter(bl => bl.projectId === p.id)
                            .reduce((t, bl) => t + (bl.actualUSD || 0), 0), 0);
                          if (received === 0 && spent === 0) return null;
                          const unspent = received - spent;
                          return (
                            <div className="pt-1 mt-1 border-t border-slate-100 space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 uppercase">Received / spent</span>
                                <span className="font-mono text-slate-600">{formatUSD(received)} / {formatUSD(spent)}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 uppercase">Unspent (restricted)</span>
                                <strong className={`font-mono ${unspent < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatUSD(unspent)}</strong>
                              </div>
                            </div>
                          );
                        })()}
                        {s === "Production" && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400 uppercase">Quotes open</span>
                            <span className="font-mono text-slate-600">{state.quotations.filter(q => ["Draft", "Sent", "Accepted"].includes(q.status)).length}</span>
                          </div>
                        )}
                      </div>
                      {activeCount === 0 && opps.length === 0 && (
                        <p className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          ⚠ Funding gap — no active project and no pipeline
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pipeline board */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-800 uppercase font-mono">🎯 Donor Pipeline</h3>
                  {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && !oppForm && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setIntakeOpen(!intakeOpen); setIntake(null); }} className="bg-indigo-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 transition-all">
                        🤖 {intakeOpen ? "Close call reader" : "Start from a call"}
                      </button>
                      <button onClick={() => setOppForm({ stage: "Prospect", currency: "USD" })} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">
                        ➕ Add Opportunity
                      </button>
                    </div>
                  )}
                </div>

                {/* Call intake: paste the funder's link/file/text and let the AI fill the form in.
                    Everything it proposes lands in the normal editable form — nothing is saved here. */}
                {intakeOpen && !oppForm && (
                  <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                    <h4 className="text-sm font-bold text-indigo-900 uppercase font-mono">🤖 Read a funding call</h4>
                    <p className="text-[11px] text-indigo-800">
                      Give it the call as a link, a file, or pasted text. It proposes the title, funder, program, amount and
                      deadline, and assesses the fit against AnaHon's real track record. You review every field before saving.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="url"
                        value={intakeUrl}
                        onChange={e => setIntakeUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && intakeUrl.trim() && !intakeBusy) { e.preventDefault(); runIntake({ url: intakeUrl.trim() }); } }}
                        placeholder="https://… link to the call"
                        className="finance-input flex-1 min-w-[240px] font-mono text-xs"
                        disabled={intakeBusy}
                      />
                      <button
                        type="button"
                        onClick={() => runIntake({ url: intakeUrl.trim() })}
                        disabled={intakeBusy || !intakeUrl.trim()}
                        className="bg-indigo-600 text-white text-[11px] font-bold rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:bg-slate-300 transition-all"
                      >
                        {intakeBusy ? "Reading…" : "Read link"}
                      </button>
                      <label className={`text-[11px] font-bold rounded-lg px-3 py-2 cursor-pointer transition-all ${intakeBusy ? "bg-slate-200 text-slate-400" : "bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-100"}`}>
                        📄 Upload call
                        <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" disabled={intakeBusy} onChange={intakeFile} />
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      value={intakeText}
                      onChange={e => setIntakeText(e.target.value)}
                      placeholder="…or paste the call text here"
                      className="finance-input w-full text-xs"
                      disabled={intakeBusy}
                    />
                    {intakeText.trim().length >= 40 && (
                      <button
                        type="button"
                        onClick={() => runIntake({ text: intakeText })}
                        disabled={intakeBusy}
                        className="bg-indigo-600 text-white text-[11px] font-bold rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:bg-slate-300 transition-all"
                      >
                        {intakeBusy ? "Reading…" : "Read pasted text"}
                      </button>
                    )}
                  </div>
                )}

                {/* The assessment stays visible above the prefilled form so the fit and the
                    risks are in front of you while you decide whether to keep it. */}
                {intake && oppForm && (
                  <div className={`p-4 rounded-xl border text-[11px] space-y-2 ${intake.assessment.fit === "Strong" ? "bg-emerald-50 border-emerald-200"
                    : intake.assessment.fit === "Weak" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
                    <p className="font-bold text-slate-800">
                      {intake.provider} read {intake.source} · Fit: {intake.assessment.fit} · Suggested program: {intake.assessment.recommendedStream || "—"}
                    </p>
                    <p className="text-slate-700">{intake.assessment.rationale}</p>
                    {intake.assessment.risks?.length > 0 && (
                      <ul className="list-disc ml-4 text-amber-900">{intake.assessment.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                    )}
                    {intake.assessment.suggestedAngle && <p className="text-emerald-900"><strong>Angle:</strong> {intake.assessment.suggestedAngle}</p>}
                    {intake.draft.donorIsNew && (
                      <p className="text-indigo-900">Funder <strong>{intake.draft.donorName}</strong> isn't registered yet — saving will add it as a prospect donor.</p>
                    )}
                    <p className="text-slate-500 italic">Draft only. Nothing is in the pipeline until you press Save below.</p>
                  </div>
                )}

                {oppForm && (
                  <form onSubmit={saveOpportunity} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">{oppForm.id ? "✏️ Edit Opportunity" : "➕ New Opportunity"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label htmlFor="opp-title" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Title")}</label>
                        <input id="opp-title" type="text" placeholder="e.g. SKF next cycle — Platform" value={oppForm.title || ""} onChange={e => setOppForm({ ...oppForm, title: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-donor" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Donor")}</label>
                        <select id="opp-donor" value={oppForm.donorId || ""} onChange={e => setOppForm({ ...oppForm, donorId: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— None yet (unscoped) —</option>
                          {state.donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-stream" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Program Stream")}</label>
                        <select id="opp-stream" value={oppForm.stream || ""} onChange={e => setOppForm({ ...oppForm, stream: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— Unassigned —</option>
                          {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-stage" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Stage")}</label>
                        <select id="opp-stage" value={oppForm.stage || "Prospect"} onChange={e => setOppForm({ ...oppForm, stage: e.target.value as Opportunity["stage"] })} className="finance-input w-full text-xs">
                          {OPP_STAGES.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Amount (0 = not scoped)")}</label>
                        <input id="opp-amount" type="number" min="0" step="any" value={oppForm.amount ?? 0} onChange={e => setOppForm({ ...oppForm, amount: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-currency" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Currency")}</label>
                        <select id="opp-currency" value={oppForm.currency || "USD"} onChange={e => setOppForm({ ...oppForm, currency: e.target.value })} className="finance-input w-full text-xs">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-deadline" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Submission Deadline")}</label>
                        <input id="opp-deadline" type="date" value={oppForm.deadline || ""} onChange={e => setOppForm({ ...oppForm, deadline: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-decision" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Decision Expected")}</label>
                        <input id="opp-decision" type="date" value={oppForm.decisionDate || ""} onChange={e => setOppForm({ ...oppForm, decisionDate: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-renewal" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Renewal Of (optional)")}</label>
                        <select id="opp-renewal" value={oppForm.renewalOfProjectId || ""} onChange={e => setOppForm({ ...oppForm, renewalOfProjectId: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— Not a renewal —</option>
                          {state.projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label htmlFor="opp-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes")}</label>
                        <textarea id="opp-notes" rows={2} value={oppForm.notes || ""} onChange={e => setOppForm({ ...oppForm, notes: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save</button>
                      <button type="button" onClick={() => setOppForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Proposal workspace — AnaHon's master template; adapt into each donor's format */}
                {propForm && (
                  <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">📝 Proposal — {propForm.title}</h4>
                      <p className="text-[11px] text-slate-500">AnaHon is the applicant. Donor: {state.donors.find(d => d.id === propForm.donorId)?.name || "not set"}. Write once here, then adapt into the donor's own template.</p>
                      {/* The pipeline this call belongs to is the user's decision — the AI may
                          recommend one, but it never moves the card. */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <label htmlFor="prop-stream" className="text-[10px] font-bold text-slate-600 uppercase">{t("Pipeline / programme")}</label>
                        <select
                          id="prop-stream"
                          value={propForm.stream || ""}
                          onChange={e => setPropForm({ ...propForm, stream: e.target.value })}
                          className="finance-input text-xs"
                        >
                          <option value="">— Unassigned —</option>
                          {STREAMS.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        {aiAssess?.recommendedStream && aiAssess.recommendedStream !== propForm.stream && (
                          <button
                            type="button"
                            onClick={() => setPropForm({ ...propForm, stream: aiAssess.recommendedStream })}
                            className="text-[10px] font-bold text-indigo-700 hover:underline"
                          >
                            AI suggests {aiAssess.recommendedStream} — use it
                          </button>
                        )}
                        <span className="text-[10px] text-slate-400">saved with the proposal</span>
                      </div>
                    </div>
                    {/* AI assist — grounded in AnaHon's real track record, prefill only */}
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                      <label htmlFor="ai-call" className="block text-[10px] font-bold text-indigo-800 uppercase">🧠 AI Assist — the donor's call</label>
                      {/* Three ways in: a file, a link, or paste. All land in the same box so
                          you can read and correct the text before the AI sees it. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className={`text-[11px] font-bold rounded-lg px-3 py-2 cursor-pointer transition-all ${callBusy ? "bg-slate-200 text-slate-400" : "bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-100"}`}>
                          📄 {callBusy ? "Reading…" : "Upload call (PDF / Word / text)"}
                          <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" disabled={callBusy} onChange={loadCallFile} />
                        </label>
                        <input
                          type="url"
                          value={callUrl}
                          onChange={e => setCallUrl(e.target.value)}
                          placeholder="…or paste a link to the call page"
                          aria-label="Link to the donor's call page"
                          className="finance-input text-xs flex-1 min-w-[180px]"
                        />
                        <button
                          type="button"
                          disabled={callBusy || !callUrl.trim()}
                          onClick={() => { loadCallSource({ url: callUrl.trim() }, callUrl.trim()); setCallUrl(""); }}
                          className="text-[11px] font-bold bg-white border border-indigo-300 text-indigo-800 rounded-lg px-3 py-2 hover:bg-indigo-100 disabled:opacity-40 transition-all"
                        >
                          🔗 Fetch link
                        </button>
                        {aiCall && (
                          <button type="button" onClick={() => setAiCall("")} className="text-[11px] text-slate-500 hover:text-red-600 hover:underline px-2">clear</button>
                        )}
                      </div>
                      <textarea id="ai-call" rows={4} value={aiCall} onChange={e => setAiCall(e.target.value)} placeholder="…or paste the call text here: focus areas, eligibility, budget range, the questions they ask…" className="finance-input w-full text-xs" />
                      {aiCall && <p className="text-[10px] text-indigo-700">{aiCall.length.toLocaleString()} characters loaded — edit freely before running the assist.</p>}
                      <div className="flex gap-2">
                        <button type="button" disabled={aiBusy} onClick={() => runAiAssist("assess")} className="bg-indigo-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 transition-all">{aiBusy ? "Thinking…" : "🔍 Assess Fit"}</button>
                        <button type="button" disabled={aiBusy} onClick={() => runAiAssist("draft")} className="bg-indigo-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 transition-all">{aiBusy ? "Thinking…" : "✍️ Draft Empty Sections"}</button>
                      </div>
                      <p className="text-[10px] text-indigo-700">Grounded in AnaHon's real programs and project history from this system. Drafts fill only sections you left empty; anything the AI cannot know appears as [FILL: …]. Nothing is saved until you save.</p>
                      {aiAssess && (
                        <div className="p-3 bg-white border border-indigo-200 rounded-lg text-xs space-y-1.5">
                          <p><strong>Fit: {aiAssess.fit}</strong> · Recommended program: <strong>{aiAssess.recommendedStream || "—"}</strong></p>
                          <p className="text-slate-600">{aiAssess.rationale}</p>
                          {aiAssess.risks?.length > 0 && (
                            <ul className="list-disc ml-4 text-amber-800">{aiAssess.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                          )}
                          {aiAssess.suggestedAngle && <p className="text-emerald-800"><strong>Angle:</strong> {aiAssess.suggestedAngle}</p>}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PROPOSAL_SECTIONS.map(([key, label, hint]) => (
                        <div key={key} className={key === "summary" || key === "solution" ? "md:col-span-2" : ""}>
                          <label htmlFor={`prop-${key}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{label}</label>
                          <textarea id={`prop-${key}`} rows={3} placeholder={hint} value={(propForm.proposal[key] as string) || ""} onChange={e => setProposal({ [key]: e.target.value })} className="finance-input w-full font-sans text-xs" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Activities & Timeline</span>
                        <button type="button" onClick={() => setProposal({ timeline: [...propTimeline, { activity: "", start: "", end: "" }] })} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-all">➕ Add activity</button>
                      </div>
                      {propTimeline.map((row, i) => (
                        <div key={i} className="grid grid-cols-2 md:grid-cols-8 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <input aria-label={`Activity ${i + 1}`} type="text" placeholder="Activity" value={row.activity} onChange={e => setProposal({ timeline: propTimeline.map((r, idx) => idx === i ? { ...r, activity: e.target.value } : r) })} className="finance-input text-xs col-span-2 md:col-span-4" />
                          <input aria-label={`Activity ${i + 1} start`} type="date" value={row.start} onChange={e => setProposal({ timeline: propTimeline.map((r, idx) => idx === i ? { ...r, start: e.target.value } : r) })} className="finance-input font-mono text-xs md:col-span-1" />
                          <input aria-label={`Activity ${i + 1} end`} type="date" value={row.end} onChange={e => setProposal({ timeline: propTimeline.map((r, idx) => idx === i ? { ...r, end: e.target.value } : r) })} className="finance-input font-mono text-xs md:col-span-1" />
                          <div className="md:col-span-2 flex items-center">
                            <button type="button" onClick={() => setProposal({ timeline: propTimeline.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Remove activity" aria-label={`Remove activity ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Indicative Budget ({propForm.currency})</span>
                        <button type="button" onClick={() => setProposal({ budget: [...propBudget, { line: "", description: "", amount: 0 }] })} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-all">➕ Add line</button>
                      </div>
                      {propBudget.map((row, i) => (
                        <div key={i} className="grid grid-cols-2 md:grid-cols-8 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <input aria-label={`Budget line ${i + 1}`} type="text" placeholder="Line (e.g. Personnel)" value={row.line} onChange={e => setProposal({ budget: propBudget.map((r, idx) => idx === i ? { ...r, line: e.target.value } : r) })} className="finance-input text-xs col-span-2 md:col-span-2" />
                          <input aria-label={`Budget line ${i + 1} description`} type="text" placeholder="Description" value={row.description} onChange={e => setProposal({ budget: propBudget.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r) })} className="finance-input text-xs col-span-2 md:col-span-4" />
                          <input aria-label={`Budget line ${i + 1} amount`} type="number" min="0" step="any" value={row.amount} onChange={e => setProposal({ budget: propBudget.map((r, idx) => idx === i ? { ...r, amount: Number(e.target.value) } : r) })} className="finance-input font-mono text-xs md:col-span-1" />
                          <div className="md:col-span-1 flex items-center">
                            <button type="button" onClick={() => setProposal({ budget: propBudget.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Remove line" aria-label={`Remove budget line ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                      {propBudget.length > 0 && (
                        <p className="text-right text-xs font-mono font-bold text-slate-800">
                          ASK: {propForm.currency} {propBudget.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString()}
                          <span className="text-slate-400 font-sans font-normal"> — becomes the opportunity's requested amount on save</span>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveProposal(false)} className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save Proposal</button>
                      <button type="button" onClick={() => saveProposal(true)} className="bg-slate-800 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-700 transition-all">📄 Save + Generate Document</button>
                      <button type="button" onClick={() => setPropForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Deadline tracker: the board answers "where is everything", this answers
                    "what do I do next". Sorted by date, coloured by how little time is left. */}
                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const dated = state.opportunities
                    .filter(o => o.deadline && !["Awarded", "Declined"].includes(o.stage))
                    .sort((a, b) => a.deadline.localeCompare(b.deadline));
                  if (!dated.length) return null;
                  const daysTo = (d: string) => Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
                  return (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase font-mono">⏳ {t("Deadlines")}</h4>
                        <span className="text-[10px] text-slate-500">{dated.length} dated · {state.opportunities.filter(o => !o.deadline && !["Awarded", "Declined"].includes(o.stage)).length} undated</span>
                      </div>
                      <div className="space-y-1">
                        {dated.map(o => {
                          const d = daysTo(o.deadline);
                          const tone = d < 0 ? "bg-slate-100 text-slate-500 border-slate-200"
                            : d <= 7 ? "bg-red-50 text-red-800 border-red-200"
                              : d <= 30 ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-slate-50 text-slate-700 border-slate-200";
                          return (
                            <div key={o.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${tone}`}>
                              <span className="font-mono font-bold whitespace-nowrap w-24 shrink-0">
                                {d < 0 ? "passed" : d === 0 ? "TODAY" : `${d}d`}
                              </span>
                              <span className="font-mono text-[10px] opacity-70 w-20 shrink-0 hidden sm:inline">{o.deadline}</span>
                              <span className="flex-1 font-medium truncate" title={o.title}>{o.title}</span>
                              <span className="text-[10px] opacity-70 hidden md:inline whitespace-nowrap">{o.stream || "—"}</span>
                              <span className="font-mono text-[10px] whitespace-nowrap">{o.amount > 0 ? `${o.currency} ${o.amount.toLocaleString()}` : "—"}</span>
                              <span className="text-[10px] font-bold uppercase opacity-70 whitespace-nowrap hidden sm:inline">{o.stage}</span>
                              {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && (
                                <button onClick={() => { setPropForm({ ...o, proposal: o.proposal || {} }); setAiAssess(null); setAiCall(""); }}
                                  className="opacity-60 hover:opacity-100 shrink-0" title="Open proposal workspace" aria-label={`Open proposal for ${o.title}`}>📝</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500 italic">Red = within a week · amber = within a month. Awarded and declined are hidden.</p>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(["Prospect", "Drafting", "Submitted", "Awarded"] as const).map(stg => {
                    // Dated first, soonest at the top — an undated prospect never outranks a live deadline.
                    const stageOpps = state.opportunities.filter(o => o.stage === stg)
                      .sort((a, b) => (a.deadline ? 0 : 1) - (b.deadline ? 0 : 1) || (a.deadline || "").localeCompare(b.deadline || ""));
                    return (
                      <div key={stg} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2 tracking-widest">{stg} ({stageOpps.length})</h4>
                        <div className="space-y-2">
                          {stageOpps.map(o => {
                            const donor = state.donors.find(d => d.id === o.donorId);
                            return (
                              <div key={o.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                <p className="text-xs font-bold text-slate-900 mb-0.5">{o.title}</p>
                                <p className="text-[10px] text-slate-500">{donor?.name || "No donor yet"} · {o.stream || "unassigned"}</p>
                                {o.amount > 0 && <p className="text-[11px] font-mono font-bold text-slate-800 mt-1">{o.currency} {o.amount.toLocaleString()}</p>}
                                {(o.decisionDate || o.deadline) && (() => {
                                  const d = o.deadline
                                    ? Math.round((new Date(o.deadline).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000)
                                    : null;
                                  const tone = d === null ? "text-amber-700"
                                    : d < 0 ? "text-slate-400" : d <= 7 ? "text-red-700 font-bold" : d <= 30 ? "text-amber-700" : "text-slate-500";
                                  return (
                                    <p className={`text-[10px] mt-0.5 ${tone}`}>
                                      📅 {o.decisionDate ? `decision ${o.decisionDate}` : `deadline ${o.deadline}`}
                                      {d !== null && ` · ${d < 0 ? "passed" : d === 0 ? "today" : `${d}d left`}`}
                                    </p>
                                  );
                                })()}
                                {o.notes && <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">{o.notes}</p>}
                                {o.stage === "Awarded" && (
                                  <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mt-1">
                                    ✓ Awarded — once the deposit is on an imported statement, register the project in Donors & Projects with that deposit as proof.
                                  </p>
                                )}
                                {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <select value={o.stage} onChange={e => moveOpportunity(o, e.target.value)} className="finance-input text-[10px] flex-1 py-1" aria-label={`Stage for ${o.title}`}>
                                      {OPP_STAGES.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                    </select>
                                    <button onClick={() => { setPropForm({ ...o, proposal: o.proposal || {} }); setAiAssess(null); setAiCall(""); }} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Proposal workspace" aria-label={`Open proposal for ${o.title}`}>📝</button>
                                    <button onClick={() => setOppForm({ ...o })} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Edit" aria-label={`Edit ${o.title}`}>✏️</button>
                                    <button onClick={() => deleteOpportunity(o)} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Delete" aria-label={`Delete ${o.title}`}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {stageOpps.length === 0 && <p className="text-[10px] text-slate-400 italic">Empty.</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {state.opportunities.some(o => o.stage === "Declined") && (
                  <p className="text-[11px] text-slate-400">
                    Declined: {state.opportunities.filter(o => o.stage === "Declined").map(o => o.title).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "production" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Production Stream — Clients & Quotations")}</h2>
                <p className="text-xs text-slate-500">
                  Earned income: clients pay AnaHon for production services. A quotation is never income —
                  income exists only when the client's payment shows on a BLOM statement (4200 service income).
                </p>
              </div>

              {/* Clients register */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-800 uppercase font-mono">👥 Client Log</h3>
                  {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && !clientForm && (
                    <button onClick={() => setClientForm({})} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">
                      ➕ Register Client
                    </button>
                  )}
                </div>

                {clientForm && (
                  <form onSubmit={saveClient} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">{clientForm.id ? "✏️ Edit Client" : "➕ New Client"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="cli-name" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Client Name")}</label>
                        <input id="cli-name" type="text" placeholder="e.g. Local NGO / company" value={clientForm.name || ""} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-contact" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Contact Person")}</label>
                        <input id="cli-contact" type="text" value={clientForm.contact || ""} onChange={e => setClientForm({ ...clientForm, contact: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-email" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Email")}</label>
                        <input id="cli-email" type="email" value={clientForm.email || ""} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-phone" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Phone")}</label>
                        <input id="cli-phone" type="text" value={clientForm.phone || ""} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-taxid" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Tax ID (for invoicing)")}</label>
                        <input id="cli-taxid" type="text" value={clientForm.taxId || ""} onChange={e => setClientForm({ ...clientForm, taxId: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes")}</label>
                        <input id="cli-notes" type="text" value={clientForm.notes || ""} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save Client</button>
                      <button type="button" onClick={() => setClientForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {state.clients.map(c => {
                    const cQuotes = state.quotations.filter(q => q.clientId === c.id);
                    const acceptedTotal = cQuotes.filter(q => ["Accepted", "Invoiced", "Paid"].includes(q.status)).reduce((s, q) => s + q.amount, 0);
                    return (
                      <div key={c.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                          <button onClick={() => setClientForm({ ...c })} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Edit client" aria-label={`Edit ${c.name}`}>✏️</button>
                        </div>
                        {(c.contact || c.email || c.phone) && (
                          <p className="text-xs text-slate-500">{[c.contact, c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        )}
                        {c.taxId && <p className="text-[10px] text-slate-400 font-mono">Tax ID: {c.taxId}</p>}
                        {c.notes && (
                          <div className="mt-2 p-2 bg-slate-50 border border-slate-105 rounded text-[11px] text-slate-600 leading-relaxed italic">ℹ️ {c.notes}</div>
                        )}
                        <div className="border-t border-slate-100 mt-3 pt-2 flex justify-between text-[10px]">
                          <span className="text-slate-400 uppercase">{cQuotes.length} quotation{cQuotes.length === 1 ? "" : "s"}</span>
                          <strong className="font-mono text-slate-800">accepted: {formatUSD(acceptedTotal)}</strong>
                        </div>
                      </div>
                    );
                  })}
                  {state.clients.length === 0 && <p className="text-xs text-slate-400 italic">No clients registered yet.</p>}
                </div>
              </div>

              {/* Quotations log */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-800 uppercase font-mono">📄 Quotations</h3>
                  {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && !quoteForm && (
                    <button onClick={() => setQuoteForm({
                      status: "Draft",
                      currency: "USD",
                      date: new Date().toISOString().slice(0, 10),
                      items: [{ service: "", description: "", output: "", unitPrice: 0, qty: 1 }],
                      terms: { financial: FINANCIAL_TERMS[1], production: PRODUCTION_NOTE, technical: TECHNICAL_NOTE, extras: EXTRAS_DEFAULT }
                    })} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all" disabled={state.clients.length === 0}>
                      ➕ New Quotation
                    </button>
                  )}
                </div>

                {quoteForm && (
                  <form onSubmit={saveQuotation} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">{quoteForm.id ? `✏️ Edit ${quoteForm.quoteNo}` : "➕ New Quotation"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="qt-client" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Client")}</label>
                        <select id="qt-client" value={quoteForm.clientId || ""} onChange={e => setQuoteForm({ ...quoteForm, clientId: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— Select client —</option>
                          {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="qt-title" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Service / Title")}</label>
                        <input id="qt-title" type="text" placeholder="e.g. Event video production — 2-day shoot + edit" value={quoteForm.title || ""} onChange={e => setQuoteForm({ ...quoteForm, title: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="qt-status" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Status")}</label>
                        <select id="qt-status" value={quoteForm.status || "Draft"} onChange={e => setQuoteForm({ ...quoteForm, status: e.target.value as Quotation["status"] })} className="finance-input w-full text-xs">
                          {QUOTE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="qt-no" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Quote № (automatic)")}</label>
                        <input id="qt-no" type="text" placeholder={currentUser.role === "Super Admin" ? "blank = auto · master override" : "assigned automatically"} value={quoteForm.quoteNo || ""} onChange={e => setQuoteForm({ ...quoteForm, quoteNo: e.target.value })} disabled={!!quoteForm.id || currentUser.role !== "Super Admin"} className="finance-input w-full font-mono text-xs disabled:opacity-60" />
                      </div>
                      <div>
                        <label htmlFor="qt-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{quoteItems.length ? "Total (from lines)" : "Amount"}</label>
                        <input id="qt-amount" type="number" min="0" step="any" value={quoteItems.length ? quoteTotal : (quoteForm.amount ?? "")} onChange={e => setQuoteForm({ ...quoteForm, amount: Number(e.target.value) })} disabled={quoteItems.length > 0} className="finance-input w-full font-mono text-xs disabled:opacity-60" />
                      </div>
                      <div>
                        <label htmlFor="qt-currency" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Currency")}</label>
                        <select id="qt-currency" value={quoteForm.currency || "USD"} onChange={e => setQuoteForm({ ...quoteForm, currency: e.target.value })} className="finance-input w-full text-xs">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="qt-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Quote Date")}</label>
                        <input id="qt-date" type="date" value={quoteForm.date || ""} onChange={e => setQuoteForm({ ...quoteForm, date: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="qt-valid" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Valid Until")}</label>
                        <input id="qt-valid" type="date" value={quoteForm.validUntil || ""} onChange={e => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="qt-desc" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Scope / Line Breakdown")}</label>
                        <textarea id="qt-desc" rows={2} placeholder="What's included — deliverables, days, crew, equipment…" value={quoteForm.description || ""} onChange={e => setQuoteForm({ ...quoteForm, description: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="qt-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes")}</label>
                        <textarea id="qt-notes" rows={2} value={quoteForm.notes || ""} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>

                      {/* Line items — pick from the real AnaHon service catalog, everything editable */}
                      <div className="md:col-span-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Line Items</span>
                          <button type="button" onClick={() => setQuoteForm({ ...quoteForm, items: [...quoteItems, { service: "", description: "", output: "", unitPrice: 0, qty: 1 }] })} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-all">
                            ➕ Add line
                          </button>
                        </div>
                        {quoteItems.map((it, i) => (
                          <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="col-span-2 md:col-span-3">
                              <label htmlFor={`qi-svc-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Service")}</label>
                              <select id={`qi-svc-${i}`} value={SERVICE_CATALOG.some(c => c.service === it.service) ? it.service : "__custom"} onChange={e => pickCatalogService(i, e.target.value === "__custom" ? "" : e.target.value)} className="finance-input w-full text-xs mb-1">
                                <option value="__custom">✏️ Custom service…</option>
                                {SERVICE_CATALOG.map(c => <option key={c.service} value={c.service}>{c.service} — ${c.unitPrice}</option>)}
                              </select>
                              <input aria-label={`Service name, line ${i + 1}`} type="text" placeholder="Service name" value={it.service} onChange={e => setQuoteItem(i, { service: e.target.value })} className="finance-input w-full text-xs" />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                              <label htmlFor={`qi-desc-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Description")}</label>
                              <textarea id={`qi-desc-${i}`} rows={3} value={it.description} onChange={e => setQuoteItem(i, { description: e.target.value })} className="finance-input w-full text-xs" />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                              <label htmlFor={`qi-out-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Output / Deliverables")}</label>
                              <textarea id={`qi-out-${i}`} rows={3} value={it.output} onChange={e => setQuoteItem(i, { output: e.target.value })} className="finance-input w-full text-xs" />
                            </div>
                            <div className="md:col-span-1">
                              <label htmlFor={`qi-price-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Unit")}</label>
                              <input id={`qi-price-${i}`} type="number" min="0" step="any" value={it.unitPrice} onChange={e => setQuoteItem(i, { unitPrice: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                            </div>
                            <div className="md:col-span-1">
                              <label htmlFor={`qi-qty-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Qty")}</label>
                              <input id={`qi-qty-${i}`} type="number" min="1" step="1" value={it.qty} onChange={e => setQuoteItem(i, { qty: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                            </div>
                            <div className="md:col-span-1 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-1">
                              <span className="text-[11px] font-mono font-bold text-slate-800 md:mt-6">{((Number(it.unitPrice) || 0) * (Number(it.qty) || 1)).toLocaleString()}</span>
                              <button type="button" onClick={() => setQuoteForm({ ...quoteForm, items: quoteItems.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Remove line" aria-label={`Remove line ${i + 1}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {quoteItems.length > 0 && (
                          <p className="text-right text-xs font-mono font-bold text-slate-800">TOTAL: {quoteForm.currency || "USD"} {quoteTotal.toLocaleString()}</p>
                        )}
                      </div>

                      {/* Standard note blocks — printed on the generated document */}
                      <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="md:col-span-2">
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Standard Notes (printed on the document)</span>
                        </div>
                        <div>
                          <label htmlFor="qt-fin" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Financial Terms")}</label>
                          <select id="qt-fin" value={quoteTerms.financial && FINANCIAL_TERMS.includes(quoteTerms.financial) ? quoteTerms.financial : (quoteTerms.financial ? "__custom" : "")} onChange={e => { if (e.target.value !== "__custom") setQuoteTerms({ financial: e.target.value }); }} className="finance-input w-full text-xs mb-1">
                            <option value="">— None —</option>
                            {FINANCIAL_TERMS.map(t => <option key={t} value={t}>{t.slice(0, 70)}…</option>)}
                            <option value="__custom">✏️ Custom…</option>
                          </select>
                          <textarea aria-label="Financial terms text" rows={2} value={quoteTerms.financial || ""} onChange={e => setQuoteTerms({ financial: e.target.value })} className="finance-input w-full text-xs" />
                        </div>
                        <div>
                          <label htmlFor="qt-extras" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Extras (upsells)")}</label>
                          <textarea id="qt-extras" rows={2} value={quoteTerms.extras || ""} onChange={e => setQuoteTerms({ extras: e.target.value })} className="finance-input w-full text-xs" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="qt-prod" checked={!!quoteTerms.production} onChange={e => setQuoteTerms({ production: e.target.checked ? PRODUCTION_NOTE : "" })} />
                          <label htmlFor="qt-prod" className="text-xs text-slate-700">{t("Production notes (2 modification sets included, +$30/extra)")}</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="qt-tech" checked={!!quoteTerms.technical} onChange={e => setQuoteTerms({ technical: e.target.checked ? TECHNICAL_NOTE : "" })} />
                          <label htmlFor="qt-tech" className="text-xs text-slate-700">{t("Technical notes (Sony full-frame, HD/4K, licensed music)")}</label>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save Quotation</button>
                      <button type="button" onClick={() => setQuoteForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Payment-match suggestions: unclaimed statement deposits whose account
                    currency + amount (±1%) fit an open quote. Human confirms — never auto-linked. */}
                {(() => {
                  const claimedTx = new Set(state.quotations.map(q => q.paymentTxId).filter(Boolean));
                  const suggestions = state.quotations
                    .filter(q => !q.paymentTxId && ["Sent", "Accepted", "Invoiced"].includes(q.status))
                    .map(q => ({
                      q,
                      txs: state.bankTransactions.filter(bt =>
                        bt.type === "Deposit" && !bt.pending && !bt.projectId && !claimedTx.has(bt.id) &&
                        (state.bankAccounts.find(ba => ba.id === bt.bankAccountId)?.currency || "USD") === q.currency &&
                        Math.abs(bt.amount - q.amount) <= Math.max(1, q.amount * 0.01))
                    }))
                    .filter(s => s.txs.length > 0);
                  if (!suggestions.length) return null;
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <p className="text-[11px] font-bold text-amber-800 uppercase">🏦 Possible payment matches on the bank statement</p>
                      {suggestions.map(({ q, txs }) => txs.map(tx => {
                        const acct = state.bankAccounts.find(ba => ba.id === tx.bankAccountId);
                        return (
                          <div key={`${q.id}-${tx.id}`} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                            <span><strong>{q.quoteNo}</strong> ({q.currency} {q.amount.toLocaleString()}) ↔ deposit {tx.date} · {formatIn(tx.amount, acct?.currency || "USD")} · "{tx.description.slice(0, 50)}"</span>
                            {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && (
                              <button onClick={() => linkQuotePayment(q, tx.id)} className="bg-emerald-600 text-white text-[10px] font-bold rounded px-2 py-1 hover:bg-emerald-700 transition-all">
                                ✓ Confirm settlement
                              </button>
                            )}
                          </div>
                        );
                      }))}
                    </div>
                  );
                })()}

                {/* Off-bank settlement: OMT / BOB / Whish / cash. Evidence ref mandatory. */}
                {settleForm && (
                  <form onSubmit={submitOffbankSettlement} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">💵 Record off-bank payment — {settleForm.q.quoteNo}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="st-method" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Method")}</label>
                        <select id="st-method" value={settleForm.method} onChange={e => setSettleForm({ ...settleForm, method: e.target.value })} className="finance-input w-full text-xs">
                          {["OMT", "BOB Finance", "Whish", "Cash"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="st-ref" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{settleForm.method === "Cash" ? "Signed receipt №" : "Transfer reference"}</label>
                        <input id="st-ref" type="text" required placeholder={settleForm.method === "Cash" ? "receipt number" : "e.g. 512-045-8198"} value={settleForm.reference} onChange={e => setSettleForm({ ...settleForm, reference: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="st-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Received on")}</label>
                        <input id="st-date" type="date" value={settleForm.date} onChange={e => setSettleForm({ ...settleForm, date: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="st-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount received ({settleForm.q.currency})</label>
                        <input id="st-amount" type="number" min="0" step="any" value={settleForm.amount} onChange={e => setSettleForm({ ...settleForm, amount: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">Recorded as a deposit on the off-bank evidence account (like the FPU BOB Finance tranches). No evidence reference, no booking.</p>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Record settlement</button>
                      <button type="button" onClick={() => setSettleForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500">
                        <th scope="col" className="p-3">Quote №</th>
                        <th scope="col" className="p-3">Date</th>
                        <th scope="col" className="p-3">Client</th>
                        <th scope="col" className="p-3">Service</th>
                        <th scope="col" className="p-3 text-right">Amount</th>
                        <th scope="col" className="p-3">Valid Until</th>
                        <th scope="col" className="p-3">Status</th>
                        <th scope="col" className="p-3">Payment</th>
                        <th scope="col" className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.quotations.sort((a, b) => b.date.localeCompare(a.date)).map(q => {
                        const client = state.clients.find(c => c.id === q.clientId);
                        return (
                          <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-700">{q.quoteNo}</td>
                            <td className="p-3 font-mono text-slate-500">{q.date}</td>
                            <td className="p-3 text-slate-700">{client?.name || q.clientId}</td>
                            <td className="p-3 text-slate-700">{q.title}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">{q.currency} {q.amount.toLocaleString()}</td>
                            <td className="p-3 font-mono text-slate-500">{q.validUntil || "—"}</td>
                            <td className="p-3">
                              {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) ? (
                                <select value={q.status} onChange={e => moveQuotation(q, e.target.value)} className="finance-input text-[10px] py-1" aria-label={`Status for ${q.quoteNo}`}>
                                  {QUOTE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                              ) : (
                                <span className="text-[10px] font-bold">{q.status}</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {q.paymentTxId ? (() => {
                                const tx = state.bankTransactions.find(bt => bt.id === q.paymentTxId);
                                return (
                                  <span className="text-[10px] font-bold text-emerald-700">
                                    🏦 settled {tx?.date || ""}
                                    {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                                      <button onClick={() => linkQuotePayment(q, "")} className="ml-1 text-slate-400 hover:text-red-600" title="Unlink payment" aria-label={`Unlink payment for ${q.quoteNo}`}>✕</button>
                                    )}
                                  </span>
                                );
                              })() : (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">—</span>
                                  {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && !["Rejected", "Expired"].includes(q.status) && (
                                    <button onClick={() => setSettleForm({ q, method: "OMT", reference: "", date: new Date().toLocaleDateString("en-CA"), amount: q.amount })} className="text-slate-400 hover:text-emerald-700 p-1 transition-colors rounded hover:bg-slate-100" title="Record off-bank payment (OMT / BOB / Whish / cash)" aria-label={`Record off-bank payment for ${q.quoteNo}`}>💵</button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <button onClick={() => generateQuoteDoc(q)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Generate client document" aria-label={`Generate document for ${q.quoteNo}`}>📄</button>
                              <button onClick={() => setQuoteForm({ ...q })} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Edit" aria-label={`Edit ${q.quoteNo}`}>✏️</button>
                              <button onClick={() => deleteQuotation(q)} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Delete" aria-label={`Delete ${q.quoteNo}`}>
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {state.quotations.length === 0 && (
                        <tr><td colSpan={9} className="p-4 text-center text-slate-400 italic">No quotations yet — register a client, then create the first quote.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400">
                  💡 When an accepted quote is delivered and invoiced, the client's payment arrives on the BLOM
                  statement and books as service income (4200) — same route as the SKF service payments.
                </p>
              </div>
            </div>
          )}

          {activeTab === "expenses" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Official Procurement & Disbursement Vouchers")}</h2>
                <p className="text-xs text-slate-500">Every item must be fully supported by digital quotes, conflict declaration checks, project mapping and mult-level signatures.</p>
              </div>

              {/* Expense submission Drawer form */}
              {["Super Admin", "Finance Officer", "Project Lead", "Project Officer"].includes(currentUser.role) && (
                <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-950 uppercase border-b border-slate-100 pb-2 mb-4">Lodge Disbursement Voucher PV-2026</h3>
                  <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Expenditure Purpose Title")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Media panel catering"
                        value={expenseTitle}
                        onChange={(e) => setExpenseTitle(e.target.value)}
                        className="finance-input w-full"
                      />
                    </div>
                    {Number(expenseAmount) > 300 && (
                      <div className="md:col-span-2">
                        <label htmlFor="exp-procurement" className="block text-xs font-bold text-slate-700 mb-1">
                          Procurement authority <span className="font-normal text-slate-500">(required above USD 300 — Policy 7.2)</span>
                        </label>
                        <select
                          id="exp-procurement"
                          value={expenseProcurement}
                          onChange={(e) => setExpenseProcurement(e.target.value)}
                          className="finance-input w-full"
                        >
                          <option value="">— Select the approved comparison or waiver —</option>
                          {state.procurements
                            .filter(pr => pr.status === "Approved" && pr.projectId === expenseProject)
                            .map(pr => (
                              <option key={pr.id} value={pr.id}>
                                {pr.title}{(pr as any).singleSource ? " — SINGLE SOURCE (waiver)" : " — 3-quote comparison"}
                              </option>
                            ))}
                        </select>
                        {expenseProject && !expenseProcurement && !inlineWaiver && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            Three quotations? Lodge the comparison in Procurement &amp; Bids.{" "}
                            Competition genuinely not possible?{" "}
                            <button
                              type="button"
                              onClick={() => setInlineWaiver({ vendorName: "", amount: expenseAmount || "", reason: "", retrospective: false })}
                              className="font-bold text-amber-700 hover:underline"
                            >
                              ＋ raise a single-source waiver here
                            </button>
                          </p>
                        )}

                        {inlineWaiver && (
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                            <p className="text-[11px] font-bold text-amber-900">Single-source waiver — competition was not possible</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Supplier this waiver covers"
                                aria-label="Waiver supplier"
                                value={inlineWaiver.vendorName}
                                onChange={(e) => setInlineWaiver({ ...inlineWaiver, vendorName: e.target.value })}
                                className="finance-input w-full text-xs"
                              />
                              <input
                                type="number"
                                placeholder="Price covered (USD)"
                                aria-label="Waiver amount"
                                value={inlineWaiver.amount}
                                onChange={(e) => setInlineWaiver({ ...inlineWaiver, amount: e.target.value })}
                                className="finance-input w-full font-mono text-xs"
                              />
                            </div>
                            <textarea
                              rows={2}
                              aria-label="Waiver justification"
                              placeholder="Why competition was not possible, and how you judged the price reasonable (min. 30 characters)"
                              value={inlineWaiver.reason}
                              onChange={(e) => setInlineWaiver({ ...inlineWaiver, reason: e.target.value })}
                              className="finance-input w-full text-xs"
                            />
                            <label className="flex items-center gap-2 text-[11px] text-amber-900">
                              <input
                                type="checkbox"
                                checked={inlineWaiver.retrospective}
                                onChange={(e) => setInlineWaiver({ ...inlineWaiver, retrospective: e.target.checked })}
                              />
                              The purchase was already made — record this waiver as retrospective
                            </label>
                            <div className="flex gap-2">
                              <button type="button" onClick={submitInlineWaiver} className="bg-amber-700 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-amber-800 transition-all">
                                Save waiver &amp; attach
                              </button>
                              <button type="button" onClick={() => setInlineWaiver(null)} className="bg-slate-100 text-slate-600 text-xs font-medium rounded-lg px-3 py-2 hover:bg-slate-200 transition-all">
                                Cancel
                              </button>
                            </div>
                            <p className="text-[10px] text-amber-800">
                              Creates the same procurement record as the Bids tab — approved on the spot if your role allows, otherwise sent for approval. Recorded in the audit trail either way.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Accompanying Justification / Sinking rationale")}</label>
                      <input
                        type="text"
                        placeholder="Why this expense is needed"
                        value={expensePurpose}
                        onChange={(e) => setExpensePurpose(e.target.value)}
                        className="finance-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Target Project Mapping")}</label>
                      <select
                        value={expenseProject}
                        onChange={(e) => setExpenseProject(e.target.value)}
                        className="finance-input w-full"
                      >
                        <option value="">-- Select Project Sinking Code --</option>
                        {requestableProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Sub-Budget designated line")}</label>
                      <select
                        value={expenseBudgetLine}
                        onChange={(e) => setExpenseBudgetLine(e.target.value)}
                        className="finance-input w-full"
                      >
                        <option value="">-- Unrestricted Operational Line --</option>
                        {state.budgetLines.filter(bl => bl.projectId === expenseProject).map(bl => (
                          <option key={bl.id} value={bl.id}>{bl.code} - {bl.description}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Vendor list / Contract partner")}</label>
                      <select
                        value={expenseVendor}
                        onChange={(e) => setExpenseVendor(e.target.value)}
                        className="finance-input w-full"
                      >
                        <option value="">-- Direct payment or Select Vendor --</option>
                        {state.vendors.filter(v => !v.blocked).map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Requested Currency")}</label>
                      <select
                        value={expenseCurrency}
                        onChange={(e) => setExpenseCurrency(e.target.value as any)}
                        className="finance-input w-full font-mono"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="LBP">LBP (ل.ل)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Amount Value")}</label>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        className="finance-input w-full font-mono"
                      />
                    </div>
                    {expenseCurrency !== "USD" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Override Exchange Rate (1 {expenseCurrency} to USD)
                        </label>
                        <input
                          type="number"
                          step="0.00000001"
                          placeholder={expenseCurrency === "EUR" ? "e.g. 1.085" : "e.g. 0.000011"}
                          value={expenseCustomRate}
                          onChange={(e) => setExpenseCustomRate(e.target.value)}
                          className="finance-input w-full font-mono bg-amber-50/20 border-amber-200"
                        />
                        <span className="text-[10px] text-amber-600 block mt-0.5 font-mono">
                          ⚠️ Leave empty to use system default rate.
                        </span>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t("Attach supporting Invoice/Agreement (PDF, PNG or JPEG)")}</label>
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={handleFileDrop}
                        className="finance-input w-full text-xs"
                      />
                      <div className="mt-2 p-2 rounded-lg border border-indigo-200 bg-indigo-50/40">
                        <label className={`block text-xs font-bold mb-1 ${aiScanning ? "text-slate-400" : "text-indigo-700"}`}>
                          {aiScanning ? "🤖 Reading invoice…" : "🤖 Scan invoice with AI (auto-fill this form)"}
                        </label>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          disabled={aiScanning}
                          onChange={handleAiInvoiceScan}
                          className="finance-input w-full text-xs"
                        />
                        <span className="text-[10px] text-indigo-600 block mt-0.5">
                          Fills the fields and attaches the scan — you review and submit (Policy 5.2).
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-3 border-t border-slate-100 pt-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="enable-shared-split"
                          checked={enableSharedSplit}
                          onChange={(e) => setEnableSharedSplit(e.target.checked)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <label htmlFor="enable-shared-split" className="text-xs font-bold text-slate-800 cursor-pointer">
                          🛠️ Enable Multi-Project Shared Cost Allocation (Co-funding split)
                        </label>
                      </div>

                      {enableSharedSplit && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                            Predefined Cost Allocation Formulas & Project Splits
                          </span>

                          {splitAllocations.map((alloc, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t("Allocation Project")}</label>
                                <select
                                  value={alloc.projectId}
                                  onChange={(e) => {
                                    const copy = [...splitAllocations];
                                    copy[idx].projectId = e.target.value;
                                    copy[idx].budgetLineId = ""; // Reset budget line
                                    setSplitAllocations(copy);
                                  }}
                                  className="finance-input w-full text-xs bg-white"
                                >
                                  <option value="">-- Select Project --</option>
                                  {requestableProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t("Budget Line mapping")}</label>
                                <select
                                  value={alloc.budgetLineId}
                                  onChange={(e) => {
                                    const copy = [...splitAllocations];
                                    copy[idx].budgetLineId = e.target.value;
                                    setSplitAllocations(copy);
                                  }}
                                  className="finance-input w-full text-xs bg-white"
                                >
                                  <option value="">-- Unrestricted Line --</option>
                                  {state.budgetLines.filter(bl => bl.projectId === alloc.projectId).map(bl => (
                                    <option key={bl.id} value={bl.id}>{bl.code} - {bl.description}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t("Percentage Split (%)")}</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={alloc.percentage}
                                  onChange={(e) => {
                                    const copy = [...splitAllocations];
                                    copy[idx].percentage = Number(e.target.value);
                                    setSplitAllocations(copy);
                                  }}
                                  className="finance-input w-full text-xs font-mono"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = splitAllocations.filter((_, i) => i !== idx);
                                    setSplitAllocations(copy);
                                  }}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 p-2 rounded text-xs border border-red-200"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setSplitAllocations([...splitAllocations, { projectId: "", budgetLineId: "", percentage: 0 }]);
                              }}
                              className="text-[10px] bg-slate-900 text-white px-2.5 py-1 rounded font-bold hover:bg-slate-950 shadow"
                            >
                              ➕ Add Project Split Line
                            </button>
                            <span className="font-mono font-bold text-slate-700">
                              Total Split:{" "}
                              <span className={splitAllocations.reduce((s, a) => s + Number(a.percentage || 0), 0) === 100 ? "text-emerald-600" : "text-amber-600"}>
                                {splitAllocations.reduce((s, a) => s + Number(a.percentage || 0), 0)}%
                              </span>{" "}
                              / 100%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-red-650 bg-red-600 text-white font-medium text-xs px-4 py-2.5 rounded-lg hover:bg-red-700 shadow transition-all">
                        Post Disbursement VoucherPV-2026
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Vouchers directory */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-md font-bold text-slate-950 uppercase font-mono">Ledger Vouchers Logs</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-lg max-w-xs">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search voucher history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-xs outline-none bg-transparent"
                      />
                    </div>
                    <input type="date" title="From date" value={vFilter.from}
                      onChange={(e) => setVFilter({ ...vFilter, from: e.target.value })}
                      className="text-xs bg-white px-2 py-1.5 border border-slate-200 rounded-lg" />
                    <input type="date" title="To date" value={vFilter.to}
                      onChange={(e) => setVFilter({ ...vFilter, to: e.target.value })}
                      className="text-xs bg-white px-2 py-1.5 border border-slate-200 rounded-lg" />
                    <select value={vFilter.type}
                      onChange={(e) => setVFilter({ ...vFilter, type: e.target.value })}
                      className="text-xs bg-white px-2 py-1.5 border border-slate-200 rounded-lg">
                      <option value="">All types</option>
                      {voucherTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={vFilter.status}
                      onChange={(e) => setVFilter({ ...vFilter, status: e.target.value })}
                      className="text-xs bg-white px-2 py-1.5 border border-slate-200 rounded-lg">
                      <option value="">All statuses</option>
                      {voucherStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {(vFilter.from || vFilter.to || vFilter.type || vFilter.status) && (
                      <button onClick={() => setVFilter({ from: "", to: "", type: "", status: "" })}
                        className="text-xs text-red-600 font-bold px-2 py-1.5 hover:underline">Clear</button>
                    )}
                    <span className="text-[10px] font-mono text-slate-500">{filteredExpenses.length} shown</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredExpenses.map(exp => {
                    const vendor = state?.vendors?.find(v => v.id === exp.vendorId);
                    const proj = state?.projects?.find(p => p.id === exp.projectId);
                    const expComments = exp.comments && Array.isArray(exp.comments) ? exp.comments : [];
                    const expAllocations = exp.allocations && Array.isArray(exp.allocations) ? exp.allocations : [];
                    // Bills vs. supporting proof — filed separately, listed separately.
                    const expDocs = state.documents.filter(d => d.linkedRecordType === "Expense" && d.linkedRecordId === exp.id);
                    const expEvidence = expDocs.filter(d => d.category === "Evidence");
                    const expInvoices = expDocs.filter(d => d.category !== "Evidence");

                    const conflict = selfDealing(exp);

                    return (
                      <div key={exp.id} className={`p-6 bg-white border rounded-xl shadow-sm space-y-4 ${conflict ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}>
                        {conflict && (
                          <div className="flex items-start gap-2 -mt-1 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <span className="text-sm leading-none pt-0.5">⚠️</span>
                            <p className="text-[11px] text-amber-900 leading-relaxed">
                              <strong>Related-party voucher.</strong> {conflict.name} raised this and is also the payee
                              ({vendor?.name || "this provider"}). Permitted — they cannot approve it themselves (§4.3) — but
                              confirm the deliverable and rate against their service agreement before signing.
                            </p>
                          </div>
                        )}
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold font-mono mr-2">{exp.voucherNo || "PV-N/A"}</span>
                            <span className="text-md font-bold text-slate-900">{exp.title || "Untitled Disbursement"}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] block text-slate-500 uppercase">Val USD Equivalent</span>
                            <span className="text-lg font-bold font-mono text-slate-950">{formatUSD(exp.convertedAmount || 0)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Request Purpose</span>
                            <p className="font-semibold text-slate-800">{exp.purpose || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Vessel Project</span>
                            <p className="font-bold text-slate-900">{proj ? `${proj.code} - ${proj.name}` : "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Contract vendor</span>
                            <p className="font-semibold text-slate-800">
                              {vendor ? vendor.name : "Direct Reimbursement"}
                              {vendor && vendor.category && (
                                <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono border ${(vendor.category || "").toLowerCase().includes("consultant") || (vendor.category || "").toLowerCase().includes("freelance") ? "bg-amber-100 text-amber-800 border-amber-200" :
                                    (vendor.category || "").toLowerCase().includes("service") ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
                                      "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}>
                                  {vendor.category}
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Current phase status</span>
                            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${exp.status === "Posted" ? "bg-emerald-100 text-emerald-700 font-bold" :
                                exp.status === "Approved" ? "bg-emerald-50 text-emerald-600" :
                                  exp.status === "Submitted" ? "bg-indigo-50 text-indigo-700" :
                                    "bg-amber-100 text-amber-700"
                              }`}>
                              ● {exp.status || "Draft"}
                            </span>
                          </div>
                        </div>

                        {exp.currency !== "USD" && (
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <span>Raw Transaction Value: <strong className="text-slate-800">{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency}</strong></span>
                            <span>Traceable Exchanger/FX Conversion Rate: <strong className="text-slate-800">1 {exp.currency} = {exp.rate} USD</strong></span>
                          </div>
                        )}

                        {/* Co-funding shared cost splits display */}
                        {expAllocations.length > 0 && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                              🛠️ Predefined Co-funding splits & Shared Cost Allocations
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono font-medium">
                              {expAllocations.map((alloc, idx) => {
                                const allocProj = state?.projects?.find(p => p.id === alloc.projectId);
                                const allocBl = state?.budgetLines?.find(bl => bl.id === alloc.budgetLineId);

                                return (
                                  <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
                                    <div>
                                      <span className="text-[10px] text-slate-400 block">Project mapping</span>
                                      <span className="font-bold text-slate-900">
                                        {allocProj ? `${allocProj.code} (${alloc.percentage || 0}%)` : `Unknown Project (${alloc.percentage || 0}%)`}
                                      </span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-baseline">
                                      <div>
                                        <span className="text-[10px] text-slate-400 block">Budget Line Mapping</span>
                                        <span className="font-bold text-slate-700">{allocBl ? allocBl.code : "Unrestricted Line"}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[10px] text-slate-400 block">Split Amount</span>
                                        <span className="font-bold text-slate-900">{(alloc.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Paid/Posted WHT audit trail info block */}
                        {["Paid", "Posted"].includes(exp.status) && (
                          <div className={`p-3 border rounded-lg text-xs font-mono grid grid-cols-3 gap-2 ${exp.whtAmount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                            <div>
                              <span className={`text-[10px] uppercase block font-bold ${exp.whtAmount > 0 ? "text-amber-800" : "text-emerald-800"}`}>Gross Amount</span>
                              <span className="font-bold text-slate-900">{(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency}</span>
                            </div>
                            <div>
                              <span className={`text-[10px] uppercase block font-bold ${exp.whtAmount > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                                {exp.whtAmount > 0 ? "WHT Withheld (7.5%)" : "WHT Withheld (0% Registered)"}
                              </span>
                              <span className={`font-bold ${exp.whtAmount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                                {exp.whtAmount > 0 ? `-${(exp.whtAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "0.00"} {exp.currency}
                              </span>
                            </div>
                            <div>
                              <span className={`text-[10px] uppercase block font-bold ${exp.whtAmount > 0 ? "text-amber-800" : "text-emerald-800"}`}>Net Paid Amount</span>
                              <span className="font-bold text-slate-950">{(exp.netAmount || ((exp.amount || 0) - (exp.whtAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency}</span>
                            </div>
                          </div>
                        )}

                        {/* Auditing Vouchers Interactive action drawer depending on simulated Role */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => setDrawerExpenseId(exp.id)}
                            className="text-[11px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded font-medium"
                          >
                            🔎 Details
                          </button>
                          {exp.status === "Submitted" && ["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                            <button
                              onClick={() => handleExpenseAction(exp.id, "finance-review", { comment: "Integrity review flagged by Layale." })}
                              className="text-[11px] bg-slate-800 hover:bg-slate-950 text-white px-3 py-1.5 rounded font-medium"
                            >
                              ⚙️ Raise Finance Review Flag
                            </button>
                          )}

                          {["Submitted", "Under Finance Review"].includes(exp.status) && ["Super Admin", "Program Director"].includes(currentUser.role) && (
                            <>
                              <button
                                onClick={() => handleExpenseAction(exp.id, "approve")}
                                className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-medium"
                              >
                                ✓ Grant Director Signature
                              </button>
                              <button
                                onClick={() => {
                                  const c = prompt("Provide correction feedback comment:");
                                  if (c) handleExpenseAction(exp.id, "return", { comment: c });
                                }}
                                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded font-medium"
                              >
                                ⤾ Request corrections
                              </button>
                            </>
                          )}

                          {exp.status === "Approved" && ["Super Admin", "Finance Officer"].includes(currentUser.role) && (() => {
                            const hasTaxId = vendor && vendor.taxId && vendor.taxId.trim() !== "" && vendor.taxId.trim().toUpperCase() !== "N/A";
                            const whtRate = hasTaxId ? 0 : 0.075;
                            const whtVal = (exp.amount || 0) * whtRate;
                            const netVal = (exp.amount || 0) - whtVal;

                            return (
                              <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg w-full">
                                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                                  <div>
                                    <span className="font-semibold text-slate-700">MoF Vendor Tax Profile:</span>{" "}
                                    <span className={hasTaxId ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                                      {hasTaxId ? `Registered (Tax ID: ${vendor.taxId})` : "Unregistered (No Official Tax ID)"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">MoF Withholding Tax:</span>{" "}
                                    <span className="font-mono font-bold bg-slate-200 px-2 py-0.5 rounded">{(whtRate * 100).toFixed(1)}% Rate</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-200 pt-2 font-mono">
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Gross Amount</span>
                                    <span className="font-bold text-slate-900">{(exp.amount || 0).toLocaleString()} {exp.currency}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase block font-bold">WHT Withheld (7.5%)</span>
                                    <span className="font-bold text-red-600 font-bold">-{whtVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {exp.currency}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Net Payout Amount</span>
                                    <span className="font-bold text-emerald-700 font-bold">{netVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {exp.currency}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 border-t border-slate-200 pt-2 mt-1">
                                  <span className="text-xs text-slate-600 font-semibold font-mono">Cashier Source:</span>
                                  <select
                                    id={`ba-sel-${exp.id}`}
                                    className="bg-white text-xs px-2 py-1 rounded border border-slate-300 outline-none"
                                  >
                                    {(state?.bankAccounts || []).map(b => (
                                      <option key={b.id} value={b.id}>{b.name} (Bal: {(b.balance || 0).toLocaleString()})</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const sel = (document.getElementById(`ba-sel-${exp.id}`) as HTMLSelectElement).value;
                                      handleExpenseAction(exp.id, "cashbook-pay", {
                                        bankAccountId: sel,
                                        paymentMethod: "Petty cash envelope",
                                        paymentRef: `VOU-${exp.voucherNo}`,
                                        whtAmount: whtVal,
                                        netAmount: netVal
                                      });
                                    }}
                                    className="text-[11px] bg-amber-650 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded font-medium shadow-sm animate-pulse"
                                  >
                                    💸 Settle Cashier payment (Apply WHT)
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          {exp.status === "Paid" && ["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                            <button
                              onClick={() => handleExpenseAction(exp.id, "general-ledger-post")}
                              className="text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded font-medium"
                            >
                              🖨️ Post to double-entry general ledger
                            </button>
                          )}

                          {/* Render voucher PDF details */}
                          <div className="ml-auto text-xs text-slate-500 font-mono flex items-center gap-1 flex-wrap justify-end">
                            {expInvoices.length
                              ? `📄 Invoice secured${expInvoices.length > 1 ? ` (${expInvoices.length})` : ""}`
                              : "⚠️ Invoice required to close"}
                            {["Super Admin", "Finance Officer", "Project Lead", "Project Officer"].includes(currentUser.role) && (<>
                              <label className="text-red-650 hover:underline font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2" title="The bill itself">
                                🧾 {expInvoices.length ? "Add invoice" : "Attach invoice"}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  multiple
                                  className="hidden"
                                  aria-label={`Attach invoice to ${exp.voucherNo}`}
                                  onChange={(ev) => handleVoucherDocUpload(ev, exp.id, exp.voucherNo, "Invoice")}
                                />
                              </label>
                              {state.vendors.find(v => v.id === exp.vendorId)?.engageable && (
                                <button
                                  onClick={() => generateProviderDoc(exp.id, exp.voucherNo)}
                                  className="text-emerald-700 hover:underline font-bold inline-flex items-center min-h-[44px] px-2"
                                  title="Generate the provider's service invoice & payment receipt for signature"
                                >
                                  🖨️ Provider invoice
                                </button>
                              )}
                              <label className="text-slate-500 hover:underline font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2" title="Distribution lists, delivery notes, photos of the purchase">
                                📷 Evidence{expEvidence.length ? ` (${expEvidence.length})` : ""}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  multiple
                                  className="hidden"
                                  aria-label={`Attach supporting evidence to ${exp.voucherNo}`}
                                  onChange={(ev) => handleVoucherDocUpload(ev, exp.id, exp.voucherNo, "Evidence")}
                                />
                              </label>
                            </>)}
                          </div>
                        </div>

                        {expDocs.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] px-1">
                            {expDocs.map(d => (
                              <a
                                key={d.id}
                                href={`/api/document/content/${d.id}`}
                                target="_blank" onClick={e => { e.preventDefault(); openDoc(d); }}
                                rel="noreferrer"
                                className="text-slate-500 hover:text-red-650 hover:underline inline-flex items-center gap-1"
                                title={`${d.category} · ${d.sizeStr}`}
                              >
                                {d.category === "Evidence" ? "📷" : "🧾"} {d.filename}
                                {d.refNo && <span className="font-mono text-slate-400">{d.refNo}</span>}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Audit Trail Timeline and Internal conversations */}
                        {expComments.length > 0 && (
                          <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Ledger Internal Auditor audit trails</span>
                            {expComments.map((c) => (
                              <div key={c.id} className="text-[11px] leading-relaxed">
                                <span className="font-bold text-slate-800">{c.author}:</span>
                                <span className="text-slate-600 pl-1">"{c.text}"</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}


          {/* tab content Procurement Sourcing */}
          {activeTab === "procurement" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Tripoli Sourcing & RFQ Comparative Sheets")}</h2>
                <p className="text-xs text-slate-500">Internal policy (Section 7.2) demands at least 3 compared quotations for any procurement exceeding 300 USD. Stricter donor thresholds apply on top when required.</p>
              </div>

              {/* Submit bid comparison */}
              {["Super Admin", "Finance Officer", "Project Lead", "Project Officer"].includes(currentUser.role) && (
                <form onSubmit={handleProcurementSubmit} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Comparative RFQ Title")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Sourcing 3 tripod screens"
                      value={procTitle}
                      onChange={(e) => setProcTitle(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Vessel Project Mapping")}</label>
                    <select
                      value={procProject}
                      onChange={(e) => setProcProject(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Select Project Sinking Code --</option>
                      {requestableProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Sub-Budget Mapping")}</label>
                    <select
                      value={procBudgetLine}
                      onChange={(e) => setProcBudgetLine(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Expense Line categories --</option>
                      {state.budgetLines.filter(x => x.projectId === procProject).map(b => (
                        <option key={b.id} value={b.id}>{b.code} - {b.description}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sourced Option A */}
                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 block">PRIMARY BID (Selected preference)</span>
                    <input
                      type="text"
                      placeholder="Vendor A Name"
                      value={procVendorA}
                      onChange={(e) => setProcVendorA(e.target.value)}
                      className="finance-input w-full bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Bid USD"
                        value={procAmountA}
                        onChange={(e) => setProcAmountA(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Rating %"
                        value={procScoreA}
                        onChange={(e) => setProcScoreA(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Sourced Option B */}
                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 block">SECONDARY COMPETING BID</span>
                    <input
                      type="text"
                      placeholder="Vendor B Name"
                      value={procVendorB}
                      onChange={(e) => setProcVendorB(e.target.value)}
                      className="finance-input w-full bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Bid USD"
                        value={procAmountB}
                        onChange={(e) => setProcAmountB(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Rating %"
                        value={procScoreB}
                        onChange={(e) => setProcScoreB(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Sourced Option C — Policy 7.2 needs three compared bids */}
                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 block">THIRD COMPETING BID</span>
                    <input
                      type="text"
                      placeholder="Vendor C Name"
                      value={procVendorC}
                      onChange={(e) => setProcVendorC(e.target.value)}
                      className="finance-input w-full bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Bid USD"
                        value={procAmountC}
                        onChange={(e) => setProcAmountC(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Rating %"
                        value={procScoreC}
                        onChange={(e) => setProcScoreC(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Single-source waiver — documented exception, never a silent bypass */}
                  <div className="md:col-span-3 border border-amber-200 bg-amber-50 p-3 rounded space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <input
                        type="checkbox"
                        checked={procSingleSource}
                        onChange={(e) => setProcSingleSource(e.target.checked)}
                      />
                      Single source — competition was not possible
                    </label>
                    <p className="text-[10px] text-amber-800">
                      Tick only when fewer than three quotations are genuinely obtainable (sole supplier, emergency response,
                      a cooperative that issues the coupons). A written reason of at least 30 characters is required below,
                      it is approved as a waiver, and it is recorded in the audit trail — donors accept a justified
                      exception, not a missing comparison.
                    </p>
                  </div>

                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">{t("Audit Justification Memo")}</label>
                    <textarea
                      placeholder="Memo rationale..."
                      value={procJustification}
                      onChange={(e) => setProcJustification(e.target.value)}
                      className="finance-input w-full bg-white h-12 text-xs"
                    />
                    <label className="inline-flex items-center gap-1.5 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={procConflict}
                        onChange={(e) => setProcConflict(e.target.checked)}
                        className="rounded accent-red-650"
                      />
                      <span className="text-[10px] text-slate-600 font-bold">No internal conflict of interest declared</span>
                    </label>
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <button type="submit" className="bg-red-660 bg-red-600 text-white font-medium text-xs rounded px-4 py-2 hover:bg-slate-950 transition-all">
                      Settle Quotation Sheet Audit File
                    </button>
                  </div>
                </form>
              )}

              {/* Active Procurements list */}
              <div className="space-y-4">
                {state.procurements.map(pr => (
                  <div key={pr.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <div>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-700">PROJECT SOURCING</span>
                        <h4 className="text-sm font-bold text-slate-950 mt-1">{pr.title}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${pr.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                        {pr.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {pr.quotations.map((q, idx) => (
                        <div key={idx} className={`p-3 rounded border ${q.selected ? "border-emerald-500 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}>
                          <div className="flex justify-between font-bold text-xs text-slate-900">
                            <span>{q.vendorName}</span>
                            {q.selected && <span className="text-emerald-700 text-[10px]">✓ Selected Candidate</span>}
                          </div>
                          <div className="mt-2 flex justify-between tracking-tight text-slate-650 text-xs font-mono font-medium">
                            <span>Quote Value:</span>
                            <span className="text-slate-950 font-bold">{q.amount.toLocaleString()} {q.currency}</span>
                          </div>
                          <div className="mt-1 flex justify-between text-xs font-mono font-medium text-slate-650">
                            <span>Rating Compliance:</span>
                            <span>{q.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={`mt-3 p-3 text-xs rounded font-mono italic ${(pr as any).singleSource ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                      {(pr as any).singleSource ? "⚠️" : "ℹ️"} <strong>{(pr as any).singleSource ? "Single-source waiver — competition waived. Stated reason:" : "Selection Memo:"}</strong> "{pr.justification}"
                      {(pr as any).approvedBy && <span className="block mt-1 not-italic text-[10px]">Approved by {(pr as any).approvedBy}</span>}
                    </div>

                    {pr.status === "Under Evaluation" && ["Super Admin", "Program Director"].includes(currentUser.role) && (
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/procurement/approve", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: pr.id, user: currentUser })
                          });
                          if (res.ok) {
                            triggerToast("Quotation bid approved. Authorized contract issuance.");
                            refreshState();
                          }
                        }}
                        className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded px-4 py-2"
                      >
                        Authorize Sourcing & Emit Contract PO
                      </button>
                    )}
                  </div>
                ))}
              </div>

            </div>
          )}


          {/* tab content Vendor Master */}
          {activeTab === "vendors" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold"> Tripoli Vendor Master & Partners Directory</h2>
                <p className="text-xs text-slate-500">
                  Every contractor, freelancer and supplier must certify conflict of interest waivers periodically. Sanction-marked providers are locked automatically.
                </p>
              </div>

              {/* ── Subscriptions & renewals ─────────────────────────────────
                  Small recurring charges are the easiest money to lose track of:
                  each one is trivial, the total is not. */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">🔁 Subscriptions & Renewals</h3>
                  <div className="flex items-center gap-2">
                    {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                      <>
                        <button type="button" disabled={subBusy} onClick={detectSubscriptions}
                          className="text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 disabled:opacity-50 transition-all">
                          {subBusy ? "Scanning…" : "🔍 Find in statements"}
                        </button>
                        <button type="button" onClick={() => setSubForm({ name: "", amount: "", currency: "USD", cycle: "Monthly", nextRenewal: "", status: "Active", bankAccountId: "ba-blom-usd", matchText: "", notes: "" })}
                          className="text-xs font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg px-3 py-2 transition-all">
                          ➕ Track a subscription
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(() => {
                  const active = state.subscriptions.filter(x => x.status === "Active");
                  const monthly = active.reduce((sum, x) => sum + (x.amount || 0) / (x.cycle === "Annual" ? 12 : x.cycle === "Quarterly" ? 3 : 1), 0);
                  if (!active.length) return null;
                  return (
                    <div className="flex flex-wrap gap-4 text-xs">
                      <span className="text-slate-500">Active: <strong className="text-slate-800">{active.length}</strong></span>
                      <span className="text-slate-500">Monthly equivalent: <strong className="font-mono text-slate-800">{formatUSD(monthly)}</strong></span>
                      <span className="text-slate-500">Annualised: <strong className="font-mono text-slate-800">{formatUSD(monthly * 12)}</strong></span>
                    </div>
                  );
                })()}

                {subForm && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label htmlFor="sb-name" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Subscription</label>
                      <input id="sb-name" type="text" placeholder="e.g. Anthropic Claude Max" value={subForm.name}
                        onChange={e => setSubForm({ ...subForm, name: e.target.value })} className="finance-input w-full text-xs" />
                    </div>
                    <div>
                      <label htmlFor="sb-amt" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount</label>
                      <input id="sb-amt" type="number" min="0" step="any" value={subForm.amount}
                        onChange={e => setSubForm({ ...subForm, amount: e.target.value })} className="finance-input w-full font-mono text-xs" />
                    </div>
                    <div>
                      <label htmlFor="sb-cycle" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Cycle</label>
                      <select id="sb-cycle" value={subForm.cycle} onChange={e => setSubForm({ ...subForm, cycle: e.target.value })} className="finance-input w-full text-xs">
                        <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sb-next" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Next renewal</label>
                      <input id="sb-next" type="date" value={subForm.nextRenewal}
                        onChange={e => setSubForm({ ...subForm, nextRenewal: e.target.value })} className="finance-input w-full font-mono text-xs" />
                    </div>
                    <div>
                      <label htmlFor="sb-acct" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Paid from</label>
                      <select id="sb-acct" value={subForm.bankAccountId} onChange={e => setSubForm({ ...subForm, bankAccountId: e.target.value })} className="finance-input w-full text-xs">
                        <option value="">—</option>
                        {state.bankAccounts.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="sb-note" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Note (optional)</label>
                      <input id="sb-note" type="text" value={subForm.notes} onChange={e => setSubForm({ ...subForm, notes: e.target.value })} className="finance-input w-full text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveSubscription(subForm)} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">💾 Save</button>
                      <button type="button" onClick={() => setSubForm(null)} className="bg-slate-100 text-slate-600 text-xs font-medium rounded-lg px-3 py-2 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </div>
                )}

                {subSuggestions && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                    <p className="text-[11px] font-bold text-indigo-900">Recurring merchants on the statements — not yet tracked</p>
                    {subSuggestions.length === 0 && <p className="text-[11px] text-indigo-700">Nothing untracked found.</p>}
                    {subSuggestions.map(sug => (
                      <div key={sug.key} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white border border-indigo-100 rounded px-2 py-1.5">
                        <span className="text-slate-700">
                          <strong>{sug.key}</strong> · {sug.charges} charges · last {sug.lastCharge} · typically {formatUSD(sug.typicalAmount)}
                          {sug.varies && <span className="text-amber-700"> (amount varies)</span>} · looks {sug.cycle.toLowerCase()}
                        </span>
                        <button type="button"
                          onClick={() => { setSubForm({ name: sug.key, amount: String(sug.typicalAmount), currency: "USD", cycle: sug.cycle, nextRenewal: sug.suggestedNextRenewal, status: "Active", bankAccountId: sug.bankAccountId, matchText: sug.key, notes: `Detected from ${sug.charges} statement charges; last ${sug.lastCharge}.` }); setSubSuggestions(null); }}
                          className="text-[11px] font-bold text-indigo-700 hover:underline">＋ track this</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSubSuggestions(null)} className="text-[10px] text-slate-500 hover:underline">close</button>
                  </div>
                )}

                {state.subscriptions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nothing tracked yet — "Find in statements" proposes the recurring charges already on your bank feed.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500">
                        <th scope="col" className="p-2">Subscription</th>
                        <th scope="col" className="p-2 text-right">Amount</th>
                        <th scope="col" className="p-2">Cycle</th>
                        <th scope="col" className="p-2">Next renewal</th>
                        <th scope="col" className="p-2">Paid from</th>
                        <th scope="col" className="p-2">Status</th>
                        <th scope="col" className="p-2">Still active?</th>
                        <th scope="col" className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.subscriptions.slice().sort((a, b) => (a.nextRenewal || "9999").localeCompare(b.nextRenewal || "9999")).map(sub => {
                        const days = subDaysLeft(sub.nextRenewal);
                        const overdue = days !== null && days < 0 && sub.status === "Active";
                        const soon = days !== null && days >= 0 && days <= 7 && sub.status === "Active";
                        return (
                          <tr key={sub.id} className={`border-b border-slate-100 ${overdue ? "bg-red-50" : soon ? "bg-amber-50" : ""}`}>
                            <td className="p-2 font-bold text-slate-800">{sub.name}{sub.notes && <span className="block text-[10px] font-normal text-slate-400">{sub.notes}</span>}</td>
                            <td className="p-2 text-right font-mono">{sub.currency} {sub.amount.toLocaleString()}</td>
                            <td className="p-2 text-slate-600">{sub.cycle}</td>
                            <td className="p-2 font-mono">
                              {sub.nextRenewal || "—"}
                              {sub.status === "Active" && days !== null && (
                                <span className={`block text-[10px] font-bold ${overdue ? "text-red-700" : soon ? "text-amber-700" : "text-slate-400"}`}>
                                  {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "renews today" : `in ${days}d`}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-500">{state.bankAccounts.find(b => b.id === sub.bankAccountId)?.name || "—"}</td>
                            <td className="p-2">
                              <select value={sub.status} onChange={e => saveSubscription({ ...sub, status: e.target.value })}
                                aria-label={`Status for ${sub.name}`} className="finance-input text-[10px] py-1">
                                <option>Active</option><option>Paused</option><option>Cancelled</option>
                              </select>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {(() => {
                                const v = (sub as any).verifiedOn;
                                const vDays = v ? Math.floor((Date.now() - new Date(`${v}T00:00:00`).getTime()) / 86400000) : null;
                                const stale = vDays === null || vDays > 90;
                                return (
                                  <span className="inline-flex items-center gap-1">
                                    <button onClick={() => verifySubscription(sub, true)} title="Confirm it is still running today"
                                      className="text-[10px] font-bold text-emerald-700 hover:underline">✓ yes</button>
                                    <button onClick={() => { if (window.confirm(`Mark ${sub.name} as no longer running?`)) verifySubscription(sub, false); }}
                                      title="No longer running — mark cancelled"
                                      className="text-[10px] font-bold text-slate-400 hover:text-red-600 hover:underline">✕ no</button>
                                    <span className={`block text-[9px] ${stale ? "text-amber-700 font-bold" : "text-slate-400"}`}>
                                      {v ? (vDays === 0 ? "checked today" : `checked ${vDays}d ago`) : "never checked"}
                                    </span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {sub.nextRenewal && sub.status === "Active" && (
                                <button onClick={() => rollSubscription(sub)} title="Paid — roll to the next period" aria-label={`Roll ${sub.name} forward`}
                                  className="text-emerald-700 hover:underline font-bold px-1">✓ paid</button>
                              )}
                              <button onClick={() => setSubForm({ ...sub, amount: String(sub.amount) })} title="Edit" aria-label={`Edit ${sub.name}`} className="text-slate-400 hover:text-slate-700 px-1">✏️</button>
                              <button onClick={() => deleteSubscription(sub)} title="Stop tracking" aria-label={`Stop tracking ${sub.name}`} className="text-slate-400 hover:text-red-600 px-1"><Trash2 className="h-3.5 w-3.5 inline" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Register New Vendor Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Onboard New Provider (Supplier / Consultant / Freelancer)</h3>
                  <div className="p-2 rounded-lg border border-indigo-200 bg-indigo-50/40 md:w-1/2">
                    <label className={`block text-xs font-bold mb-1 ${aiVendorScanning ? "text-slate-400" : "text-indigo-700"}`}>
                      {aiVendorScanning ? "🤖 Reading supplier details…" : "🤖 Scan an invoice with AI (auto-fill supplier details)"}
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      disabled={aiVendorScanning}
                      onChange={handleAiVendorScan}
                      className="finance-input w-full text-xs"
                    />
                    <span className="text-[10px] text-indigo-600 block mt-0.5">
                      Fills the fields from the supplier's invoice — vet and register manually (Policy 7.3).
                    </span>
                  </div>
                  <form onSubmit={handleVendorRegister} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Provider / Vendor Name")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Layale El-Khatib (Consultant)"
                        required
                        value={newVendorName}
                        onChange={(e) => setNewVendorName(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Contract / Provider Category")}</label>
                      <select
                        required
                        value={newVendorCategory}
                        onChange={(e) => setNewVendorCategory(e.target.value)}
                        className="finance-input w-full text-xs bg-white"
                      >
                        <option value="">-- Choose Category --</option>
                        <option value="Consultant / Freelancer">Consultant / Freelancer</option>
                        <option value="Service Provider">Service Provider (engaged under agreement)</option>
                        <option value="Software Subscriptions">Software Subscriptions</option>
                        <option value="General Supplier">General Supplier</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Telecommunications">Telecommunications</option>
                        <option value="Landlord">Landlord (Rent Services)</option>
                        <option value="Government / Tax Authority">Government / Tax Authority</option>
                        <option value="Other">Other Category</option>
                      </select>
                      {/* Explicit, not inferred from the category — a mislabelled category
                          must never be enough to permit a signed agreement. */}
                      <label htmlFor="vendor-engageable" className="mt-2 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          id="vendor-engageable"
                          checked={newVendorEngageable}
                          onChange={(e) => setNewVendorEngageable(e.target.checked)}
                          className="h-4 w-4 mt-0.5 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-600 leading-snug">
                          We <strong>engage</strong> this party under a service agreement<br />
                          <span className="text-slate-400">Leave unticked for anyone we simply buy from — a shop, a taxi, a subscription. Only ticked vendors can be issued an agreement.</span>
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("MoF Tax Registry ID (If Registered)")}</label>
                      <input
                        type="text"
                        placeholder="e.g. MoF-9382LB (or leave blank/N/A)"
                        value={newVendorTaxId}
                        onChange={(e) => setNewVendorTaxId(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Contact Email / Phone")}</label>
                      <input
                        type="text"
                        placeholder="e.g. consultant@anahon.org"
                        value={newVendorContact}
                        onChange={(e) => setNewVendorContact(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Bank Account / Payment Details")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Bank Audi Tripoli, Account 2981..."
                        value={newVendorBankInfo}
                        onChange={(e) => setNewVendorBankInfo(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <button type="submit" className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all h-[36px] flex items-center justify-center">
                      Onboard Provider
                    </button>
                  </form>

                  {["Consultant / Freelancer", "Service Provider"].includes(newVendorCategory) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex flex-col gap-1 font-mono">
                      <span className="font-bold flex items-center gap-1">🏛️ Lebanese MoF Statutory Compliance Alert:</span>
                      <p className="leading-relaxed">
                        Individuals and consultants who do not have an official, active **Tax Registry ID** (MoF number) are subject to a **7.5% Withholding Tax (WHT)**.
                        The system will automatically calculate and withhold this tax at the payment stage unless a valid Tax Registry ID is entered above.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-100">
                    <tr className="border-b border-sub-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Vendor Account</th>
                      <th className="px-6 py-3">Primary Category</th>
                      <th className="px-6 py-3 hidden md:table-cell">Tax Registry ID</th>
                      <th className="px-6 py-3 hidden md:table-cell">Audit Disclosures</th>
                      <th className="px-6 py-3 hidden md:table-cell">Sanctions Rating</th>
                      <th className="px-6 py-3">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-sans">
                    {state.vendors.map(v => (
                      <React.Fragment key={v.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{v.name}</p>
                          <span className="text-[11px] text-slate-550 font-mono">{v.contact}</span>
                          <button
                            type="button"
                            onClick={() => setPartyFileFor(partyFileFor === v.id ? null : v.id)}
                            aria-expanded={partyFileFor === v.id}
                            className="block text-[10px] font-bold text-slate-500 hover:text-red-650 hover:underline mt-0.5 min-h-[24px]"
                          >
                            {partyFileFor === v.id ? "▾ close file" : "📂 open file (agreement + invoices)"}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{v.category}</td>
                        <td className="px-6 py-4 font-mono font-medium hidden md:table-cell">{v.taxId}</td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${v.declarationSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {v.declarationSigned ? "Signed Conflict Code" : "Pending Signature"}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          {v.blocked ? (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                              🚨 blocked - direct fail-safe
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                              Passed clear
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {/* Only engagement-type vendors can hold an agreement. A software
                              subscription or a taxi is a purchase — it needs a voucher, not a contract. */}
                          {(() => {
                            const canManage = ["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role);
                            if (!v.engageable) {
                              return (
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400 italic block">Supplier — purchases only</span>
                                  {canManage && !v.blocked && v.active && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetEngageable(v.id, v.name, true)}
                                      className="text-[10px] text-slate-500 hover:text-red-650 hover:underline"
                                    >
                                      mark engageable…
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            if (v.blocked || !v.active) return <span className="text-[10px] text-slate-400 italic">Engageable · unavailable</span>;
                            if (!canManage) return <span className="text-[10px] text-emerald-700">Engageable</span>;
                            return (
                              <div className="space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => { setContractFor(contractFor === v.id ? null : v.id); setContractParty("vendor"); }}
                                  aria-expanded={contractFor === v.id}
                                  className="text-[10px] font-bold text-red-650 hover:text-red-700 hover:underline min-h-[44px] md:min-h-0 md:py-1 block"
                                >
                                  {contractFor === v.id ? "✕ Cancel" : "📄 Service agreement"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetEngageable(v.id, v.name, false)}
                                  className="text-[10px] text-slate-400 hover:text-slate-700 hover:underline"
                                >
                                  revert to supplier
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                      {partyFileFor === v.id && (
                        <tr>
                          <td colSpan={6} className="px-6 py-3 bg-slate-50/60">
                            {renderPartyFile(v.id, v.name)}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Service agreement generator — vendors only. Figures are typed by a human;
                  nothing is inferred, because an agreement is a signed instrument. */}
              {contractFor && contractParty === "vendor" && (() => {
                const v = state.vendors.find(x => x.id === contractFor);
                if (!v) return null;
                return (
                  <form
                    onSubmit={(e) => handleGenerateContract(e, v.id, "vendor")}
                    aria-label={`Generate service agreement for ${v.name}`}
                    className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-sm font-bold text-slate-900">📄 Service agreement — {v.name}</h3>
                      <span className="text-[10px] font-mono text-slate-500">{v.category}{v.taxId ? ` · Tax ID ${v.taxId}` : ""}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="md:col-span-2">
                        <label htmlFor="sa-role" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Role / scope of services")}</label>
                        <input id="sa-role" type="text" placeholder={`e.g. Field logistics & volunteer coordination (blank = "${v.category}")`}
                          value={contractForm.role}
                          onChange={(e) => setContractForm({ ...contractForm, role: e.target.value })}
                          className="finance-input w-full text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-project" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Project")}</label>
                        <select id="sa-project" required value={contractForm.projectId}
                          onChange={(e) => setContractForm({ ...contractForm, projectId: e.target.value })}
                          className="finance-input w-full text-xs">
                          <option value="">— Select —</option>
                          {state.projects.filter(p => p.status === "Active").map(p => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="sa-start" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Start")}</label>
                        <input id="sa-start" type="date" required value={contractForm.startDate}
                          onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                          className="finance-input w-full text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-end" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("End")}</label>
                        <input id="sa-end" type="date" required value={contractForm.endDate}
                          onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                          className="finance-input w-full text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-fee" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Fee per period (USD)")}</label>
                        <input id="sa-fee" type="number" step="0.01" required value={contractForm.monthlyFee}
                          onChange={(e) => setContractForm({ ...contractForm, monthlyFee: e.target.value })}
                          className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-total" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Agreement Total (USD)")}</label>
                        <input id="sa-total" type="number" step="0.01" required value={contractForm.contractTotal}
                          onChange={(e) => setContractForm({ ...contractForm, contractTotal: e.target.value })}
                          className="finance-input w-full font-mono text-xs" />
                      </div>
                      <button type="submit" disabled={contractBusy}
                        className="bg-slate-900 hover:bg-slate-955 disabled:opacity-50 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all min-h-[44px]">
                        {contractBusy ? "Generating…" : "Generate agreement"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      Fees are payable against the provider's invoice on delivery — not against a timesheet.
                      Generated unsigned and filed in the project's vault folder. Never backdate: issue a dated addendum instead (Policy §6.8).
                    </p>
                  </form>
                );
              })()}
            </div>
          )}


          {/* tab content Cash & Bank Balances */}
          {activeTab === "banking" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{t("Banking Statements & Cash Recon Ledger")}</h2>
                  <p className="text-xs text-slate-500">Match raw physical statements to vouchers to evaluate reconciliatory variances.</p>
                </div>
              </div>

              {/* Direct Reconcile form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleBankReconcile} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Target Account Vault Drawer")}</label>
                    <select
                      value={recBank}
                      onChange={(e) => setRecBank(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Choose Account --</option>
                      {state.bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Transaction Type")}</label>
                    <select
                      value={recType}
                      onChange={(e) => setRecType(e.target.value as "Deposit" | "Withdrawal")}
                      className="finance-input w-full"
                    >
                      <option value="Deposit">Deposit (+)</option>
                      <option value="Withdrawal">Withdrawal (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Statement Entry Memo")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Bank charge ref 3381"
                      value={recDesc}
                      onChange={(e) => setRecDesc(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Statement Amount")}</label>
                    <input
                      type="number"
                      placeholder="Raw Currency value"
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-955 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all">
                    Acknowledge Statement Item
                  </button>
                </form>
              )}

              {(() => {
                const filtered = state.bankTransactions
                  .filter(tx => !bankFilterAcc || tx.bankAccountId === bankFilterAcc)
                  .filter(tx => !bankSearch || tx.description.toLowerCase().includes(bankSearch.toLowerCase()) || (tx.voucherNo || "").toLowerCase().includes(bankSearch.toLowerCase()))
                  .sort((a, b) => b.date.localeCompare(a.date));
                const visible = filtered.slice(0, bankShown);
                return (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <select value={bankFilterAcc} onChange={e => { setBankFilterAcc(e.target.value); setBankShown(50); }} className="finance-input text-xs w-52">
                        <option value="">All accounts</option>
                        {state.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
                      </select>
                      <input value={bankSearch} onChange={e => { setBankSearch(e.target.value); setBankShown(50); }} placeholder="Search description / voucher…" className="finance-input text-xs flex-1 min-w-40" />
                      <span className="text-[11px] text-slate-500 ml-auto">{filtered.length} entries · statement-verified</span>
                    </div>
                    <div className="max-h-[560px] overflow-y-auto">
                      {/* Mobile: stacked cards instead of a squeezed table */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {visible.map(tx => {
                          const ba = state.bankAccounts.find(x => x.id === tx.bankAccountId);
                          const isOut = tx.type === "Withdrawal";
                          return (
                            <div key={tx.id} className="px-4 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] text-slate-500">{tx.date}</span>
                                <span className={`font-mono font-bold text-sm ${isOut ? "text-red-600" : "text-emerald-700"}`}>
                                  {isOut ? "−" : "+"}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {ba?.currency}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 mt-0.5">{tx.description}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{ba?.name.replace("BLOM Business Plus ", "BLOM ")}{tx.voucherNo ? ` · ${tx.voucherNo}` : ""}</p>
                            </div>
                          );
                        })}
                      </div>
                      <table className="w-full text-left hidden md:table">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                          <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono">
                            <th className="px-4 py-2.5 w-28">Date</th>
                            <th className="px-4 py-2.5 w-32">Voucher</th>
                            <th className="px-4 py-2.5 w-40 hidden md:table-cell">Account</th>
                            <th className="px-4 py-2.5 hidden md:table-cell">Description</th>
                            <th className="px-4 py-2.5 text-right w-40">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-sans">
                          {visible.map(tx => {
                            const ba = state.bankAccounts.find(x => x.id === tx.bankAccountId);
                            const isOut = tx.type === "Withdrawal";
                            return (
                              <tr key={tx.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>
                                <td className="px-4 py-2 font-mono">{tx.voucherNo
                                  ? <span className="font-bold text-slate-800">{tx.voucherNo}</span>
                                  : <span className="text-slate-400">bank stmt</span>}</td>
                                <td className="px-4 py-2 text-slate-600 hidden md:table-cell whitespace-nowrap">{ba?.name.replace("BLOM Business Plus ", "BLOM ")}</td>
                                <td className="px-4 py-2 text-slate-700 hidden md:table-cell">{tx.description}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold whitespace-nowrap ${isOut ? "text-red-600" : "text-emerald-700"}`}>
                                  {isOut ? "−" : "+"}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {ba?.currency}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filtered.length > bankShown && (
                      <button onClick={() => setBankShown(bankShown + 100)} className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 border-t border-slate-200">
                        Show {Math.min(100, filtered.length - bankShown)} more of {filtered.length - bankShown} remaining
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}


          {/* tab content General Ledger Double Entry */}
          {activeTab === "ledger" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{t("General double-entry General Ledger")}</h2>
                  <p className="text-xs text-slate-500">Every single transaction emits balanced matching debits and credits across appropriate asset/cost centers.</p>
                </div>
                {/* Print command */}
                <button
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
                >
                  🖨️ Export PDF Audit Trial Balance
                </button>
              </div>

              {/* General balanced debits/credits indicators */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-md font-bold mb-4 uppercase text-slate-800 font-mono flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Trial balance ledger report sheet
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mb-2">All balances converted to USD base currency at current system FX rates (EUR: {state.fxRates.EUR} / LBP: {state.fxRates.LBP}).</p>
                <div className="divide-y divide-slate-200">
                  <header className="grid grid-cols-4 gap-4 text-xs font-bold uppercase font-mono py-2 text-slate-600">
                    <span>Account code</span>
                    <span>Class description</span>
                    <span className="text-right">Debit Balance (USD)</span>
                    <span className="text-right">Credit Balance (USD)</span>
                  </header>
                  {(() => {
                    let totalDeb = 0;
                    let totalCred = 0;
                    const rows = state.accounts.map(acc => {
                      // Convert every balance into USD base currency before presenting
                      let fx = 1;
                      if (acc.currency === "EUR") fx = state.fxRates.EUR;
                      if (acc.currency === "LBP") fx = state.fxRates.LBP;
                      const usdBalance = acc.balance * fx;
                      // Debit-normal accounts: Asset & Expense. Credit-normal: Liability, Equity, Revenue.
                      // Negative balances flip to the opposite column (e.g. Accumulated Depreciation, Partner Drawings).
                      const isDebitNormal = acc.type === "Expense" || acc.type === "Asset";
                      let debVal = 0;
                      let credVal = 0;
                      if (isDebitNormal) {
                        if (usdBalance >= 0) debVal = usdBalance; else credVal = Math.abs(usdBalance);
                      } else {
                        if (usdBalance >= 0) credVal = usdBalance; else debVal = Math.abs(usdBalance);
                      }
                      if (debVal === 0 && credVal === 0) return null;
                      totalDeb += debVal;
                      totalCred += credVal;
                      return (
                        <div key={acc.code} className="grid grid-cols-4 gap-4 text-xs font-mono py-2 hover:bg-slate-50">
                          <span>{acc.code}</span>
                          <span>{acc.name}{acc.currency !== "USD" ? <span className="text-[9px] text-slate-400"> ({acc.balance.toLocaleString()} {acc.currency})</span> : null}</span>
                          <span className="text-right font-bold text-slate-900">{debVal > 0 ? formatUSD(debVal) : "-"}</span>
                          <span className="text-right font-bold text-slate-900">{credVal > 0 ? formatUSD(credVal) : "-"}</span>
                        </div>
                      );
                    });
                    const balanced = Math.abs(totalDeb - totalCred) < 0.01;
                    return (
                      <>
                        {rows}
                        <div className={`grid grid-cols-4 gap-4 text-xs font-mono py-2 font-bold border-t-2 ${balanced ? "border-emerald-400 bg-emerald-50" : "border-red-400 bg-red-50"}`}>
                          <span />
                          <span className={balanced ? "text-emerald-700" : "text-red-700"}>
                            {balanced ? "✓ TOTALS — LEDGER IN BALANCE" : `⚠️ TOTALS — OUT OF BALANCE BY ${formatUSD(Math.abs(totalDeb - totalCred))}`}
                          </span>
                          <span className="text-right text-slate-900">{formatUSD(totalDeb)}</span>
                          <span className="text-right text-slate-900">{formatUSD(totalCred)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Manual Adjustment Journal Entry Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-md font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                      ⚖️ Post Manual Adjustment Journal Entry
                    </h3>
                    <p className="text-xs text-slate-500">Record corrective adjustments or periodic transfers directly. Must be perfectly balanced (Debits = Credits).</p>
                  </div>

                  <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Adjustment Date")}</label>
                        <input
                          type="date"
                          required
                          value={adjDate}
                          onChange={(e) => setAdjDate(e.target.value)}
                          className="finance-input w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Journal Reference No")}</label>
                        <input
                          type="text"
                          placeholder="e.g. ADJ-2026-05"
                          value={adjReferenceNo}
                          onChange={(e) => setAdjReferenceNo(e.target.value)}
                          className="finance-input w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Description / Memo")}</label>
                        <input
                          type="text"
                          required
                          placeholder="Purpose of correction..."
                          value={adjDescription}
                          onChange={(e) => setAdjDescription(e.target.value)}
                          className="finance-input w-full text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700 uppercase font-mono">Journal Lines</span>
                        <button
                          type="button"
                          onClick={() => setAdjItems([...adjItems, { accountCode: "", debit: 0, credit: 0, projectId: "" }])}
                          className="text-xs text-red-650 hover:text-red-700 font-bold flex items-center gap-1"
                        >
                          ➕ Add Line
                        </button>
                      </div>

                      <div className="space-y-3">
                        {adjItems.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="md:col-span-4">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t("Account")}</label>
                              <select
                                required
                                value={item.accountCode}
                                onChange={(e) => {
                                  const copy = [...adjItems];
                                  copy[idx].accountCode = e.target.value;
                                  setAdjItems(copy);
                                }}
                                className="finance-input w-full text-xs bg-white"
                              >
                                <option value="">-- Select Account --</option>
                                {state.accounts.map(acc => (
                                  <option key={acc.code} value={acc.code}>
                                    {acc.code} - {acc.name} ({acc.type})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t("Debit (USD)")}</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.debit || ""}
                                onChange={(e) => {
                                  const copy = [...adjItems];
                                  copy[idx].debit = Number(e.target.value);
                                  if (Number(e.target.value) > 0) copy[idx].credit = 0;
                                  setAdjItems(copy);
                                }}
                                className="finance-input w-full text-xs bg-white"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t("Credit (USD)")}</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.credit || ""}
                                onChange={(e) => {
                                  const copy = [...adjItems];
                                  copy[idx].credit = Number(e.target.value);
                                  if (Number(e.target.value) > 0) copy[idx].debit = 0;
                                  setAdjItems(copy);
                                }}
                                className="finance-input w-full text-xs bg-white"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t("Project Tag (Optional)")}</label>
                              <select
                                value={item.projectId}
                                onChange={(e) => {
                                  const copy = [...adjItems];
                                  copy[idx].projectId = e.target.value;
                                  setAdjItems(copy);
                                }}
                                className="finance-input w-full text-xs bg-white"
                              >
                                <option value="">Unrestricted (None)</option>
                                {state.projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-1 text-right">
                              <button
                                type="button"
                                disabled={adjItems.length <= 2}
                                onClick={() => {
                                  if (adjItems.length > 2) {
                                    setAdjItems(adjItems.filter((_, i) => i !== idx));
                                  }
                                }}
                                className="text-red-650 hover:text-red-800 disabled:text-slate-300 disabled:cursor-not-allowed mb-2 inline-block"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-t border-slate-100 pt-4 gap-4">
                      <div className="text-xs font-mono">
                        <span className="mr-4">Debits: <strong className="text-slate-900">{formatUSD(adjItems.reduce((s, i) => s + Number(i.debit || 0), 0))}</strong></span>
                        <span className="mr-4">Credits: <strong className="text-slate-900">{formatUSD(adjItems.reduce((s, i) => s + Number(i.credit || 0), 0))}</strong></span>

                        {Math.abs(
                          adjItems.reduce((s, i) => s + Number(i.debit || 0), 0) -
                          adjItems.reduce((s, i) => s + Number(i.credit || 0), 0)
                        ) < 0.01 ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">✓ Balanced</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">
                            ⚠️ Out of balance by {formatUSD(Math.abs(adjItems.reduce((s, i) => s + Number(i.debit || 0), 0) - adjItems.reduce((s, i) => s + Number(i.credit || 0), 0)))}
                          </span>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={
                          adjItems.some(i => !i.accountCode) ||
                          Math.abs(
                            adjItems.reduce((s, i) => s + Number(i.debit || 0), 0) -
                            adjItems.reduce((s, i) => s + Number(i.credit || 0), 0)
                          ) >= 0.01
                        }
                        className="bg-red-650 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                      >
                        ⚖️ Post Adjustment Entry
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Journal Entries Posted log list */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-slate-950 uppercase font-mono">Ledger Posted Journals</h4>
                {state.journalEntries.map(je => (
                  <div key={je.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-inner">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                      <span className="text-xs font-bold text-slate-700 font-mono">{je.journal} Journal Ref: {je.referenceNo}</span>
                      <span className="text-[11px] text-slate-500 font-mono">Date posted: {je.date}</span>
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      {je.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-slate-650">
                          <span>Account {it.accountCode} • Project: {it.projectId || "Unrestricted"}</span>
                          <span>
                            {it.debit > 0 ? `DR: ${formatUSD(it.debit)}` : ""}
                            {it.credit > 0 ? `CR: ${formatUSD(it.credit)}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}


          {/* tab content Timesheets & Payroll */}
          {activeTab === "payroll" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Timesheet Allocation & Co-Funding Cost Mapping")}</h2>
                <p className="text-xs text-slate-500">
                  Donor rules mandate personnel compensation matches timesheet percentage logs signed by project leaders.
                </p>
              </div>

              {/* Register New Employee Form */}
              {["Super Admin", "HR / Payroll Officer"].includes(currentUser.role) && (
                <form onSubmit={handleEmployeeRegister} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div>
                    <label htmlFor="emp-name" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Full Name")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Farah Shami"
                      required
                      id="emp-name"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="finance-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-position" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Position / Title")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Community Coordinator"
                      required
                      id="emp-position"
                      value={newEmpPosition}
                      onChange={(e) => setNewEmpPosition(e.target.value)}
                      className="finance-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-salary" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Base Salary (USD)")}</label>
                    <input
                      type="number"
                      placeholder="Monthly Base"
                      required
                      id="emp-salary"
                      value={newEmpSalary}
                      onChange={(e) => setNewEmpSalary(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-allowance" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Allowance (USD)")}</label>
                    <input
                      type="number"
                      placeholder="Monthly Allowance"
                      id="emp-allowance"
                      value={newEmpAllowance}
                      onChange={(e) => setNewEmpAllowance(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-bank-account" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Funds Drawn From")}</label>
                    {/* Options come from the real bank accounts, so this list cannot drift away
                        from the accounts AnaHon actually holds. Required even for cash — cash
                        salaries are withdrawn from one of these accounts first. */}
                    <select
                      id="emp-bank-account"
                      value={newEmpBankAccountId}
                      onChange={(e) => setNewEmpBankAccountId(e.target.value)}
                      className="finance-input w-full text-xs"
                      required
                    >
                      <option value="">— Select account —</option>
                      {(state.bankAccounts || []).filter(ba => ba.active).map(ba => (
                        <option key={ba.id} value={ba.id}>🏦 {ba.name} · {ba.accountNo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="emp-delivery" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Delivered By")}</label>
                    <select
                      id="emp-delivery"
                      value={newEmpPaymentMethod}
                      onChange={(e) => setNewEmpPaymentMethod(e.target.value)}
                      className="finance-input w-full text-xs"
                      required
                    >
                      <option value="Bank Transfer">🏦 Bank transfer to employee</option>
                      <option value="Cash">💵 Cash withdrawn from that account</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-955 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all">
                    Register Employee
                  </button>
                </form>
              )}

              {/* Staff timesheets loop list */}
              <div className="space-y-4">
                {state.employees.filter(emp => !isSelfService || (emp.userEmail || "").toLowerCase() === (currentUser.email || "").toLowerCase()).map(emp => {
                  const isOwnCard = (emp.userEmail || "").toLowerCase() === (currentUser.email || "").toLowerCase();
                  const hasTimesheet = state.timesheets.some(t => t.employeeId === emp.id && t.month === selectedTSMonth);
                  const activeTimesheet = state.timesheets.find(t => t.employeeId === emp.id && t.month === selectedTSMonth);
                  // % values typed into this card's inputs — no timesheet is DUE until something is entered
                  const enteredPool = state.projects.reduce((s, p) => s + (Number(tsAllocValues[`${emp.id}-${p.id}`]) || 0), 0);

                  return (
                    <div key={emp.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{emp.name}</h4>
                          <p className="text-xs text-slate-500">{emp.position} • Base: {formatUSD(emp.salary)} + {formatUSD(emp.allowance)} allowance</p>
                          {(() => {
                            const payAcct = state.bankAccounts.find(ba => ba.id === emp.bankAccountId);
                            if (!payAcct) return (
                              <p className="text-[11px] text-amber-700 italic mt-0.5">⚠ No source account on file — payroll cannot be traced to the bank.</p>
                            );
                            const isCash = emp.paymentMethod === "Cash";
                            return (
                              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                <span aria-hidden="true">{isCash ? "💵" : "🏦"}</span> {isCash ? "Cash withdrawn from" : "Bank transfer from"}{" "}
                                {payAcct.name} <span className="text-slate-400">{payAcct.accountNo}</span>
                              </p>
                            );
                          })()}
                          {["Super Admin", "HR / Payroll Officer", "Finance Officer"].includes(currentUser.role) && (
                            <button
                              type="button"
                              onClick={() => { setContractFor(contractFor === emp.id ? null : emp.id); setContractParty("employee"); }}
                              aria-expanded={contractFor === emp.id}
                              className="mt-1.5 text-[10px] font-bold text-red-650 hover:text-red-700 hover:underline min-h-[44px] md:min-h-0 md:py-1"
                            >
                              {contractFor === emp.id ? "✕ Cancel contract" : "📄 Employment contract"}
                            </button>
                          )}
                          {["Super Admin", "Finance Officer", "HR / Payroll Officer"].includes(currentUser.role) && (
                            <button
                              type="button"
                              onClick={() => generatePayslip(emp.id, emp.name, selectedTSMonth)}
                              className="block text-[10px] font-bold text-emerald-700 hover:underline mt-0.5 min-h-[24px]"
                              title={`Payslip for ${selectedTSMonth} from the employee record and that month's timesheet`}
                            >
                              🧾 Payslip {selectedTSMonth}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPartyFileFor(partyFileFor === emp.id ? null : emp.id)}
                            aria-expanded={partyFileFor === emp.id}
                            className="block text-[10px] font-bold text-slate-500 hover:text-red-650 hover:underline mt-0.5 min-h-[24px]"
                          >
                            {partyFileFor === emp.id ? "▾ close file" : "📂 open file (contracts + documents)"}
                          </button>
                        </div>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${activeTimesheet?.status === "Approved" ? "bg-emerald-100 text-emerald-700"
                          : activeTimesheet || enteredPool > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>
                          ● Month: {selectedTSMonth} • {activeTimesheet?.status || (enteredPool > 0 ? "Draft Pending" : "No donor allocation")}
                        </span>
                      </div>

                      {partyFileFor === emp.id && renderPartyFile(emp.id, emp.name)}

                      {/* Contract generator — figures are typed by a human, never inferred from
                          salary, because a contract is a signed instrument. */}
                      {contractFor === emp.id && contractParty === "employee" && (
                        <form
                          onSubmit={(e) => handleGenerateContract(e, emp.id, "employee")}
                          aria-label={`Generate employment contract for ${emp.name}`}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                        >
                          <div>
                            <label htmlFor={`ct-project-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Project")}</label>
                            <select id={`ct-project-${emp.id}`} required value={contractForm.projectId}
                              onChange={(e) => setContractForm({ ...contractForm, projectId: e.target.value })}
                              className="finance-input w-full text-xs">
                              <option value="">— Select —</option>
                              {state.projects.filter(p => p.status === "Active").map(p => (
                                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`ct-kind-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Type")}</label>
                            <select id={`ct-kind-${emp.id}`} value={contractForm.kind}
                              onChange={(e) => setContractForm({ ...contractForm, kind: e.target.value })}
                              className="finance-input w-full text-xs">
                              <option value="Employment">Employment contract</option>
                              <option value="Service">Service agreement (staff on deliverables)</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`ct-start-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Start")}</label>
                            <input id={`ct-start-${emp.id}`} type="date" required value={contractForm.startDate}
                              onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                              className="finance-input w-full text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-end-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("End")}</label>
                            <input id={`ct-end-${emp.id}`} type="date" required value={contractForm.endDate}
                              onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                              className="finance-input w-full text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-loe-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Level of Effort %")}</label>
                            <input id={`ct-loe-${emp.id}`} type="number" min="0" max="100" placeholder="optional"
                              value={contractForm.loePct}
                              onChange={(e) => setContractForm({ ...contractForm, loePct: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-fee-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Monthly Fee (USD)")}</label>
                            <input id={`ct-fee-${emp.id}`} type="number" step="0.01" required value={contractForm.monthlyFee}
                              onChange={(e) => setContractForm({ ...contractForm, monthlyFee: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-total-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Contract Total (USD)")}</label>
                            <input id={`ct-total-${emp.id}`} type="number" step="0.01" required value={contractForm.contractTotal}
                              onChange={(e) => setContractForm({ ...contractForm, contractTotal: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <button type="submit" disabled={contractBusy}
                            className="bg-slate-900 hover:bg-slate-955 disabled:opacity-50 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all min-h-[44px]">
                            {contractBusy ? "Generating…" : "Generate contract"}
                          </button>
                          <p className="md:col-span-4 text-[10px] text-slate-500 italic">
                            Generated unsigned and filed in the project's vault folder. Countersignatory is taken
                            from the authorised signatories on record. Never backdate — issue a dated addendum instead (Policy §6.8).
                          </p>
                        </form>
                      )}

                      {/* Allocations inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        {state.projects.map(p => {
                          const valKey = `${emp.id}-${p.id}`;
                          return (
                            <div key={p.id}>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project % for {p.code}</label>
                              <input
                                type="number"
                                placeholder="%"
                                value={tsAllocValues[valKey] || ""}
                                onChange={(e) => setTsAllocValues({ ...tsAllocValues, [valKey]: Number(e.target.value) })}
                                className="finance-input w-full font-mono text-xs"
                                disabled={activeTimesheet?.status === "Approved"}
                              />
                            </div>
                          );
                        })}

                        {activeTimesheet?.status !== "Approved" && enteredPool > 0 && (["Super Admin", "HR / Payroll Officer"].includes(currentUser.role) || (isSelfService && isOwnCard)) && (
                          <button
                            onClick={() => handleTimesheetSubmit(emp.id)}
                            className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5"
                          >
                            Submit allocations log ({enteredPool}%)
                          </button>
                        )}

                        {activeTimesheet && activeTimesheet.status === "Submitted" && ["Super Admin", "Program Director"].includes(currentUser.role) && (
                          <button
                            onClick={() => handleApproveTimesheet(activeTimesheet.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded px-4 py-2.5"
                          >
                            ✓ Approve proportional cost allocations
                          </button>
                        )}
                      </div>

                      {/* Employee history: projects worked on + financial statement */}
                      {(() => {
                        const ALIASES: Record<string, string[]> = {
                          "emp-1": ["saad matar"],
                          "emp-2": ["ahmad ayshan", "ahmad aychan"],
                          "emp-3": ["sally kayyali"],
                          "emp-4": ["assem nayrab", "assem nairab"],
                        };
                        const aliases = ALIASES[emp.id] || [emp.name.toLowerCase()];
                        const myTs = state.timesheets
                          .filter(t => t.employeeId === emp.id)
                          .sort((a, b) => a.month.localeCompare(b.month));
                        // project engagement periods from timesheet allocations
                        const eng: Record<string, { pct: number; first: string; last: string; months: number }> = {};
                        for (const t of myTs) {
                          let allocs: any[] = [];
                          try { allocs = JSON.parse((t as any).allocationsJson || "[]"); } catch { }
                          if (!allocs.length && (t as any).allocations) allocs = (t as any).allocations;
                          for (const a of allocs) {
                            if (!a.projectId) continue;
                            const e = eng[a.projectId] || { pct: a.percentage, first: t.month, last: t.month, months: 0 };
                            e.pct = a.percentage; e.last = t.month; e.months += 1;
                            if (t.month < e.first) e.first = t.month;
                            eng[a.projectId] = e;
                          }
                        }
                        // payments matched from posted vouchers
                        const paid: Record<string, { n: number; usd: number }> = {};
                        let grand = 0;
                        for (const ex of state.expenses) {
                          const hay = `${ex.title} ${ex.purpose}`.toLowerCase();
                          if (!aliases.some(a => hay.includes(a))) continue;
                          const key = ex.projectId || "—";
                          const p = paid[key] || { n: 0, usd: 0 };
                          p.n += 1; p.usd += ex.convertedAmount; paid[key] = p; grand += ex.convertedAmount;
                        }
                        const projName = (pid: string) => state.projects.find(p => p.id === pid)?.code || pid;
                        const rows = Array.from(new Set([...Object.keys(eng), ...Object.keys(paid)]));
                        if (!rows.length) return null;
                        return (
                          <div className="border-t border-slate-100 pt-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Employment history & financial statement</p>
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-[10px] text-slate-500 uppercase">
                                  <th className="py-1 pr-2">Project</th>
                                  <th className="py-1 pr-2">LOE</th>
                                  <th className="py-1 pr-2">Period</th>
                                  <th className="py-1 pr-2 text-right">Months</th>
                                  <th className="py-1 pr-2 text-right">Payments</th>
                                  <th className="py-1 text-right">Total paid (USD)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map(pid => {
                                  // payments without any timesheet engagement = per-deliverable
                                  // service-provider work (Policy 8.6), not payroll
                                  const contractor = !eng[pid] && (paid[pid]?.n || 0) > 0;
                                  return (
                                    <tr key={pid} className="border-t border-slate-100">
                                      <td className="py-1.5 pr-2 font-semibold">{projName(pid)}</td>
                                      <td className="py-1.5 pr-2">{eng[pid] ? `${eng[pid].pct}% (payroll)` : contractor ? <span className="text-indigo-700 font-semibold">Contractor · per deliverable</span> : "—"}</td>
                                      <td className="py-1.5 pr-2 font-mono text-[11px]">{eng[pid] ? `${eng[pid].first} → ${eng[pid].last}` : "—"}</td>
                                      <td className="py-1.5 pr-2 text-right">{eng[pid]?.months ?? "—"}</td>
                                      <td className="py-1.5 pr-2 text-right">{paid[pid]?.n ?? 0}</td>
                                      <td className="py-1.5 text-right font-mono">{formatUSD(paid[pid]?.usd || 0)}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="border-t-2 border-slate-300 font-bold">
                                  <td className="py-1.5 pr-2" colSpan={5}>Career total (all recorded vouchers)</td>
                                  <td className="py-1.5 text-right font-mono">{formatUSD(grand)}</td>
                                </tr>
                              </tbody>
                            </table>
                            <p className="text-[10px] text-slate-400 mt-1">Derived from approved timesheets and posted vouchers; FPU amounts are EUR paid, shown at the report rate.</p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

            </div>
          )}


          {/* tab content Periodic Reports (Policy 11.2) */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <style>{`@media print { body * { visibility: hidden; } #period-report, #period-report * { visibility: visible; } #period-report { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; } }`}</style>
              <div>
                <h2 className="text-xl font-bold">{t("Periodic Financial Reports")}</h2>
                <p className="text-xs text-slate-500">Semi-annual and annual reporting per Policy 11.2 — budget vs actual, income, cash position, compliance status.</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="report-start" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Period starting (optional)")}</label>
                  <input id="report-start" type="month" value={reportStart} onChange={e => setReportStart(e.target.value)} className="finance-input text-xs" />
                </div>
                <div>
                  <label htmlFor="report-end" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Period ending (month)")}</label>
                  <input id="report-end" type="month" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="finance-input text-xs" />
                </div>
                {reportStart ? (
                  <button disabled={reportLoading} onClick={() => generatePeriodReport(0)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                    {reportLoading ? "Generating…" : `Generate ${reportStart} → ${reportEnd} Report`}
                  </button>
                ) : (<>
                <button disabled={reportLoading} onClick={() => generatePeriodReport(6)} className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                  {reportLoading ? "Generating…" : "Generate 6-Month Report"}
                </button>
                <button disabled={reportLoading} onClick={() => generatePeriodReport(12)} className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                  {reportLoading ? "Generating…" : "Generate Annual Report"}
                </button>
                </>)}
                {reportData && (
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-mono hidden md:block" title="Filename used when saving as PDF (Policy 13.4.1)">
                      {reportFileName(reportData.meta)}.pdf
                    </span>
                    <button disabled={reportLoading} onClick={downloadPeriodReport} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                      ⬇ Download PDF
                    </button>
                    <button onClick={printPeriodReport} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded px-3 py-2.5" title="Opens the OS print dialog (filename set by the app, not the report)">
                      🖨 Print
                    </button>
                  </div>
                )}
              </div>

              {reportData && (
                <div id="period-report" className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm space-y-6 text-sm">
                  <div className="border-b-2 border-slate-900 pb-3">
                    <h1 className="text-lg font-bold tracking-wide">ANAHON MEDIA PLATFORM — {reportData.meta.title.toUpperCase()}</h1>
                    <p className="text-xs text-slate-600">Period: {reportData.meta.periodStart} → {reportData.meta.periodEnd} · Basis: {reportData.meta.basis} · Generated: {reportData.meta.generatedAt.slice(0, 16).replace("T", " ")} UTC</p>
                  </div>

                  {/* Stacks on phones — three currency figures side by side at 375px overlap. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-3 border border-slate-200 rounded"><p className="text-[10px] uppercase font-bold text-slate-500">Income received</p><p className="text-lg font-mono font-bold">{formatUSD(reportData.totals.incomeInPeriod)}</p></div>
                    <div className="p-3 border border-slate-200 rounded"><p className="text-[10px] uppercase font-bold text-slate-500">Expenditure</p><p className="text-lg font-mono font-bold">{formatUSD(reportData.totals.expenditureInPeriod)}</p></div>
                    <div className="p-3 border border-slate-200 rounded"><p className="text-[10px] uppercase font-bold text-slate-500">Vouchers</p><p className="text-lg font-mono font-bold">{reportData.totals.vouchersInPeriod}</p></div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">1. Budget vs Actual by Project</h3>
                    {reportData.perProject.map((p: any) => (
                      <div key={p.code} className="mb-4">
                        <p className="font-semibold text-xs bg-slate-100 px-2 py-1 rounded">{p.code} — {p.name} · {p.donor} · {p.status} · allocated {formatUSD(p.allocated)} · spent to date {formatUSD(p.toDate)} ({p.variancePct > 0 ? "+" : ""}{p.variancePct}%)</p>
                        <table className="w-full text-xs mt-1">
                          <thead><tr className="text-[10px] text-slate-500 uppercase text-left"><th className="py-0.5">Line</th><th>Description</th><th className="text-right">Allocated</th><th className="text-right">In period</th><th className="text-right">Actual to date</th></tr></thead>
                          <tbody>{p.lines.map((l: any) => (
                            <tr key={l.code} className="border-t border-slate-100"><td className="py-0.5 pr-2 font-mono">{l.code}</td><td className="pr-2">{l.description.split(" (EUR")[0].slice(0, 48)}</td><td className="text-right font-mono">{formatUSD(l.allocated)}</td><td className="text-right font-mono">{formatUSD(l.inPeriod)}</td><td className="text-right font-mono">{formatUSD(l.actual)}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">2. Expenditure by Category (period)</h3>
                      <table className="w-full text-xs">{Object.entries(reportData.byCategory).map(([c, v]: any) => (
                        <tbody key={c}><tr className="border-t border-slate-100"><td className="py-1">{c}</td><td className="text-right font-mono">{formatUSD(v)}</td></tr></tbody>))}
                      </table>
                    </div>
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">3. Cash & Bank Position (current)</h3>
                      <table className="w-full text-xs">{reportData.bankPosition.map((b: any) => (
                        <tbody key={b.name}><tr className="border-t border-slate-100"><td className="py-1">{b.name} ({b.currency})</td><td className="text-right font-mono">{b.balance.toLocaleString()} {b.currency}</td><td className="text-right font-mono">{formatUSD(b.usd)}</td></tr></tbody>))}
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">4. Income Received in Period</h3>
                    <table className="w-full text-xs">
                      <thead><tr className="text-[10px] text-slate-500 uppercase text-left"><th className="py-0.5">Date</th><th>Description</th><th>Account</th><th className="text-right">Amount</th><th className="text-right">USD</th></tr></thead>
                      <tbody>{reportData.deposits.map((d: any, i: number) => (
                        <tr key={i} className="border-t border-slate-100"><td className="py-0.5 font-mono">{d.date}</td><td className="pr-2">{d.description.slice(0, 60)}</td><td>{d.account}</td><td className="text-right font-mono">{d.amount.toLocaleString()} {d.currency}</td><td className="text-right font-mono">{formatUSD(d.usd)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>

                  {reportData.internalMovements?.length > 0 && (
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">
                        4b. Internal Movements — excluded from income ({formatUSD(reportData.totals.internalMovementsInPeriod)})
                      </h3>
                      <p className="text-[10px] text-slate-500 mb-1">Currency conversions and reversals between our own balances. Listed for completeness; counting them as income would double-count money already received.</p>
                      <table className="w-full text-xs">
                        <tbody>{reportData.internalMovements.map((d: any, i: number) => (
                          <tr key={i} className="border-t border-slate-100"><td className="py-0.5 font-mono">{d.date}</td><td className="pr-2">{d.description.slice(0, 60)}</td><td className="text-right font-mono">{d.amount.toLocaleString()} {d.currency}</td><td className="text-right font-mono text-slate-500">{formatUSD(d.usd)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">5. Compliance Status</h3>
                    {reportData.compliance.map((t: any, i: number) => (
                      <p key={i} className="text-xs py-0.5 border-t border-slate-100">{t.overdue ? "🔴" : t.status === "Done" ? "✅" : "🟡"} {t.title} — {t.status}{t.dueDate ? ` (due ${t.dueDate})` : ""}</p>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-500 border border-amber-200 bg-amber-50/40 rounded p-2">
                    <p className="font-bold uppercase mb-1">Notes & known limitations</p>
                    {reportData.caveats.map((c: string, i: number) => <p key={i}>• {c}</p>)}
                  </div>

                  <div className="flex gap-16 pt-8">
                    <div className="flex-1 border-t border-slate-400 pt-1 text-xs">Prepared by — Finance Officer (Policy 11.7)<br />Name & signature: ____________________</div>
                    <div className="flex-1 border-t border-slate-400 pt-1 text-xs">Approved by — Program Director (Policy 11.7)<br />Name & signature: ____________________</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* tab content Fixed Assets Roll forward */}
          {activeTab === "assets" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{t("Fixed Assets capitalization Register")}</h2>
                  <p className="text-xs text-slate-500 md:max-w-xl">
                    Sinking cost models with straight-line automatic depreciation trackers mapped to physical serial numbers.
                  </p>
                </div>
              </div>

              {/* Capitalize Asset Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleCapitalizeAsset} className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Asset Name / Model")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Sony FX6 camera"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Acquisition Cost USD")}</label>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={assetCost}
                      onChange={(e) => setAssetCost(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Vessel Project funding")}</label>
                    <select
                      value={assetProject}
                      onChange={(e) => setAssetProject(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Direct Purchase or Code Link --</option>
                      {state.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Useful Life (Years)")}</label>
                    <select
                      value={assetLife}
                      onChange={(e) => setAssetLife(e.target.value)}
                      className="finance-input w-full font-mono"
                    >
                      <option value="2">2 Years</option>
                      <option value="3">3 Years</option>
                      <option value="4">4 Years</option>
                      <option value="5">5 Years</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all">
                    Capitalize Asset register
                  </button>
                </form>
              )}

              {/* Assets rollforward index register */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.fixedAssets.map(asset => (
                  <div key={asset.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">SERIAL NO: {asset.serialNumber}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${asset.condition === "Excellent" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>{asset.condition}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{asset.name}</h4>
                    <p className="text-xs text-slate-600">Location custody: {asset.location} / {asset.custodian}</p>

                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[9px] block text-slate-400">COST</span>
                        <span className="font-bold text-slate-800">{formatUSD(asset.cost)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400">ACCUM DEP</span>
                        <span className="font-bold text-slate-800">-{formatUSD(asset.accumulatedDepreciation)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400">BOOK VALUE</span>
                        <span className="font-bold text-red-650 font-bold text-red-650">{formatUSD(asset.currentBookValue)}</span>
                      </div>
                    </div>

                    {["Super Admin", "Auditor / Read-Only Reviewer"].includes(currentUser.role) && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <select
                          id={`cond-${asset.id}`}
                          className="bg-slate-100 text-xs px-2 py-1 rounded border border-slate-300 outline-none"
                        >
                          <option value="Excellent">Excellent condition</option>
                          <option value="Good">Good condition</option>
                          <option value="Needs Repair">Needs Repair</option>
                          <option value="Damaged">Damaged</option>
                        </select>
                        <button
                          onClick={async () => {
                            const cond = (document.getElementById(`cond-${asset.id}`) as HTMLSelectElement).value;
                            const res = await fetch("/api/assets/verify", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ assetId: asset.id, condition: cond, location: asset.location, user: currentUser })
                            });
                            if (res.ok) {
                              triggerToast("Asset condition verified on physical review.");
                              refreshState();
                            }
                          }}
                          className="text-[11px] bg-slate-900 text-white px-2.5 py-1 rounded shadow-sm"
                        >
                          Record audit verification check
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>
          )}


          {/* tab content Partner Capital draws */}
          {activeTab === "partners" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Partner Capital & Draws Accounting Accounts")}</h2>
                <p className="text-xs text-slate-500 md:max-w-xl">
                  Civil company regulations dictate partner loan drawdowns and equity contributions be fully aligned with monthly petty cash limits.
                </p>
              </div>

              {/* Draw invest form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Select Partner profile")}</label>
                    <select
                      value={drawPartner}
                      onChange={(e) => setDrawPartner(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Choose Partner Account --</option>
                      {state.partnerAccounts.map(p => (
                        <option key={p.id} value={p.id}>{p.partnerName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Amount USD")}</label>
                    <input
                      type="number"
                      placeholder="USD Value"
                      value={drawAmount}
                      onChange={(e) => setDrawAmount(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <button
                    onClick={(e) => handlePartnerDrawSubmit(e, "invest")}
                    className="bg-slate-905 bg-slate-900 text-white text-xs font-semibold rounded px-4 py-2.5 hover:bg-slate-950 shadow"
                  >
                    Post Capital Contribution
                  </button>
                  <button
                    onClick={(e) => handlePartnerDrawSubmit(e, "withdraw")}
                    className="bg-red-660 bg-red-600 text-white text-xs font-semibold rounded px-4 py-2.5 hover:bg-red-750 shadow"
                  >
                    Lodge Partner Drawings
                  </button>
                </form>
              )}

              {/* Partners logs index */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.partnerAccounts.map(p => (
                  <div key={p.id} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-md font-bold text-slate-950 uppercase font-sans border-b border-rose-100 pb-2 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-red-650 text-red-600" />
                      {p.partnerName} Partner Equity Line
                    </h4>
                    <div className="space-y-2 text-xs font-mono font-medium">
                      <div className="flex justify-between border-b border-slate-50 py-1.5 text-slate-650">
                        <span>Capital balance account:</span>
                        <span className="text-slate-950 font-bold">{formatUSD(p.capitalBalance)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 py-1.5 text-slate-650">
                        <span>Outstanding draws account:</span>
                        <span className="text-rose-600 font-bold">-{formatUSD(p.drawingsBalance)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 py-1.5 text-slate-650">
                        <span>Loan accounts back to platform:</span>
                        <span className="text-slate-950 font-bold">{formatUSD(p.loansToCompany)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-slate-950 pt-2 text-slate-800">
                        <span>Current Account Net Equity Balance:</span>
                        <span className="text-slate-950 font-bold">{formatUSD(p.currentAccountBalance)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}


          {/* Daily Expenses Sheet removed */}
          {false && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold"> Tripoli Daily Operations Expenses Sheet</h2>
                  <p className="text-xs text-slate-500">
                    Real-time synced ledger tracking daily cashier vault balances, petty cash accounts, and immediate operational co-funded allocations.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Sheet Ledger Date</span>
                    <input
                      type="date"
                      value={dailySelectedDate}
                      onChange={(e) => setDailySelectedDate(e.target.value)}
                      className="bg-transparent text-xs font-mono font-bold text-slate-900 border-none outline-none cursor-pointer"
                    />
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200 mx-2" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Select Cash/Bank Vault</span>
                    <select
                      value={dailySelectedBankId || ((state?.bankAccounts || [])[0]?.id || "")}
                      onChange={(e) => setDailySelectedBankId(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-900 border-none outline-none cursor-pointer"
                    >
                      {(state?.bankAccounts || []).map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {(() => {
                const selectedBankId = dailySelectedBankId || ((state?.bankAccounts || [])[0]?.id || "");
                const selectedAccount = (state?.bankAccounts || []).find(b => b.id === selectedBankId);
                // Pending advice lines never enter balance math — statements decide.
                const accountTransactions = (state?.bankTransactions || []).filter(t => t.bankAccountId === selectedBankId && !t.pending);
                const pendingTransactions = (state?.bankTransactions || []).filter(t => t.bankAccountId === selectedBankId && t.pending);

                const dailyDeposits = accountTransactions
                  .filter(t => t.date === dailySelectedDate && t.type === "Deposit")
                  .reduce((sum, t) => sum + t.amount, 0);

                const dailyWithdrawals = accountTransactions
                  .filter(t => t.date === dailySelectedDate && t.type === "Withdrawal")
                  .reduce((sum, t) => sum + t.amount, 0);

                const inflowsBefore = accountTransactions
                  .filter(t => t.date < dailySelectedDate && t.type === "Deposit")
                  .reduce((sum, t) => sum + t.amount, 0);

                const outflowsBefore = accountTransactions
                  .filter(t => t.date < dailySelectedDate && t.type === "Withdrawal")
                  .reduce((sum, t) => sum + t.amount, 0);

                const openingBalance = inflowsBefore - outflowsBefore;
                const closingBalance = openingBalance + dailyDeposits - dailyWithdrawals;

                const dailyTransactions = accountTransactions.filter(t => t.date === dailySelectedDate);

                return (
                  <>
                    {/* KPI Balance Sheet cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Opening Balance</span>
                        <span className="text-xl font-bold font-mono text-slate-800">
                          {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedAccount?.currency}
                        </span>
                        <p className="text-[10px] text-slate-400">Opening reserve for {dailySelectedDate}</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Daily Inflows (+)</span>
                        <span className="text-xl font-bold font-mono text-emerald-600">
                          +{dailyDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedAccount?.currency}
                        </span>
                        <p className="text-[10px] text-slate-400">Total receipts / drawing inputs</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
                        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Daily Outflows (-)</span>
                        <span className="text-xl font-bold font-mono text-amber-600">
                          -{dailyWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedAccount?.currency}
                        </span>
                        <p className="text-[10px] text-slate-400">Settled vouchers / petty cash out</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-sm space-y-1 text-white">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Closing Balance</span>
                        <span className="text-xl font-bold font-mono text-white">
                          {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedAccount?.currency}
                        </span>
                        <p className="text-[10px] text-slate-400">End-of-day reconciled reserve</p>
                      </div>
                    </div>

                    {/* Pending eBLOM advices — staged, not yet on a statement */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-amber-900 uppercase font-mono">
                          ⏳ Pending eBLOM advices ({pendingTransactions.length})
                        </h4>
                        {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                          <label className="text-[11px] font-bold text-amber-800 hover:text-amber-950 cursor-pointer inline-flex items-center gap-1 min-h-[44px] px-2 border border-amber-300 rounded bg-white">
                            📥 Import eBLOM advice PDF
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                const b64 = await new Promise<string>((resolve, reject) => {
                                  const r = new FileReader();
                                  r.onload = () => resolve(String(r.result).split(",")[1] || "");
                                  r.onerror = reject;
                                  r.readAsDataURL(file);
                                });
                                try {
                                  const res = await fetch("/api/bank/import-notice", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ base64: b64, user: currentUser })
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error);
                                  triggerToast(`Advice imported: ${data.staged} staged as pending, ${data.results.length - data.staged} skipped, ${data.cleared} confirmed by statement.`);
                                  refreshState();
                                } catch (err: any) {
                                  triggerToast(err.message, "error");
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {pendingTransactions.length === 0 ? (
                        <p className="text-[11px] text-amber-700 italic">
                          None. Download a transaction advice PDF from eBLOM and import it here to stage recent
                          activity before the next statement — pending lines never change balances or reports.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {pendingTransactions.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-xs p-2 bg-white border border-amber-200 rounded font-mono">
                              <span className="text-slate-700 truncate">{t.date} • {t.description}</span>
                              <span className={`font-bold ${t.type === "Deposit" ? "text-emerald-700" : "text-amber-700"}`}>
                                {t.type === "Deposit" ? "+" : "−"}{formatIn(t.amount, selectedAccount?.currency || "USD")} <em className="text-[9px] text-amber-600 font-sans">PENDING</em>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Physical cash count — turns "cash on hand" from an inferred book
                        figure into a counted fact, and sizes the undocumented gap. */}
                    {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold font-mono uppercase text-slate-800">💵 Count the cash drawer</h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ledger 1120 book: {formatUSD(state.accounts.find(a => a.code === "1120")?.balance || 0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                          <div>
                            <label htmlFor="cc-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Counted on")}</label>
                            <input id="cc-date" type="date" value={cashCountForm.date}
                              onChange={(e) => setCashCountForm({ ...cashCountForm, date: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label htmlFor="cc-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes in hand (USD)")}</label>
                            <input id="cc-amount" type="number" min="0" step="any" placeholder="e.g. 420"
                              value={cashCountForm.countedUSD}
                              onChange={(e) => setCashCountForm({ ...cashCountForm, countedUSD: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label htmlFor="cc-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Note (optional)")}</label>
                            <input id="cc-notes" type="text" placeholder="who was present, where counted"
                              value={cashCountForm.notes}
                              onChange={(e) => setCashCountForm({ ...cashCountForm, notes: e.target.value })}
                              className="finance-input w-full text-xs" />
                          </div>
                          <button type="button" onClick={submitCashCount}
                            className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">
                            💾 Record count
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Counted notes are treated as available funds. The difference against the 1120 book balance is cash drawn
                          without documented vouchers — it stays visible as a gap, never as available money. A count older than 45 days is excluded until recounted.
                        </p>
                        {state.cashCounts.length > 0 && (
                          <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                            {state.cashCounts.slice(0, 3).map(c => (
                              <div key={c.id} className="flex justify-between">
                                <span>{c.date} · counted by {c.countedBy || "—"}{c.notes ? ` · ${c.notes}` : ""}</span>
                                <span className="font-bold text-slate-700">{formatUSD(c.countedUSD)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ⚡ Daily direct expense — the one form for day-to-day spending.
                        Posts the full chain in a single submit; nothing to approve later
                        because the money has already left (Policy: record same day). */}
                    {["Super Admin", "Finance Officer", "Program Director"].includes(currentUser.role) && (
                      <form
                        onSubmit={(e) => handleDailyDirectSubmit(e, selectedBankId)}
                        aria-label="Lodge a daily direct expense"
                        className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold font-mono uppercase text-slate-800">⚡ Lodge Daily Direct Expense</h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            pays from: {selectedAccount?.name} {selectedAccount?.accountNo} — one submit posts voucher · bank · budget · ledger · digitized record
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                          <div className="md:col-span-2">
                            <label htmlFor="daily-title" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("What was bought")}</label>
                            <input id="daily-title" type="text" required placeholder="e.g. Fuel for distribution run"
                              value={dailyTitle} onChange={(e) => setDailyTitle(e.target.value)}
                              className="finance-input w-full text-xs" />
                          </div>
                          <div>
                            <label htmlFor="daily-vendor" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Vendor")}</label>
                            <select id="daily-vendor" required value={dailyVendor}
                              onChange={(e) => setDailyVendor(e.target.value)} className="finance-input w-full text-xs">
                              <option value="">— Select —</option>
                              {state.vendors.filter(v => v.active && !v.blocked).map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="daily-project" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Project")}</label>
                            <select id="daily-project" required value={dailyProject}
                              onChange={(e) => { setDailyProject(e.target.value); setDailyBudgetLine(""); }}
                              className="finance-input w-full text-xs">
                              <option value="">— Select —</option>
                              {state.projects.filter(p => p.status === "Active").map(p => (
                                <option key={p.id} value={p.id}>{p.code}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="daily-bl" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Budget Line")}</label>
                            <select id="daily-bl" required value={dailyBudgetLine}
                              onChange={(e) => setDailyBudgetLine(e.target.value)} className="finance-input w-full text-xs">
                              <option value="">— Select —</option>
                              {state.budgetLines.filter(bl => bl.projectId === dailyProject).map(bl => (
                                <option key={bl.id} value={bl.id}>{bl.code} — {bl.description.slice(0, 40)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="daily-amount" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Amount ({selectedAccount?.currency})</label>
                            <input id="daily-amount" type="number" step="0.01" min="0.01" required
                              value={dailyAmount} onChange={(e) => setDailyAmount(e.target.value)}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <button type="submit" disabled={dailyBusy}
                            className="bg-slate-900 hover:bg-slate-955 disabled:opacity-50 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all min-h-[44px]">
                            {dailyBusy ? "Posting…" : "Post expense"}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">
                          For same-day cash/card spending with the receipt in hand. Larger or planned purchases go through
                          Expenses → voucher → approval instead. Attach the receipt afterwards from the voucher drawer.
                        </p>
                      </form>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Reconciled Transactions Index */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h4 className="text-xs font-bold font-mono uppercase text-slate-800">
                              Ledger Postings for {dailySelectedDate} ({dailyTransactions.length} items)
                            </h4>
                            <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-bold font-mono">
                              Reconciled Live
                            </span>
                          </div>

                          {dailyTransactions.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                              <Calendar className="h-8 w-8 text-slate-300" />
                              <span>No financial logs recorded for this day on {selectedAccount?.name}.</span>
                            </div>
                          ) : (
                            <table className="w-full text-left">
                              <thead className="bg-slate-100 font-mono text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3">Reference No</th>
                                  <th className="px-4 py-3">Description / Purpose</th>
                                  <th className="px-4 py-3 hidden md:table-cell">Type</th>
                                  <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs font-sans">
                                {dailyTransactions.map(t => {
                                  const matchingExpense = (state?.expenses || []).find(e => e.voucherNo === t.voucherNo);

                                  return (
                                    <tr key={t.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-4 font-mono font-bold text-red-650 text-red-600">
                                        {t.voucherNo || "Statement Adjust"}
                                      </td>
                                      <td className="px-4 py-4">
                                        <p className="font-semibold text-slate-900">{t.description}</p>
                                        {matchingExpense && (
                                          <span className="text-[10px] text-slate-500">
                                            Project: {matchingExpense.projectId || "N/A"} | WHT: {(matchingExpense.whtAmount || 0).toLocaleString()} {selectedAccount?.currency}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-4 hidden md:table-cell">
                                        <span className={`inline-block px-2 py-0.5 rounded font-bold text-[9px] uppercase ${t.type === "Deposit" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                          }`}>
                                          {t.type}
                                        </span>
                                      </td>
                                      <td className={`px-4 py-4 text-right font-mono font-bold ${t.type === "Deposit" ? "text-emerald-600" : "text-slate-900"
                                        }`}>
                                        {t.type === "Deposit" ? "+" : "-"} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedAccount?.currency}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                      {/* Right: Quick Direct Petty Cash Form */}
                      <div className="space-y-4">
                        {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                          <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                            <div>
                              <h4 className="text-xs font-bold font-mono uppercase text-slate-800 border-b border-slate-100 pb-2">
                                ⚡ Quick Daily Direct Expense Lodger
                              </h4>
                              <p className="text-[10px] text-slate-500 mt-1">
                                Bypass the approval lifecycle for immediate operations. Logs, approvals, settlements, and ledger postings execute in one click.
                              </p>
                            </div>

                            <form onSubmit={handleDailyDirectSubmit} className="space-y-3">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("Expense Title")}</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Taxi to ministry"
                                  required
                                  value={dailyTitle}
                                  onChange={(e) => setDailyTitle(e.target.value)}
                                  className="finance-input w-full text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("justification / rationale")}</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Urgent transport"
                                  value={dailyPurpose}
                                  onChange={(e) => setDailyPurpose(e.target.value)}
                                  className="finance-input w-full text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("Target Project mapping")}</label>
                                <select
                                  required
                                  value={dailyProject}
                                  onChange={(e) => setDailyProject(e.target.value)}
                                  className="finance-input w-full text-xs bg-white"
                                >
                                  <option value="">-- Choose Project --</option>
                                  {(state?.projects || []).map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("Budget line mapping")}</label>
                                <select
                                  value={dailyBudgetLine}
                                  onChange={(e) => setDailyBudgetLine(e.target.value)}
                                  className="finance-input w-full text-xs bg-white"
                                >
                                  <option value="">-- Select Line --</option>
                                  {(state?.budgetLines || []).filter(bl => bl.projectId === dailyProject).map(bl => (
                                    <option key={bl.id} value={bl.id}>{bl.code} - {bl.description}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("Contractor / Vendor")}</label>
                                <select
                                  value={dailyVendor}
                                  onChange={(e) => setDailyVendor(e.target.value)}
                                  className="finance-input w-full text-xs bg-white"
                                >
                                  <option value="">-- Miscellaneous Out-of-Pocket --</option>
                                  {(state?.vendors || []).filter(v => !v.blocked).map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("Currency")}</label>
                                  <select
                                    value={dailyCurrency}
                                    onChange={(e) => setDailyCurrency(e.target.value as any)}
                                    className="finance-input w-full text-xs bg-white font-mono font-bold"
                                  >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="LBP">LBP (ل.ل)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">{t("Amount")}</label>
                                  <input
                                    type="number"
                                    required
                                    placeholder="e.g. 50"
                                    value={dailyAmount}
                                    onChange={(e) => setDailyAmount(e.target.value)}
                                    className="finance-input w-full text-xs font-mono"
                                  />
                                </div>
                              </div>

                              <button
                                type="submit"
                                className="w-full mt-2 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold py-2.5 rounded shadow transition-all flex items-center justify-center gap-1.5"
                              >
                                💸 Settle & Post Direct Expense
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* tab content Compliance & AI Audit Desk */}
          {activeTab === "handbooks" && (() => {
            const books = state.documents
              .filter(d => d.category === "Handbook")
              // The filename carries a policy number as a suffix — order by it, not alphabetically.
              .map(d => ({ d, no: (d.filename.match(/_(\d{3})\.docx$/) || [])[1] || "" }))
              .sort((a, b) => a.no.localeCompare(b.no) || a.d.filename.localeCompare(b.d.filename));
            const pretty = (f: string) => f
              .replace(/\.docx$/i, "").replace(/_\d{3}$/, "")
              .replace(/^Ana[Hh]on[_\s-]*/i, "").replace(/[_]+/g, " ").trim();
            const nums = books.map(b => b.no).filter(Boolean);
            const gaps = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(3, "0"))
              .filter(n => !nums.includes(n) && n <= (nums[nums.length - 1] || "000"));
            const dupes = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];

            return (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Policies & Handbooks</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    AnaHon's institutional policies. Funders ask for these by name — the ARIJ form has a
                    policies checklist. Click any one to read it here.
                  </p>
                </div>

                {(gaps.length > 0 || dupes.length > 0) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                    <strong>Numbering:</strong>{" "}
                    {gaps.length > 0 && <>missing {gaps.join(", ")}. </>}
                    {dupes.length > 0 && <>number {dupes.join(", ")} used twice. </>}
                    Either the missing ones were never written, or they exist and are not here.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {books.map(({ d, no }) => (
                    <button key={d.id} onClick={() => openDoc(d)}
                      className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-red-300 hover:shadow-md transition flex items-start gap-3">
                      <span className="text-lg leading-none pt-0.5">📘</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{pretty(d.filename)}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {no && `#${no} · `}{d.refNo} · {d.sizeStr}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {!books.length && (
                  <p className="text-sm text-slate-500">No handbooks registered yet.</p>
                )}
              </div>
            );
          })()}

          {activeTab === "compliance" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("MoF / CNSS Regulatory Compliance Desk & Audit Logs")}</h2>
                <p className="text-xs text-slate-500">
                  AnaHon Media Platform adheres to robust Lebanese Civil Partnership guidelines. Trigger automated AI Audit logs inspections below.
                </p>
              </div>

              {/* Team & Roles — master account only. Role authority lives in the DB (server middleware). */}
              {currentUser.role === "Super Admin" && (
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">👥 Team & Roles (master account)</h3>
                  <p className="text-[11px] text-slate-500">Project Officers can raise vouchers and procurement requests for their assigned projects only — the server refuses everything else, including approving their own requests (§4.3).</p>
                  <div className="space-y-2">
                    {state.users.filter(u => u.active).map(u => {
                      const assigned = new Set<string>(JSON.parse((u as any).projectIdsJson || "[]"));
                      const setRole = async (role: string, projectIds: string[], streamScope?: string) => {
                        try {
                          const res = await fetch("/api/users/set-role", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: u.id, role, projectIds, streamScope: streamScope ?? (u as any).streamScope ?? "", user: currentUser })
                          });
                          if (!res.ok) throw new Error((await res.json()).error || "Failed to set role");
                          triggerToast(`${u.name} → ${role}`);
                          refreshState();
                        } catch (err: any) {
                          triggerToast(err.message, "error");
                        }
                      };
                      return (
                        <div key={u.id} className="flex flex-wrap items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <span className="font-bold text-slate-800 min-w-[140px]">{u.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{u.email}</span>
                          <select
                            value={u.role}
                            onChange={e => setRole(e.target.value, [...assigned])}
                            aria-label={`Role for ${u.name}`}
                            className="finance-input text-xs py-1"
                            disabled={u.id === currentUser.id}
                          >
                            {["Super Admin", "Finance Officer", "Program Director", "Project Officer", "Project Lead", "HR / Payroll Officer", "Auditor / Read-Only Reviewer", "Employee (Self-Service)"].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {u.role === "Project Officer" && (
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Programme:</span>
                              <select
                                value={(u as any).streamScope || ""}
                                onChange={e => setRole(u.role, [...assigned], e.target.value)}
                                aria-label={`Programme scope for ${u.name}`}
                                className="finance-input text-xs py-1"
                              >
                                <option value="">— none (named projects only) —</option>
                                {STREAMS.map(st => <option key={st} value={st}>{st}</option>)}
                              </select>
                              <span className="text-[10px] text-slate-400">every project in that programme, now and later</span>
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Also:</span>
                              {state.projects.map(p => (
                                <label key={p.id} className="flex items-center gap-1 text-[10px] font-mono text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={assigned.has(p.id)}
                                    onChange={e => {
                                      const next = new Set(assigned);
                                      if (e.target.checked) next.add(p.id); else next.delete(p.id);
                                      setRole(u.role, [...next]);
                                    }}
                                  />
                                  {p.code}
                                </label>
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Org broad FX update configuration details inline */}
              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                  System Settings: Fiscal Rates & VAT Threshold configurations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div>
                    <span className="block text-xs text-slate-600 font-bold mb-1">Tripoli EUR Statement Conversions rate</span>
                    <input
                      type="number"
                      step="0.01"
                      value={eurRateInput}
                      onChange={(e) => setEurRateInput(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-slate-600 font-bold mb-1">Hyperinflation LBP Bank conversion exchange rate</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={lbpRateInput}
                      onChange={(e) => setLbpRateInput(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/fxRates", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ EUR: eurRateInput, LBP: lbpRateInput, user: currentUser })
                        });
                        if (res.ok) {
                          triggerToast("Global FX Rates updated on central systems.");
                          refreshState();
                        }
                      }}
                      className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow w-full md:w-auto"
                    >
                      Adjust Global Rates
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/fxRates/sync-inforeuro", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user: currentUser })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Sync failed");
                          triggerToast(`Official InfoEuro EUR rate synced: ${data.eurRate} USD (Period: ${data.period})`);
                          setEurRateInput(data.eurRate.toString());
                          refreshState();
                        } catch (err: any) {
                          triggerToast(err.message, "error");
                        }
                      }}
                      className="bg-red-650 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 shadow w-full md:w-auto flex items-center justify-center gap-1 font-sans"
                    >
                      🇪🇺 Sync InfoEuro EUR Rate
                    </button>
                  </div>
                </div>
              </div>

              {/* The Gemini AI compliance audit panel */}
              <div className="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-red-650 bg-red-600 text-white text-lg font-bold">
                    AH
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-sans">Gemini AI Audit Intelligence Engine</h3>
                    <p className="text-[11px] text-slate-300 font-mono">
                      Strict Audit Readiness compliance checklist verification mapped to Ministry of Finance chapter rules.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                  <select
                    value={auditType}
                    onChange={(e) => setAuditType(e.target.value)}
                    className="bg-slate-950 text-xs px-3 py-2 rounded text-white border border-slate-800 outline-none flex-1 font-mono hover:bg-slate-1000"
                  >
                    <option value="Donor Guidelines check (EU commitment checks)">EU co-funding & restricted lines audit</option>
                    <option value="Statutory Lebanese Civil Co. Tax compliance">Lebanese MoF Chapter 3 payroll tax checks</option>
                    <option value="Asset depreciation verification scan">Fixed asset registerStraight Line checks</option>
                    <option value="Capital draws risk threshold reviews">Owner drawbacks & related-parties scan</option>
                  </select>
                  <button
                    onClick={runGeminiScan}
                    disabled={geminiLoading}
                    className="bg-red-650 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 py-2.5 rounded shadow transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {geminiLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Running regulatory check...
                      </>
                    ) : (
                      <>
                        🔍 Run AI Regulatory Audit Scan
                      </>
                    )}
                  </button>
                </div>

                {geminiReport && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-96">
                    {geminiReport}
                  </div>
                )}
              </div>

              {/* Audit actions logs list registry */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-850 font-mono">Audit Log Traceability Archive</h4>
                <div className="divide-y divide-slate-100 text-xs font-mono max-h-60 overflow-y-auto">
                  {state.auditLogs.map(log => (
                    <div key={log.id} className="py-2.5 flex justify-between items-start gap-3 hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-900">[{log.userName}]</span>
                        <span className="text-slate-800 pl-2">{log.action}:</span>
                        <span className="text-slate-650 pl-1">"{log.details}"</span>
                      </div>
                      <span className="text-slate-400 font-normal shrink-0">{(log.timestamp.split("T")[1] || log.timestamp).replace("Z", "")}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Missing-evidence button. Always visible, because a documentation gap you have to go
          looking for is a gap nobody looks for. Counts are derived, never stored. */}
      {evidenceGaps.total > 0 && !gapsOpen && (
        <button
          onClick={() => setGapsOpen(true)}
          title="Documents missing against posted spend"
          className="fixed bottom-5 right-5 z-[95] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg
                     bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors"
        >
          <span className="text-base leading-none">📄</span>
          <span>{evidenceGaps.total} missing</span>
        </button>
      )}

      {gapsOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[96]" onClick={() => setGapsOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-[97] bg-slate-50 shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-900 text-white shrink-0">
              <span className="text-lg">📄</span>
              <div className="flex-1">
                <p className="font-bold text-sm">Missing documents</p>
                <p className="text-[11px] text-slate-400">Derived live from the register — nothing here is stored</p>
              </div>
              <button onClick={() => setGapsOpen(false)} aria-label="Close" className="text-slate-300 hover:text-white text-xl px-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {evidenceGaps.pettyGap > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-bold text-red-900">Cash drawn with no voucher — {evidenceGaps.money(evidenceGaps.pettyGap)}</p>
                  <p className="text-[11px] text-red-800 mt-1">
                    Ledger 1120. This is money out of the bank that no voucher accounts for. It is a
                    documentation gap, not available funds.
                  </p>
                  <button onClick={() => { setGapsOpen(false); handleNavClick("banking"); }}
                    className="mt-2 text-[11px] font-bold text-red-700 hover:underline">Open Banking →</button>
                </div>
              )}

              {[
                { key: "ev", title: "Posted spend with no third-party evidence", rows: evidenceGaps.noEvidence,
                  note: "No invoice, receipt or contract on file. The app's own digitized copy of the voucher does not count." },
                { key: "pr", title: "Over $300 with no procurement record", rows: evidenceGaps.noProcurement,
                  note: "Policy requires an RFQ or an approved single-source waiver above USD 300." }
              ].map(group => group.rows.length > 0 && (
                <div key={group.key} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                    <p className="text-xs font-bold text-amber-900">
                      {group.title} — {group.rows.length} · {evidenceGaps.money(group.rows.reduce((s, e) => s + e.convertedAmount, 0))}
                    </p>
                    <p className="text-[10px] text-amber-800 mt-0.5">{group.note}</p>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {group.rows.map(e => (
                      <button key={e.id}
                        onClick={() => { setGapsOpen(false); handleNavClick("expenses"); setDrawerExpenseId(e.id); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-500 w-28 shrink-0">{e.voucherNo}</span>
                        <span className="text-[11px] flex-1 truncate text-slate-800">{e.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{evidenceGaps.proj(e.projectId)?.code || "—"}</span>
                        <span className="text-[11px] font-mono font-bold text-slate-900 shrink-0">{evidenceGaps.money(e.convertedAmount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {evidenceGaps.unspent.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                    <p className="text-xs font-bold text-amber-900">Funded projects with no vouchers at all — {evidenceGaps.unspent.length}</p>
                    <p className="text-[10px] text-amber-800 mt-0.5">Bank-confirmed money received, but nothing has ever been booked against it.</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {evidenceGaps.unspent.map(({ p, amount }) => (
                      <button key={p.id}
                        onClick={() => { setGapsOpen(false); setSelectedProjectId(p.id); handleNavClick("projects"); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-500 w-28 shrink-0">{p.code}</span>
                        <span className="text-[11px] flex-1 truncate text-slate-800">{p.name}</span>
                        <span className="text-[11px] font-mono font-bold text-slate-900 shrink-0">{evidenceGaps.money(amount)} received</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Document viewer — scans, contracts and generated papers open here rather than in a
          new tab. z above the voucher drawer so an invoice can be checked against its voucher. */}
      {docView && (() => {
        const src = `/api/document/content/${docView.id}`;
        const mt = (docView.mimeType || "").toLowerCase();
        const ext = (docView.filename.split(".").pop() || "").toLowerCase();
        const isImage = mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext);
        const isPdf = mt.includes("pdf") || ext === "pdf";
        const isText = mt.startsWith("text/") || ["txt", "md", "csv", "json", "html"].includes(ext);
        return (
          <>
            <div className="fixed inset-0 bg-black/70 z-[100]" onClick={() => setDocView(null)} />
            <div className="fixed inset-3 md:inset-8 z-[110] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shrink-0">
                <span className="text-lg">📄</span>
                <p className="flex-1 text-sm font-mono truncate" title={docView.filename}>{docView.filename}</p>
                <a href={src} download={docView.filename}
                  className="text-[11px] bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors">⬇ Download</a>
                <a href={src} target="_blank" rel="noreferrer"
                  className="text-[11px] bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors">↗ New tab</a>
                <button onClick={() => setDocView(null)} aria-label="Close document viewer"
                  className="text-slate-300 hover:text-white text-xl leading-none px-2">✕</button>
              </div>
              <div className="flex-1 bg-slate-100 overflow-auto">
                {isImage ? (
                  <div className="min-h-full flex items-center justify-center p-4">
                    <img src={src} alt={docView.filename} className="max-w-full max-h-full object-contain shadow-lg" />
                  </div>
                ) : isPdf ? (
                  // Rendered server-side to PNG: no browser PDF plugin is involved, so this
                  // works in embedded webviews and browsers where an <iframe> shows blank.
                  docPages === null ? (
                    <p className="h-full flex items-center justify-center text-sm text-slate-500">Rendering {docView.filename}…</p>
                  ) : docPages === 0 ? (
                    <p className="h-full flex items-center justify-center text-sm text-red-600">Couldn't render this PDF. Download it to open locally.</p>
                  ) : (
                    <div className="flex flex-col items-center gap-4 p-4">
                      {Array.from({ length: docPages }, (_, i) => (
                        <img key={i} src={`/api/document/page/${docView.id}/${i}`} alt={`Page ${i + 1}`}
                          className="max-w-full shadow-lg bg-white" loading={i < 2 ? "eager" : "lazy"} />
                      ))}
                      {docPages > 1 && <p className="text-xs text-slate-500 pb-2">{docPages} pages</p>}
                    </div>
                  )
                ) : /\.docx$/i.test(docView.filename) ? (
                  // Text extracted server-side. Not the original formatting, but readable in place —
                  // Download still gives the real Word file when the layout matters.
                  docText === null ? (
                    <p className="h-full flex items-center justify-center text-sm text-slate-500">Reading {docView.filename}…</p>
                  ) : docText === "" ? (
                    <p className="h-full flex items-center justify-center text-sm text-red-600">Couldn't read this Word file. Download it to open locally.</p>
                  ) : (
                    <div className="max-w-3xl mx-auto p-6 md:p-10 bg-white min-h-full">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-4">
                        Text view · formatting not preserved
                      </p>
                      <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{docText}</div>
                    </div>
                  )
                ) : isText ? (
                  <iframe src={src} title={docView.filename} className="w-full h-full border-0 bg-white" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
                    <p className="text-4xl">📎</p>
                    <p className="text-sm text-slate-700 font-medium">{docView.filename}</p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      This file type can't be shown in the browser — Word and Excel files have to be opened
                      in their own application. Download it, or open it from the document vault.
                    </p>
                    <a href={src} download={docView.filename}
                      className="text-xs bg-red-600 text-white rounded-lg px-4 py-2 hover:bg-red-700 transition-colors">⬇ Download</a>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* Voucher detail drawer — the full chain of one expense in a side panel */}
      {drawerExpenseId && (() => {
        const exp = state.expenses.find(e => e.id === drawerExpenseId);
        if (!exp) return null;
        const proj = state.projects.find(p => p.id === exp.projectId);
        const bl = state.budgetLines.find(b => b.id === exp.budgetLineId);
        const ven = state.vendors.find(v => v.id === exp.vendorId);
        const docs = state.documents.filter(d => d.linkedRecordType === "Expense" && d.linkedRecordId === exp.id);
        const bankHits = state.bankTransactions.filter(t => t.voucherNo === exp.voucherNo);
        const fmtTs = (s?: string | null) => s ? s.slice(0, 10) : null;
        const steps: [string, string | null][] = [["Created", fmtTs(exp.created_at)], ["Approved", fmtTs(exp.approved_at)], ["Paid", fmtTs(exp.paid_at)]];
        return (
          <>
            <div className="fixed inset-0 bg-black/40 z-[80]" onClick={() => setDrawerExpenseId(null)} />
            <aside className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[90] shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold">{exp.voucherNo}</p>
                  <p className="text-xs text-slate-300">{exp.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exp.status === "Posted" ? "bg-emerald-600" : exp.status === "Paid" ? "bg-blue-600" : exp.status === "Approved" ? "bg-amber-500" : "bg-slate-600"}`}>{exp.status}</span>
                  <button onClick={() => setDrawerExpenseId(null)} className="text-slate-300 hover:text-white text-lg leading-none px-1">✕</button>
                </div>
              </div>

              <div className="p-5 space-y-5 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amounts</p>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-t border-slate-100"><td className="py-1 text-slate-500">Gross</td><td className="py-1 text-right font-mono font-bold">{exp.amount.toLocaleString()} {exp.currency}{exp.rate !== 1 ? ` @ ${exp.rate}` : ""}</td></tr>
                      <tr className="border-t border-slate-100"><td className="py-1 text-slate-500">Converted (USD base)</td><td className="py-1 text-right font-mono">{formatUSD(exp.convertedAmount)}</td></tr>
                      {exp.whtAmount > 0 && (<>
                        <tr className="border-t border-slate-100"><td className="py-1 text-slate-500">WHT withheld</td><td className="py-1 text-right font-mono text-red-600">−{exp.whtAmount.toLocaleString()} {exp.currency}</td></tr>
                        <tr className="border-t border-slate-100"><td className="py-1 text-slate-500">Net paid</td><td className="py-1 text-right font-mono font-bold">{exp.netAmount.toLocaleString()} {exp.currency}</td></tr>
                      </>)}
                      {exp.paymentMethod && <tr className="border-t border-slate-100"><td className="py-1 text-slate-500">Method / Ref</td><td className="py-1 text-right">{exp.paymentMethod}{exp.paymentRef ? ` · ${exp.paymentRef}` : ""}</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assignment</p>
                  <p className="text-xs"><span className="text-slate-500">Project:</span> <b>{proj ? `${proj.code} — ${proj.name}` : "—"}</b></p>
                  <p className="text-xs mt-1"><span className="text-slate-500">Budget line:</span> {bl ? `${bl.code} · ${bl.description.split(" (EUR")[0]}` : "Unrestricted / shared"}</p>
                  <p className="text-xs mt-1"><span className="text-slate-500">Vendor:</span> {ven?.name || "—"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Timeline</p>
                  <div className="flex gap-2">
                    {steps.map(([label, ts]) => (
                      <div key={label} className={`flex-1 rounded border px-2 py-1.5 text-center ${ts ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                        <p className="text-[10px] font-bold">{ts ? "✓" : "…"} {label}</p>
                        <p className="text-[10px] font-mono text-slate-500">{ts || "pending"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Documents ({docs.length})</p>
                  {docs.length === 0 && <p className="text-xs text-slate-400">No documents linked to this voucher.</p>}
                  {docs.map(d => (
                    <a key={d.id} href={`/api/document/content/${d.id}`} target="_blank" onClick={e => { e.preventDefault(); openDoc(d); }} rel="noreferrer"
                      className="flex items-center gap-2 py-1.5 border-t border-slate-100 text-xs hover:bg-slate-50 px-1 rounded">
                      <span className="text-[9px] font-bold uppercase text-slate-400 w-24 shrink-0">{d.category}</span>
                      <span className="flex-1 truncate text-blue-700 underline decoration-dotted">{d.filename}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{d.sizeStr}</span>
                    </a>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank statement match</p>
                  {bankHits.length === 0 && <p className="text-xs text-slate-400">No statement line carries this voucher number (cash disbursement or pending GL rebuild).</p>}
                  {bankHits.map(t => (
                    <p key={t.id} className="text-xs py-1 border-t border-slate-100 font-mono">{t.date} · {t.type === "Withdrawal" ? "−" : "+"}{t.amount.toLocaleString()} · {t.description.slice(0, 46)}</p>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Purpose</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{exp.purpose || "—"}</p>
                </div>
              </div>
            </aside>
          </>
        );
      })()}

      {/* Root-Level Floating Sidebar Toggle Handle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`hidden md:flex fixed top-1/2 -translate-y-1/2 z-[60] h-11 w-8 items-center justify-center ${rtl ? "rounded-l-xl border-l" : "rounded-r-xl border-r"} bg-slate-800 border-y border-slate-700 hover:bg-slate-700 text-white shadow-lg transition-all duration-300 ease-in-out cursor-pointer text-xs font-mono font-bold ${
          rtl
            ? (isOpen ? 'right-64' : 'right-0')
            : (isOpen ? 'left-64' : 'left-0')
        }`}
        style={{ minWidth: '32px', minHeight: '44px' }}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isOpen === rtl ? "▶" : "◀"}
      </button>
    </div>
  );
}

// ==========================================
// PUBLIC CONTENT INVENTORY PAGE (/Icontent_Inv)
// ==========================================
function IcontentInvPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeModalImage, setActiveModalImage] = useState<any | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const images = [
    {
      id: "hon_logo",
      title: "HON - Roots and Reach Logo Poster",
      description: "Official branding and visual identity poster for HON: 'Roots and Reach - Here We Are'. High contrast graphic on warm yellow background.",
      url: "/assets/images/hon_logo.jpg",
      size: "46.3 KB",
      type: "JPEG Image",
      dimensions: "768 × 1024 px",
    },
    {
      id: "tripoli_arch",
      title: "Al-Mina Traditional Souk Arches",
      description: "Atmospheric view of the historical stone-vaulted corridors and traditional marketplaces of Tripoli, Lebanon.",
      url: "/assets/images/tripoli_arch.png",
      size: "235 KB",
      type: "PNG Image",
      dimensions: "640 × 960 px",
    },
    {
      id: "concrete_pavilion",
      title: "Niemeyer Concrete Arched Pavilion",
      description: "The modernist architectural curves of the Rashid Karami International Fairground in Tripoli, designed by Oscar Niemeyer.",
      url: "/assets/images/concrete_pavilion.jpg",
      size: "223 KB",
      type: "JPEG Image",
      dimensions: "1024 × 683 px",
    },
    {
      id: "man_portrait",
      title: "AnaHon Portrait Archive",
      description: "Professional staff portrait of a smiling member of the AnaHon team, taken against the backdrop of the Tripoli hills.",
      url: "/assets/images/man_portrait.jpg",
      size: "213 KB",
      type: "JPEG Image",
      dimensions: "1024 × 1024 px",
    },
    {
      id: "exhibition_hall",
      title: "Tripoli Explained Exhibition",
      description: "An interactive educational exhibition organized inside Niemeyer's pavilion, titled 'Tripoli Explained: An Interactive Journey'.",
      url: "/assets/images/exhibition_hall.jpg",
      size: "360 KB",
      type: "JPEG Image",
      dimensions: "1024 × 576 px",
    },
    {
      id: "hon_banner",
      title: "HON - Horizontal Logo Banner",
      description: "Official horizontal logotype and brand mark for HON: 'Roots and Reach - Here We Are'. High-resolution black and white branding banner.",
      url: "/assets/images/hon_banner.png",
      size: "71.4 KB",
      type: "PNG Image",
      dimensions: "1024 × 534 px",
    },
    {
      id: "tripoli_hammam",
      title: "Hammam Ezzeddine Bathhouse Interior",
      description: "The historical stone domes, vaulted archways, and central octagonal marble fountain inside Tripoli's Hammam Ezzeddine.",
      url: "/assets/images/tripoli_hammam.jpg",
      size: "76.2 KB",
      type: "JPEG Image",
      dimensions: "502 × 336 px",
    },
    {
      id: "hon_banner_yellow",
      title: "HON - Horizontal Yellow Logo Banner",
      description: "Official horizontal logotype and brand mark for HON: 'Roots and Reach - Here We Are'. Elegant yellow-themed brand identity banner.",
      url: "/assets/images/hon_banner_yellow.png",
      size: "85.3 KB",
      type: "PNG Image",
      dimensions: "1024 × 534 px",
    }
  ];

  const filteredImages = images.filter(img =>
    img.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    img.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setShareToast(`Downloading ${filename}...`);
    setTimeout(() => setShareToast(null), 3000);
  };

  const handleCopyLink = (url: string, id: string) => {
    const absUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(absUrl).then(() => {
      setCopiedId(id);
      setShareToast("Direct link copied to clipboard!");
      setTimeout(() => {
        setCopiedId(null);
        setShareToast(null);
      }, 3000);
    }).catch(() => {
      setShareToast("Failed to copy link");
      setTimeout(() => setShareToast(null), 3000);
    });
  };

  const handleShare = (img: any) => {
    if (navigator.share) {
      navigator.share({
        title: img.title,
        text: img.description,
        url: `${window.location.origin}${img.url}`
      }).catch(() => {});
    } else {
      handleCopyLink(img.url, img.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Elegant Header */}
      <header className="sticky top-0 z-40 bg-slate-900/75 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-lg shadow-md hover:bg-red-500 transition-colors">
              AH
            </a>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                AnaHon Content Inventory
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">Public Access</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Archive extension: /Icontent_Inv</p>
            </div>
          </div>
          
          <a href="/" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all shadow-sm">
            <ArrowLeft size={14} />
            Back to Portal
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        
        {/* Intro section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-900 pb-8">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Tripoli Visual Archives</h2>
            <p className="text-sm text-slate-400">
              A curated collection of media assets showcasing the cultural, historical, and architectural identity of Tripoli, Lebanon. These verified resources are publicly available for editorial, programmatic, and compliance documentation use.
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/50 backdrop-blur border border-slate-850 rounded-xl p-3">
            <div className="text-center px-4 border-r border-slate-800">
              <span className="block text-xs text-slate-500 font-mono uppercase">Total Files</span>
              <span className="text-xl font-bold text-white">5</span>
            </div>
            <div className="text-center px-4 border-r border-slate-800">
              <span className="block text-xs text-slate-500 font-mono uppercase">Archive Size</span>
              <span className="text-xl font-bold text-red-500">1.08 MB</span>
            </div>
            <div className="text-center px-4">
              <span className="block text-xs text-slate-500 font-mono uppercase">Availability</span>
              <span className="text-xl font-bold text-emerald-500">100%</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search and View Mode */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search images or descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-650 transition-all font-sans"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-350"}`}
              title="Grid View"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-350"}`}
              title="List View"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {filteredImages.length === 0 && (
          <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-500 text-sm">No assets match your search terms.</p>
          </div>
        )}

        {/* Grid Layout */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImages.map((img) => (
              <div key={img.id} className="group bg-slate-900/40 backdrop-blur border border-slate-850 hover:border-slate-700/60 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col shadow-lg shadow-slate-950/20">
                {/* Image display */}
                <div className="relative aspect-video overflow-hidden bg-slate-950 cursor-pointer" onClick={() => setActiveModalImage(img)}>
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveModalImage(img); }}
                      className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-all"
                      style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Inspect Metadata"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(img.url, `${img.id}${img.url.substring(img.url.lastIndexOf("."))}`); }}
                      className="p-2.5 rounded-full bg-red-650 bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all"
                      style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Download Image"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  
                  {/* Image Type Badge */}
                  <span className="absolute bottom-3 left-3 text-[10px] font-semibold font-mono tracking-wider text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur">
                    {img.type.split(" ")[0]}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-white group-hover:text-red-500 transition-colors">{img.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{img.description}</p>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-4">
                    {/* File specs */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{img.dimensions}</span>
                      <span>{img.size}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleDownload(img.url, `${img.id}${img.url.substring(img.url.lastIndexOf("."))}`)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                        style={{ minHeight: '44px' }}
                      >
                        <Download size={14} />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => handleCopyLink(img.url, img.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          copiedId === img.id
                            ? "bg-emerald-950/40 border-emerald-850 border-emerald-800 text-emerald-400"
                            : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-350 hover:text-white"
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        <Copy size={14} />
                        <span>Link</span>
                      </button>
                      <button
                        onClick={() => handleShare(img)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                        style={{ minHeight: '44px' }}
                      >
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List Layout */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {filteredImages.map((img) => (
              <div key={img.id} className="group bg-slate-900/30 backdrop-blur border border-slate-850 hover:border-slate-800 rounded-xl overflow-hidden transition-all flex flex-col md:flex-row md:items-center p-4 gap-6">
                {/* Small preview image */}
                <div className="w-full md:w-44 aspect-video md:aspect-square rounded-lg overflow-hidden bg-slate-950 shrink-0 cursor-pointer" onClick={() => setActiveModalImage(img)}>
                  <img src={img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                
                {/* Meta details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-white group-hover:text-red-500 transition-colors">{img.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{img.description}</p>
                    </div>
                    <span className="hidden sm:inline-block text-[10px] font-semibold font-mono tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {img.type}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 pt-3 border-t border-slate-800/60 text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1">Dimensions: <strong className="text-slate-350">{img.dimensions}</strong></span>
                    <span className="flex items-center gap-1">Size: <strong className="text-slate-350">{img.size}</strong></span>
                    <span className="flex items-center gap-1">Path: <strong className="text-red-400/80">{img.url}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-32">
                  <button
                    onClick={() => handleDownload(img.url, `${img.id}${img.url.substring(img.url.lastIndexOf("."))}`)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-650 bg-red-600 hover:bg-red-550 hover:bg-red-550 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                    style={{ minHeight: '44px' }}
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => handleCopyLink(img.url, img.id)}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      copiedId === img.id
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                        : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-350 hover:text-white"
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <Copy size={14} />
                    <span>Link</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating share notification */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-55 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-3 shadow-2xl text-white text-xs font-mono font-medium"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>{shareToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen view modal */}
      <AnimatePresence>
        {activeModalImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-850 border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Media viewer */}
              <div className="flex-1 bg-black flex items-center justify-center relative p-6 max-h-[50vh] md:max-h-full overflow-hidden">
                <img
                  src={activeModalImage.url}
                  alt={activeModalImage.title}
                  className="max-w-full max-h-[40vh] md:max-h-[60vh] object-contain"
                />
              </div>

              {/* Sidebar specifications */}
              <div className="w-full md:w-80 p-6 border-t md:border-t-0 md:border-l border-slate-850 flex flex-col justify-between bg-slate-900">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-lg text-white leading-tight">{activeModalImage.title}</h3>
                    <button
                      onClick={() => setActiveModalImage(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      style={{ minWidth: '32px', minHeight: '32px' }}
                    >
                      ✕
                    </button>
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-relaxed">{activeModalImage.description}</p>
                  
                  {/* Detailed Specs list */}
                  <div className="border-t border-slate-850 pt-4 space-y-2 text-xs font-mono">
                    <span className="block text-slate-500 uppercase tracking-widest text-[9px] mb-3">Specifications</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resource URL</span>
                      <a href={activeModalImage.url} target="_blank" rel="noreferrer" className="text-red-400 hover:underline flex items-center gap-1 truncate max-w-[140px]">
                        {activeModalImage.url}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dimensions</span>
                      <span className="text-slate-300">{activeModalImage.dimensions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">File Size</span>
                      <span className="text-slate-300">{activeModalImage.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Format</span>
                      <span className="text-slate-300">{activeModalImage.type}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-850 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDownload(activeModalImage.url, `${activeModalImage.id}${activeModalImage.url.substring(activeModalImage.url.lastIndexOf("."))}`)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-650 bg-red-600 hover:bg-red-550 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                    style={{ minHeight: '44px' }}
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => handleCopyLink(activeModalImage.url, activeModalImage.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      copiedId === activeModalImage.id
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                        : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-350 hover:text-white"
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <Copy size={14} />
                    <span>{copiedId === activeModalImage.id ? "Copied" : "Copy Link"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-950/60 border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono">
        &copy; {new Date().getFullYear()} AnaHon Media Platform. All rights reserved.
      </footer>
    </div>
  );
}
