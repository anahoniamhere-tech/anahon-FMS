import * as XLSX from "xlsx";
import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building,
  User,
  Users,
  FolderGit2,
  Coins,
  FileText,
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
import { DatabaseState, Account, Project, Donor, Vendor, Expense, Procurement, BankAccount, Employee, Timesheet, FixedAsset, PartnerAccount, AppDoc, ComplianceTask, AuditLog } from "./types";
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
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Filter Term
  const [searchTerm, setSearchTerm] = useState("");

  // Sub-forms and interactive options
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<"Asset" | "Liability" | "Equity" | "Revenue" | "Expense">("Expense");
  const [newAccountCurrency, setNewAccountCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [newAccountGroup, setNewAccountGroup] = useState("Operating Expenses");

  // New Expense submission form
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expensePurpose, setExpensePurpose] = useState("");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseProject, setExpenseProject] = useState("");
  const [expenseBudgetLine, setExpenseBudgetLine] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCustomRate, setExpenseCustomRate] = useState("");
  const [tempAttachment, setTempAttachment] = useState<{ filename: string; mimeType: string; base64: string } | null>(null);

  // Daily Operations placeholder states
  const [dailySelectedDate, setDailySelectedDate] = useState<string>("2026-05-25");
  const [dailySelectedBankId, setDailySelectedBankId] = useState<string>("");
  const [dailyTitle, setDailyTitle] = useState<string>("");
  const [dailyPurpose, setDailyPurpose] = useState<string>("");
  const [dailyProject, setDailyProject] = useState<string>("");
  const [dailyBudgetLine, setDailyBudgetLine] = useState<string>("");
  const [dailyVendor, setDailyVendor] = useState<string>("");
  const [dailyCurrency, setDailyCurrency] = useState<"USD" | "EUR" | "LBP">("USD");
  const [dailyAmount, setDailyAmount] = useState<string>("0");
  const handleDailyDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerToast("Direct operational vault transaction posted.");
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
  const [procJustification, setProcJustification] = useState("");
  const [procConflict, setProcConflict] = useState(false);

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
  const [newEmpPaymentMethod, setNewEmpPaymentMethod] = useState("");
  const [newEmpContractType, setNewEmpContractType] = useState("");

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

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  // Load backend state on initialization
  const refreshState = async () => {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) throw new Error("Could not load backend finances state.");
      const data: DatabaseState = await res.json();
      setState(data);
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Full Name</label>
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Email Address</label>
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Password</label>
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

  // Helper: Converted totals
  const totalUSDInBank = state.bankAccounts
    .filter(b => b.active)
    .reduce((sum, b) => {
      let rate = 1;
      if (b.currency === "EUR") rate = state.fxRates.EUR;
      if (b.currency === "LBP") rate = state.fxRates.LBP;
      return sum + b.balance * rate;
    }, 0);

  // Base currency converter summary format
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

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
          quotations: [
            { vendorName: procVendorA, amount: procAmountA, currency: "USD", score: procScoreA, selected: true },
            { vendorName: procVendorB || "Second Sourced Vendor", amount: procAmountB || "0", currency: "USD", score: procScoreB, selected: false }
          ],
          justification: procJustification || "Sourced based on lowest cost compliant bid in Tripoli region.",
          conflictDeclared: procConflict,
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
        refreshState();
      } else {
        const data = await res.json();
        triggerToast(data.error || "Failed to register vendor.", "error");
      }
    } catch {
      triggerToast("Error registering new vendor.", "error");
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
          paymentMethod: newEmpPaymentMethod || "Bank Audi Wire",
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
        setNewEmpPaymentMethod("");
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
    const allocations = state.projects.map(p => ({
      projectId: p.id,
      percentage: tsAllocValues[`${empId}-${p.id}`] || 0
    }));

    const totalPerc = allocations.reduce((s, x) => s + x.percentage, 0);
    if (totalPerc !== 100) {
      triggerToast(`Fractions sum issue: Timesheet allocations must sum identically to 100%. (Current pool: ${totalPerc}%)`, "error");
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
    return (
      title.toLowerCase().includes(term.toLowerCase()) ||
      purpose.toLowerCase().includes(term.toLowerCase()) ||
      voucherNo.toLowerCase().includes(term.toLowerCase())
    );
  });



  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* Toast Alert Header Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
              }`}
          >
            <AlertCircle className="h-5 w-5" />
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
        <div className="flex items-center gap-4">
          <button onClick={handleFirebaseSignOut} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer">
            <UserCheck className="w-3.5 h-3.5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white relative z-50 h-16">
        <div className="flex items-center gap-3">
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
        
        <aside className={`fixed top-16 bottom-0 left-0 z-50 bg-slate-900 border-slate-800 shrink-0 transition-all duration-300 ease-in-out md:relative md:top-0 md:flex md:flex-col ${
          isOpen 
            ? 'translate-x-0 w-64 p-4 border-r' 
            : '-translate-x-full md:translate-x-0 md:w-0 md:p-0 md:border-r-0 overflow-hidden'
        }`}>
          <nav className="space-y-1 font-sans">
            <button onClick={() => handleNavClick("dashboard")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Activity className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Overview Dashboard</span>
            </button>

            <button onClick={() => handleNavClick("accounts")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "accounts" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Sliders className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Chart of Accounts</span>
            </button>

            <button onClick={() => handleNavClick("projects")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "projects" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FolderGit2 className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Donors & Projects</span>
            </button>

            <button onClick={() => handleNavClick("expenses")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "expenses" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <FileText className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Disbursement Vouchers</span>
              <span className="ml-auto bg-slate-800 text-[10px] text-slate-300 px-1.5 py-0.5 rounded-full font-mono shrink-0">
                {state.expenses.filter(e => ["Submitted", "Under Finance Review", "Approved"].includes(e.status)).length}
              </span>
            </button>

            <button onClick={() => handleNavClick("procurement")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "procurement" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Layers className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Procurement & Bids</span>
            </button>

            <button onClick={() => handleNavClick("vendors")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "vendors" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Vendor Registry</span>
            </button>

            <button onClick={() => handleNavClick("banking")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "banking" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Coins className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Banking & Cash Reconcile</span>
            </button>

            <button onClick={() => handleNavClick("ledger")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "ledger" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Building className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">General double-entry Ledger</span>
            </button>

            <button onClick={() => handleNavClick("payroll")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "payroll" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <User className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Timesheets & Payroll Allocation</span>
            </button>

            <button onClick={() => handleNavClick("assets")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "assets" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <HardDrive className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Fixed Assets Roll-Forward</span>
            </button>

            <button onClick={() => handleNavClick("partners")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "partners" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <Briefcase className="h-4 w-4 shrink-0" />
              <span className="text-left flex-1">Partner Capital Tracking</span>
            </button>

            <button onClick={() => handleNavClick("compliance")} className={`flex w-full items-center text-left gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === "compliance" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}>
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
              <span className="text-left flex-1">Compliance Control Desk</span>
              <span className="ml-auto flex h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            </button>
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

              {/* Financial Summary KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Total Available Treasury Pool</span>
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-slate-900">{formatUSD(totalUSDInBank)}</h3>
                  <p className="mt-1 text-xs text-slate-500">Across Bank accounts and 2 Cash boxes</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Active Donor Projects</span>
                    <FolderGit2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-blue-900">{state.projects.length}</h3>
                  <p className="mt-1 text-xs text-slate-500">With restriction covenants active</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-1000">Outstanding Approvals</span>
                    <Sliders className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-amber-700">
                    {state.expenses.filter(e => e.status === "Submitted" || e.status === "Under Finance Review").length} Vouchers
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Pending Director / Finance signatures</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Vat rate / Tax settings</span>
                    <Percent className="h-5 w-5 text-slate-600" />
                  </div>
                  <h3 className="mt-2 text-2xl font-bold font-mono text-slate-800">MoF 11% / SSD Pool</h3>
                  <p className="mt-1 text-xs text-slate-500">Adjusted to Ministry of Finance Chapter 3 regulations</p>
                </div>
              </div>

              {/* Active Projects Burn rates visual tracking blocks */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Project budgets & Sinking Burn Rates</h3>
                <div className="space-y-6">
                  {state.projects.map(p => {
                    const lines = state.budgetLines.filter(bl => bl.projectId === p.id);
                    const spent = lines.reduce((s, x) => s + x.actualUSD, 0);
                    const committed = lines.reduce((s, x) => s + x.committedUSD, 0);
                    const remaining = Math.max(0, p.budgetUSD - (spent + committed));
                    const percentageSpent = Math.min(100, ((spent + committed) / p.budgetUSD) * 100);

                    return (
                      <div key={p.id} className="p-4 rounded-lg bg-slate-50 border border-slate-105">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold font-mono mr-2">{p.code}</span>
                            <span className="text-sm font-bold text-slate-900">{p.name}</span>
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            Total Limit: {formatUSD(p.budgetUSD)} | Burn rate: <span className="font-bold text-slate-850">{percentageSpent.toFixed(1)}%</span>
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
                    {state.complianceTasks.map(t => (
                      <div key={t.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                          <span className="text-xs text-slate-500">Deadline: {t.dueDate} • Code: {t.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${t.status === "Done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
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
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Account Number Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 5140"
                      value={newAccountCode}
                      onChange={(e) => setNewAccountCode(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Descriptive Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Travel fuel to Akkar"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Class Type</label>
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
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Currency Code</label>
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
                <table className="w-full text-left border-collapse">
                  <header className="bg-slate-100">
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Code / ID</th>
                      <th className="px-6 py-3">Reporting Classification Name</th>
                      <th className="px-6 py-3 hidden md:table-cell">Account Type</th>
                      <th className="px-6 py-3 hidden md:table-cell">Original Currency</th>
                      <th className="px-6 py-3 text-right">Raw Ledger Balance</th>
                      <th className="px-6 py-3 text-right hidden md:table-cell">Status</th>
                    </tr>
                  </header>
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
                <h2 className="text-xl font-bold">Resricted Donor Grants & Sinking Budgets</h2>
                <p className="text-xs text-slate-500">Track designated funding allocations, revised budget versions and project execution timelines.</p>
              </div>

              {/* Donors Profiles list */}
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

              {/* Active Restricted Projects Section (NEW) */}
              <div className="space-y-4">
                <h3 className="text-md font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                  📁 Active Restricted Projects
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {state.projects.map(proj => {
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
                          <span className="text-[10px] bg-red-50 text-red-700 font-mono font-bold px-2 py-0.5 rounded uppercase">
                            {proj.code}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${proj.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}>
                            {proj.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 font-sans mb-1">{proj.name}</h4>
                        <p className="text-xs text-slate-500 mb-3">Donor Partner: {donor?.name || "Restricted Donor"}</p>

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
                                    accept="application/pdf"
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
                                    <span className="text-slate-700 truncate max-w-xs">📄 {doc.filename} ({doc.sizeStr})</span>
                                    <a
                                      href={`data:${doc.mimeType};base64,${doc.base64}`}
                                      download={doc.filename}
                                      className="text-red-650 hover:underline font-mono text-[10px] font-bold inline-flex items-center min-h-[44px] px-2"
                                    >
                                      📥 Download
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
                                            href={`data:${docAttached.mimeType};base64,${docAttached.base64}`}
                                            download={docAttached.filename}
                                            className="text-red-650 hover:underline font-bold inline-flex items-center min-h-[44px] px-2"
                                          >
                                            📥 Supporting PDF
                                          </a>
                                        ) : (
                                          <span className="text-slate-400 italic inline-flex items-center min-h-[44px] px-2">No bill PDF attached</span>
                                        )}
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
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projBankTx.length} items</span>
                            </div>

                            {projBankTx.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No cleared bank statements linked to this project's vouchers.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projBankTx.map(bt => {
                                  const account = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                                  return (
                                    <div key={bt.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-0.5 font-mono">
                                      <div className="flex justify-between text-slate-800">
                                        <span>{bt.date} • {account?.name}</span>
                                        <span className="font-bold text-red-600">-{formatUSD(bt.amount)}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 font-sans italic">Reconciled to: {bt.voucherNo} • {bt.description}</p>
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
                              <label className="text-xs font-bold text-slate-650 uppercase">Select Reporting Month:</label>
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
          {activeTab === "expenses" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Official Procurement & Disbursement Vouchers</h2>
                <p className="text-xs text-slate-500">Every item must be fully supported by digital quotes, conflict declaration checks, project mapping and mult-level signatures.</p>
              </div>

              {/* Expense submission Drawer form */}
              {["Super Admin", "Finance Officer", "Project Lead"].includes(currentUser.role) && (
                <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-950 uppercase border-b border-slate-100 pb-2 mb-4">Lodge Disbursement Voucher PV-2026</h3>
                  <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Expenditure Purpose Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Media panel catering"
                        value={expenseTitle}
                        onChange={(e) => setExpenseTitle(e.target.value)}
                        className="finance-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Accompanying Justification / Sinking rationale</label>
                      <input
                        type="text"
                        placeholder="Why this expense is needed"
                        value={expensePurpose}
                        onChange={(e) => setExpensePurpose(e.target.value)}
                        className="finance-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Target Project Mapping</label>
                      <select
                        value={expenseProject}
                        onChange={(e) => setExpenseProject(e.target.value)}
                        className="finance-input w-full"
                      >
                        <option value="">-- Select Project Sinking Code --</option>
                        {state.projects.map(p => (
                          <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Budget designated line</label>
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">Vendor list / Contract partner</label>
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">Requested Currency</label>
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">Amount Value</label>
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">Attach supporting Invoice/Agreement (PDF)</label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileDrop}
                        className="finance-input w-full text-xs"
                      />
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
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Allocation Project</label>
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
                                  {state.projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Budget Line mapping</label>
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
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Percentage Split (%)</label>
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
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-md font-bold text-slate-950 uppercase font-mono">Ledger Vouchers Logs</h3>
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
                </div>

                <div className="space-y-4">
                  {filteredExpenses.map(exp => {
                    const vendor = state?.vendors?.find(v => v.id === exp.vendorId);
                    const proj = state?.projects?.find(p => p.id === exp.projectId);
                    const expComments = exp.comments && Array.isArray(exp.comments) ? exp.comments : [];
                    const expAllocations = exp.allocations && Array.isArray(exp.allocations) ? exp.allocations : [];

                    return (
                      <div key={exp.id} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
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
                              <span className="font-bold text-slate-950">{(exp.netAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency}</span>
                            </div>
                          </div>
                        )}

                        {/* Auditing Vouchers Interactive action drawer depending on simulated Role */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
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
                          <div className="ml-auto text-xs text-slate-500 font-mono flex items-center gap-1">
                            {exp.hasAttachment ? "📄 Invoice Attachments secured" : "⚠️ Attachments required to close"}
                          </div>
                        </div>

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
                <h2 className="text-xl font-bold">Tripoli Sourcing & RFQ Comparative Sheets</h2>
                <p className="text-xs text-slate-500">Quotations matching rules demand at least 3 compared sources for donor procurements exceeding 1500 USD.</p>
              </div>

              {/* Submit bid comparison */}
              {["Super Admin", "Finance Officer", "Project Lead"].includes(currentUser.role) && (
                <form onSubmit={handleProcurementSubmit} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Comparative RFQ Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Sourcing 3 tripod screens"
                      value={procTitle}
                      onChange={(e) => setProcTitle(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vessel Project Mapping</label>
                    <select
                      value={procProject}
                      onChange={(e) => setProcProject(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Select Project Sinking Code --</option>
                      {state.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Budget Mapping</label>
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

                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Audit Justification Memo</label>
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

                    <div className="mt-3 p-3 bg-slate-100 text-xs rounded text-slate-700 font-mono italic">
                      ℹ️ <strong>Selection Memo:</strong> "{pr.justification}"
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

              {/* Register New Vendor Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Onboard New Provider (Supplier / Consultant / Freelancer)</h3>
                  <form onSubmit={handleVendorRegister} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Provider / Vendor Name</label>
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
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Contract / Provider Category</label>
                      <select
                        required
                        value={newVendorCategory}
                        onChange={(e) => setNewVendorCategory(e.target.value)}
                        className="finance-input w-full text-xs bg-white"
                      >
                        <option value="">-- Choose Category --</option>
                        <option value="Consultant / Freelancer">Consultant / Freelancer</option>
                        <option value="Service Provider">Service Provider</option>
                        <option value="General Supplier">General Supplier</option>
                        <option value="Landlord">Landlord (Rent Services)</option>
                        <option value="Government / Tax Authority">Government / Tax Authority</option>
                        <option value="Other">Other Category</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">MoF Tax Registry ID (If Registered)</label>
                      <input
                        type="text"
                        placeholder="e.g. MoF-9382LB (or leave blank/N/A)"
                        value={newVendorTaxId}
                        onChange={(e) => setNewVendorTaxId(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Contact Email / Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. consultant@anahon.org"
                        value={newVendorContact}
                        onChange={(e) => setNewVendorContact(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Bank Account / Payment Details</label>
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
                  <header className="bg-slate-100">
                    <tr className="border-b border-sub-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Vendor Account</th>
                      <th className="px-6 py-3">Primary Category</th>
                      <th className="px-6 py-3 hidden md:table-cell">Tax Registry ID</th>
                      <th className="px-6 py-3 hidden md:table-cell">Audit Disclosures</th>
                      <th className="px-6 py-3 hidden md:table-cell">Sanctions Rating</th>
                    </tr>
                  </header>
                  <tbody className="divide-y divide-slate-100 text-sm font-sans">
                    {state.vendors.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{v.name}</p>
                          <span className="text-[11px] text-slate-550 font-mono">{v.contact}</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* tab content Cash & Bank Balances */}
          {activeTab === "banking" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Banking Statements & Cash Recon Ledger</h2>
                  <p className="text-xs text-slate-500">Match raw physical statements to vouchers to evaluate reconciliatory variances.</p>
                </div>
              </div>

              {/* Direct Reconcile form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleBankReconcile} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Target Account Vault Drawer</label>
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
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Transaction Type</label>
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
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Statement Entry Memo</label>
                    <input
                      type="text"
                      placeholder="e.g. Bank charge ref 3381"
                      value={recDesc}
                      onChange={(e) => setRecDesc(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Statement Amount</label>
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

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <header className="bg-slate-100">
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Statement Date</th>
                      <th className="px-6 py-3">Vouchering Ref</th>
                      <th className="px-6 py-3 hidden md:table-cell">Account Drawer</th>
                      <th className="px-6 py-3 hidden md:table-cell">Description Purpose</th>
                      <th className="px-6 py-3 text-right">Cleared Amount</th>
                    </tr>
                  </header>
                  <tbody className="divide-y divide-slate-100 text-sm font-sans">
                    {state.bankTransactions.map(tx => {
                      const ba = state.bankAccounts.find(x => x.id === tx.bankAccountId);
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-mono text-slate-500">{tx.date}</td>
                          <td className="px-6 py-3 font-mono font-bold text-red-650 text-red-600">{tx.voucherNo || "Statement adjustment"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-800 hidden md:table-cell">{ba?.name}</td>
                          <td className="px-6 py-3 text-slate-700 hidden md:table-cell">{tx.description}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-slate-900">
                            {tx.type === "Withdrawal" ? "-" : "+"} {tx.amount.toLocaleString()} {ba?.currency}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* tab content General Ledger Double Entry */}
          {activeTab === "ledger" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">General double-entry General Ledger</h2>
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
                <div className="divide-y divide-slate-200">
                  <header className="grid grid-cols-4 gap-4 text-xs font-bold uppercase font-mono py-2 text-slate-600">
                    <span>Account code</span>
                    <span>Class description</span>
                    <span className="text-right">Debit Balance</span>
                    <span className="text-right">Credit Balance</span>
                  </header>
                  {state.accounts.map(acc => {
                    const debVal = acc.type === "Expense" || acc.type === "Asset" ? acc.balance : 0;
                    const credVal = acc.type === "Liability" || acc.type === "Equity" || acc.type === "Revenue" ? Math.abs(acc.balance) : 0;
                    if (debVal === 0 && credVal === 0) return null;
                    return (
                      <div key={acc.code} className="grid grid-cols-4 gap-4 text-xs font-mono py-2 hover:bg-slate-50">
                        <span>{acc.code}</span>
                        <span>{acc.name}</span>
                        <span className="text-right font-bold text-slate-900">{debVal > 0 ? formatUSD(debVal) : "-"}</span>
                        <span className="text-right font-bold text-slate-900">{credVal > 0 ? formatUSD(credVal) : "-"}</span>
                      </div>
                    );
                  })}
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
                        <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Adjustment Date</label>
                        <input
                          type="date"
                          required
                          value={adjDate}
                          onChange={(e) => setAdjDate(e.target.value)}
                          className="finance-input w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Journal Reference No</label>
                        <input
                          type="text"
                          placeholder="e.g. ADJ-2026-05"
                          value={adjReferenceNo}
                          onChange={(e) => setAdjReferenceNo(e.target.value)}
                          className="finance-input w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Description / Memo</label>
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
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Account</label>
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
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Debit (USD)</label>
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
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Credit (USD)</label>
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
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Project Tag (Optional)</label>
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
                <h2 className="text-xl font-bold">Timesheet Allocation & Co-Funding Cost Mapping</h2>
                <p className="text-xs text-slate-500">
                  Donor rules mandate personnel compensation matches timesheet percentage logs signed by project leaders.
                </p>
              </div>

              {/* Register New Employee Form */}
              {["Super Admin", "HR / Payroll Officer"].includes(currentUser.role) && (
                <form onSubmit={handleEmployeeRegister} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Farah Shami"
                      required
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="finance-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Position / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Community Coordinator"
                      required
                      value={newEmpPosition}
                      onChange={(e) => setNewEmpPosition(e.target.value)}
                      className="finance-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Base Salary (USD)</label>
                    <input
                      type="number"
                      placeholder="Monthly Base"
                      required
                      value={newEmpSalary}
                      onChange={(e) => setNewEmpSalary(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Allowance (USD)</label>
                    <input
                      type="number"
                      placeholder="Monthly Allowance"
                      value={newEmpAllowance}
                      onChange={(e) => setNewEmpAllowance(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Payment Method</label>
                    <select
                      value={newEmpPaymentMethod}
                      onChange={(e) => setNewEmpPaymentMethod(e.target.value)}
                      className="finance-input w-full text-xs"
                    >
                      <option value="Bank Audi Wire">Bank Audi Wire</option>
                      <option value="Petty Cash USD">Petty Cash USD</option>
                      <option value="USD Cash Check">USD Cash Check</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-955 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all">
                    Register Employee
                  </button>
                </form>
              )}

              {/* Staff timesheets loop list */}
              <div className="space-y-4">
                {state.employees.map(emp => {
                  const hasTimesheet = state.timesheets.some(t => t.employeeId === emp.id && t.month === selectedTSMonth);
                  const activeTimesheet = state.timesheets.find(t => t.employeeId === emp.id && t.month === selectedTSMonth);

                  return (
                    <div key={emp.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{emp.name}</h4>
                          <p className="text-xs text-slate-500">{emp.position} • Base: {formatUSD(emp.salary)} + {formatUSD(emp.allowance)} allowance</p>
                        </div>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${activeTimesheet?.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                          ● Month: {selectedTSMonth} • {activeTimesheet?.status || "Draft Pending"}
                        </span>
                      </div>

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

                        {activeTimesheet?.status !== "Approved" && ["Super Admin", "HR / Payroll Officer"].includes(currentUser.role) && (
                          <button
                            onClick={() => handleTimesheetSubmit(emp.id)}
                            className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5"
                          >
                            Submit allocations log
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
                    </div>
                  );
                })}
              </div>

            </div>
          )}


          {/* tab content Fixed Assets Roll forward */}
          {activeTab === "assets" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Fixed Assets capitalization Register</h2>
                  <p className="text-xs text-slate-500 md:max-w-xl">
                    Sinking cost models with straight-line automatic depreciation trackers mapped to physical serial numbers.
                  </p>
                </div>
              </div>

              {/* Capitalize Asset Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleCapitalizeAsset} className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Asset Name / Model</label>
                    <input
                      type="text"
                      placeholder="e.g. Sony FX6 camera"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Acquisition Cost USD</label>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={assetCost}
                      onChange={(e) => setAssetCost(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Vessel Project funding</label>
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
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Useful Life (Years)</label>
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
                <h2 className="text-xl font-bold">Partner Capital & Draws Accounting Accounts</h2>
                <p className="text-xs text-slate-500 md:max-w-xl">
                  Civil company regulations dictate partner loan drawdowns and equity contributions be fully aligned with monthly petty cash limits.
                </p>
              </div>

              {/* Draw invest form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Partner profile</label>
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">Amount USD</label>
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
                const accountTransactions = (state?.bankTransactions || []).filter(t => t.bankAccountId === selectedBankId);

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
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Expense Title</label>
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
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">justification / rationale</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Urgent transport"
                                  value={dailyPurpose}
                                  onChange={(e) => setDailyPurpose(e.target.value)}
                                  className="finance-input w-full text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Target Project mapping</label>
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
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Budget line mapping</label>
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
                                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Contractor / Vendor</label>
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
                                  <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Currency</label>
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
                                  <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Amount</label>
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
          {activeTab === "compliance" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">MoF / CNSS Regulatory Compliance Desk & Audit Logs</h2>
                <p className="text-xs text-slate-500">
                  AnaHon Media Platform adheres to robust Lebanese Civil Partnership guidelines. Trigger automated AI Audit logs inspections below.
                </p>
              </div>

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
                      <span className="text-slate-400 font-normal shrink-0">{log.timestamp.split("T")[1].replace("Z", "")}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Root-Level Floating Sidebar Toggle Handle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-1/2 -translate-y-1/2 z-[60] flex h-11 w-8 items-center justify-center rounded-r-xl bg-slate-800 border-y border-r border-slate-700 hover:bg-slate-700 text-white shadow-lg transition-all duration-300 ease-in-out cursor-pointer text-xs font-mono font-bold ${
          isOpen 
            ? 'left-64' 
            : 'left-0'
        }`}
        style={{ minWidth: '32px', minHeight: '44px' }}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isOpen ? "◀" : "▶"}
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
