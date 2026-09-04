import { useState } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { Project } from "../types";
import { STREAMS } from "../constants";
import { SharedProps } from "./shared";
import { MANAGERS } from "../roles";

export default function ComplianceTab({ currentUser, eurRateInput, lbpRateInput, refreshState, setEurRateInput, setLbpRateInput, state, t, triggerToast }: SharedProps) {
  // Gemini Compliance scan response
  const [geminiLoading, setGeminiLoading] = useState(false);

  const [geminiReport, setGeminiReport] = useState<string>("");

  const [auditType, setAuditType] = useState("Donor Compliance check");

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
  return (<>
          {true && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("MoF / CNSS Regulatory Compliance Desk & Audit Logs")}</h2>
                <p className="text-xs text-slate-500">
                  AnaHon Media Platform adheres to robust Lebanese Civil Partnership guidelines. Trigger automated AI Audit logs inspections below.
                </p>
              </div>

              {/* Team & Roles — master account only. Role authority lives in the DB (server middleware). */}
              {currentUser.role === "Super Admin" && (
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">👥 Team & Roles (master account)</h3>
                  <p className="text-[11px] text-slate-500">Project Officers can raise vouchers and procurement requests for their assigned projects only — the server refuses everything else, including approving their own requests (§4.3).</p>
                  <div className="space-y-2">
                    {state.users.filter(u => u.active).map(u => {
                      const assigned = new Set<string>(JSON.parse((u as any).projectIdsJson || "[]"));
                      const setRole = async (role: string, projectIds: string[], streamScope?: string) => {
                        try {
                          const res = await fetch("/api/users/set-role", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: u.id, role, projectIds, streamScope: streamScope ?? (u as any).streamScope ?? "", user: currentUser })
                          });
                          if (!res.ok) throw new Error((await res.json()).error || "Failed to set role");
                          triggerToast(`${u.name} → ${role}`);
                          refreshState();
                        } catch (err: any) {
                          triggerToast(err.message, "error");
                        }
                      };
                      return (
                        <div key={u.id} className="flex flex-wrap items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <span className="font-bold text-slate-800 min-w-[140px]">{u.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{u.email}</span>
                          <select
                            value={u.role}
                            onChange={e => setRole(e.target.value, [...assigned])}
                            aria-label={`Role for ${u.name}`}
                            className="finance-input text-xs py-1"
                            disabled={u.id === currentUser.id}
                          >
                            {[...MANAGERS, "Project Officer"].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {u.role === "Project Officer" && (
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Programme:</span>
                              <select
                                value={(u as any).streamScope || ""}
                                onChange={e => setRole(u.role, [...assigned], e.target.value)}
                                aria-label={`Programme scope for ${u.name}`}
                                className="finance-input text-xs py-1"
                              >
                                <option value="">— none (named projects only) —</option>
                                {STREAMS.map(st => <option key={st} value={st}>{st}</option>)}
                              </select>
                              <span className="text-[10px] text-slate-400">every project in that programme, now and later</span>
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Also:</span>
                              {state.projects.map(p => (
                                <label key={p.id} className="flex items-center gap-1 text-[10px] font-mono text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={assigned.has(p.id)}
                                    onChange={e => {
                                      const next = new Set(assigned);
                                      if (e.target.checked) next.add(p.id); else next.delete(p.id);
                                      setRole(u.role, [...next]);
                                    }}
                                  />
                                  {p.code}
                                </label>
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  <div className="flex flex-col md:flex-row gap-2">
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
                      className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow w-full md:w-auto"
                    >
                      Adjust Global Rates
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/fxRates/sync-inforeuro", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user: currentUser })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Sync failed");
                          triggerToast(`Official InfoEuro EUR rate synced: ${data.eurRate} USD (Period: ${data.period})`);
                          setEurRateInput(data.eurRate.toString());
                          refreshState();
                        } catch (err: any) {
                          triggerToast(err.message, "error");
                        }
                      }}
                      className="bg-red-650 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 shadow w-full md:w-auto flex items-center justify-center gap-1 font-sans"
                    >
                      🇪🇺 Sync InfoEuro EUR Rate
                    </button>
                  </div>
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
                      <span className="text-slate-400 font-normal shrink-0">{(log.timestamp.split("T")[1] || log.timestamp).replace("Z", "")}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
  </>);
}
