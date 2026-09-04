import React, { useState } from "react";
import { Account } from "../types";
import { tr } from "../i18n";
import { SharedProps } from "./shared";
import { FINANCE } from "../roles";

export default function BankingTab({ bankFilterAcc, setBankFilterAcc, bankSearch, setBankSearch, currentUser, refreshState, state, t, triggerToast }: SharedProps) {
  // Bank Reconciliation Trigger form
  const [recBank, setRecBank] = useState("");

  const [recType, setRecType] = useState<"Deposit" | "Withdrawal">("Withdrawal");

  const [recDesc, setRecDesc] = useState("");

  const [recAmount, setRecAmount] = useState("");

  const [bankShown, setBankShown] = useState<number>(50);

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
  return (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{t("Banking Statements & Cash Recon Ledger")}</h2>
                  <p className="text-xs text-slate-500">Match raw physical statements to vouchers to evaluate reconciliatory variances.</p>
                </div>
              </div>

              {/* Direct Reconcile form */}
              {FINANCE.includes(currentUser.role) && (
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
  );
}
