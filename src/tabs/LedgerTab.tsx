import React, { useState } from "react";
import { Activity } from "lucide-react";
import { Account, Project } from "../types";
import { SharedProps } from "./shared";
import { FINANCE } from "../roles";

export default function LedgerTab({ currentUser, formatUSD, refreshState, state, t, triggerToast }: SharedProps) {
  // Manual Adjustment Journal Entry states
  const [adjDate, setAdjDate] = useState("");

  const [adjDescription, setAdjDescription] = useState("");

  const [adjReferenceNo, setAdjReferenceNo] = useState("");

  const [adjItems, setAdjItems] = useState<{ accountCode: string; debit: number; credit: number; projectId: string }[]>([
    { accountCode: "", debit: 0, credit: 0, projectId: "" },
    { accountCode: "", debit: 0, credit: 0, projectId: "" }
  ]);

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
  return (
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
              {FINANCE.includes(currentUser.role) && (
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
  );
}
