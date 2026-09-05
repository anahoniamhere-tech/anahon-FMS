import { useState } from "react";
import { Activity, Calendar, Copy, DollarSign, FolderGit2, Percent, Sliders } from "lucide-react";
import { Donor, Project } from "../types";
import { SharedProps } from "./shared";

export default function DashboardTab({ formatIn, formatUSD, handleNavClick, isProjectOfficer, phoneAccess, requestableProjects, state, t, triggerToast }: SharedProps) {
  const [showPhoneQr, setShowPhoneQr] = useState(false);

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
  return (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-sans text-slate-900"> Tripoli Operations Control Dashboard</h2>
                  <p className="text-sm text-slate-500">
                    Consolidated cashboxes, restricted project ledger balances, and active compliance review status.
                  </p>
                </div>
                {/* Instant KPI metrics banner */}
                {/* Counted from the register, not asserted: a score nothing computes is
                    worse than no score, because it gets quoted to a donor. */}
                <button
                  type="button"
                  onClick={() => handleNavClick("mydesk")}
                  className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-3 text-left hover:border-red-300"
                >
                  <Activity className="h-8 w-8 text-red-600" />
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Statutory checklist</h3>
                    <p className="text-xl font-bold font-mono text-red-600">
                      {(state.complianceTasks || []).filter(t => t.status === "Done").length}
                      <span className="text-slate-400"> / {(state.complianceTasks || []).length}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(state.complianceTasks || []).filter(t => t.status !== "Done" && t.dueDate < new Date().toLocaleDateString("en-CA")).length} overdue · open on My Desk
                    </p>
                  </div>
                </button>
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
                  <h3 className="mt-2 text-2xl font-bold font-mono text-slate-800">
                    {state.orgSettings?.vatRate ?? 0}% VAT
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Approval threshold {formatUSD(state.orgSettings?.approvalThresholdUSD ?? 0)} · click to open Compliance
                  </p>
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
  );
}
