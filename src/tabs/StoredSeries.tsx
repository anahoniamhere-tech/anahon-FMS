import React, { useEffect, useMemo, useState } from "react";
import { SITE_EDITORS } from "../roles";
import { periodTotals } from "../insights";

/**
 * What each platform has done over a stretch of time — the long record, typed in.
 *
 * Meta refuses any page-insights window longer than 93 days (src/insights.ts), so the panel above
 * this one can only ever answer "how is this month going". This table answers "what has this
 * platform done since 2021", and until now that answer lived in PDFs in Google Drive and was
 * quoted to funders from there. Nothing here is fetched: the live pull never writes these rows and
 * these rows never overwrite the live pull.
 *
 * Aggregates only, no personal data (Policy 024, draft). Audience geography is a sentence in the
 * note, because a proposal writer reads it and nobody sums it.
 *
 * A blank cell reads "—" and means the platform does not report that metric. It never reads 0:
 * a zero in a proposal is a claim about the work, an empty cell is an admission about the export.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
const nf = new Intl.NumberFormat("en-US");
const n = (v: any) => (v == null || v === "" ? "—" : nf.format(Number(v)));
const PLATFORMS = ["Facebook", "Instagram", "YouTube", "TikTok", "X", "LinkedIn"];
const COUNTS = [
  ["followers", "Followers"], ["followersGained", "New followers"], ["reach", "Reach"],
  ["impressions", "Impressions"], ["views", "Views"], ["interactions", "Interactions"]
] as const;
const BASIS: Record<string, string> = { organic: "organic", "includes paid": "includes paid", unknown: "organic/paid unknown" };
const BASIS_PILL: Record<string, string> = {
  organic: "bg-emerald-50 text-emerald-800", "includes paid": "bg-amber-50 text-amber-800", unknown: "bg-slate-100 text-slate-600"
};
const blank = { id: "", platform: "Facebook", periodStart: "", periodEnd: "", followers: "", followersGained: "", reach: "", impressions: "", views: "", interactions: "", basis: "unknown", source: "", note: "" };

/** Which of a platform's totals leads the tile, and which follow it. Reach first because it is
 *  the figure a funder asks for; a platform with none of them still shows its follower level. */
const totalPairs = (t: any): [string, number][] =>
  ([["reach", t.reach], ["impressions", t.impressions], ["views", t.views], ["interactions", t.interactions]] as [string, number][])
    .filter(([, v]) => v > 0);
/** A platform whose export gave no total at all still has a follower level, and that is a real
 *  figure — showing a dash there reads as missing data rather than as what the export contained. */
const headline = (t: any): [string, number] | undefined =>
  totalPairs(t)[0] ?? (t.last?.followers != null ? [`followers at ${t.last.periodEnd}`, t.last.followers] : undefined);
const rest = (t: any) => totalPairs(t).slice(1);

