import { useState } from "react";
import { Download } from "lucide-react";
import { Account, Project } from "../types";
import { tr } from "../i18n";
import { SharedProps } from "./shared";

export default function ReportsTab({ formatUSD, t, triggerToast }: SharedProps) {
  // Periodic reports (Policy 11.2)
  const [reportData, setReportData] = useState<any>(null);

  const [reportLoading, setReportLoading] = useState(false);

  const [reportEnd, setReportEnd] = useState<string>(new Date().toISOString().slice(0, 7));

  // Export filename follows the Policy 13.4.1 pattern (YEAR_ENTITY_DOCTYPE_PERIOD).
  // Browsers take the PDF filename from document.title, so we swap it for the print only.
  const reportFileName = (meta: any) =>
    `${meta.periodEnd.slice(0, 4)}_ANAHON_${meta.months === 12 ? "ANNUAL" : meta.months === 6 ? "SEMI-ANNUAL" : `${meta.months}-MONTH`}-FINANCIAL-REPORT_${meta.periodStart}_to_${meta.periodEnd}`;

  // Direct PDF export: writes the file with the policy filename, bypassing the OS print
  // dialog (which names the file after the host app, not the page).
  const downloadPeriodReport = async () => {
    if (!reportData) return;
    const el = document.getElementById("period-report");
    if (!el) return;
    setReportLoading(true);
    try {
      // Rendered server-side (headless Chrome): real selectable text and page breaks.
      const res = await fetch(`/api/reports/pdf?months=${reportData.meta.months}&end=${reportEnd}`);
      if (!res.ok) throw new Error((await res.json()).error || "Rendering failed");
      const blob = await res.blob();
      const name = `${reportFileName(reportData.meta)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      triggerToast(`Saved ${name} to your Downloads folder.`);
    } catch (err: any) {
      triggerToast(`PDF export failed: ${err.message}. Use Print instead.`, "error");
    } finally {
      setReportLoading(false);
    }
  };

  const printPeriodReport = () => {
    if (!reportData) return;
    const previousTitle = document.title;
    document.title = reportFileName(reportData.meta);
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 60000); // fallback if afterprint never fires
  };

  // Custom timeframe: when a start month is set, it wins over the preset buttons.
  const [reportStart, setReportStart] = useState<string>("");

  const generatePeriodReport = async (months: number) => {
    setReportLoading(true);
    try {
      const q = reportStart ? `start=${reportStart}&end=${reportEnd}` : `months=${months}&end=${reportEnd}`;
      const res = await fetch(`/api/reports/period?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Report generation failed.");
      setReportData(data);
    } catch (err: any) {
      setReportData(null);
      triggerToast(err.message, "error");
    } finally {
      setReportLoading(false);
    }
  };
  return (
            <div className="space-y-6">
              <style>{`@media print { body * { visibility: hidden; } #period-report, #period-report * { visibility: visible; } #period-report { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; } }`}</style>
              <div>
                <h2 className="text-xl font-bold">{t("Periodic Financial Reports")}</h2>
                <p className="text-xs text-slate-500">Semi-annual and annual reporting per Policy 11.2 — budget vs actual, income, cash position, compliance status.</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="report-start" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Period starting (optional)")}</label>
                  <input id="report-start" type="month" value={reportStart} onChange={e => setReportStart(e.target.value)} className="finance-input text-xs" />
                </div>
                <div>
                  <label htmlFor="report-end" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Period ending (month)")}</label>
                  <input id="report-end" type="month" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="finance-input text-xs" />
                </div>
                {reportStart ? (
                  <button disabled={reportLoading} onClick={() => generatePeriodReport(0)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                    {reportLoading ? "Generating…" : `Generate ${reportStart} → ${reportEnd} Report`}
                  </button>
                ) : (<>
                <button disabled={reportLoading} onClick={() => generatePeriodReport(6)} className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                  {reportLoading ? "Generating…" : "Generate 6-Month Report"}
                </button>
                <button disabled={reportLoading} onClick={() => generatePeriodReport(12)} className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                  {reportLoading ? "Generating…" : "Generate Annual Report"}
                </button>
                </>)}
                {reportData && (
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-mono hidden md:block" title="Filename used when saving as PDF (Policy 13.4.1)">
                      {reportFileName(reportData.meta)}.pdf
                    </span>
                    <button disabled={reportLoading} onClick={downloadPeriodReport} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 disabled:opacity-50">
                      ⬇ Download PDF
                    </button>
                    <button onClick={printPeriodReport} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded px-3 py-2.5" title="Opens the OS print dialog (filename set by the app, not the report)">
                      🖨 Print
                    </button>
                  </div>
                )}
              </div>

              {reportData && (
                <div id="period-report" className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm space-y-6 text-sm">
                  <div className="border-b-2 border-slate-900 pb-3">
                    <h1 className="text-lg font-bold tracking-wide">ANAHON MEDIA PLATFORM — {reportData.meta.title.toUpperCase()}</h1>
                    <p className="text-xs text-slate-600">Period: {reportData.meta.periodStart} → {reportData.meta.periodEnd} · Basis: {reportData.meta.basis} · Generated: {reportData.meta.generatedAt.slice(0, 16).replace("T", " ")} UTC</p>
                  </div>

                  {/* Stacks on phones — three currency figures side by side at 375px overlap. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-3 border border-slate-200 rounded"><p className="text-[10px] uppercase font-bold text-slate-500">Income received</p><p className="text-lg font-mono font-bold">{formatUSD(reportData.totals.incomeInPeriod)}</p></div>
                    <div className="p-3 border border-slate-200 rounded"><p className="text-[10px] uppercase font-bold text-slate-500">Expenditure</p><p className="text-lg font-mono font-bold">{formatUSD(reportData.totals.expenditureInPeriod)}</p></div>
                    <div className="p-3 border border-slate-200 rounded"><p className="text-[10px] uppercase font-bold text-slate-500">Vouchers</p><p className="text-lg font-mono font-bold">{reportData.totals.vouchersInPeriod}</p></div>
                  </div>

                  {reportData.statement && (
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">
                        {t("Surplus & Deficit Statement")}
                      </h3>
                      <p className="text-[10px] text-slate-500 mb-2">
                        {t("Five lines. Each one subtracts from the one above. Taken from the posted ledger, not from voucher rollups.")}
                      </p>
                      <table className="w-full text-xs">
                        <tbody>
                          {reportData.statementLines?.map((line: any) => {
                            const v = reportData.statement[line.key] as number;
                            const isTotal = !!line.computed;
                            return (
                              <tr key={line.key} className={isTotal ? "bg-slate-100 font-bold" : "border-t border-slate-100"}>
                                <td className="py-1.5 pr-2 w-8 text-slate-400 font-mono text-[10px]">{line.less ? "less" : isTotal ? "=" : ""}</td>
                                <td className="py-1.5 pr-2">
                                  <span className={isTotal ? "text-slate-900" : "text-slate-800"}>{line.en}</span>
                                  <span className="text-slate-500 mr-2 ml-2" dir="rtl">{line.ar}</span>
                                </td>
                                <td className="py-1.5 pr-2 text-slate-500 text-[10px] hidden md:table-cell">{line.note}</td>
                                <td className={`py-1.5 text-right font-mono ${v < 0 ? "text-red-700" : ""}`}>{formatUSD(v)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Recognition policy decides whether these five lines mean anything.
                          If grant income is booked on receipt, the surplus is an artefact. */}
                      {reportData.recognition?.map((f: any) => (
                        <p key={f.rule} className="text-[10px] text-red-900 bg-red-50 border border-red-200 rounded px-2 py-1.5 mt-2">
                          <span className="font-bold">{t("Recognition rule")} {f.rule}: </span>{tr(f.ar, f.en)}
                        </p>
                      ))}
                      {/* A restricted-grant surplus is unspent donor money, not a cushion.
                          Saying so here stops the figure being read as free cash. */}
                      {reportData.statement.surplus > 0 && (
                        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
                          {t("A surplus on restricted grants is unspent donor money carried forward, not free cash — read it against the restricted balances above.")}
                        </p>
                      )}
                      {!!reportData.statement.unclassified?.length && (
                        <p className="text-[10px] text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5 mt-2">
                          {t("Postings the statement could not place")}: {reportData.statement.unclassified.map((u: any) => `${u.code} (${formatUSD(u.amount)})`).join(", ")}
                        </p>
                      )}
                      <details className="mt-2">
                        <summary className="text-[10px] text-slate-500 cursor-pointer">{t("Accounts behind these lines")}</summary>
                        <table className="w-full text-[11px] mt-1">
                          <tbody>{reportData.statement.rows.map((r: any) => (
                            <tr key={r.code} className="border-t border-slate-100">
                              <td className="py-0.5 pr-2 font-mono text-slate-500">{r.code}</td>
                              <td className="pr-2">{r.name}</td>
                              <td className="pr-2 text-slate-400 text-[10px]">{r.bucket}</td>
                              <td className="text-right font-mono">{formatUSD(r.amount)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </details>
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">1. Budget vs Actual by Project</h3>
                    {reportData.perProject.map((p: any) => (
                      <div key={p.code} className="mb-4">
                        <p className="font-semibold text-xs bg-slate-100 px-2 py-1 rounded">{p.code} — {p.name} · {p.donor} · {p.status} · allocated {formatUSD(p.allocated)} · spent to date {formatUSD(p.toDate)} ({p.variancePct > 0 ? "+" : ""}{p.variancePct}%)</p>
                        <table className="w-full text-xs mt-1">
                          <thead><tr className="text-[10px] text-slate-500 uppercase text-left"><th className="py-0.5">Line</th><th>Description</th><th className="text-right">Allocated</th><th className="text-right">In period</th><th className="text-right">Actual to date</th></tr></thead>
                          <tbody>{p.lines.map((l: any) => (
                            <tr key={l.code} className="border-t border-slate-100"><td className="py-0.5 pr-2 font-mono">{l.code}</td><td className="pr-2">{l.description.split(" (EUR")[0].slice(0, 48)}</td><td className="text-right font-mono">{formatUSD(l.allocated)}</td><td className="text-right font-mono">{formatUSD(l.inPeriod)}</td><td className="text-right font-mono">{formatUSD(l.actual)}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">2. Expenditure by Category (period)</h3>
                      <table className="w-full text-xs">{Object.entries(reportData.byCategory).map(([c, v]: any) => (
                        <tbody key={c}><tr className="border-t border-slate-100"><td className="py-1">{c}</td><td className="text-right font-mono">{formatUSD(v)}</td></tr></tbody>))}
                      </table>
                    </div>
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">3. Cash & Bank Position (current)</h3>
                      <table className="w-full text-xs">{reportData.bankPosition.map((b: any) => (
                        <tbody key={b.name}><tr className="border-t border-slate-100"><td className="py-1">{b.name} ({b.currency})</td><td className="text-right font-mono">{b.balance.toLocaleString()} {b.currency}</td><td className="text-right font-mono">{formatUSD(b.usd)}</td></tr></tbody>))}
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">4. Income Received in Period</h3>
                    <table className="w-full text-xs">
                      <thead><tr className="text-[10px] text-slate-500 uppercase text-left"><th className="py-0.5">Date</th><th>Description</th><th>Account</th><th className="text-right">Amount</th><th className="text-right">USD</th></tr></thead>
                      <tbody>{reportData.deposits.map((d: any, i: number) => (
                        <tr key={i} className="border-t border-slate-100"><td className="py-0.5 font-mono">{d.date}</td><td className="pr-2">{d.description.slice(0, 60)}</td><td>{d.account}</td><td className="text-right font-mono">{d.amount.toLocaleString()} {d.currency}</td><td className="text-right font-mono">{formatUSD(d.usd)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>

                  {reportData.internalMovements?.length > 0 && (
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider mb-2">
                        4b. Internal Movements — excluded from income ({formatUSD(reportData.totals.internalMovementsInPeriod)})
                      </h3>
                      <p className="text-[10px] text-slate-500 mb-1">Currency conversions and reversals between our own balances. Listed for completeness; counting them as income would double-count money already received.</p>
                      <table className="w-full text-xs">
                        <tbody>{reportData.internalMovements.map((d: any, i: number) => (
                          <tr key={i} className="border-t border-slate-100"><td className="py-0.5 font-mono">{d.date}</td><td className="pr-2">{d.description.slice(0, 60)}</td><td className="text-right font-mono">{d.amount.toLocaleString()} {d.currency}</td><td className="text-right font-mono text-slate-500">{formatUSD(d.usd)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">5. Compliance Status</h3>
                    {reportData.compliance.map((t: any, i: number) => (
                      <p key={i} className="text-xs py-0.5 border-t border-slate-100">{t.overdue ? "🔴" : t.status === "Done" ? "✅" : "🟡"} {t.title} — {t.status}{t.dueDate ? ` (due ${t.dueDate})` : ""}</p>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-500 border border-amber-200 bg-amber-50/40 rounded p-2">
                    <p className="font-bold uppercase mb-1">Notes & known limitations</p>
                    {reportData.caveats.map((c: string, i: number) => <p key={i}>• {c}</p>)}
                  </div>

                  <div className="flex gap-16 pt-8">
                    <div className="flex-1 border-t border-slate-400 pt-1 text-xs">Prepared by — Finance Officer (Policy 11.7)<br />Name & signature: ____________________</div>
                    <div className="flex-1 border-t border-slate-400 pt-1 text-xs">Approved by — Program Director (Policy 11.7)<br />Name & signature: ____________________</div>
                  </div>
                </div>
              )}
            </div>
  );
}
