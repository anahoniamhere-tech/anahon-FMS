import React, { useState, useEffect, FormEvent, ChangeEvent } from "react";
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
  Filter
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
  const [tempAttachment, setTempAttachment] = useState<{ filename: string; mimeType: string; base64: string } | null>(null);

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

  // Timesheet Allocation interactive adjustment
  const [selectedTSMonth, setSelectedTSMonth] = useState("2026-05");
  const [tsAllocValues, setTsAllocValues] = useState<{ [projId: string]: number }>({});

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
  const filteredExpenses = state.expenses.filter(e =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.voucherNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              className={`flex-1 pb-3 text-sm font-bold transition-all relative ${
                authTab === "signin" ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign In
              {authTab === "signin" && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
              )}
            </button>
            <button
              onClick={() => { setAuthTab("signup"); setAuthError(null); }}
              className={`flex-1 pb-3 text-sm font-bold transition-all relative ${
                authTab === "signup" ? "text-white" : "text-slate-500 hover:text-slate-300"
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
              className="w-full p-3 bg-red-600 hover:bg-red-750 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-50 font-bold tracking-wide uppercase font-mono"
            >
              {authBtnLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{authTab === "signin" ? "Access ERP Console" : "Establish Profile"}</span>
              )}
            </button>
          </form>

          {/* Local testing helper banner */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono text-center">
              Local Development Seed Roles
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 bg-slate-955/35 p-2.5 rounded-lg border border-slate-850">
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
              Tip: Click any seed email to auto-fill the forms. (Use password: **password123** for seed accounts).
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      
      {/* Toast Alert Header Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-white ${
              toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Global Controls & Navigation Top Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-red-600 text-white font-bold text-lg shadow-inner">
            AH
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-sans">AnaHon Financial Management</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              Tripoli Civil Co. Compliance Terminal • Registration: {state.orgSettings.vesselCode}
            </p>
          </div>
        </div>

        {/* Real Authenticated Firebase User Profile */}
        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <div className="flex items-center gap-3 bg-slate-800 p-1.5 px-3 rounded-lg border border-slate-700">
            <div className="w-8 h-8 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center font-bold text-red-400 text-sm">
              {currentUser?.name?.substring(0, 2).toUpperCase() || "AH"}
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-white leading-tight">{currentUser?.name}</span>
              <span className="block text-[9px] text-red-400 font-mono tracking-wider font-semibold uppercase leading-none">{currentUser?.role}</span>
            </div>
          </div>
          
          <button
            onClick={handleFirebaseSignOut}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container: Sidebar + Working Tab Layout Screen */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side Sidebar Menu */}
        <aside className="w-64 border-r border-slate-200 bg-slate-900 flex flex-col justify-between p-4 overflow-y-auto shrink-0 select-none">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "dashboard" ? "bg-red-650 bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Activity className="h-4 w-4" />
              Overview Dashboard
            </button>

            <button
              onClick={() => setActiveTab("accounts")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "accounts" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Sliders className="h-4 w-4" />
              Chart of Accounts
            </button>

            <button
              onClick={() => setActiveTab("projects")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "projects" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FolderGit2 className="h-4 w-4" />
              Donors & Projects
            </button>

            <button
              onClick={() => setActiveTab("expenses")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "expenses" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FileText className="h-4 w-4" />
              Disbursement Vouchers
              <span className="ml-auto bg-slate-800 text-[10px] text-slate-300 px-1.5 py-0.5 rounded-full font-mono">
                {state.expenses.filter(e => ["Submitted", "Under Finance Review", "Approved"].includes(e.status)).length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("procurement")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "procurement" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Layers className="h-4 w-4" />
              Procurement & Bids
            </button>

            <button
              onClick={() => setActiveTab("vendors")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "vendors" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Users className="h-4 w-4" />
              Vendor Registry
            </button>

            <button
              onClick={() => setActiveTab("banking")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "banking" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Coins className="h-4 w-4" />
              Banking & Cash Reconcile
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "ledger" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Building className="h-4 w-4" />
              General double-entry Ledger
            </button>

            <button
              onClick={() => setActiveTab("payroll")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "payroll" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <User className="h-4 w-4" />
              Timesheets & Payroll Allocation
            </button>

            <button
              onClick={() => setActiveTab("assets")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "assets" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <HardDrive className="h-4 w-4" />
              Fixed Assets Roll-Forward
            </button>

            <button
              onClick={() => setActiveTab("partners")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "partners" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Partner Capital Tracking
            </button>

            <button
              onClick={() => setActiveTab("compliance")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "compliance" ? "bg-red-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              Compliance Control Desk
              <span className="ml-auto flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
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
        <main className="flex-1 flex flex-col overflow-y-auto p-8">

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
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                            t.status === "Done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
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
                      <th className="px-6 py-3">Account Type</th>
                      <th className="px-6 py-3">Original Currency</th>
                      <th className="px-6 py-3 text-right">Raw Ledger Balance</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </header>
                  <tbody className="divide-y divide-slate-100 text-sm font-sans">
                    {state.accounts.map((acc) => (
                      <tr key={acc.code} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-mono font-bold text-slate-800">{acc.code}</td>
                        <td className="px-6 py-3 font-medium text-slate-900">{acc.name}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                            acc.type === "Asset" ? "bg-teal-50 text-teal-700" :
                            acc.type === "Liability" ? "bg-amber-50 text-amber-700" :
                            acc.type === "Equity" ? "bg-indigo-50 text-indigo-700" :
                            acc.type === "Revenue" ? "bg-emerald-50 text-emerald-700" :
                            "bg-rose-50 text-rose-700"
                          }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-slate-600">{acc.currency}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-slate-900">
                          {acc.balance.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right">
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

              {/* Budgets Lines adjustments drawer block */}
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
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Attach supporting Invoice/Agreement (PDF)</label>
                      <input
                        type="file"
                        onChange={handleFileDrop}
                        className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
                      />
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
                    const vendor = state.vendors.find(v => v.id === exp.vendorId);
                    const proj = state.projects.find(p => p.id === exp.projectId);
                    
                    return (
                      <div key={exp.id} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold font-mono mr-2">{exp.voucherNo}</span>
                            <span className="text-md font-bold text-slate-900">{exp.title}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] block text-slate-500 uppercase">Val USD Equivalent</span>
                            <span className="text-lg font-bold font-mono text-slate-950">{formatUSD(exp.convertedAmount)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Request Purpose</span>
                            <p className="font-semibold text-slate-800">{exp.purpose}</p>
                          </div>
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Vessel Project</span>
                            <p className="font-bold text-slate-900">{proj?.code} - {proj?.name}</p>
                          </div>
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Contract vendor</span>
                            <p className="font-semibold text-slate-800">{vendor ? vendor.name : "Direct Reimbursement"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] block text-slate-500 uppercase">Current phase status</span>
                            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              exp.status === "Posted" ? "bg-emerald-100 text-emerald-700 font-bold" :
                              exp.status === "Approved" ? "bg-emerald-50 text-emerald-600" :
                              exp.status === "Submitted" ? "bg-indigo-50 text-indigo-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              ● {exp.status}
                            </span>
                          </div>
                        </div>

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

                          {exp.status === "Approved" && ["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                            <div className="flex items-center gap-2">
                              <select
                                id={`ba-sel-${exp.id}`}
                                className="bg-slate-100 text-xs px-2 py-1 rounded border border-slate-300 outline-none"
                              >
                                {state.bankAccounts.map(b => (
                                  <option key={b.id} value={b.id}>{b.name} (Bal: {b.balance.toLocaleString()})</option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  const sel = (document.getElementById(`ba-sel-${exp.id}`) as HTMLSelectElement).value;
                                  handleExpenseAction(exp.id, "cashbook-pay", { bankAccountId: sel, paymentMethod: "Petty cash envelope", paymentRef: `VOU-${exp.voucherNo}` });
                                }}
                                className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded font-medium shadow-sm animate-pulse"
                              >
                                💸 Settle Cashier payment
                              </button>
                            </div>
                          )}

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
                        {exp.comments.length > 0 && (
                          <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Ledger Internal Auditor audit trails</span>
                            {exp.comments.map((c) => (
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
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        pr.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
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

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <header className="bg-slate-100">
                    <tr className="border-b border-sub-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Vendor Account</th>
                      <th className="px-6 py-3">Primary Category</th>
                      <th className="px-6 py-3">Tax Registry ID</th>
                      <th className="px-6 py-3">Audit Disclosures</th>
                      <th className="px-6 py-3">Sanctions Rating</th>
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
                        <td className="px-6 py-4 font-mono font-medium">{v.taxId}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${v.declarationSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {v.declarationSigned ? "Signed Conflict Code" : "Pending Signature"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
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

              {/* Bank Transaction entries directory list */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <header className="bg-slate-100">
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Statement Date</th>
                      <th className="px-6 py-3">Vouchering Ref</th>
                      <th className="px-6 py-3">Account Drawer</th>
                      <th className="px-6 py-3">Description Purpose</th>
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
                          <td className="px-6 py-3 font-semibold text-slate-800">{ba?.name}</td>
                          <td className="px-6 py-3 text-slate-700">{tx.description}</td>
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
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          activeTimesheet?.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
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
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        asset.condition === "Excellent" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
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
                    className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow"
                  >
                    Adjust Global Exchange Rate Settings
                  </button>
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
    </div>
  );
}
