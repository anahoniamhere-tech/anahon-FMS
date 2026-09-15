import { useState } from "react";
import { SharedProps } from "./shared";
import { MANAGERS } from "../roles";
import { agreementDocs } from "../coreDocs";
import { lateCosts } from "../lateCosts";

type Props = Pick<SharedProps, "state" | "currentUser" | "t" | "triggerToast" | "refreshState" | "formatUSD"> & {
  activity: { id: string; projectId: string; title: string };
};

/**
 * Under one donor-report obligation: each time it was submitted (append-only), and the costs
 * recorded into its period since — beside the submitted figure, never folded into it.
 */
export default function ReportSubmissions({ state, currentUser, t, triggerToast, refreshState, formatUSD, activity }: Props) {
  const today = new Date().toLocaleDateString("en-CA");
  const [form, setForm] = useState<null | { periodStart: string; periodEnd: string; submittedOn: string; evidence: string; basis: string; asSubmittedUSD: string }>(null);
  const [busy, setBusy] = useState(false);
  const subs = (state.donorReportSubmissions || []).filter(s => s.activityId === activity.id);
  const vouchers = (state.expenses || []) as any[];
  const docs = (state.documents || []).filter((d: any) => d.linkedRecordType === "Project" && d.linkedRecordId === activity.projectId && !d.fileMissing);
  const mayRecord = MANAGERS.includes(currentUser.role);

  const label = !form ? "" : busy ? t("Recording…")
    : !form.periodStart || !form.periodEnd ? t("Record — enter the report's period")
    : !form.submittedOn ? t("Record — enter the day it was submitted")
    : !form.evidence.trim() ? t("Record — name the evidence")
    : form.basis === "entered from the filed report" && form.asSubmittedUSD === "" ? t("Record — enter the total the filed report states")
    : t("Record the submission");
  const ready = !!form && !busy && label === t("Record the submission");

  const submit = async () => {
    if (!form || !ready) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reports/submission", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activity.projectId, activityId: activity.id, ...form, asSubmittedUSD: Number(form.asSubmittedUSD), user: currentUser }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Refused");
      triggerToast(t("Submission recorded — it will not change."));
      setForm(null); refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const fld = "finance-input w-full text-xs min-h-[44px]";
  const lbl = "block text-[10px] font-bold text-slate-600 uppercase mb-1";
  return (
    <div className="mt-2 space-y-2">
      {subs.map(s => {
        const lc = lateCosts(s, vouchers);
        return (
          <div key={s.id} className="text-[11px] border-s-2 border-slate-300 ps-2 space-y-1">
            <p className="text-slate-700">
              {t("Submitted on")} <span dir="ltr" className="font-mono">{s.submittedOn}</span> · {t("period")} <span dir="ltr" className="font-mono">{s.periodStart} → {s.periodEnd}</span> ·{" "}
              <strong dir="ltr">{formatUSD(s.asSubmittedUSD)}</strong> <span className="text-slate-400">({s.basis === "frozen" ? t("frozen by the system") : t("entered from the filed report")} · {s.evidence})</span>
            </p>
            {lc.late.length > 0 ? (
              <div className="text-amber-800">
                <p className="font-bold">
                  {t("report submitted on")} <span dir="ltr">{s.submittedOn}</span> — {lc.late.length} {t("costs recorded since")}, <span dir="ltr">{formatUSD(lc.lateUSD)}</span>
                </p>
                <ul className="ps-3">
                  {lc.late.map(x => (
                    <li key={x.id}><span dir="ltr" className="font-mono">{x.voucherNo}</span> · {t("dated")} <span dir="ltr">{x.transactionDate}</span> · {t("recorded")} <span dir="ltr">{x.recordedOn}</span> · <span dir="ltr">{formatUSD(x.usd)}</span></li>
                  ))}
                </ul>
                <p className="text-slate-500">{t("The submitted figure is unchanged; these are shown beside it.")}</p>
              </div>
            ) : (
              <p className="text-emerald-700">{t("No cost recorded into this period since it was submitted.")}</p>
            )}
            {lc.unjudged > 0 && (
              <p className="text-slate-400">{lc.unjudged} {t("earlier vouchers have no recording date and cannot be judged.")}</p>
            )}
          </div>
        );
      })}
      {subs.length > 0 && <p className="text-[10px] text-slate-400">{t("Counts vouchers only (a co-funded voucher by its share); payroll, journal-only and bank-only costs are not yet included.")}</p>}

      {mayRecord && !form && (
        <button type="button" onClick={() => setForm({ periodStart: "", periodEnd: "", submittedOn: "", evidence: "", basis: "entered from the filed report", asSubmittedUSD: "" })}
          className="text-xs rounded-lg px-3 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-100">{subs.length ? t("Record a resubmission") : t("Mark submitted")}</button>
      )}
      {form && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label htmlFor={`rs-ps-${activity.id}`} className={lbl}>{t("Period from")}</label>
              <input id={`rs-ps-${activity.id}`} type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} className={`${fld} font-mono`} /></div>
            <div><label htmlFor={`rs-pe-${activity.id}`} className={lbl}>{t("Period to")}</label>
              <input id={`rs-pe-${activity.id}`} type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} className={`${fld} font-mono`} /></div>
            <div><label htmlFor={`rs-so-${activity.id}`} className={lbl}>{t("Submitted on")}</label>
              <input id={`rs-so-${activity.id}`} type="date" max={today} value={form.submittedOn} onChange={e => setForm({ ...form, submittedOn: e.target.value })} className={`${fld} font-mono`} /></div>
            <div><label htmlFor={`rs-ev-${activity.id}`} className={lbl}>{t("Evidence")}</label>
              <input id={`rs-ev-${activity.id}`} list={`rs-evl-${activity.id}`} value={form.evidence} onChange={e => setForm({ ...form, evidence: e.target.value })}
                placeholder={t("ANH-DOC number, or the email's subject and date")} className={fld} />
              <datalist id={`rs-evl-${activity.id}`}>{docs.map((d: any) => <option key={d.refNo} value={d.refNo}>{d.filename}</option>)}</datalist></div>
            <div><label htmlFor={`rs-ba-${activity.id}`} className={lbl}>{t("Figure")}</label>
              <select id={`rs-ba-${activity.id}`} value={form.basis} onChange={e => setForm({ ...form, basis: e.target.value })} className={fld}>
                <option value="entered from the filed report">{t("entered from the filed report")}</option>
                <option value="frozen">{t("frozen by the system now")}</option>
              </select></div>
            {form.basis === "entered from the filed report" && (
              <div><label htmlFor={`rs-usd-${activity.id}`} className={lbl}>{t("Total as submitted (USD)")}</label>
                <input id={`rs-usd-${activity.id}`} type="number" min="0" step="any" value={form.asSubmittedUSD} onChange={e => setForm({ ...form, asSubmittedUSD: e.target.value })} className={`${fld} font-mono`} /></div>
            )}
          </div>
          <p className="text-[10px] text-slate-500">{t("A recorded submission is never edited. If the donor received a corrected report, record it again as a resubmission.")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!ready} onClick={submit} className="text-xs rounded-lg px-4 min-h-[44px] bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">{label}</button>
            <button type="button" onClick={() => setForm(null)} className="text-xs rounded-lg px-4 min-h-[44px] bg-slate-100 hover:bg-slate-200">{t("Cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
