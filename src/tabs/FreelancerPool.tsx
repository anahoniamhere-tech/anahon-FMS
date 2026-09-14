import React, { useState } from "react";
import { UserSearch } from "lucide-react";
import { SharedProps } from "./shared";
import { poolViewFor } from "../personnelDocs";
import type { PoolCandidate } from "../types";

/**
 * The freelancer pool — people AnaHon may engage but has no contract with yet.
 *
 * Rendered beside the personnel files. Two tiers, decided once in poolViewFor and enforced on
 * the server, not here: the personnel-file roles receive whole rows and CVs; managers receive
 * name and skills and nothing else, so there is nothing more in the browser to reveal.
 *
 * What this deliberately does NOT offer: turning an entry into a supplier or a contract. That
 * is Buying & paying's flow — a pool entry becomes a Vendor in the Suppliers door.
 */
const STATUSES = ["Prospect", "Worked with us", "Not a fit"] as const;
/**
 * The status words, in Arabic, kept here rather than as i18n keys on purpose. "Prospect" is
 * already a key — the funding funnel's stage, translated فرصة محتملة, "a potential opportunity".
 * Said of a person that is wrong, and changing the shared key would break the funnel. The stored
 * value stays the English word; only what an Arabic reader sees differs.
 */
const STATUS_AR: Record<string, string> = { "Prospect": "مرشّح", "Worked with us": "عمل معنا", "Not a fit": "غير مناسب" };
const BLANK = { id: "", name: "", skills: "", city: "", country: "", languages: "", email: "", phone: "", dayRate: "", currency: "USD", status: "Prospect", notes: "" };

export default function FreelancerPool({ currentUser, state, t, lang, triggerToast, refreshState, openDoc }: SharedProps) {
  const view = poolViewFor(currentUser?.role);
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const [busy, setBusy] = useState(false);
  if (!view) return null;
  const statusLabel = (st: string) => (lang === "ar" ? STATUS_AR[st] || st : st);

  const rows: PoolCandidate[] = (state as any).poolCandidates || [];
  const cvsOf = (id: string) => (state.documents || []).filter((d: any) => d.partyId === id);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch("/api/pool/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, user: currentUser }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save the entry.");
      triggerToast(form.id ? `${d.candidate.name} updated.` : `${d.candidate.name} added to the pool.`);
      setForm(null);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const remove = async (c: PoolCandidate) => {
    // A reason is required: this is personal data about someone we never contracted.
    const reason = window.prompt(t("Why is this person being removed from the pool?"));
    if (reason === null) return;
    try {
      const res = await fetch("/api/pool/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, reason, user: currentUser }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not remove the entry.");
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
      // Category CV, partyId = the pool entry: the upload route files it under
      // PERSONNEL/Freelancer Pool/<name>, and maySeePersonnelFile keeps it to the file's holders.
      const res = await fetch("/api/document/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, mimeType: file.type,
          sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          base64, category: "CV", partyId: c.id, user: currentUser,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not file the CV.");
      triggerToast(d.duplicate ? "Already on file — no second copy made." : `CV filed for ${c.name}.`);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const field = (key: keyof typeof BLANK, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`pool-${key}`} className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t(label)}</label>
      <input id={`pool-${key}`} value={(form as any)[key]} onChange={e => setForm({ ...form!, [key]: e.target.value })}
        className="finance-input w-full text-xs" {...props} />
    </div>
  );

  return (
    <section aria-labelledby="pool-h" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="pool-h" className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <UserSearch className="h-4 w-4" aria-hidden="true" /> {t("Freelancer pool")}
          </h3>
          <p className="text-[11px] text-slate-500">
            {view === "full"
              ? t("People we may engage but have no contract with yet. Their CVs are seen by HR, the Programme Director and the master account only.")
              : t("Name and skills only. Contact details, rates and CVs are kept to the personnel-file holders.")}
          </p>
        </div>
        {view === "full" && !form && (
          <button type="button" onClick={() => setForm({ ...BLANK })}
            className="min-h-[44px] rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-950 md:min-h-0">
            + {t("Add to the pool")}
          </button>
        )}
      </div>

      {view === "full" && form && (
        <form onSubmit={save} aria-label={t("Freelancer pool entry")}
          className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
          {field("name", "Full Name", { required: true })}
          <div className="md:col-span-2">{field("skills", "Skills / roles", { placeholder: "Producer, filmmaker" })}</div>
          <div>
            <label htmlFor="pool-status" className="mb-1 block text-[10px] font-bold uppercase text-slate-600">{t("Status")}</label>
            <select id="pool-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="finance-input w-full text-xs">
              {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          {field("city", "City")}
          {field("country", "Country")}
          <div className="md:col-span-2">{field("languages", "Languages", { placeholder: "Arabic, English" })}</div>
          {field("email", "Email", { type: "email", dir: "ltr" })}
          {field("phone", "Phone", { type: "tel", dir: "ltr", placeholder: "+9613123456" })}
          {field("dayRate", "Day rate (optional)", { type: "number", min: 0, step: "0.01", dir: "ltr" })}
          {field("currency", "Currency", { dir: "ltr" })}
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

      <ul className="divide-y divide-slate-100">
        {rows.map(c => (
          <li key={c.id} className="space-y-1 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">{c.name}</span>
              {view === "full" && c.status && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  c.status === "Worked with us" ? "bg-emerald-100 text-emerald-700"
                    : c.status === "Not a fit" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                  {statusLabel(c.status)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-700">{c.skills || <span className="italic text-slate-400">{t("No skills recorded")}</span>}</p>

            {view === "full" && (
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

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">{t("CV")}</span>
                  {cvsOf(c.id).length === 0 && <span className="text-[11px] italic text-slate-400">{t("None on file")}</span>}
                  {cvsOf(c.id).map((d: any) => (
                    <button key={d.id} type="button" onClick={() => openDoc(d)}
                      className="text-[11px] text-red-650 hover:text-red-700 hover:underline">
                      📄 {d.filename} <span className="font-mono text-[9px] text-slate-400">{d.refNo}</span>
                    </button>
                  ))}
                  <label className={`cursor-pointer rounded border border-slate-300 px-2 py-0.5 text-[10px] font-semibold hover:bg-slate-50 ${busy ? "opacity-50" : ""}`}>
                    + {t("Add CV")}
                    <input type="file" className="hidden" disabled={busy} accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadCv(c, f); e.target.value = ""; }} />
                  </label>
                  <span className="ms-auto flex gap-3">
                    <button type="button" onClick={() => setForm({
                      id: c.id, name: c.name, skills: c.skills || "", city: c.city || "", country: c.country || "",
                      languages: c.languages || "", email: c.email || "", phone: c.phone || "",
                      dayRate: c.dayRate == null ? "" : String(c.dayRate), currency: c.currency || "USD",
                      status: c.status || "Prospect", notes: c.notes || "",
                    })} className="text-[11px] font-semibold text-slate-600 hover:underline">{t("Edit")}</button>
                    <button type="button" onClick={() => remove(c)} className="text-[11px] font-semibold text-red-700 hover:underline">{t("Remove from the pool")}</button>
                  </span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {view === "full" && (
        <p className="text-[10px] text-slate-400">
          {t("Engaging someone from the pool — making them a supplier and drawing their agreement — is done in Buying & paying, not here.")}
        </p>
      )}
    </section>
  );
}