export default function StoredSeries({ role, triggerToast }: { role: string; triggerToast: (m: string, k?: string) => void }) {
  const mayEdit = SITE_EDITORS.includes(role);
  const [rows, setRows] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/social/periods").then(r => r.json()).then(d => setRows(d.ok ? d.rows : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  // Per platform, over everything stored. The rule (reach adds, followers does not) lives in
  // insights.ts beside windowFor, where check-social pins it.
  const totals = useMemo(() => periodTotals(rows || []), [rows]);

  const save = async () => {
    setBusy(true);
    const r = await post("/api/social/periods/save", form).finally(() => setBusy(false));
    if (r.success) { triggerToast(form.id ? "Updated" : "Recorded"); setForm(null); load(); }
    else triggerToast(r.error || "Failed", "error");
  };
  const remove = async (row: any) => {
    if (window.confirm(`Remove the ${row.platform} row for ${row.periodStart} → ${row.periodEnd}?`) !== true) return;
    const r = await post("/api/social/periods/delete", { id: row.id });
    if (r.success) { triggerToast("Removed"); load(); } else triggerToast(r.error || "Failed", "error");
  };

  const field = (k: string, label: string, type = "text", extra: any = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <input type={type} value={form[k] ?? ""} onChange={e => setForm({ ...form, [k]: e.target.value })}
        className="rounded border border-slate-300 px-2 py-1 text-xs" dir={type === "number" || type === "date" ? "ltr" : "auto"} {...extra} />
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-bold text-slate-900">The long record</h3>
        <p className="text-[11px] text-slate-500">
          Typed in from exports. Meta will not answer a window longer than 93 days, so this is the only place the app can say what a platform has done since 2021.
        </p>
        {mayEdit && !form && <button onClick={() => setForm({ ...blank })} className="ms-auto text-xs text-red-700 underline">add a period</button>}
      </div>

      {totals.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {totals.map(([platform, t]) => (
            <div key={platform} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{platform}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900" dir="ltr">{n(headline(t)?.[1] ?? null)}</div>
              <div className="text-[11px] text-slate-500">
                {headline(t)?.[0] || "nothing totalled"}
                {/* Everything else this platform has, named. The headline is one metric, and on a
                    platform with several it must not read as the only one AnaHon can claim. */}
                {rest(t).map(([label, v]) => <span key={label}> · <span dir="ltr">{n(v)}</span> {label}</span>)}
                {t.last?.followers != null && totalPairs(t).length > 0 && <> · <span dir="ltr">{n(t.last.followers)}</span> followers at <span dir="ltr">{t.last.periodEnd}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Platform</span>
              <input list="sp-platforms" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-xs" />
              <datalist id="sp-platforms">{PLATFORMS.map(p => <option key={p} value={p} />)}</datalist>
            </label>
            {field("periodStart", "From", "date")}
            {field("periodEnd", "To", "date")}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Organic or paid</span>
              <select value={form.basis} onChange={e => setForm({ ...form, basis: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-xs">
                {Object.entries(BASIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {COUNTS.map(([k, label]) => <React.Fragment key={k}>{field(k, label, "number", { min: 0, placeholder: "not reported" })}</React.Fragment>)}
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Where it came from</span>
              <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="the export, screen or file this was read off" className="rounded border border-slate-300 px-2 py-1 text-xs" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Note — anything the columns cannot hold (audience geography, what the export left out)</span>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} className="rounded border border-slate-300 px-2 py-1 text-xs" dir="auto" />
          </label>
          <p className="text-[11px] text-slate-500">Leave a figure empty when the platform does not report it — an empty cell reads “—”, and is not the same as zero.</p>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-40">{busy ? "saving…" : form.id ? "Save" : "Record it"}</button>
            <button onClick={() => setForm(null)} className="text-xs text-slate-600 underline">cancel</button>
          </div>
        </div>
      )}

      {rows == null ? <p className="text-xs text-slate-500">Loading…</p> : !rows.length ? (
        <p className="text-xs text-slate-500">Nothing stored yet — the lifetime figures are still only in the Drive exports.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[52rem] text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Platform", "Period", ...COUNTS.map(c => c[1]), "Source"].map(h => <th key={h} className="px-2 py-1.5 text-start font-medium">{h}</th>)}
                {mayEdit && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-2 py-1.5 font-bold text-slate-800" dir="auto">{r.platform}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-600"><span dir="ltr">{r.periodStart} → {r.periodEnd}</span></td>
                  {COUNTS.map(([k]) => (
                    <td key={k} className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">
                      {n(r[k])}
                      {k === "reach" && r.reach != null && <span className={`ms-1 inline-block whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-bold ${BASIS_PILL[r.basis]}`}>{BASIS[r.basis]}</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-slate-500">
                    <span dir="auto">{r.source}</span>
                    {r.note && <p className="mt-0.5 max-w-[26rem] text-[11px] text-slate-500" dir="auto">{r.note}</p>}
                  </td>
                  {mayEdit && (
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <button onClick={() => setForm({ ...blank, ...r, ...Object.fromEntries(COUNTS.map(([k]) => [k, r[k] ?? ""])) })} className="text-red-700 underline">edit</button>
                      <button onClick={() => remove(r)} className="ms-2 text-red-700 underline">remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!rows?.length && (
        <p className="text-[11px] text-slate-500">
          Totals add reach, impressions, views and interactions across the periods stored for a platform; followers are shown as the latest figure, never summed.
          Overlapping periods would double-count, so store one row per platform per period and no more.
        </p>
      )}
    </div>
  );
}
