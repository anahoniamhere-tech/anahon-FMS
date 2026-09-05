import React, { useState, FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Donor, Opportunity, Proposal } from "../types";
import { OPP_STAGES, PROPOSAL_SECTIONS, STREAMS } from "../constants";
import { SharedProps } from "./shared";
import { MANAGERS } from "../roles";

export default function FunnelTab({ currentUser, formatUSD, handleNavClick, openDoc, refreshState, setSelectedProjectId, state, t, triggerToast }: SharedProps) {
  // Funding funnel: the opportunity being added/edited (null = form closed)
  const [oppForm, setOppForm] = useState<Partial<Opportunity> | null>(null);

  // Proposal workspace: the opportunity whose proposal is being written
  const [propForm, setPropForm] = useState<(Partial<Opportunity> & { proposal: Proposal }) | null>(null);

  // AI assist inside the workspace: pasted call text, busy flag, last fit assessment
  const [aiCall, setAiCall] = useState("");

  const [callUrl, setCallUrl] = useState("");

  const [callBusy, setCallBusy] = useState(false);

  const [aiBusy, setAiBusy] = useState(false);

  const [aiAssess, setAiAssess] = useState<{ fit: string; recommendedStream: string; rationale: string; risks: string[]; suggestedAngle: string } | null>(null);

  // Call intake: start an opportunity FROM a call rather than typing it in
  const [intakeOpen, setIntakeOpen] = useState(false);

  const [intakeUrl, setIntakeUrl] = useState("");

  const [intakeText, setIntakeText] = useState("");

  const [intakeBusy, setIntakeBusy] = useState(false);

  const [intake, setIntake] = useState<{ source: string; provider: string; callText: string; draft: any; assessment: any } | null>(null);

  // ── Funding funnel handlers ──────────────────────────────────────────────
  // Pipeline is forward-looking only; the server keeps it out of all financial math.
  const saveOpportunity = async (e: FormEvent) => {
    e.preventDefault();
    if (!oppForm?.title || !oppForm?.stage) {
      triggerToast("An opportunity needs at least a title and a stage.", "error");
      return;
    }
    try {
      const res = await fetch("/api/opportunities/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...oppForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save opportunity");
      triggerToast(`Pipeline ${oppForm.id ? "updated" : "added"}: ${oppForm.title}`);
      setOppForm(null);
      setIntake(null);
      setIntakeOpen(false);
      setIntakeUrl("");
      setIntakeText("");
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const moveOpportunity = async (opp: Opportunity, stage: string) => {
    try {
      const res = await fetch("/api/opportunities/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...opp, stage, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to move opportunity");
      triggerToast(`"${opp.title}" moved to ${stage}.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const deleteOpportunity = async (opp: Opportunity) => {
    if (!window.confirm(`Remove "${opp.title}" from the pipeline?`)) return;
    try {
      const res = await fetch("/api/opportunities/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: opp.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete opportunity");
      triggerToast(`Removed from pipeline: ${opp.title}`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // ── Proposal workspace handlers ───────────────────────────────────────────
  const saveProposal = async (thenGenerate: boolean) => {
    if (!propForm?.id) return;
    try {
      const res = await fetch("/api/opportunities/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...propForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save proposal");
      if (thenGenerate) {
        const docRes = await fetch("/api/opportunities/proposal-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: propForm.id, user: currentUser })
        });
        const docData = await docRes.json();
        if (!docRes.ok) throw new Error(docData.error || "Failed to generate proposal document");
        openDoc({ id: docData.docId, filename: "document" });
        triggerToast("Proposal saved and document filed to vault (GENERAL/Proposals).");
      } else {
        triggerToast(`Proposal saved: ${propForm.title}`);
      }
      setPropForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // A call can arrive as a PDF, a Word file or a link. Extract to plain text and put it in
  // the box so the user reads and edits it BEFORE any AI sees it.
  const loadCallSource = async (payload: any, label: string) => {
    setCallBusy(true);
    try {
      const res = await fetch("/api/opportunities/call-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not read that source");
      setAiCall(prev => (prev ? `${prev}\n\n— ${label} —\n${d.text}` : `— ${label} —\n${d.text}`));
      triggerToast(`Loaded ${d.text.length.toLocaleString()} characters from ${d.source} — review it before running the assist.`);
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
    setCallBusy(false);
  };

  // Read a call (link, file or pasted text) and let the AI propose the whole opportunity.
  // Nothing is saved: the draft lands in the normal form so every field stays editable.
  const runIntake = async (payload: any) => {
    setIntakeBusy(true);
    try {
      const res = await fetch("/api/opportunities/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not read that call");
      setIntake(d);
      setOppForm({
        ...d.draft,
        // donorName rides along so saving can register a funder we don't have yet
        donorName: d.draft.donorIsNew ? d.draft.donorName : undefined
      } as any);
      setAiCall(d.callText);
      triggerToast(`${d.provider} read the call from ${d.source} — fit: ${d.assessment.fit}. Review every field before saving.`);
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
    setIntakeBusy(false);
  };

  const intakeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    const base64: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
      r.readAsDataURL(file);
    });
    await runIntake({ filename: file.name, base64 });
  };

  const loadCallFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    const base64: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
      r.readAsDataURL(file);
    });
    await loadCallSource({ filename: file.name, base64 }, file.name);
  };

  // AI prefills, humans decide: drafts fill only sections the user left empty.
  const runAiAssist = async (mode: "assess" | "draft") => {
    if (!propForm?.id) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/opportunities/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: propForm.id, callText: aiCall, mode, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "AI assist failed");
      if (mode === "assess") {
        setAiAssess(d.result);
      } else {
        const merged = { ...propForm.proposal };
        let filled = 0, kept = 0;
        (["summary", "problem", "solution", "objectives", "deliverables", "outputs", "outcomes"] as (keyof Proposal)[]).forEach(k => {
          const v = d.result[k];
          if (v && !(merged[k] as string)) { (merged as any)[k] = v; filled++; }
          else if (v) kept++;
        });
        setPropForm({ ...propForm, proposal: merged });
        triggerToast(`AI drafted ${filled} empty section${filled === 1 ? "" : "s"}${kept ? ` (${kept} kept your own text)` : ""} — review every line before saving.`);
      }
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
    setAiBusy(false);
  };

  const propBudget = propForm?.proposal.budget || [];

  const propTimeline = propForm?.proposal.timeline || [];

  const setProposal = (patch: Partial<Proposal>) => propForm && setPropForm({ ...propForm, proposal: { ...propForm.proposal, ...patch } });
  return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("AnaHon Programs & Funding Funnel")}</h2>
                <p className="text-xs text-slate-500">
                  AnaHon (Civil Company 90/2023, Tripoli) is the sole applicant, implementing and financial body.
                  Five programs sit under it. The pipeline below is forward-looking only — nothing here touches
                  balances or reports until a bank deposit registers a real project.
                </p>
              </div>

              {/* Program stream cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {STREAMS.map(s => {
                  const projs = state.projects.filter(p => (p.stream || "") === s);
                  const opps = state.opportunities.filter(o => o.stream === s && o.stage !== "Declined");
                  const activeCount = projs.filter(p => p.status === "Active").length;
                  const totalFunded = projs.reduce((sum, p) => sum + (p.budgetUSD || 0), 0);
                  return (
                    <div key={s} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-slate-900">{s}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{projs.length} funded · {activeCount} active</span>
                      </div>
                      {projs.length > 0 ? (
                        <ul className="space-y-1 mb-3">
                          {projs.map(p => (
                            <li key={p.id}>
                              {/* Click-through: open this project in the Projects register. */}
                              <button
                                onClick={() => { setSelectedProjectId(p.id); handleNavClick("projects"); }}
                                className="w-full flex justify-between items-center gap-2 text-[11px] rounded px-1.5 py-1 -mx-1.5 hover:bg-slate-50 text-left"
                                title={`${p.name} — open in Donors & Projects`}
                              >
                                <span className="font-mono text-slate-600 shrink-0">{p.code}</span>
                                <span className="text-slate-500 truncate flex-1">{p.name}</span>
                                <span className={p.status === "Active" ? "text-emerald-700 font-bold shrink-0" : "text-slate-400 shrink-0"}>{p.status}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic mb-3">No funded projects yet.</p>
                      )}
                      <div className="border-t border-slate-100 pt-2 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 uppercase">Funded to date</span>
                          <strong className="font-mono text-slate-800">{formatUSD(totalFunded)}</strong>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 uppercase">Pipeline</span>
                          <span className="font-mono text-slate-600">{opps.length} open</span>
                        </div>
                        {(() => {
                          // Restricted balance: money actually received for these projects, less
                          // what has been documented as spent. Not a slice of the bank balance —
                          // cash is fungible and part of it sits in the undocumented petty gap.
                          const received = projs.reduce((sum, p) => sum + state.bankTransactions
                            .filter(bt => bt.projectId === p.id && bt.type === "Deposit" && !bt.pending)
                            .reduce((t, bt) => {
                              const ccy = state.bankAccounts.find(ba => ba.id === bt.bankAccountId)?.currency || "USD";
                              const rate = ccy === "EUR" ? state.fxRates.EUR : ccy === "LBP" ? state.fxRates.LBP : 1;
                              return t + bt.amount * rate;
                            }, 0), 0);
                          const spent = projs.reduce((sum, p) => sum + state.budgetLines
                            .filter(bl => bl.projectId === p.id)
                            .reduce((t, bl) => t + (bl.actualUSD || 0), 0), 0);
                          if (received === 0 && spent === 0) return null;
                          const unspent = received - spent;
                          return (
                            <div className="pt-1 mt-1 border-t border-slate-100 space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 uppercase">Received / spent</span>
                                <span className="font-mono text-slate-600">{formatUSD(received)} / {formatUSD(spent)}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 uppercase">Unspent (restricted)</span>
                                <strong className={`font-mono ${unspent < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatUSD(unspent)}</strong>
                              </div>
                            </div>
                          );
                        })()}
                        {s === "Production" && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400 uppercase">Quotes open</span>
                            <span className="font-mono text-slate-600">{state.quotations.filter(q => ["Draft", "Sent", "Accepted"].includes(q.status)).length}</span>
                          </div>
                        )}
                      </div>
                      {activeCount === 0 && opps.length === 0 && (
                        <p className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          ⚠ Funding gap — no active project and no pipeline
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pipeline board */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-800 uppercase font-mono">🎯 Donor Pipeline</h3>
                  {MANAGERS.includes(currentUser.role) && !oppForm && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setIntakeOpen(!intakeOpen); setIntake(null); }} className="bg-indigo-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 transition-all">
                        🤖 {intakeOpen ? "Close call reader" : "Start from a call"}
                      </button>
                      <button onClick={() => setOppForm({ stage: "Prospect", currency: "USD" })} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">
                        ➕ Add Opportunity
                      </button>
                    </div>
                  )}
                </div>

                {/* Call intake: paste the funder's link/file/text and let the AI fill the form in.
                    Everything it proposes lands in the normal editable form — nothing is saved here. */}
                {intakeOpen && !oppForm && (
                  <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                    <h4 className="text-sm font-bold text-indigo-900 uppercase font-mono">🤖 Read a funding call</h4>
                    <p className="text-[11px] text-indigo-800">
                      Give it the call as a link, a file, or pasted text. It proposes the title, funder, program, amount and
                      deadline, and assesses the fit against AnaHon's real track record. You review every field before saving.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="url"
                        value={intakeUrl}
                        onChange={e => setIntakeUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && intakeUrl.trim() && !intakeBusy) { e.preventDefault(); runIntake({ url: intakeUrl.trim() }); } }}
                        placeholder="https://… link to the call"
                        className="finance-input flex-1 min-w-[240px] font-mono text-xs"
                        disabled={intakeBusy}
                      />
                      <button
                        type="button"
                        onClick={() => runIntake({ url: intakeUrl.trim() })}
                        disabled={intakeBusy || !intakeUrl.trim()}
                        className="bg-indigo-600 text-white text-[11px] font-bold rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:bg-slate-300 transition-all"
                      >
                        {intakeBusy ? "Reading…" : "Read link"}
                      </button>
                      <label className={`text-[11px] font-bold rounded-lg px-3 py-2 cursor-pointer transition-all ${intakeBusy ? "bg-slate-200 text-slate-400" : "bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-100"}`}>
                        📄 Upload call
                        <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" disabled={intakeBusy} onChange={intakeFile} />
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      value={intakeText}
                      onChange={e => setIntakeText(e.target.value)}
                      placeholder="…or paste the call text here"
                      className="finance-input w-full text-xs"
                      disabled={intakeBusy}
                    />
                    {intakeText.trim().length >= 40 && (
                      <button
                        type="button"
                        onClick={() => runIntake({ text: intakeText })}
                        disabled={intakeBusy}
                        className="bg-indigo-600 text-white text-[11px] font-bold rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:bg-slate-300 transition-all"
                      >
                        {intakeBusy ? "Reading…" : "Read pasted text"}
                      </button>
                    )}
                  </div>
                )}

                {/* The assessment stays visible above the prefilled form so the fit and the
                    risks are in front of you while you decide whether to keep it. */}
                {intake && oppForm && (
                  <div className={`p-4 rounded-xl border text-[11px] space-y-2 ${intake.assessment.fit === "Strong" ? "bg-emerald-50 border-emerald-200"
                    : intake.assessment.fit === "Weak" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
                    <p className="font-bold text-slate-800">
                      {intake.provider} read {intake.source} · Fit: {intake.assessment.fit} · Suggested program: {intake.assessment.recommendedStream || "—"}
                    </p>
                    <p className="text-slate-700">{intake.assessment.rationale}</p>
                    {intake.assessment.risks?.length > 0 && (
                      <ul className="list-disc ml-4 text-amber-900">{intake.assessment.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                    )}
                    {intake.assessment.suggestedAngle && <p className="text-emerald-900"><strong>Angle:</strong> {intake.assessment.suggestedAngle}</p>}
                    {intake.draft.donorIsNew && (
                      <p className="text-indigo-900">Funder <strong>{intake.draft.donorName}</strong> isn't registered yet — saving will add it as a prospect donor.</p>
                    )}
                    <p className="text-slate-500 italic">Draft only. Nothing is in the pipeline until you press Save below.</p>
                  </div>
                )}

                {oppForm && (
                  <form onSubmit={saveOpportunity} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">{oppForm.id ? "✏️ Edit Opportunity" : "➕ New Opportunity"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label htmlFor="opp-title" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Title")}</label>
                        <input id="opp-title" type="text" placeholder="e.g. SKF next cycle — Platform" value={oppForm.title || ""} onChange={e => setOppForm({ ...oppForm, title: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-donor" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Donor")}</label>
                        <select id="opp-donor" value={oppForm.donorId || ""} onChange={e => setOppForm({ ...oppForm, donorId: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— None yet (unscoped) —</option>
                          {state.donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-stream" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Program Stream")}</label>
                        <select id="opp-stream" value={oppForm.stream || ""} onChange={e => setOppForm({ ...oppForm, stream: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— Unassigned —</option>
                          {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-stage" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Stage")}</label>
                        <select id="opp-stage" value={oppForm.stage || "Prospect"} onChange={e => setOppForm({ ...oppForm, stage: e.target.value as Opportunity["stage"] })} className="finance-input w-full text-xs">
                          {OPP_STAGES.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Amount (0 = not scoped)")}</label>
                        <input id="opp-amount" type="number" min="0" step="any" value={oppForm.amount ?? 0} onChange={e => setOppForm({ ...oppForm, amount: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-currency" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Currency")}</label>
                        <select id="opp-currency" value={oppForm.currency || "USD"} onChange={e => setOppForm({ ...oppForm, currency: e.target.value })} className="finance-input w-full text-xs">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="opp-deadline" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Submission Deadline")}</label>
                        <input id="opp-deadline" type="date" value={oppForm.deadline || ""} onChange={e => setOppForm({ ...oppForm, deadline: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-decision" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Decision Expected")}</label>
                        <input id="opp-decision" type="date" value={oppForm.decisionDate || ""} onChange={e => setOppForm({ ...oppForm, decisionDate: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="opp-renewal" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Renewal Of (optional)")}</label>
                        <select id="opp-renewal" value={oppForm.renewalOfProjectId || ""} onChange={e => setOppForm({ ...oppForm, renewalOfProjectId: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— Not a renewal —</option>
                          {state.projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label htmlFor="opp-link" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Call / Application Link")}</label>
                        <input id="opp-link" type="url" inputMode="url" placeholder="https://…" value={oppForm.link || ""} onChange={e => setOppForm({ ...oppForm, link: e.target.value })} className="finance-input w-full font-mono text-xs" dir="ltr" />
                        <p className="text-[10px] text-slate-400 mt-1">{t("The page you apply on — so anyone can re-check the call.")}</p>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Work Samples")}</label>
                        <p className="text-[10px] text-slate-400 mb-1.5">{t("Published AnaHon work sent as evidence with this application.")}</p>
                        {(oppForm.samples || []).map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 mb-1">
                            <a href={s.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-[11px] text-blue-700 hover:underline truncate flex-1">
                              {s.title || s.url}
                            </a>
                            <button type="button" title={t("Remove")}
                              onClick={() => setOppForm({ ...oppForm, samples: (oppForm.samples || []).filter((_: any, j: number) => j !== i) })}
                              className="text-[10px] text-slate-400 hover:text-red-600 shrink-0 px-1">✕</button>
                          </div>
                        ))}
                        <div className="flex flex-col sm:flex-row gap-2 mt-1">
                          <input id="opp-sample-url" type="url" inputMode="url" placeholder="https://anahon.org/…" dir="ltr"
                            className="finance-input flex-1 font-mono text-xs" />
                          <input id="opp-sample-title" type="text" placeholder={t("What it is (optional)")} className="finance-input flex-1 text-xs" />
                          <button type="button" className="bg-slate-100 text-slate-700 text-xs font-medium rounded-lg px-3 py-2 hover:bg-slate-200 shrink-0"
                            onClick={() => {
                              const u = document.getElementById("opp-sample-url") as HTMLInputElement;
                              const ti = document.getElementById("opp-sample-title") as HTMLInputElement;
                              const url = u.value.trim();
                              if (!url) return;
                              try { new URL(url); } catch { triggerToast("That is not a valid link — include https://"); return; }
                              setOppForm({ ...oppForm, samples: [...(oppForm.samples || []), { url, title: ti.value.trim() }] });
                              u.value = ""; ti.value = "";
                            }}>+ {t("Add Sample")}</button>
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <label htmlFor="opp-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes")}</label>
                        <textarea id="opp-notes" rows={2} value={oppForm.notes || ""} onChange={e => setOppForm({ ...oppForm, notes: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save</button>
                      <button type="button" onClick={() => setOppForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Proposal workspace — AnaHon's master template; adapt into each donor's format */}
                {propForm && (
                  <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">📝 Proposal — {propForm.title}</h4>
                      <p className="text-[11px] text-slate-500">AnaHon is the applicant. Donor: {state.donors.find(d => d.id === propForm.donorId)?.name || "not set"}. Write once here, then adapt into the donor's own template.</p>
                      {/* The pipeline this call belongs to is the user's decision — the AI may
                          recommend one, but it never moves the card. */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <label htmlFor="prop-stream" className="text-[10px] font-bold text-slate-600 uppercase">{t("Pipeline / programme")}</label>
                        <select
                          id="prop-stream"
                          value={propForm.stream || ""}
                          onChange={e => setPropForm({ ...propForm, stream: e.target.value })}
                          className="finance-input text-xs"
                        >
                          <option value="">— Unassigned —</option>
                          {STREAMS.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        {aiAssess?.recommendedStream && aiAssess.recommendedStream !== propForm.stream && (
                          <button
                            type="button"
                            onClick={() => setPropForm({ ...propForm, stream: aiAssess.recommendedStream })}
                            className="text-[10px] font-bold text-indigo-700 hover:underline"
                          >
                            AI suggests {aiAssess.recommendedStream} — use it
                          </button>
                        )}
                        <span className="text-[10px] text-slate-400">saved with the proposal</span>
                      </div>
                    </div>
                    {/* AI assist — grounded in AnaHon's real track record, prefill only */}
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                      <label htmlFor="ai-call" className="block text-[10px] font-bold text-indigo-800 uppercase">🧠 AI Assist — the donor's call</label>
                      {/* Three ways in: a file, a link, or paste. All land in the same box so
                          you can read and correct the text before the AI sees it. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className={`text-[11px] font-bold rounded-lg px-3 py-2 cursor-pointer transition-all ${callBusy ? "bg-slate-200 text-slate-400" : "bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-100"}`}>
                          📄 {callBusy ? "Reading…" : "Upload call (PDF / Word / text)"}
                          <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" disabled={callBusy} onChange={loadCallFile} />
                        </label>
                        <input
                          type="url"
                          value={callUrl}
                          onChange={e => setCallUrl(e.target.value)}
                          placeholder="…or paste a link to the call page"
                          aria-label="Link to the donor's call page"
                          className="finance-input text-xs flex-1 min-w-[180px]"
                        />
                        <button
                          type="button"
                          disabled={callBusy || !callUrl.trim()}
                          onClick={() => { loadCallSource({ url: callUrl.trim() }, callUrl.trim()); setCallUrl(""); }}
                          className="text-[11px] font-bold bg-white border border-indigo-300 text-indigo-800 rounded-lg px-3 py-2 hover:bg-indigo-100 disabled:opacity-40 transition-all"
                        >
                          🔗 Fetch link
                        </button>
                        {aiCall && (
                          <button type="button" onClick={() => setAiCall("")} className="text-[11px] text-slate-500 hover:text-red-600 hover:underline px-2">clear</button>
                        )}
                      </div>
                      <textarea id="ai-call" rows={4} value={aiCall} onChange={e => setAiCall(e.target.value)} placeholder="…or paste the call text here: focus areas, eligibility, budget range, the questions they ask…" className="finance-input w-full text-xs" />
                      {aiCall && <p className="text-[10px] text-indigo-700">{aiCall.length.toLocaleString()} characters loaded — edit freely before running the assist.</p>}
                      <div className="flex gap-2">
                        <button type="button" disabled={aiBusy} onClick={() => runAiAssist("assess")} className="bg-indigo-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 transition-all">{aiBusy ? "Thinking…" : "🔍 Assess Fit"}</button>
                        <button type="button" disabled={aiBusy} onClick={() => runAiAssist("draft")} className="bg-indigo-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 transition-all">{aiBusy ? "Thinking…" : "✍️ Draft Empty Sections"}</button>
                      </div>
                      <p className="text-[10px] text-indigo-700">Grounded in AnaHon's real programs and project history from this system. Drafts fill only sections you left empty; anything the AI cannot know appears as [FILL: …]. Nothing is saved until you save.</p>
                      {aiAssess && (
                        <div className="p-3 bg-white border border-indigo-200 rounded-lg text-xs space-y-1.5">
                          <p><strong>Fit: {aiAssess.fit}</strong> · Recommended program: <strong>{aiAssess.recommendedStream || "—"}</strong></p>
                          <p className="text-slate-600">{aiAssess.rationale}</p>
                          {aiAssess.risks?.length > 0 && (
                            <ul className="list-disc ml-4 text-amber-800">{aiAssess.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                          )}
                          {aiAssess.suggestedAngle && <p className="text-emerald-800"><strong>Angle:</strong> {aiAssess.suggestedAngle}</p>}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PROPOSAL_SECTIONS.map(([key, label, hint]) => (
                        <div key={key} className={key === "summary" || key === "solution" ? "md:col-span-2" : ""}>
                          <label htmlFor={`prop-${key}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{label}</label>
                          <textarea id={`prop-${key}`} rows={3} placeholder={hint} value={(propForm.proposal[key] as string) || ""} onChange={e => setProposal({ [key]: e.target.value })} className="finance-input w-full font-sans text-xs" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Activities & Timeline</span>
                        <button type="button" onClick={() => setProposal({ timeline: [...propTimeline, { activity: "", start: "", end: "" }] })} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-all">➕ Add activity</button>
                      </div>
                      {propTimeline.map((row, i) => (
                        <div key={i} className="grid grid-cols-2 md:grid-cols-8 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <input aria-label={`Activity ${i + 1}`} type="text" placeholder="Activity" value={row.activity} onChange={e => setProposal({ timeline: propTimeline.map((r, idx) => idx === i ? { ...r, activity: e.target.value } : r) })} className="finance-input text-xs col-span-2 md:col-span-4" />
                          <input aria-label={`Activity ${i + 1} start`} type="date" value={row.start} onChange={e => setProposal({ timeline: propTimeline.map((r, idx) => idx === i ? { ...r, start: e.target.value } : r) })} className="finance-input font-mono text-xs md:col-span-1" />
                          <input aria-label={`Activity ${i + 1} end`} type="date" value={row.end} onChange={e => setProposal({ timeline: propTimeline.map((r, idx) => idx === i ? { ...r, end: e.target.value } : r) })} className="finance-input font-mono text-xs md:col-span-1" />
                          <div className="md:col-span-2 flex items-center">
                            <button type="button" onClick={() => setProposal({ timeline: propTimeline.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Remove activity" aria-label={`Remove activity ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Indicative Budget ({propForm.currency})</span>
                        <button type="button" onClick={() => setProposal({ budget: [...propBudget, { line: "", description: "", amount: 0 }] })} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-all">➕ Add line</button>
                      </div>
                      {propBudget.map((row, i) => (
                        <div key={i} className="grid grid-cols-2 md:grid-cols-8 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <input aria-label={`Budget line ${i + 1}`} type="text" placeholder="Line (e.g. Personnel)" value={row.line} onChange={e => setProposal({ budget: propBudget.map((r, idx) => idx === i ? { ...r, line: e.target.value } : r) })} className="finance-input text-xs col-span-2 md:col-span-2" />
                          <input aria-label={`Budget line ${i + 1} description`} type="text" placeholder="Description" value={row.description} onChange={e => setProposal({ budget: propBudget.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r) })} className="finance-input text-xs col-span-2 md:col-span-4" />
                          <input aria-label={`Budget line ${i + 1} amount`} type="number" min="0" step="any" value={row.amount} onChange={e => setProposal({ budget: propBudget.map((r, idx) => idx === i ? { ...r, amount: Number(e.target.value) } : r) })} className="finance-input font-mono text-xs md:col-span-1" />
                          <div className="md:col-span-1 flex items-center">
                            <button type="button" onClick={() => setProposal({ budget: propBudget.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Remove line" aria-label={`Remove budget line ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                      {propBudget.length > 0 && (
                        <p className="text-right text-xs font-mono font-bold text-slate-800">
                          ASK: {propForm.currency} {propBudget.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString()}
                          <span className="text-slate-400 font-sans font-normal"> — becomes the opportunity's requested amount on save</span>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveProposal(false)} className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save Proposal</button>
                      <button type="button" onClick={() => saveProposal(true)} className="bg-slate-800 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-700 transition-all">📄 Save + Generate Document</button>
                      <button type="button" onClick={() => setPropForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Deadline tracker: the board answers "where is everything", this answers
                    "what do I do next". Sorted by date, coloured by how little time is left. */}
                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const dated = state.opportunities
                    .filter(o => o.deadline && !["Awarded", "Declined"].includes(o.stage))
                    .sort((a, b) => a.deadline.localeCompare(b.deadline));
                  if (!dated.length) return null;
                  const daysTo = (d: string) => Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
                  return (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase font-mono">⏳ {t("Deadlines")}</h4>
                        <span className="text-[10px] text-slate-500">{dated.length} dated · {state.opportunities.filter(o => !o.deadline && !["Awarded", "Declined"].includes(o.stage)).length} undated</span>
                      </div>
                      <div className="space-y-1">
                        {dated.map(o => {
                          const d = daysTo(o.deadline);
                          const tone = d < 0 ? "bg-slate-100 text-slate-500 border-slate-200"
                            : d <= 7 ? "bg-red-50 text-red-800 border-red-200"
                              : d <= 30 ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-slate-50 text-slate-700 border-slate-200";
                          return (
                            <div key={o.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${tone}`}>
                              <span className="font-mono font-bold whitespace-nowrap w-24 shrink-0">
                                {d < 0 ? "passed" : d === 0 ? "TODAY" : `${d}d`}
                              </span>
                              <span className="font-mono text-[10px] opacity-70 w-20 shrink-0 hidden sm:inline">{o.deadline}</span>
                              <span className="flex-1 font-medium truncate" title={o.title}>{o.title}</span>
                              <span className="text-[10px] opacity-70 hidden md:inline whitespace-nowrap">{o.stream || "—"}</span>
                              <span className="font-mono text-[10px] whitespace-nowrap">{o.amount > 0 ? `${o.currency} ${o.amount.toLocaleString()}` : "—"}</span>
                              <span className="text-[10px] font-bold uppercase opacity-70 whitespace-nowrap hidden sm:inline">{o.stage}</span>
                              {MANAGERS.includes(currentUser.role) && (
                                <button onClick={() => { setPropForm({ ...o, proposal: o.proposal || {} }); setAiAssess(null); setAiCall(""); }}
                                  className="opacity-60 hover:opacity-100 shrink-0" title="Open proposal workspace" aria-label={`Open proposal for ${o.title}`}>📝</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500 italic">Red = within a week · amber = within a month. Awarded and declined are hidden.</p>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(["Prospect", "Drafting", "Submitted", "Awarded"] as const).map(stg => {
                    // Dated first, soonest at the top — an undated prospect never outranks a live deadline.
                    const stageOpps = state.opportunities.filter(o => o.stage === stg)
                      .sort((a, b) => (a.deadline ? 0 : 1) - (b.deadline ? 0 : 1) || (a.deadline || "").localeCompare(b.deadline || ""));
                    return (
                      <div key={stg} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2 tracking-widest">{stg} ({stageOpps.length})</h4>
                        <div className="space-y-2">
                          {stageOpps.map(o => {
                            const donor = state.donors.find(d => d.id === o.donorId);
                            return (
                              <div key={o.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                <p className="text-xs font-bold text-slate-900 mb-0.5">{o.title}</p>
                                <p className="text-[10px] text-slate-500">{donor?.name || "No donor yet"} · {o.stream || "unassigned"}</p>
                                {o.amount > 0 && <p className="text-[11px] font-mono font-bold text-slate-800 mt-1">{o.currency} {o.amount.toLocaleString()}</p>}
                                {(o.decisionDate || o.deadline) && (() => {
                                  const d = o.deadline
                                    ? Math.round((new Date(o.deadline).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000)
                                    : null;
                                  const tone = d === null ? "text-amber-700"
                                    : d < 0 ? "text-slate-400" : d <= 7 ? "text-red-700 font-bold" : d <= 30 ? "text-amber-700" : "text-slate-500";
                                  return (
                                    <p className={`text-[10px] mt-0.5 ${tone}`}>
                                      📅 {o.decisionDate ? `decision ${o.decisionDate}` : `deadline ${o.deadline}`}
                                      {d !== null && ` · ${d < 0 ? "passed" : d === 0 ? "today" : `${d}d left`}`}
                                    </p>
                                  );
                                })()}
                                {o.notes && <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">{o.notes}</p>}
                                {o.link && (
                                  <a href={o.link} target="_blank" rel="noopener noreferrer" dir="ltr"
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 hover:text-blue-900 hover:underline mt-1 max-w-full">
                                    🔗 <span className="truncate">{(() => { try { return new URL(o.link).hostname.replace(/^www\./, ""); } catch { return o.link; } })()}</span>
                                  </a>
                                )}
                                {!!(o.samples || []).length && (
                                  <div className="mt-1 pt-1 border-t border-slate-100">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{t("Work Samples")} · {o.samples.length}</p>
                                    {o.samples.map((s, i) => (
                                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                                        className="block text-[10px] text-blue-700 hover:underline truncate">
                                        ▸ {s.title || (() => { try { return decodeURIComponent(new URL(s.url).pathname).replace(/\/$/, "").split("/").pop() || s.url; } catch { return s.url; } })()}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {o.stage === "Awarded" && (
                                  <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mt-1">
                                    ✓ Awarded — once the deposit is on an imported statement, register the project in Donors & Projects with that deposit as proof.
                                  </p>
                                )}
                                {MANAGERS.includes(currentUser.role) && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <select value={o.stage} onChange={e => moveOpportunity(o, e.target.value)} className="finance-input text-[10px] flex-1 py-1" aria-label={`Stage for ${o.title}`}>
                                      {OPP_STAGES.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                    </select>
                                    <button onClick={() => { setPropForm({ ...o, proposal: o.proposal || {} }); setAiAssess(null); setAiCall(""); }} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Proposal workspace" aria-label={`Open proposal for ${o.title}`}>📝</button>
                                    <button onClick={() => setOppForm({ ...o })} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Edit" aria-label={`Edit ${o.title}`}>✏️</button>
                                    <button onClick={() => deleteOpportunity(o)} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Delete" aria-label={`Delete ${o.title}`}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {stageOpps.length === 0 && <p className="text-[10px] text-slate-400 italic">Empty.</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {state.opportunities.some(o => o.stage === "Declined") && (
                  <p className="text-[11px] text-slate-400">
                    Declined: {state.opportunities.filter(o => o.stage === "Declined").map(o => o.title).join(" · ")}
                  </p>
                )}
              </div>
            </div>
  );
}
