import React, { useState } from "react";
import { UserSearch } from "lucide-react";
import { SharedProps } from "./shared";
import {
  poolViewFor, mayEditPool, mayAssess, mayRemoveFromPool, poolFieldsWritableBy,
  POOL_FIELDS, POOL_STATUSES, poolHeadSeat, type PoolField,
} from "../personnelDocs";
import type { PoolCandidate, PoolAssessment } from "../types";

/**
 * The freelancer pool — people AnaHon may engage but has no contract with yet — split by field.
 *
 * Every rule here is asked of personnelDocs.ts, and every rule is ALSO enforced on the server:
 * this screen never hides data, it only declines to offer controls. A field head is sent only
 * their own field's people, whole, and only their own field's assessment; the Finance Officer is
 * sent name and skills; the file holders are sent everything. What arrives is what may be shown.
 *
 * Deliberately not offered: turning an entry into a supplier or drawing their agreement. That is
 * Buying & paying's flow, and the footer says so.
 */

/**
 * The status words in Arabic, kept local on purpose. "Prospect" is already an i18n key — the
 * funding funnel's stage, فرصة محتملة, "a potential opportunity" — which is wrong said of a person,
 * and changing the shared key would break the funnel. The stored value stays the English word.
 */
const STATUS_AR: Record<string, string> = { "Prospect": "مرشّح", "Worked with us": "عمل معنا", "Not a fit": "غير مناسب" };
const FIELD_AR: Record<string, string> = { Editorial: "التحرير", Production: "الإنتاج" };
const BLANK = { id: "", name: "", skills: "", city: "", country: "", languages: "", email: "", phone: "", dayRate: "", currency: "USD", notes: "", fields: [] as string[] };

