import React, { useState } from "react";
import { Expense, Project, Quotation } from "../types";
import { SharedProps } from "./shared";
import Info from "../Info";

export default function ProcurementTab({ currentUser, refreshState, requestableProjects, state, t, triggerToast, lang }: SharedProps) {
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

  const [procVendorC, setProcVendorC] = useState("");

  const [procAmountC, setProcAmountC] = useState("");

  const [procScoreC, setProcScoreC] = useState("60");

  const [procJustification, setProcJustification] = useState("");

  const [procConflict, setProcConflict] = useState(false);

  // Waiver: fewer than 3 quotations, only with a written reason.
  const [procSingleSource, setProcSingleSource] = useState(false);

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
          // Only quotations actually obtained. The form used to pad a phantom
          // "Second Sourced Vendor" at 0 USD, which fabricated a comparison.
          quotations: [
            { vendorName: procVendorA, amount: procAmountA, currency: "USD", score: procScoreA, selected: true },
            ...(procVendorB ? [{ vendorName: procVendorB, amount: procAmountB || "0", currency: "USD", score: procScoreB, selected: false }] : []),
            ...(procVendorC ? [{ vendorName: procVendorC, amount: procAmountC || "0", currency: "USD", score: procScoreC, selected: false }] : [])
          ],
          justification: procJustification,
          conflictDeclared: procConflict,
          singleSource: procSingleSource,
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
  return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Tripoli Sourcing & RFQ Comparative Sheets")}</h2>
                <p className="text-xs text-slate-500">Internal policy (Section 7.2) demands at least 3 compared quotations for any procurement exceeding 300 USD. Stricter donor thresholds apply on top when required.</p>
              </div>

              {/* Submit bid comparison */}
              {["Super Admin", "Finance Officer", "Project Lead", "Project Officer"].includes(currentUser.role) && (
                <form onSubmit={handleProcurementSubmit} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Comparative RFQ Title")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Sourcing 3 tripod screens"
                      value={procTitle}
                      onChange={(e) => setProcTitle(e.target.value)}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Vessel Project Mapping")}</label>
                    <select
                      value={procProject}
                      onChange={(e) => setProcProject(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Select Project Sinking Code --</option>
                      {requestableProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t("Sub-Budget Mapping")}</label>
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

                  {/* Sourced Option C — Policy 7.2 needs three compared bids */}
                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 block">THIRD COMPETING BID</span>
                    <input
                      type="text"
                      placeholder="Vendor C Name"
                      value={procVendorC}
                      onChange={(e) => setProcVendorC(e.target.value)}
                      className="finance-input w-full bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Bid USD"
                        value={procAmountC}
                        onChange={(e) => setProcAmountC(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Rating %"
                        value={procScoreC}
                        onChange={(e) => setProcScoreC(e.target.value)}
                        className="finance-input w-full bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Single-source waiver — documented exception, never a silent bypass */}
                  <div className="md:col-span-3 border border-amber-200 bg-amber-50 p-3 rounded space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <input
                        type="checkbox"
                        checked={procSingleSource}
                        onChange={(e) => setProcSingleSource(e.target.checked)}
                      />
                      Single source — competition was not possible
                    </label>
                    <p className="text-[10px] text-amber-800">
                      Tick only when fewer than three quotations are genuinely obtainable (sole supplier, emergency response,
                      a cooperative that issues the coupons). A written reason of at least 30 characters is required below,
                      it is approved as a waiver, and it is recorded in the audit trail — donors accept a justified
                      exception, not a missing comparison.
                    </p>
                  </div>

                  <div className="border border-slate-105 p-3 rounded bg-slate-50 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">{t("Audit Justification Memo")}</label>
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

                    <div className={`mt-3 p-3 text-xs rounded font-mono italic ${(pr as any).singleSource ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                      {(pr as any).singleSource ? "⚠️" : "ℹ️"} <strong>{(pr as any).singleSource ? "Single-source waiver — competition waived. Stated reason:" : "Selection Memo:"}</strong> "{pr.justification}"
                      {(pr as any).approvedBy && <span className="block mt-1 not-italic text-[10px]">Approved by {(pr as any).approvedBy}</span>}
                    </div>

                    {pr.status === "Under Evaluation" && ["Super Admin", "Executive Director"].includes(currentUser.role) && (
                      <><button
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
                      </button><Info id="procurement-approve" lang={lang} /></>
                    )}
                  </div>
                ))}
              </div>

            </div>
  );
}
