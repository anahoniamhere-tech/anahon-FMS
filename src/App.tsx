import * as XLSX from "xlsx";
import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { selfDealingRequester } from "./selfDealing";
import { isPersonnelDoc, maySeePersonnelFile, PERSONNEL_CATEGORIES } from "./personnelDocs";
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
  Eye,
  Newspaper
} from "lucide-react";
import { DatabaseState, Account, Project, Donor, Vendor, Expense, Procurement, BankAccount, Employee, Timesheet, FixedAsset, PartnerAccount, AppDoc, ComplianceTask, AuditLog, Opportunity, Client, Quotation, QuotationItem, Proposal } from "./types";

import { PROPOSAL_SECTIONS, STREAMS, OPP_STAGES, QUOTE_STATUSES, SERVICE_CATALOG, FINANCIAL_TERMS, PRODUCTION_NOTE, TECHNICAL_NOTE, EXTRAS_DEFAULT } from "./constants";
import { tr } from "./i18n";
import IcontentInvPage from "./IcontentInvPage";
import ProjectsTab from "./tabs/ProjectsTab";
import ExpensesTab from "./tabs/ExpensesTab";
import PartnersTab from "./tabs/PartnersTab";
import ComplianceTab from "./tabs/ComplianceTab";
import MyDeskTab from "./tabs/MyDeskTab";
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
import HelpTab from "./tabs/HelpTab";
import EditorialTab from "./tabs/EditorialTab";
import NetworkTab from "./tabs/NetworkTab";
import ToolsTab from "./tabs/ToolsTab";
import ArchiveTab from "./tabs/ArchiveTab";
import SocialTab from "./tabs/SocialTab";
import WebsiteTab from "./tabs/WebsiteTab";
import LiveTab from "./tabs/LiveTab";
import RoleSwitch, { ActingBanner } from "./RoleSwitch";
import { visibleNav, LANDING } from "./nav";
import { withTicket, refreshDocTicket } from "./docTicket";
import { SharedProps } from "./tabs/shared";
import { auth } from "./firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
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
  // The seat the Super Admin is standing in, if any. The server is told on every write.
  // Declared with the other hooks: a hook below the early returns changes the hook count
  // between the sign-in render and the signed-in render, and React then renders nothing.
  const [actingAs, setActingAs] = useState<string | null>(null);
  // Banking ledger view controls (shared: global search pre-fills them)
  const [bankFilterAcc, setBankFilterAcc] = useState<string>("");
  const [bankSearch, setBankSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("mydesk");
  // One-click Arabic. Remembered across sessions; flips the page to RTL.
  const [lang, setLang] = useState<string>(() => localStorage.getItem("anahon-lang") || "en");
  const t = (s: string) => tr(lang, s);
  const rtl = lang === "ar";
  useEffect(() => {
    localStorage.setItem("anahon-lang", lang);
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // A file dropped outside a drop zone must never navigate the tab away from the
  // app (the browser's default replaces the SPA with the file — a blank screen).
  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  // Filter Term
  const [searchTerm, setSearchTerm] = useState("");



  // Document viewer: open scans and contracts in place. Clicking a file used to spawn a
  // browser tab (and a download for anything the browser won't render inline), so checking
  // one invoice against one voucher meant leaving the page.
  const [docView, setDocView] = useState<{ id: string; filename: string; mimeType?: string } | null>(null);
  const [docPages, setDocPages] = useState<number | null>(null); // null = still counting, 0 = failed
  const [docText, setDocText] = useState<string | null>(null);   // extracted .docx body



  // Live LAN address for phone access — re-read on load so a changed IP is never stale.
  const [phoneAccess, setPhoneAccess] = useState<{ urls: { iface: string; url: string }[]; qr: string | null } | null>(null);
















  // Contract generation (per employee card)
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [contractParty, setContractParty] = useState<"employee" | "vendor">("employee");
  const [contractForm, setContractForm] = useState({
    projectId: "", kind: "Employment", startDate: "", endDate: "", loePct: "", monthlyFee: "", contractTotal: "", role: ""
  });
  const [contractBusy, setContractBusy] = useState(false);


  // ---- Party file: everything on record for one person/provider, in one panel ----
  const [partyFileFor, setPartyFileFor] = useState<string | null>(null);
  // Filing a document INTO someone else's personnel file — HR/Payroll and the Program
  // Director do this for the team; everyone else never sees the control at all.
  const [personnelCat, setPersonnelCat] = useState<string>("CV");
  const [personnelBusy, setPersonnelBusy] = useState(false);

  // Documents carry an explicit partyId (set by the 31-Jul migration, and stamped on every
  // newly generated contract). The name heuristic survives only as a labelled safety net for
  // future scans that arrive without a link.
  const collectPartyFile = (partyId: string, partyName: string) => {
    const firstName = (partyName.split(/\s+/)[0] || "").toLowerCase();
    const linked = state.documents.filter(d => d.partyId === partyId);
    // Identity papers and CVs form their own section — they are not "other documents".
    // The server has already withheld them from anyone outside this person's personnel
    // file, so whatever reaches here is legitimately visible.
    const personal = linked.filter(isPersonnelDoc);
    const agreements = linked.filter(d => !personal.includes(d) && /contract|agreement|addendum/i.test(`${d.category} ${d.filename}`));
    const other = linked.filter(d => !agreements.includes(d) && !personal.includes(d));
    const unlinkedByName = firstName.length < 3 ? [] : state.documents.filter(d =>
      !d.partyId &&
      /contract|agreement|timesheet|addendum|receipt|ts_/i.test(`${d.category} ${d.filename}`) &&
      d.filename.toLowerCase().includes(firstName));
    const vouchers = state.expenses
      .filter(e => e.vendorId === partyId)
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const docsOf = (eid: string) => state.documents.filter(d => d.linkedRecordType === "Expense" && d.linkedRecordId === eid);
    return { agreements, other, personal, unlinkedByName, vouchers, docsOf };
  };

  /** Every document URL carries the viewer's id: personnel documents (passports, IDs, CVs)
   *  are refused by the server to anyone outside the personnel file, and it needs to know
   *  who is asking. Harmless on ordinary documents, which ignore it. */
  // Documents are opened with a signed ticket for this sign-in, never with a uid in the URL.
  const docUrl = (p: string) => withTicket(p);

  /** Open a document in the in-app viewer instead of a new tab. Pass the AppDoc (or any
   *  object carrying id/filename/mimeType). Falls back to a plain link if id is missing. */
  const openDoc = (d: { id: string; filename?: string; mimeType?: string }) => {
    const filename = d.filename || "document";
    setDocView({ id: d.id, filename, mimeType: d.mimeType });
    setDocPages(null);
    setDocText(null);
    if (/pdf/i.test(d.mimeType || "") || /\.pdf$/i.test(filename)) {
      fetch(docUrl(`/api/document/pages/${d.id}`))
        .then(r => r.json())
        .then(j => setDocPages(j.pages || 0))
        .catch(() => setDocPages(0));
    } else if (/\.docx$/i.test(filename)) {
      fetch(docUrl(`/api/document/docx-text/${d.id}`))
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(t => setDocText(t))
        .catch(() => setDocText(""));
    }
  };

  /** File a personnel document (CV, passport, ID…) against a named employee. Goes through
   *  the same upload endpoint as everything else, which routes it to PERSONNEL/<name>/ and
   *  refuses the write unless this user is entitled to that person's file. */
  const uploadPersonnelDoc = async (partyId: string, file: File, category: string) => {
    setPersonnelBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/document/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, mimeType: file.type,
          sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          base64, category, partyId, user: currentUser,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not file the document.");
      triggerToast(d.duplicate ? "Already on file — no second copy made." : `${category} filed.`);
      await refreshState();
    } catch (e: any) {
      triggerToast(e.message);
    } finally {
      setPersonnelBusy(false);
    }
  };

  const renderPartyFile = (partyId: string, partyName: string) => {
    const { agreements, other, personal, unlinkedByName, vouchers, docsOf } = collectPartyFile(partyId, partyName);
    const total = vouchers.reduce((s, e) => s + e.convertedAmount, 0);
    const docLink = (d: any) => (
      <a key={d.id} href={docUrl(`/api/document/content/${d.id}`)} target="_blank" onClick={e => { e.preventDefault(); openDoc(d); }} rel="noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-red-650 hover:text-red-700 hover:underline mr-3">
        📄 {d.filename}
      </a>
    );
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-left">
        <h5 className="text-xs font-bold text-slate-800 font-mono uppercase">📂 File — {partyName}</h5>
        {maySeePersonnelFile(currentUser, state.employees, partyId) && (
          <div className="rounded-lg border border-[#E23B3B]/30 bg-[#E23B3B]/[0.04] p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f2020] mb-1">
              🔒 Personal file — restricted
            </p>
            {personal.length === 0 && (
              <p className="text-[11px] italic text-slate-500">No personal documents on file yet.</p>
            )}
            {personal.map(d => (
              <div key={d.id} className="flex items-baseline gap-2">
                <span className="w-32 shrink-0 text-[9px] font-bold uppercase text-slate-500">{d.category}</span>
                {docLink(d)}
                <span className="shrink-0 font-mono text-[9px] text-slate-400">{d.refNo}</span>
              </div>
            ))}
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#E23B3B]/15 pt-2">
              <select
                value={personnelCat}
                onChange={e => setPersonnelCat(e.target.value)}
                className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px]"
                aria-label={`Document type for ${partyName}`}
              >
                {PERSONNEL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className={`cursor-pointer rounded bg-[#6D1A1A] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#4A1010] ${personnelBusy ? "opacity-50" : ""}`}>
                {personnelBusy ? "Filing…" : "+ Add document"}
                <input
                  type="file"
                  className="hidden"
                  disabled={personnelBusy}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadPersonnelDoc(partyId, f, personnelCat);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-[10px] text-slate-500">
                Filed to PERSONNEL / {partyName}. Visible to {partyName.split(/\s+/)[0]}, the Executive Director and HR / Payroll only.
              </span>
            </div>
          </div>
        )}
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
  const [focusId, setFocusId] = useState<string | null>(null);
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
    // What a role may open is decided by the sidebar data, never by a second list here.
    const role = u?.role || "";
    const allowed = visibleNav(role).flatMap(sec => sec.items.map(i => i.navKey));
    if (!allowed.includes(activeTab)) setActiveTab(LANDING[role] || allowed[0] || "mydesk");
  }, [state, activeUserId, activeTab]);


  // Load backend state on initialization
  const refreshState = async () => {
    refreshDocTicket();
    try {
      // Identify the viewer so the server can narrow the payload: a Project Officer
      // is sent only their programme's records, never the whole organisation's.
      const uid = localStorage.getItem("anahon-uid") || "";
      const res = await fetch("/api/state"); // the sign-in token names the viewer; a uid in the URL is ignored
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
          // Send the signed token, not a claimed email. The server verifies Google's
          // signature and looks the account up from what the signature says.
          const idToken = await user.getIdToken();
          const syncRes = await fetch("/api/auth/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
          });
          if (!syncRes.ok) {
            // Firebase knows this person; this system does not (or has deactivated them).
            // They must land back on the sign-in window with the reason, NOT half-way
            // inside a shell they have no data for — being signed in to Firebase but not
            // here is exactly the state that renders an empty, broken workspace.
            const problem = await syncRes.json().catch(() => ({ error: "Sign-in failed." }));
            await signOut(auth);
            setFbUser(null);
            setAuthError(problem.error || "Sign-in failed.");
            setLoading(false);
            setAuthLoading(false);
            return;
          }
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

  const handleGoogleSignIn = async () => {
    setAuthBtnLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      triggerToast("Logged in with Google.");
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
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Management System</p>
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
                <span>{authTab === "signin" ? "Access Management System" : "Establish Profile"}</span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono uppercase tracking-widest">
            <div className="flex-1 h-px bg-slate-800" /><span>or</span><div className="flex-1 h-px bg-slate-800" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authBtnLoading}
            className="w-full p-3 bg-white hover:bg-slate-100 text-slate-900 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
            <span>Sign in with Google</span>
          </button>

          {/* Local testing helper banner */}
          {/* Seed shortcuts print a working password on the sign-in screen, so they exist
              only in a dev build. import.meta.env.DEV is compiled to false by `vite build`,
              and the whole block is then dropped by dead-code elimination — it cannot be
              re-enabled by a flag someone forgets to unset in production. */}
          {import.meta.env.DEV && (
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
                {/* Real person, real account — fills the address only. Marwan sets and knows
                    his own password; anyone else knowing it would make "Marwan approved this"
                    worth nothing, which is the whole reason the role exists. */}
                <span className="block text-slate-300 select-all cursor-pointer hover:text-white" onClick={() => { setAuthEmail("marwancheikh315@gmail.com"); setAuthPassword(""); setAuthTab("signin"); }}>
                  marwancheikh315@gmail.com
                </span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 italic text-center">
              Tip: Click an address to fill it in. Seed accounts use <strong>password123</strong>; real accounts use their owner's own password.
            </p>
          </div>
          )}

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
  // Content crew (Policy 002 production team) see only the editorial desk.
  const isContentCrew = ["Reporter", "Content Creator", "Podcaster"].includes(currentUser?.role || "");

  /** Evidence gaps, derived live from state so the count can never go stale.
   *  "Digitized*" documents are the app's own rendering of the voucher — they are not
   *  third-party evidence, and counting them would hide exactly what this panel is for. */
  const evidenceGaps = (() => {
    const COUNTED = ["Approved", "Paid", "Posted"];
    // Proof means a document AnaHon did not author after the fact. Neither the app's own
    // digitized copy nor a reconstructed voucher qualifies — both are our own reconstruction
    // of a record, and counting them would let the gap close itself.
    const hasProof = (expId: string) => state.documents.some(d =>
      d.linkedRecordType === "Expense" && d.linkedRecordId === expId
      && !/^Digitized/i.test(d.category || "") && !/^Reconstructed Voucher/i.test(d.category || ""));
    const proj = (id: string) => state.projects.find(p => p.id === id);
    const money = (n: number) => formatUSD(n);

    // A reconstructed voucher is AnaHon's own document reissued because the signed hard copy was
    // lost on a closed grant. It is a documented position, not independent evidence — so it neither
    // counts as proof nor sits in the unexplained pile. Three states, and the difference is stated.
    const isReconstructed = (expId: string) => state.documents.some(d =>
      d.linkedRecordType === "Expense" && d.linkedRecordId === expId && /^Reconstructed Voucher/i.test(d.category || ""));

    const reconstructed = state.expenses
      .filter(e => COUNTED.includes(e.status) && !hasProof(e.id) && isReconstructed(e.id))
      .sort((a, b) => b.convertedAmount - a.convertedAmount);

    const noEvidence = state.expenses
      .filter(e => COUNTED.includes(e.status) && !hasProof(e.id) && !isReconstructed(e.id))
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
      noEvidence, reconstructed, noProcurement, unspent, pettyGap, money, proj,
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
  // Closed projects keep their history but stop accepting new charges — a completed
  // grant's budget is settled, so it must not appear in any project picker.
  const requestableProjects = (officerProjectIds ? (state?.projects || []).filter(p => officerProjectIds.has(p.id)) : (state?.projects || []))
    .filter(p => p.status !== "Completed" && p.status !== "Closed");



  // Base currency converter summary format
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  // Bank money is shown in the currency it actually moved in — the EUR sub-account holds euros,
  // and printing those as dollars misstates the source document.
  const formatIn = (val: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);



































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

























  // Everything the split-out tab components receive. Grows as tabs are split.
  const shared: SharedProps = {
    state, setState, currentUser, t, lang, rtl, formatUSD, formatIn,
    refreshState, triggerToast, handleNavClick, openDoc,
    bankFilterAcc, setBankFilterAcc, bankSearch, setBankSearch,
    requestableProjects, isProjectOfficer, isSelfService, phoneAccess,
    contractFor, setContractFor, contractParty, setContractParty,
    contractForm, setContractForm, contractBusy, handleGenerateContract,
    partyFileFor, setPartyFileFor, renderPartyFile,
    eurRateInput, setEurRateInput, lbpRateInput, setLbpRateInput,
    searchTerm, setSearchTerm, setDrawerExpenseId, handleVoucherDocUpload,
    selectedProjectId, setSelectedProjectId, workspaceRef,
    focusId, setFocusId,
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
            className={`fixed top-16 md:top-4 right-4 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
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
          <img src="/assets/images/anahon_logo.png" alt="AnaHon" className="h-10 w-auto drop-shadow" />
          <div>
            <h1 className="text-lg font-bold tracking-tight font-sans">AnaHon Management System</h1>
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
          {/* Brand date pill (§7): red dot, letter-spaced caps, translucent on dark. */}
          <span className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold tracking-[0.15em] text-white/90 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase().replace(/ /g, " ")}
          </span>
          {/* One-click Arabic: menus and main actions switch, and the page flips to RTL. */}
          <RoleSwitch currentUser={currentUser} onChange={(r) => { setActingAs(r); refreshState(); }} />
          {state?.siteUrl && (
            <a href={state.siteUrl} target="_blank" rel="noopener"
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800"
              title={state.siteUrl}>🌐 {t("Website")}</a>
          )}
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
      <ActingBanner acting={actingAs} onStop={() => { (window as any).__actingAs = undefined; setActingAs(null); refreshState(); }} />

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
          <img src="/assets/images/anahon_logo.png" alt="AnaHon" className="h-9 w-auto drop-shadow" />
          <div className="flex flex-col">
            <h1 className="text-xs font-bold tracking-tight font-sans">AnaHon MS</h1>
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
            {/* The sidebar is data: src/nav.tsx. Eight doors by job; scripts/check-nav.ts proves every screen is listed once. */}
            {visibleNav(currentUser?.role || "").map((sec, si) => (
              <React.Fragment key={sec.section}>
                <p className={`px-3 ${si === 0 ? "pt-1" : "pt-3"} pb-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase select-none`}>{t(sec.section)}</p>
                {sec.items.map(item => (
                  <button key={item.navKey} onClick={() => handleNavClick(item.navKey)}
                    className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === item.navKey ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
                    {item.icon}
                    <span className="text-left flex-1">{t(item.label)}</span>
                    {item.badge === "expenses" && (
                      <span className="ml-auto bg-slate-800 text-[10px] text-slate-300 px-1.5 py-0.5 rounded-full font-mono shrink-0">
                        {state.expenses.filter(e => ["Submitted", "Under Finance Review", "Approved"].includes(e.status)).length}
                      </span>
                    )}
                    {item.badge === "compliance" && <span className="ml-auto flex h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />}
                  </button>
                ))}
              </React.Fragment>
            ))}
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
          {activeTab === "projects" && <ProjectsTab {...shared} />}


          {/* tab content Vouchers & Expenses Lifecycle */}
          {activeTab === "funnel" && <FunnelTab {...shared} />}

          {activeTab === "production" && <ProductionTab {...shared} />}

          {activeTab === "editorial" && <EditorialTab {...shared} />}

          {activeTab === "expenses" && <ExpensesTab {...shared} />}


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
          {activeTab === "partners" && <PartnersTab {...shared} />}

          {/* tab content Compliance & AI Audit Desk */}
          {activeTab === "network" && <NetworkTab {...shared} />}
          {activeTab === "tools" && <ToolsTab {...shared} />}
          {activeTab === "archive" && <ArchiveTab {...shared} />}
          {activeTab === "social" && <SocialTab {...shared} />}
          {activeTab === "website" && <WebsiteTab {...shared} />}
          {activeTab === "live" && <LiveTab {...shared} />}
          {activeTab === "handbooks" && <HandbooksTab {...shared} />}
          {activeTab === "help" && <HelpTab {...shared} />}

          {activeTab === "mydesk" && <MyDeskTab {...shared} />}
          {activeTab === "compliance" && <ComplianceTab {...shared} />}

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

              {evidenceGaps.reconstructed.length > 0 && (
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg">
                  <p className="text-xs font-bold text-slate-800">
                    Reconstructed vouchers — {evidenceGaps.reconstructed.length} · {evidenceGaps.money(evidenceGaps.reconstructed.reduce((s, e) => s + e.convertedAmount, 0))}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Closed grants whose signed hard copies could not be located. AnaHon's own voucher was
                    reissued from the approved budget, the financial report the funder accepted, and the
                    expense register — each one stating on its face that the original is unavailable.
                    Not counted as independent evidence, and not left unexplained.
                  </p>
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
        const src = docUrl(`/api/document/content/${docView.id}`);
        const mt = (docView.mimeType || "").toLowerCase();
        const ext = (docView.filename.split(".").pop() || "").toLowerCase();
        const isImage = mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext);
        const isPdf = mt.includes("pdf") || ext === "pdf";
        const isText = mt.startsWith("text/") || ["txt", "md", "csv", "json", "html"].includes(ext);
        const isVideo = mt.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext);
        const isAudio = mt.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac"].includes(ext);
        return (
          <>
            <div className="fixed inset-0 bg-black/70 z-[100]" onClick={() => setDocView(null)} />
            <div className="fixed inset-3 md:inset-8 z-[110] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shrink-0">
                <span className="text-lg">📄</span>
                <p className="flex-1 text-sm font-mono truncate" title={docView.filename}>{docView.filename}</p>
                <a href={src} download={docView.filename}
                  className="text-[11px] bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors">⬇ Download</a>
                {isText && !/\.(txt|md|csv|json)$/i.test(docView.filename) && (
                  <a href={docUrl(`/api/document/${docView.id}/pdf`)} download
                    className="text-[11px] bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors">⬇ PDF</a>
                )}
                {/* Print the document itself, not the app around it. Same-origin iframe, so
                    its own print dialog gives a clean page with no chrome or sidebar. */}
                <button
                  onClick={() => {
                    const frame = document.getElementById("doc-view-frame") as HTMLIFrameElement | null;
                    if (frame?.contentWindow) { frame.contentWindow.focus(); frame.contentWindow.print(); }
                    else window.open(src, "_blank", "noopener");
                  }}
                  className="text-[11px] bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors">🖨 Print</button>
                <a href={src} target="_blank" rel="noreferrer"
                  className="text-[11px] bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors">↗ New tab</a>
                <button onClick={() => setDocView(null)} aria-label="Close document viewer"
                  className="text-slate-300 hover:text-white text-xl leading-none px-2">✕</button>
              </div>
              {/* min-h-0: a flex child defaults to min-height:auto, so the iframe's h-full
                  resolves against an indefinite height and collapses to 0 in a short window.
                  Without this the viewer opens with the document loaded but nothing visible. */}
              <div className="flex-1 min-h-0 bg-slate-100 overflow-auto">
                {isImage ? (
                  <div className="min-h-full flex items-center justify-center p-4">
                    <img src={src} alt={docView.filename} className="max-w-full max-h-full object-contain shadow-lg" />
                  </div>
                ) : isVideo ? (
                  <div className="min-h-full flex items-center justify-center p-4">
                    <video src={src} controls className="max-w-full max-h-full shadow-lg" />
                  </div>
                ) : isAudio ? (
                  // Meeting recordings live here — playable without leaving the vault.
                  <div className="min-h-full flex items-center justify-center p-8">
                    <audio src={src} controls className="w-full max-w-xl" />
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
                        <img key={i} src={docUrl(`/api/document/page/${docView.id}/${i}`)} alt={`Page ${i + 1}`}
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
                  <iframe id="doc-view-frame" src={src} title={docView.filename} className="w-full h-full border-0 bg-white" />
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
                    <a key={d.id} href={withTicket(`/api/document/content/${d.id}`)} target="_blank" onClick={e => { e.preventDefault(); openDoc(d); }} rel="noreferrer"
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

















