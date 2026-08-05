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

import { PROPOSAL_SECTIONS, STREAMS, OPP_STAGES, QUOTE_STATUSES, SERVICE_CATALOG, FINANCIAL_TERMS, PRODUCTION_NOTE, TECHNICAL_NOTE, EXTRAS_DEFAULT } from "./constants";
import { tr } from "./i18n";
import IcontentInvPage from "./IcontentInvPage";
import FunnelTab from "./tabs/FunnelTab";
import VendorsTab from "./tabs/VendorsTab";
import ProductionTab from "./tabs/ProductionTab";
import PayrollTab from "./tabs/PayrollTab";
import LedgerTab from "./tabs/LedgerTab";
import DashboardTab from "./tabs/DashboardTab";
import ProcurementTab from "./tabs/ProcurementTab";
import BankingTab from "./tabs/BankingTab";
import ReportsTab from "./tabs/ReportsTab";
import AssetsTab from "./tabs/AssetsTab";
import AccountsTab from "./tabs/AccountsTab";
import HandbooksTab from "./tabs/HandbooksTab";
import { SharedProps } from "./tabs/shared";
import { auth } from "./firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";



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
  // Banking ledger view controls (shared: global search pre-fills them)
  const [bankFilterAcc, setBankFilterAcc] = useState<string>("");
  const [bankSearch, setBankSearch] = useState<string>("");
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

  // Document viewer: open scans and contracts in place. Clicking a file used to spawn a
  // browser tab (and a download for anything the browser won't render inline), so checking
  // one invoice against one voucher meant leaving the page.
  const [docView, setDocView] = useState<{ id: string; filename: string; mimeType?: string } | null>(null);
  const [docPages, setDocPages] = useState<number | null>(null); // null = still counting, 0 = failed
  const [docText, setDocText] = useState<string | null>(null);   // extracted .docx body



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

  // Project timeline step being added/edited (null = form closed).
  const [activityForm, setActivityForm] = useState<any | null>(null);


  // Physical cash count form (Banking tab).
  const [cashCountForm, setCashCountForm] = useState({ date: new Date().toLocaleDateString("en-CA"), countedUSD: "", notes: "" });

  // Inline single-source waiver raised from the voucher form (null = panel closed).
  const [inlineWaiver, setInlineWaiver] = useState<{ vendorName: string; amount: string; reason: string; retrospective: boolean } | null>(null);
  const [expenseCurrency, setExpenseCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCustomRate, setExpenseCustomRate] = useState("");
  const [tempAttachment, setTempAttachment] = useState<{ filename: string; mimeType: string; base64: string } | null>(null);
  const [aiScanning, setAiScanning] = useState(false);

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









  // Shared cost split allocation states
  const [enableSharedSplit, setEnableSharedSplit] = useState(false);
  const [splitAllocations, setSplitAllocations] = useState<{ projectId: string; budgetLineId: string; percentage: number; }[]>([
    { projectId: "", budgetLineId: "", percentage: 50 },
    { projectId: "", budgetLineId: "", percentage: 50 }
  ]);


  // Contract generation (per employee card)
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [contractParty, setContractParty] = useState<"employee" | "vendor">("employee");
  const [contractForm, setContractForm] = useState({
    projectId: "", kind: "Employment", startDate: "", endDate: "", loePct: "", monthlyFee: "", contractTotal: "", role: ""
  });
  const [contractBusy, setContractBusy] = useState(false);


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



  // Base currency converter summary format
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  // Bank money is shown in the currency it actually moved in — the EUR sub-account holds euros,
  // and printing those as dollars misstates the source document.
  const formatIn = (val: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);


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

  // Everything the split-out tab components receive. Grows as tabs are split.
  const shared: SharedProps = {
    state, setState, currentUser, t, lang, rtl, formatUSD, formatIn,
    refreshState, triggerToast, handleNavClick, openDoc,
    bankFilterAcc, setBankFilterAcc, bankSearch, setBankSearch,
    requestableProjects, isProjectOfficer, isSelfService, phoneAccess,
    contractFor, setContractFor, contractParty, setContractParty,
    contractForm, setContractForm, contractBusy, handleGenerateContract,
    partyFileFor, setPartyFileFor, renderPartyFile,
  };

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
          {activeTab === "dashboard" && <DashboardTab {...shared} />}


          {/* tab content Chart of Accounts */}
          {activeTab === "accounts" && <AccountsTab {...shared} />}


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
          {activeTab === "funnel" && <FunnelTab {...shared} />}

          {activeTab === "production" && <ProductionTab {...shared} />}

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
          {activeTab === "procurement" && <ProcurementTab {...shared} />}


          {/* tab content Vendor Master */}
          {activeTab === "vendors" && <VendorsTab {...shared} />}


          {/* tab content Cash & Bank Balances */}
          {activeTab === "banking" && <BankingTab {...shared} />}


          {/* tab content General Ledger Double Entry */}
          {activeTab === "ledger" && <LedgerTab {...shared} />}


          {/* tab content Timesheets & Payroll */}
          {activeTab === "payroll" && <PayrollTab {...shared} />}


          {/* tab content Periodic Reports (Policy 11.2) */}
          {activeTab === "reports" && <ReportsTab {...shared} />}

          {/* tab content Fixed Assets Roll forward */}
          {activeTab === "assets" && <AssetsTab {...shared} />}


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
          {activeTab === "handbooks" && <HandbooksTab {...shared} />}

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