export default function FreelancerPool({ currentUser, state, t, lang, triggerToast, refreshState, openDoc }: SharedProps) {
  const role = currentUser?.role;
  const view = poolViewFor(role);
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const [assessing, setAssessing] = useState<{ candidateId: string; field: string; status: string; rating: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!view) return null;

  const statusLabel = (s: string) => (lang === "ar" ? STATUS_AR[s] || s : s);
  const fieldLabel = (f: string) => (lang === "ar" ? FIELD_AR[f] || f : f);
  const canEdit = mayEditPool(role);
  const writable = poolFieldsWritableBy(role) as string[];
  const rows: PoolCandidate[] = (state as any).poolCandidates || [];
  const cvsOf = (id: string) => (state.documents || []).filter((d: any) => d.partyId === id && d.category === "CV");

  const post = async (url: string, body: any) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, user: currentUser }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "The request was refused.");
    return d;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const d = await post("/api/pool/save", form);
      triggerToast(form.id ? `${d.candidate.name} updated.` : `${d.candidate.name} added to ${d.addedTo.join(" and ")}.`);
      setForm(null);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const assess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessing) return;
    setBusy(true);
    try {
      await post("/api/pool/assess", assessing);
      triggerToast(`${fieldLabel(assessing.field)}: ${statusLabel(assessing.status)}.`);
      setAssessing(null);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const remove = async (c: PoolCandidate) => {
    // A reason is required: this is personal data about someone we never contracted.
    const reason = window.prompt(t("Why is this person being removed from the pool?"));
    if (reason === null) return;
    try {
      const d = await post("/api/pool/delete", { id: c.id, reason });
      triggerToast(`${c.name} removed. ${d.unlinkedDocuments} CV kept in the vault.`);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const uploadCv = async (c: PoolCandidate, file: File) => {
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      // Category CV, partyId = the pool entry: filed under PERSONNEL/Freelancer Pool/<name>, and
      // the upload gate lets in the file holders or the head of one of this person's fields.
      const d = await post("/api/document/upload", {
        filename: file.name, mimeType: file.type, sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        base64, category: "CV", partyId: c.id,
      });
      triggerToast(d.duplicate ? "Already on file — no second copy made." : `CV filed for ${c.name}.`);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const input = (key: keyof typeof BLANK, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`pool-${key}`} className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t(label)}</label>
      <input id={`pool-${key}`} value={(form as any)[key]} onChange={e => setForm({ ...form!, [key]: e.target.value })}
        className="finance-input w-full text-xs" {...props} />
    </div>
  );

  const headline = view.kind === "all"
    ? t("People we may engage but have no contract with yet, in two fields. Their CVs are seen by HR, the Executive Director and the head of their field only.")
    : view.kind === "fields"
      ? t("The people in your field. You see their full entry and CVs, and your field's assessment — nothing about anyone outside it.")
      : t("Name and skills only. Contact details, rates, assessments and CVs are kept to the field heads and the personnel-file holders.");

  // Group by field for anyone who assesses; Finance sees one flat list.
  const fieldsShown: PoolField[] = view.kind === "fields" ? view.fields : POOL_FIELDS.map(f => f.key);
  const inField = (c: PoolCandidate, f: string) => (c.assessments || []).some(a => a.field === f);

  const entry = (c: PoolCandidate, field?: string) => {
    const a: PoolAssessment | undefined = field ? (c.assessments || []).find(x => x.field === field) : undefined;
    const alsoIn = field ? (c.assessments || []).filter(x => x.field !== field).map(x => fieldLabel(x.field)) : [];
    return (
      <li key={`${c.id}-${field || "summary"}`} className="space-y-1 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-slate-900">{c.name}</span>
          {a && (
            <span className="flex items-center gap-2">
              {a.rating != null && <span className="text-[10px] font-bold text-slate-600" aria-label={`${t("Rating")} ${a.rating}/5`}><span dir="ltr">{a.rating}/5</span></span>}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                a.status === "Worked with us" ? "bg-emerald-100 text-emerald-700"
                  : a.status === "Not a fit" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                {statusLabel(a.status)}
              </span>
            </span>
          )}
        </div>
        <p className="text-xs text-slate-700">{c.skills || <span className="italic text-slate-400">{t("No skills recorded")}</span>}</p>

        {view.kind !== "summary" && (
          <>
            <p className="text-[11px] text-slate-500">
              {[c.city, c.country].filter(Boolean).join(", ")}
              {c.languages ? ` · ${c.languages}` : ""}
              {c.dayRate != null ? <> · {t("Day rate")} <span dir="ltr" className="font-mono">{c.currency} {c.dayRate}</span></> : null}
            </p>
            {(c.email || c.phone) && (
              <p className="text-[11px] text-slate-500">
                {c.email && <span dir="ltr" className="font-mono">{c.email}</span>}
                {c.email && c.phone ? " · " : ""}
                {c.phone && <span dir="ltr" className="font-mono">{c.phone}</span>}
              </p>
            )}
            {c.notes && <p className="text-[11px] italic text-slate-500">{c.notes}</p>}
            {/* A head sees that a person is also in the other field, but never the other field's
                judgement — that row is not in their payload to begin with. */}
            {view.kind === "all" && alsoIn.length > 0 && <p className="text-[10px] text-slate-400">{t("Also in")}: {alsoIn.join(", ")}</p>}
            {a && (a.note || a.assessedAs) && (
              <p className="text-[11px] text-slate-600">
                {a.note && <span>“{a.note}”</span>}
                {a.assessedAs && <span className="ms-1 text-[10px] text-slate-400">— {a.assessedAs}</span>}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">{t("CV")}</span>
              {cvsOf(c.id).length === 0 && <span className="text-[11px] italic text-slate-400">{t("None on file")}</span>}
              {cvsOf(c.id).map((d: any) => (
                <button key={d.id} type="button" onClick={() => openDoc(d)} className="text-[11px] text-red-650 hover:text-red-700 hover:underline">
                  📄 {d.filename} <span className="font-mono text-[9px] text-slate-400">{d.refNo}</span>
                </button>
              ))}
              {canEdit && (
                <label className={`cursor-pointer rounded border border-slate-300 px-2 py-0.5 text-[10px] font-semibold hover:bg-slate-50 ${busy ? "opacity-50" : ""}`}>
                  + {t("Add CV")}
                  <input type="file" className="hidden" disabled={busy} accept=".pdf,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadCv(c, f); e.target.value = ""; }} />
                </label>
              )}
              <span className="ms-auto flex gap-3">
                {field && mayAssess(role, field) && a && (
                  <button type="button" onClick={() => setAssessing({ candidateId: c.id, field, status: a.status, rating: a.rating == null ? "" : String(a.rating), note: a.note })}
                    className="text-[11px] font-semibold text-slate-700 hover:underline">{t("Assess")}</button>
                )}
                {canEdit && (
                  <button type="button" onClick={() => setForm({
                    id: c.id, name: c.name, skills: c.skills || "", city: c.city || "", country: c.country || "",
                    languages: c.languages || "", email: c.email || "", phone: c.phone || "",
                    dayRate: c.dayRate == null ? "" : String(c.dayRate), currency: c.currency || "USD", notes: c.notes || "", fields: [],
                  })} className="text-[11px] font-semibold text-slate-600 hover:underline">{t("Edit")}</button>
                )}
                {mayRemoveFromPool(role) && (
                  <button type="button" onClick={() => remove(c)} className="text-[11px] font-semibold text-red-700 hover:underline">{t("Remove from the pool")}</button>
                )}
              </span>
            </div>

            {assessing && assessing.candidateId === c.id && assessing.field === field && (
              <form onSubmit={assess} aria-label={`${t("Assess")} ${c.name} — ${fieldLabel(field!)}`}
                className="mt-2 grid grid-cols-1 items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                <div>
                  <label htmlFor={`as-status-${c.id}`} className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t("Status")}</label>
                  <select id={`as-status-${c.id}`} value={assessing.status} onChange={e => setAssessing({ ...assessing, status: e.target.value })} className="finance-input w-full text-xs">
                    {POOL_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`as-rating-${c.id}`} className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t("Rating (1–5)")}</label>
                  <select id={`as-rating-${c.id}`} value={assessing.rating} onChange={e => setAssessing({ ...assessing, rating: e.target.value })} className="finance-input w-full text-xs">
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`as-note-${c.id}`} className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t("Assessment note")}</label>
                  <input id={`as-note-${c.id}`} maxLength={500} value={assessing.note} onChange={e => setAssessing({ ...assessing, note: e.target.value })} className="finance-input w-full text-xs" />
                </div>
                <div className="flex gap-2 md:col-span-4">
                  <button type="submit" disabled={busy} className="min-h-[44px] rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 md:min-h-0">{busy ? t("Saving…") : t("Save")}</button>
                  <button type="button" onClick={() => setAssessing(null)} className="min-h-[44px] rounded border border-slate-300 px-3 py-1.5 text-xs md:min-h-0">{t("Cancel")}</button>
                </div>
              </form>
            )}
          </>
        )}
      </li>
    );
  };

  return (
    <section aria-labelledby="pool-h" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="pool-h" className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <UserSearch className="h-4 w-4" aria-hidden="true" /> {t("Freelancer pool")}
          </h3>
          <p className="text-[11px] text-slate-500">{headline}</p>
        </div>
        {canEdit && !form && (
          <button type="button" onClick={() => setForm({ ...BLANK, fields: writable.length === 1 ? [...writable] : [] })}
            className="min-h-[44px] rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-950 md:min-h-0">
            + {t("Add to the pool")}
          </button>
        )}
      </div>

      {canEdit && form && (
        <form onSubmit={save} aria-label={t("Freelancer pool entry")}
          className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
          {input("name", "Full Name", { required: true })}
          <div className="md:col-span-3">{input("skills", "Skills / roles", { placeholder: "Producer, filmmaker" })}</div>
          <fieldset className="md:col-span-4">
            <legend className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{form.id ? t("Also add to") : t("Field")}</legend>
            <div className="flex flex-wrap gap-4">
              {POOL_FIELDS.filter(f => writable.includes(f.key)).map(f => (
                <label key={f.key} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={form.fields.includes(f.key)}
                    onChange={e => setForm({ ...form, fields: e.target.checked ? [...form.fields, f.key] : form.fields.filter(x => x !== f.key) })} />
                  {fieldLabel(f.key)} <span className="text-[10px] text-slate-400">({f.covers})</span>
                </label>
              ))}
            </div>
          </fieldset>
          {input("city", "City")}
          {input("country", "Country")}
          <div className="md:col-span-2">{input("languages", "Languages", { placeholder: "Arabic, English" })}</div>
          {input("email", "Email", { type: "email", dir: "ltr" })}
          {input("phone", "Phone", { type: "tel", dir: "ltr", placeholder: "+9613123456" })}
          {input("dayRate", "Day rate (optional)", { type: "number", min: 0, step: "0.01", dir: "ltr" })}
          {input("currency", "Currency", { dir: "ltr" })}
          <div className="md:col-span-4">
            <label htmlFor="pool-notes" className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t("Notes")}</label>
            <textarea id="pool-notes" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="finance-input w-full text-xs" />
          </div>
          <div className="flex gap-2 md:col-span-4">
            <button type="submit" disabled={busy} className="min-h-[44px] rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-950 disabled:opacity-50 md:min-h-0">
              {busy ? t("Saving…") : t("Save")}
            </button>
            <button type="button" onClick={() => setForm(null)} className="min-h-[44px] rounded border border-slate-300 px-4 py-2 text-xs md:min-h-0">{t("Cancel")}</button>
          </div>
        </form>
      )}

      {rows.length === 0 && <p className="text-[11px] italic text-slate-500">{t("Nobody is in the pool yet.")}</p>}

      {view.kind === "summary"
        ? <ul className="divide-y divide-slate-100">{rows.map(c => entry(c))}</ul>
        : fieldsShown.map(f => {
          const people = rows.filter(c => inField(c, f));
          const meta = POOL_FIELDS.find(x => x.key === f)!;
          // Same vacancy rule the server records with; only the file holders are sent the accounts.
          const cover = view.kind === "all" && poolHeadSeat(f, state.users || []).vacant;
          return (
            <div key={f} className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                {fieldLabel(f)} <span className="font-normal normal-case text-slate-400">· {t("assessed by the")} {cover ? <>{t("Executive Director")} ({t("seat vacant")}: {t(meta.head)})</> : t(meta.head)}</span>
              </h4>
              {people.length === 0
                ? <p className="py-2 text-[11px] italic text-slate-400">{t("Nobody in this field yet.")}</p>
                : <ul className="divide-y divide-slate-100">{people.map(c => entry(c, f))}</ul>}
            </div>
          );
        })}

      {canEdit && (
        <p className="text-[10px] text-slate-400">
          {t("Engaging someone from the pool — making them a supplier and drawing their agreement — is done in Buying & paying, not here.")}
        </p>
      )}
    </section>
  );
}
