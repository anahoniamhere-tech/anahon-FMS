import React, { useCallback, useEffect, useState } from "react";
import { SharedProps } from "./shared";
import { FINANCE } from "../roles";
import { CONSULTANT_REVIEW_CATEGORY } from "../consultantPack";

type Props = Pick<SharedProps, "currentUser" | "t" | "triggerToast" | "formatUSD">;
type Row = {
  id: string; name: string; currency: string; ledgerCode: string; statementClosing: number; bookClosing: number; difference: number;
  awaiting: number; unmatched: number; reconciliation: any; reviews: { id: string; filename: string }[];
};
type Overview = { month: string; mayMark: boolean; accounts: Row[]; packs: { id: string; month: string; producedAt: string; producedByName: string; fileName: string; sha256: string }[]; lateSinceLastPack: number; lastPackAt: string;
  withheld: { docId: string; refNo: string; category: string; reason: string; voucherNo: string }[] };

const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString("en-CA").slice(0, 7); };
const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
};
const btn = "min-h-[44px] text-xs font-medium border border-slate-300 rounded-lg px-3 bg-white hover:bg-slate-50 disabled:opacity-50";

/**
 * The external consultant's reports and month pack (Policy P5 §12.1, §12.4, §13). He has no login: Finance
 * produces the files here and Saad shares a dated view-only copy on Drive. The Finance Officer prepares each
 * account's reconciliation (§4.3); the consultant's signed or commented copy is filed against it.
 */
