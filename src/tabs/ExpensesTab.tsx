import React, { useState } from "react";
import { selfDealingRequester } from "../selfDealing";
import { Search } from "lucide-react";
import { Procurement, Project, Vendor } from "../types";
import { SharedProps } from "./shared";

export default function ExpensesTab({ currentUser, formatUSD, handleVoucherDocUpload, openDoc, refreshState, requestableProjects, searchTerm, setDrawerExpenseId, setSearchTerm, state, t, triggerToast }: SharedProps) {
  const [vFilter, setVFilter] = useState({ from: "", to: "", type: "", status: "" });

  // New Expense submission form
  const [expenseTitle, setExpenseTitle] = useState("");

  const [expensePurpose, setExpensePurpose] = useState("");

  const [expenseVendor, setExpenseVendor] = useState("");

  const [expenseProject, setExpenseProject] = useState("");

  const [expenseBudgetLine, setExpenseBudgetLine] = useState("");

  // Approved procurement authorising a >USD 300 purchase (Policy 7.2).
  const [expenseProcurement, setExpenseProcurement] = useState("");

  // Inline single-source waiver raised from the voucher form (null = panel closed).
  const [inlineWaiver, setInlineWaiver] = useState<{ vendorName: string; amount: string; reason: string; retrospective: boolean } | null>(null);

  const [expenseCurrency, setExpenseCurrency] = useState<"USD" | "EUR" | "LBP">("USD");

  const [expenseAmount, setExpenseAmount] = useState("");

  const [expenseCustomRate, setExpenseCustomRate] = useState("");

  const [tempAttachment, setTempAttachment] = useState<{ filename: string; mimeType: string; base64: string } | null>(null);

  const [aiScanning, setAiScanning] = useState(false);

  // Shared cost split allocation states
  const [enableSharedSplit, setEnableSharedSplit] = useState(false);

  const [splitAllocations, setSplitAllocations] = useState<{ projectId: string; budgetLineId: string; percentage: number; }[]>([
    { projectId: "", budgetLineId: "", percentage: 50 },
    { projectId: "", budgetLineId: "", percentage: 50 }
  ]);

  // Requester-only role: raises vouchers/procurement for assigned projects, approves nothing.
  // The server enforces this independently — the UI gating is convenience, not the control.
  /** Derived, never stored, so it stays true if either side of the link changes. */
  const selfDealing = (exp: { vendorId?: string; requestorId?: string }) =>
    selfDealingRequester(exp, state.vendors, state.users);

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
        triggerToast("Waiver raised — a Finance Officer or the Executive Director must approve it before this voucher can be lodged.", "error");
      }
      setInlineWaiver(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
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
  return (<>
          {true && (
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
                      <label className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-red-650 hover:underline cursor-pointer min-h-[44px]">
                        📷 {t("Photograph the receipt")}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleFileDrop}
                        />
                      </label>
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

                          {["Submitted", "Under Finance Review"].includes(exp.status) && ["Super Admin", "Executive Director"].includes(currentUser.role) && (
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
  </>);
}
