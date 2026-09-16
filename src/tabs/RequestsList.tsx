import { useState } from "react";
import type { FeatureRequest } from "../types";
import type { SharedProps } from "./shared";

/**
 * Requests — things someone needed the FMS to do and it could not (Anna plan §3).
 * Everyone sees their own; the master account sees all and triages them. The rooms read
 * the same rows with scripts/feature-requests.ts; nothing is pushed anywhere.
 */
const STATUSES: FeatureRequest["status"][] = ["New", "Triaged", "Planned", "Done", "Declined"];

export default function RequestsList({ state, currentUser, t, refreshState, triggerToast }: SharedProps) {
  const rows = state.featureRequests || [];
  const master = currentUser?.role === "Super Admin";
  const [edit, setEdit] = useState<Record<string, { status: string; room: string; note: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  if (!rows.length) return null;

  const triage = async (r: FeatureRequest) => {
    const e = edit[r.id];
    if (!e) return;
    setBusy(r.id);
    try {
      const res = await fetch("/api/requests/triage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, ...e, user: currentUser }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || t("Could not save."));
      setEdit(x => { const { [r.id]: _, ...rest } = x; return rest; });
      triggerToast(t("Saved"));
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); } finally { setBusy(null); }
  };

  return (
    <section data-anna-target="help.requests">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("Requests")}</h2>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {rows.map(r => {
          const e = edit[r.id] || { status: r.status, room: r.room, note: r.note };
          return (
            <div key={r.id} className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{r.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{t(r.status)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{r.need}</p>
              {r.example && <p className="whitespace-pre-wrap text-xs text-slate-500">{t("Example")}: {r.example}</p>}
              <p className="text-[11px] text-slate-400">
                {r.createdName} · {r.createdAt.slice(0, 10)} · {t("Urgency")}: {t(r.urgency)}{r.door ? ` · ${r.door}` : ""}{r.room ? ` · ${r.room}` : ""}
              </p>
              {r.note && !master && <p className="text-xs text-slate-600">{r.note}</p>}
              {master && (
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <select value={e.status} onChange={x => setEdit({ ...edit, [r.id]: { ...e, status: x.target.value } })}
                    aria-label={t("Status")} className="min-h-[36px] rounded-lg border border-slate-300 px-2 text-xs">
                    {STATUSES.map(s => <option key={s} value={s}>{t(s)}</option>)}
                  </select>
                  <input value={e.room} onChange={x => setEdit({ ...edit, [r.id]: { ...e, room: x.target.value } })}
                    placeholder={t("Room")} aria-label={t("Room")} className="min-h-[36px] w-32 rounded-lg border border-slate-300 px-2 text-xs" />
                  <input value={e.note} onChange={x => setEdit({ ...edit, [r.id]: { ...e, note: x.target.value } })}
                    placeholder={t("Note")} aria-label={t("Note")} className="min-h-[36px] min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-xs" />
                  <button onClick={() => triage(r)} disabled={!edit[r.id] || busy === r.id}
                    className="min-h-[36px] rounded-lg bg-[#6D1A1A] px-3 text-xs font-bold text-white hover:bg-[#4A1010] disabled:opacity-40">
                    {busy === r.id ? t("Saving…") : t("Save")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
