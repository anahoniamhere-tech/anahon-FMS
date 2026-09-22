import React, { useEffect, useState } from "react";
import { ic } from "../nav";
import { FileText, TriangleAlert } from "lucide-react";
import { LABEL_WORDS } from "../editorialGates";
import { ARTICLE_TYPES } from "../articleFile";

/**
 * Every article already on the website, in one list, with every field editable (22 Sep 2026).
 *
 * Deliberately NOT the editorial chain above it: that chain produces a new piece through
 * fact-check and two approvals (P3 §4). This manages what is already published — most of these
 * files are legacy imports with no piece in the register at all.
 *
 * Saad's rule: metadata is free. Changing the title or the body changes what a reader already
 * read, so the form asks for one line saying what was wrong and what is right (P3 §8). The server
 * decides that, not this screen — the button only says so first.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
type Row = { file: string; lang: string; title: string; slug: string; date: string; articleType: string; category: string; contentLabel: string; tags: string[]; updated: string; corrections: string[]; fmsId: string };
type Loaded = { fields: Record<string, any>; body: string; others: { key: string; value: string }[]; corrections: string[] };

export default function ArticlesPanel({ currentUser, t, triggerToast }: { currentUser: any; t: (s: string) => string; triggerToast: (m: string, k?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/articles").then(r => r.json())
    .then(d => setRows(d.ok ? d.articles : []))
    .catch(() => setRows([]));
  useEffect(() => { if (open && rows == null) load(); }, [open]);

  const openOne = async (r: Row) => {
    setSel(r); setDoc(null); setNote("");
    const d = await fetch(`/api/articles/one?lang=${encodeURIComponent(r.lang)}&file=${encodeURIComponent(r.file)}`).then(x => x.json()).catch(e => ({ error: e.message }));
    if (!d.ok) { triggerToast(d.error || t("Could not open that article"), "error"); setSel(null); return; }
    setDoc(d); setForm({ ...d.fields }); setBody(d.body);
  };

  // The same two fields the server treats as "what a reader already read".
  const changed = doc ? [
    ...(String(form.title ?? "").trim() !== String(doc.fields.title ?? "").trim() ? ["title"] : []),
    ...(body.trim() !== doc.body.trim() ? ["body"] : []),
  ] : [];

  const save = async () => {
    if (!sel) return;
    setBusy(true);
    const r = await post("/api/articles/save", {
      lang: sel.lang, file: sel.file, fields: form, body,
      correctionNote: note, user: currentUser,
    }).catch(e => ({ error: e.message }));
    setBusy(false);
    if (r.ok) {
      triggerToast(r.corrected?.length ? t("Saved — the correction is on the article, with today's date.") : t("Saved."));
      setSel(null); setDoc(null); load();
    } else triggerToast(r.error || t("Could not save"), "error");
  };

  const shown = (rows || []).filter(r => !q.trim()
    || `${r.title} ${r.slug} ${r.category} ${r.tags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()));

  const label = (k: string) => <span className="block text-slate-600 font-bold mb-1">{t(k)}</span>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 text-sm font-bold text-slate-800 uppercase font-mono">
        <span>{open ? "▾" : "▸"}</span>{ic(FileText, "h-4 w-4")}{t("Articles on the website")}
        <span className="ms-auto text-[10px] font-normal normal-case text-slate-400">
          {rows ? `${rows.length} ${t("articles")}` : t("everything already published — type, category, tags, text")}
        </span>
      </button>

      {open && (
        <div className="space-y-3 text-xs">
          {rows == null ? <p className="text-slate-500">{t("Loading…")}</p> : !rows.length ? (
            <p className="text-slate-500">{t("No article files found on the site.")}</p>
          ) : !sel ? (
            <>
              <input value={q} onChange={e => setQ(e.target.value)} dir="auto"
                placeholder={t("Search by title, slug, category or tag")} className="finance-input w-full" />
              <div className="divide-y divide-slate-100">
                {shown.map(r => (
                  <button key={`${r.lang}/${r.file}`} onClick={() => openOne(r)}
                    className="flex w-full flex-wrap items-center gap-2 py-2 text-start hover:bg-slate-50">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase" dir="ltr">{r.lang}</span>
                    <span className="font-bold text-slate-900" dir="auto">{r.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{r.articleType || "news"}</span>
                    {r.category && <span className="text-slate-500">{r.category}</span>}
                    {r.contentLabel && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">{r.contentLabel}</span>}
                    {r.tags.slice(0, 3).map(tg => <span key={tg} className="text-slate-400">#{tg}</span>)}
                    {r.corrections?.length > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800">{ic(TriangleAlert, "h-3 w-3")}{t("corrected")}</span>}
                    <span className="ms-auto font-mono text-slate-400" dir="ltr">{r.date?.slice(0, 10)}</span>
                  </button>
                ))}
                {!shown.length && <p className="py-3 text-slate-400">{t("Nothing matches that.")}</p>}
              </div>
            </>
          ) : !doc ? <p className="text-slate-500">{t("Loading…")}</p> : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => { setSel(null); setDoc(null); }} className="rounded bg-slate-100 px-3 py-1 font-bold hover:bg-slate-200">← {t("All articles")}</button>
                <span className="font-mono text-slate-400" dir="ltr">{sel.lang}/{sel.file}</span>
                {sel.fmsId && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{t("from the register")}</span>}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">{label("Title")}
                  <input value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} dir="auto" className="finance-input w-full" /></div>
                <div className="md:col-span-2">{label("Description")}
                  <input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} dir="auto" className="finance-input w-full" /></div>
                <div>{label("Type")}
                  <select value={form.articleType || "news"} onChange={e => setForm({ ...form, articleType: e.target.value })} className="finance-input w-full">
                    {ARTICLE_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select></div>
                <div>{label("Content label")}
                  <select value={form.contentLabel || ""} onChange={e => setForm({ ...form, contentLabel: e.target.value })} className="finance-input w-full">
                    <option value="">— {t("none")} —</option>
                    {LABEL_WORDS.map(([w]) => <option key={w} value={w}>{w}</option>)}
                  </select></div>
                <div>{label("Category")}
                  <input value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} dir="auto" className="finance-input w-full" /></div>
                <div>{label("Tags")}
                  <input value={(form.tags || []).join(", ")} onChange={e => setForm({ ...form, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    dir="auto" placeholder={t("comma separated")} className="finance-input w-full" /></div>
                <div>{label("Author")}
                  <input value={form.author || ""} onChange={e => setForm({ ...form, author: e.target.value })} dir="auto" className="finance-input w-full" /></div>
                <div>{label("Date")}
                  <input value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} dir="ltr" className="finance-input w-full" /></div>
                <div className="md:col-span-2">{label("Cover")}
                  <input value={form.cover || ""} onChange={e => setForm({ ...form, cover: e.target.value })} dir="ltr" className="finance-input w-full" /></div>
                {form.contentLabel && LABEL_WORDS.some(([w, k]) => w === form.contentLabel && k === "Commercial") && (
                  <div className="md:col-span-2">{label("Who paid for it")}
                    <input value={form.sponsorDisclosure || ""} onChange={e => setForm({ ...form, sponsorDisclosure: e.target.value })} dir="auto" className="finance-input w-full" /></div>
                )}
              </div>

              <div>{label("The article")}
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={16} dir="auto" className="finance-input w-full font-mono text-[11px]" /></div>

              {doc.others.length > 0 && (
                <p className="text-[10px] text-slate-400" dir="auto">
                  {t("Kept as they are, not edited here")}: {doc.others.map(o => `${o.key}=${o.value}`).join(" · ")}
                </p>
              )}
              {doc.corrections?.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900" dir="auto">
                  <b>{t("Corrections on the record")}</b>
                  <ul className="list-disc ms-4">{doc.corrections.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              {changed.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-2 space-y-1">
                  <p className="text-[11px] font-bold text-amber-900">
                    {t("You changed the")} {changed.map(c => t(c)).join(t(" and "))} — {t("what a reader already read.")}
                  </p>
                  <p className="text-[10px] text-amber-900">{t("Say what was wrong and what is right. It is kept with today's date and shown on the article (Policy P3 §8).")}</p>
                  <input value={note} onChange={e => setNote(e.target.value)} dir="auto"
                    placeholder={t("e.g. The mayor was named wrongly; it is Ali Hassan.")} className="finance-input w-full" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={save} disabled={busy}
                  className="rounded bg-red-700 px-4 py-1.5 font-bold text-white disabled:opacity-40">
                  {busy ? t("Saving…") : changed.length ? t("Save the correction") : t("Save")}
                </button>
                <span className="text-[10px] text-slate-400">
                  {changed.length
                    ? t("The site is rebuilt after saving.")
                    : t("Reclassifying changes nothing a reader was told — no correction needed.")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
