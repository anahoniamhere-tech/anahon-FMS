import React, { useState, FormEvent } from "react";
import { Account, Expense } from "../types";
import { tr } from "../i18n";
import { SharedProps } from "./shared";
import { FINANCE } from "../roles";

export default function AccountsTab({ currentUser, setState, state, t, triggerToast }: SharedProps) {
  // Sub-forms and interactive options
  const [newAccountCode, setNewAccountCode] = useState("");

  const [newAccountName, setNewAccountName] = useState("");

  const [newAccountType, setNewAccountType] = useState<"Asset" | "Liability" | "Equity" | "Revenue" | "Expense">("Expense");

  const [newAccountCurrency, setNewAccountCurrency] = useState<"USD" | "EUR" | "LBP">("USD");

  const [newAccountGroup, setNewAccountGroup] = useState("Operating Expenses");

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
  return (
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
              {FINANCE.includes(currentUser.role) && (
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
  );
}