export default function ConsultantPackPanel({ currentUser, t, triggerToast, formatUSD }: Props) {
  const [month, setMonth] = useState(lastMonth());
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState("");
  const [reviewedOn, setReviewedOn] = useState<Record<string, string>>({});
  const isFinance = FINANCE.includes(currentUser.role);

  const load = useCallback(async () => {
    const res = await fetch(`/api/consultant/overview?month=${month}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setData(d); else { setData(null); if (d.error) triggerToast(d.error, "error"); }
  }, [month, triggerToast]);
  useEffect(() => { if (isFinance) load(); }, [isFinance, load]);
  if (!isFinance) return null;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (err: any) { triggerToast(err.message, "error"); } finally { setBusy(""); }
  };
  const download = (report: string, format: string) => run(`${report}-${format}`, async () => {
    const res = await fetch(`/api/consultant/report?month=${month}&report=${report}&format=${format}`);
    if (!res.ok) throw new Error((await res.json()).error || "Export failed");
    save(await res.blob(), `${month.slice(0, 4)}_ANAHON_${report.toUpperCase()}_${month}.${format}`);
  });
  const pack = () => run("pack", async () => {
    const res = await fetch("/api/consultant/pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, user: currentUser }) });
    if (!res.ok) throw new Error((await res.json()).error || "The pack could not be built");
    save(await res.blob(), `ANAHON_CONSULTANT-PACK_${month}.zip`);
    triggerToast(t("Month pack produced."));
    await load();
  });
  const post = async (url: string, body: any) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, user: currentUser }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "The request was refused.");
    return d;
  };
  const mark = (r: Row) => run(`mark-${r.id}`, async () => {
    await post("/api/consultant/reconciliation/mark", { accountId: r.id, month });
    triggerToast(t("Reconciliation prepared.")); await load();
  });
  const fileReview = (r: Row, file: File) => run(`review-${r.id}`, async () => {
    const day = reviewedOn[r.id];
    if (!day) throw new Error(t("Enter the date the consultant reviewed it."));
    const base64 = await new Promise<string>((ok, fail) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.onerror = fail; fr.readAsDataURL(file); });
    const up = await post("/api/document/upload", { filename: file.name, mimeType: file.type, sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`, base64, category: CONSULTANT_REVIEW_CATEGORY, linkedRecordType: "BankReconciliation", linkedRecordId: r.reconciliation.id });
    await post("/api/consultant/reconciliation/review", { reconciliationId: r.reconciliation.id, reviewDocId: (up.document || up.doc)?.id, reviewedOn: day });
    triggerToast(t("Consultant's review filed.")); await load();
  });

  const reports: [string, string][] = [["gl", t("General ledger detail")], ["reconciliation", t("Account reconciliations")], ["schedules", t("Standing schedules")], ["trial-balance", t("Trial balance")]];

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-md font-bold text-slate-900">{t("External consultant")}</h3>
          <p className="text-xs text-slate-500">{t("Files for the consultant, shared by Saad as a view-only copy. Nothing is uploaded from here.")} {t("Policy")} <span dir="ltr" className="whitespace-nowrap">P5 §12.1</span></p>
        </div>
        <div>
          <label htmlFor="cp-month" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Month")}</label>
          <input id="cp-month" type="month" value={month} onChange={e => setMonth(e.target.value)} className="finance-input font-mono text-xs min-h-[44px]" />
        </div>
      </div>

      <div className="space-y-2">
        {reports.map(([key, label]) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs text-slate-700">{label}</span>
            <span className="flex gap-2">
              <button type="button" className={btn} disabled={!!busy} onClick={() => download(key, "xlsx")}><span dir="ltr">XLSX</span></button>
              <button type="button" className={btn} disabled={!!busy} onClick={() => download(key, "pdf")}><span dir="ltr">PDF</span></button>
            </span>
          </div>
        ))}
        <button type="button" onClick={pack} disabled={!!busy} className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg px-4">
          {busy === "pack" ? t("Building the pack…") : t("Build the month pack (zip)")}
        </button>
        {data && data.lastPackAt && (
          <p className="text-[11px] text-slate-600">{t("Records added late since the last pack")}: <span dir="ltr">{data.lateSinceLastPack}</span></p>
        )}
      </div>

      {/* What the pack withholds, so Finance can correct a mis-filed category. No filename: the reference is enough to
          find it, and this list lives in the FMS — the zip itself only counts them. */}
      {data && data.withheld.length > 0 && (
        <div className="space-y-2 border border-amber-200 bg-amber-50/60 rounded-lg p-3">
          <h4 className="text-sm font-bold text-slate-900">{t("Withheld from this month's pack")}</h4>
          <p className="text-[11px] text-slate-600">{t("If a document here is ordinary evidence filed under the wrong category, correct its category and build the pack again.")}</p>
          <ul className="divide-y divide-amber-100 text-xs">
            {data.withheld.map(w => (
              <li key={w.docId} className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{w.refNo || w.docId}</span>
                <span className="text-slate-700"><bdi>{w.category}</bdi> · <span dir="ltr" className="font-mono whitespace-nowrap">{w.voucherNo}</span></span>
                <span className="text-amber-900">{w.reason === "identity or personnel paper" ? t("identity or personnel paper") : t("source or editorial material")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">{t("Reconciliations")}</h4>
          <ul className="divide-y divide-slate-100 border-y border-slate-100">
            {data.accounts.map(r => (
              <li key={r.id} className="py-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-bold text-slate-900"><bdi>{r.name}</bdi></span>
                  <span className="text-slate-600">{t("difference")} <span dir="ltr" className={`font-mono whitespace-nowrap ${Math.abs(r.difference) >= 0.005 ? "text-red-700 font-bold" : ""}`}>{r.difference.toFixed(2)} {r.currency}</span></span>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 text-slate-600">
                  <span>{t("lines")} <span dir="ltr" className="font-mono whitespace-nowrap">{r.statementClosing.toFixed(2)}</span></span>
                  <span>{t("books")} <span dir="ltr" className="font-mono whitespace-nowrap">{r.bookClosing.toFixed(2)}</span></span>
                  <span>{t("awaiting a statement line")}: <span dir="ltr">{r.awaiting}</span></span>
                </div>
                <p className="text-slate-700">
                  {r.reconciliation ? <>{t("Prepared by")} <bdi>{r.reconciliation.preparedByName}</bdi> · <span dir="ltr" className="font-mono">{String(r.reconciliation.preparedAt).slice(0, 10)}</span></> : t("Not yet prepared")}
                  {" · "}
                  {r.reconciliation?.reviewedOn ? <>{t("Reviewed by the external consultant on")} <span dir="ltr" className="font-mono">{r.reconciliation.reviewedOn}</span></> : t("Not yet reviewed by the consultant")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {data.mayMark && !r.reconciliation?.reviewedOn && (
                    <button type="button" className={btn} disabled={!!busy} onClick={() => mark(r)}>{r.reconciliation ? t("Prepare again") : t("Mark prepared")}</button>
                  )}
                  {r.reconciliation && !r.reconciliation.reviewedOn && (
                    <>
                      <input type="date" aria-label={t("Reviewed on")} value={reviewedOn[r.id] || ""} onChange={e => setReviewedOn(v => ({ ...v, [r.id]: e.target.value }))} className="finance-input font-mono text-xs min-h-[44px]" />
                      <label className={`${btn} flex items-center justify-center cursor-pointer`}>
                        {busy === `review-${r.id}` ? t("Filing…") : t("File the consultant's review")}
                        <input type="file" className="sr-only" disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) fileReview(r, f); }} />
                      </label>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!data.mayMark && <p className="text-[11px] text-slate-600">{t("Only the Finance Officer prepares a reconciliation (Policy P5 §4.3).")}</p>}
        </div>
      )}

      {data && data.packs.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-900">{t("Packs produced")}</h4>
          <ul className="text-xs text-slate-700 space-y-1">
            {data.packs.slice(0, 8).map(p => (
              <li key={p.id} className="flex flex-wrap justify-between gap-x-3">
                <span dir="ltr" className="font-mono whitespace-nowrap">{p.month}</span>
                <span><span dir="ltr" className="font-mono">{p.producedAt.slice(0, 16).replace("T", " ")}</span> · <bdi>{p.producedByName}</bdi></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
