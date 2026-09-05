import React, { useState } from "react";
import { Calendar, Download, User } from "lucide-react";
import { Account, Expense, Project } from "../types";
import { tr } from "../i18n";
import { SharedProps } from "./shared";
import { FINANCE, MANAGERS } from "../roles";

export default function PartnersTab({ currentUser, formatIn, formatUSD, refreshState, state, t, triggerToast }: SharedProps) {
  // Physical cash count form (Banking tab).
  const [cashCountForm, setCashCountForm] = useState({ date: new Date().toLocaleDateString("en-CA"), countedUSD: "", notes: "" });

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

  // Partners drawings Capital values addition
  const [drawPartner, setDrawPartner] = useState("");

  const [drawAmount, setDrawAmount] = useState("");

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
  return (<>
          {true && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Partner Capital & Draws Accounting Accounts")}</h2>
                <p className="text-xs text-slate-500 md:max-w-xl">
                  Civil company regulations dictate partner loan drawdowns and equity contributions be fully aligned with monthly petty cash limits.
                </p>
              </div>

              {/* Draw invest form */}
              {FINANCE.includes(currentUser.role) && (
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
                        {FINANCE.includes(currentUser.role) && (
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
                    {FINANCE.includes(currentUser.role) && (
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
                    {MANAGERS.includes(currentUser.role) && (
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
                        {FINANCE.includes(currentUser.role) && (
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
  </>);
}
