import React, { useState } from "react";
import { Donor, Employee, Project } from "../types";
import { tr } from "../i18n";
import { SharedProps } from "./shared";
import { DIRECTORS, HR, PAYROLL_VIEWERS } from "../roles";

export default function PayrollTab({ contractBusy, contractFor, contractForm, contractParty, currentUser, formatUSD, handleGenerateContract, isSelfService, openDoc, partyFileFor, refreshState, renderPartyFile, setContractFor, setContractForm, setContractParty, setPartyFileFor, state, t, triggerToast }: SharedProps) {
  // Employee registration states
  const [newEmpName, setNewEmpName] = useState("");

  const [newEmpPosition, setNewEmpPosition] = useState("");

  const [newEmpSalary, setNewEmpSalary] = useState("");

  const [newEmpAllowance, setNewEmpAllowance] = useState("");

  // How the money reaches the employee ("Cash" | "Bank Transfer"). Cash is still drawn from a
  // bank account first, so newEmpBankAccountId is required either way.
  const [newEmpPaymentMethod, setNewEmpPaymentMethod] = useState("Bank Transfer");

  const [newEmpBankAccountId, setNewEmpBankAccountId] = useState("");

  const [newEmpContractType, setNewEmpContractType] = useState("");

  // Timesheet Allocation interactive adjustment
  const [selectedTSMonth, setSelectedTSMonth] = useState("2026-05");

  const [tsAllocValues, setTsAllocValues] = useState<{ [projId: string]: number }>({});

  const generatePayslip = async (employeeId: string, name: string, month: string) => {
    try {
      const res = await fetch("/api/payroll/payslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, month, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to generate payslip");
      triggerToast(`Payslip generated for ${name} — ${month}.`);
      openDoc({ id: d.docId, filename: "document" });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
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
          paymentMethod: newEmpPaymentMethod,
          bankAccountId: newEmpBankAccountId,
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
        setNewEmpPaymentMethod("Bank Transfer");
        setNewEmpBankAccountId("");
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
    // Policy 8.4: the timesheet records the % of time per DONOR project; the remainder is
    // non-project/core time. Requiring exactly 100% would force over-allocation (Policy 8.7).
    const allocations = state.projects
      .map(p => ({ projectId: p.id, percentage: tsAllocValues[`${empId}-${p.id}`] || 0 }))
      .filter(a => a.percentage > 0);

    const totalPerc = allocations.reduce((s, x) => s + x.percentage, 0);
    if (totalPerc <= 0) {
      triggerToast("Enter at least one project percentage (donor-charged share of the month).", "error");
      return;
    }
    if (totalPerc > 100) {
      triggerToast(`Over-allocation prohibited (Policy 8.7): donor allocations sum to ${totalPerc}%. Reduce to 100% or less.`, "error");
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
  return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Timesheet Allocation & Co-Funding Cost Mapping")}</h2>
                <p className="text-xs text-slate-500">
                  Donor rules mandate personnel compensation matches timesheet percentage logs signed by project leaders.
                </p>
              </div>

              {/* Register New Employee Form */}
              {HR.includes(currentUser.role) && (
                <form onSubmit={handleEmployeeRegister} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div>
                    <label htmlFor="emp-name" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Full Name")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Farah Shami"
                      required
                      id="emp-name"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="finance-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-position" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Position / Title")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Community Coordinator"
                      required
                      id="emp-position"
                      value={newEmpPosition}
                      onChange={(e) => setNewEmpPosition(e.target.value)}
                      className="finance-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-salary" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Base Salary (USD)")}</label>
                    <input
                      type="number"
                      placeholder="Monthly Base"
                      required
                      id="emp-salary"
                      value={newEmpSalary}
                      onChange={(e) => setNewEmpSalary(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-allowance" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Allowance (USD)")}</label>
                    <input
                      type="number"
                      placeholder="Monthly Allowance"
                      id="emp-allowance"
                      value={newEmpAllowance}
                      onChange={(e) => setNewEmpAllowance(e.target.value)}
                      className="finance-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-bank-account" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Funds Drawn From")}</label>
                    {/* Options come from the real bank accounts, so this list cannot drift away
                        from the accounts AnaHon actually holds. Required even for cash — cash
                        salaries are withdrawn from one of these accounts first. */}
                    <select
                      id="emp-bank-account"
                      value={newEmpBankAccountId}
                      onChange={(e) => setNewEmpBankAccountId(e.target.value)}
                      className="finance-input w-full text-xs"
                      required
                    >
                      <option value="">— Select account —</option>
                      {(state.bankAccounts || []).filter(ba => ba.active).map(ba => (
                        <option key={ba.id} value={ba.id}>🏦 {ba.name} · {ba.accountNo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="emp-delivery" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Delivered By")}</label>
                    <select
                      id="emp-delivery"
                      value={newEmpPaymentMethod}
                      onChange={(e) => setNewEmpPaymentMethod(e.target.value)}
                      className="finance-input w-full text-xs"
                      required
                    >
                      <option value="Bank Transfer">🏦 Bank transfer to employee</option>
                      <option value="Cash">💵 Cash withdrawn from that account</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-955 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all">
                    Register Employee
                  </button>
                </form>
              )}

              {/* Staff timesheets loop list */}
              <div className="space-y-4">
                {state.employees.filter(emp => !isSelfService || (emp.userEmail || "").toLowerCase() === (currentUser.email || "").toLowerCase()).map(emp => {
                  const isOwnCard = (emp.userEmail || "").toLowerCase() === (currentUser.email || "").toLowerCase();
                  const hasTimesheet = state.timesheets.some(t => t.employeeId === emp.id && t.month === selectedTSMonth);
                  const activeTimesheet = state.timesheets.find(t => t.employeeId === emp.id && t.month === selectedTSMonth);
                  // % values typed into this card's inputs — no timesheet is DUE until something is entered
                  const enteredPool = state.projects.reduce((s, p) => s + (Number(tsAllocValues[`${emp.id}-${p.id}`]) || 0), 0);

                  return (
                    <div key={emp.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{emp.name}</h4>
                          <p className="text-xs text-slate-500">{emp.position} • Base: {formatUSD(emp.salary)} + {formatUSD(emp.allowance)} allowance</p>
                          {(() => {
                            const payAcct = state.bankAccounts.find(ba => ba.id === emp.bankAccountId);
                            if (!payAcct) return (
                              <p className="text-[11px] text-amber-700 italic mt-0.5">⚠ No source account on file — payroll cannot be traced to the bank.</p>
                            );
                            const isCash = emp.paymentMethod === "Cash";
                            return (
                              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                <span aria-hidden="true">{isCash ? "💵" : "🏦"}</span> {isCash ? "Cash withdrawn from" : "Bank transfer from"}{" "}
                                {payAcct.name} <span className="text-slate-400">{payAcct.accountNo}</span>
                              </p>
                            );
                          })()}
                          {PAYROLL_VIEWERS.includes(currentUser.role) && (
                            <button
                              type="button"
                              onClick={() => { setContractFor(contractFor === emp.id ? null : emp.id); setContractParty("employee"); }}
                              aria-expanded={contractFor === emp.id}
                              className="mt-1.5 text-[10px] font-bold text-red-650 hover:text-red-700 hover:underline min-h-[44px] md:min-h-0 md:py-1"
                            >
                              {contractFor === emp.id ? "✕ Cancel contract" : "📄 Employment contract"}
                            </button>
                          )}
                          {PAYROLL_VIEWERS.includes(currentUser.role) && (
                            <button
                              type="button"
                              onClick={() => generatePayslip(emp.id, emp.name, selectedTSMonth)}
                              className="block text-[10px] font-bold text-emerald-700 hover:underline mt-0.5 min-h-[24px]"
                              title={`Payslip for ${selectedTSMonth} from the employee record and that month's timesheet`}
                            >
                              🧾 Payslip {selectedTSMonth}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPartyFileFor(partyFileFor === emp.id ? null : emp.id)}
                            aria-expanded={partyFileFor === emp.id}
                            className="block text-[10px] font-bold text-slate-500 hover:text-red-650 hover:underline mt-0.5 min-h-[24px]"
                          >
                            {partyFileFor === emp.id ? "▾ close file" : "📂 open file (contracts + documents)"}
                          </button>
                        </div>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${activeTimesheet?.status === "Approved" ? "bg-emerald-100 text-emerald-700"
                          : activeTimesheet || enteredPool > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>
                          ● Month: {selectedTSMonth} • {activeTimesheet?.status || (enteredPool > 0 ? "Draft Pending" : "No donor allocation")}
                        </span>
                      </div>

                      {partyFileFor === emp.id && renderPartyFile(emp.id, emp.name)}

                      {/* Contract generator — figures are typed by a human, never inferred from
                          salary, because a contract is a signed instrument. */}
                      {contractFor === emp.id && contractParty === "employee" && (
                        <form
                          onSubmit={(e) => handleGenerateContract(e, emp.id, "employee")}
                          aria-label={`Generate employment contract for ${emp.name}`}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                        >
                          <div>
                            <label htmlFor={`ct-project-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Project")}</label>
                            <select id={`ct-project-${emp.id}`} required value={contractForm.projectId}
                              onChange={(e) => setContractForm({ ...contractForm, projectId: e.target.value })}
                              className="finance-input w-full text-xs">
                              <option value="">— Select —</option>
                              {state.projects.filter(p => p.status === "Active").map(p => (
                                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`ct-kind-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Type")}</label>
                            <select id={`ct-kind-${emp.id}`} value={contractForm.kind}
                              onChange={(e) => setContractForm({ ...contractForm, kind: e.target.value })}
                              className="finance-input w-full text-xs">
                              <option value="Employment">Employment contract</option>
                              <option value="Service">Service agreement (staff on deliverables)</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`ct-start-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Start")}</label>
                            <input id={`ct-start-${emp.id}`} type="date" required value={contractForm.startDate}
                              onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                              className="finance-input w-full text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-end-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("End")}</label>
                            <input id={`ct-end-${emp.id}`} type="date" required value={contractForm.endDate}
                              onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                              className="finance-input w-full text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-loe-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Level of Effort %")}</label>
                            <input id={`ct-loe-${emp.id}`} type="number" min="0" max="100" placeholder="optional"
                              value={contractForm.loePct}
                              onChange={(e) => setContractForm({ ...contractForm, loePct: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-fee-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Monthly Fee (USD)")}</label>
                            <input id={`ct-fee-${emp.id}`} type="number" step="0.01" required value={contractForm.monthlyFee}
                              onChange={(e) => setContractForm({ ...contractForm, monthlyFee: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label htmlFor={`ct-total-${emp.id}`} className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Contract Total (USD)")}</label>
                            <input id={`ct-total-${emp.id}`} type="number" step="0.01" required value={contractForm.contractTotal}
                              onChange={(e) => setContractForm({ ...contractForm, contractTotal: e.target.value })}
                              className="finance-input w-full font-mono text-xs" />
                          </div>
                          <button type="submit" disabled={contractBusy}
                            className="bg-slate-900 hover:bg-slate-955 disabled:opacity-50 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all min-h-[44px]">
                            {contractBusy ? "Generating…" : "Generate contract"}
                          </button>
                          <p className="md:col-span-4 text-[10px] text-slate-500 italic">
                            Generated unsigned and filed in the project's vault folder. Countersignatory is taken
                            from the authorised signatories on record. Never backdate — issue a dated addendum instead (Policy §6.8).
                          </p>
                        </form>
                      )}

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

                        {activeTimesheet?.status !== "Approved" && enteredPool > 0 && (HR.includes(currentUser.role) || isOwnCard) && (
                          <button
                            onClick={() => handleTimesheetSubmit(emp.id)}
                            className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5"
                          >
                            Submit allocations log ({enteredPool}%)
                          </button>
                        )}

                        {activeTimesheet && activeTimesheet.status === "Submitted" && DIRECTORS.includes(currentUser.role) && (
                          <button
                            onClick={() => handleApproveTimesheet(activeTimesheet.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded px-4 py-2.5"
                          >
                            ✓ Approve proportional cost allocations
                          </button>
                        )}
                      </div>

                      {/* Employee history: projects worked on + financial statement */}
                      {(() => {
                        const ALIASES: Record<string, string[]> = {
                          "emp-1": ["saad matar"],
                          "emp-2": ["ahmad ayshan", "ahmad aychan"],
                          "emp-3": ["sally kayyali"],
                          "emp-4": ["assem nayrab", "assem nairab"],
                        };
                        const aliases = ALIASES[emp.id] || [emp.name.toLowerCase()];
                        const myTs = state.timesheets
                          .filter(t => t.employeeId === emp.id)
                          .sort((a, b) => a.month.localeCompare(b.month));
                        // project engagement periods from timesheet allocations
                        const eng: Record<string, { pct: number; first: string; last: string; months: number }> = {};
                        for (const t of myTs) {
                          let allocs: any[] = [];
                          try { allocs = JSON.parse((t as any).allocationsJson || "[]"); } catch { }
                          if (!allocs.length && (t as any).allocations) allocs = (t as any).allocations;
                          for (const a of allocs) {
                            if (!a.projectId) continue;
                            const e = eng[a.projectId] || { pct: a.percentage, first: t.month, last: t.month, months: 0 };
                            e.pct = a.percentage; e.last = t.month; e.months += 1;
                            if (t.month < e.first) e.first = t.month;
                            eng[a.projectId] = e;
                          }
                        }
                        // payments matched from posted vouchers
                        const paid: Record<string, { n: number; usd: number }> = {};
                        let grand = 0;
                        for (const ex of state.expenses) {
                          const hay = `${ex.title} ${ex.purpose}`.toLowerCase();
                          if (!aliases.some(a => hay.includes(a))) continue;
                          const key = ex.projectId || "—";
                          const p = paid[key] || { n: 0, usd: 0 };
                          p.n += 1; p.usd += ex.convertedAmount; paid[key] = p; grand += ex.convertedAmount;
                        }
                        const projName = (pid: string) => state.projects.find(p => p.id === pid)?.code || pid;
                        const rows = Array.from(new Set([...Object.keys(eng), ...Object.keys(paid)]));
                        if (!rows.length) return null;
                        return (
                          <div className="border-t border-slate-100 pt-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Employment history & financial statement</p>
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-[10px] text-slate-500 uppercase">
                                  <th className="py-1 pr-2">Project</th>
                                  <th className="py-1 pr-2">LOE</th>
                                  <th className="py-1 pr-2">Period</th>
                                  <th className="py-1 pr-2 text-right">Months</th>
                                  <th className="py-1 pr-2 text-right">Payments</th>
                                  <th className="py-1 text-right">Total paid (USD)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map(pid => {
                                  // payments without any timesheet engagement = per-deliverable
                                  // service-provider work (Policy 8.6), not payroll
                                  const contractor = !eng[pid] && (paid[pid]?.n || 0) > 0;
                                  return (
                                    <tr key={pid} className="border-t border-slate-100">
                                      <td className="py-1.5 pr-2 font-semibold">{projName(pid)}</td>
                                      <td className="py-1.5 pr-2">{eng[pid] ? `${eng[pid].pct}% (payroll)` : contractor ? <span className="text-indigo-700 font-semibold">Contractor · per deliverable</span> : "—"}</td>
                                      <td className="py-1.5 pr-2 font-mono text-[11px]">{eng[pid] ? `${eng[pid].first} → ${eng[pid].last}` : "—"}</td>
                                      <td className="py-1.5 pr-2 text-right">{eng[pid]?.months ?? "—"}</td>
                                      <td className="py-1.5 pr-2 text-right">{paid[pid]?.n ?? 0}</td>
                                      <td className="py-1.5 text-right font-mono">{formatUSD(paid[pid]?.usd || 0)}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="border-t-2 border-slate-300 font-bold">
                                  <td className="py-1.5 pr-2" colSpan={5}>Career total (all recorded vouchers)</td>
                                  <td className="py-1.5 text-right font-mono">{formatUSD(grand)}</td>
                                </tr>
                              </tbody>
                            </table>
                            <p className="text-[10px] text-slate-400 mt-1">Derived from approved timesheets and posted vouchers; FPU amounts are EUR paid, shown at the report rate.</p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

            </div>
  );
}
