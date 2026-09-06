import React, { useEffect, useMemo, useState } from "react";

/**
 * The Section panel of the Live editor — every piece of copy the site renders, as a form.
 *
 * The site imports JSON data files (site.json: hero, programs, hosts, shows, stats,
 * incubator, academy, newsletter, team, faq · i18n.json: navigation, footer, labels ·
 * programs.json). Objects with `en` / `ar` keys become two fields; strings, numbers,
 * booleans and lists are edited in place. Saving a section writes the file and refreshes
 * the site. Clicking text on the framed page opens the section that text lives in
 * (`focus`); "Sections" lists them all for what a page cannot show.
 *
 * Was the "Site content" door until 6 Sep 2026 — one editor now, the page in front, the
 * form beside it, the way a page builder does it.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

export const FILE_LABEL: Record<string, string> = { site: "Pages & sections", i18n: "Navigation, footer & labels", programs: "Programs & mission" };
export const SECTION_LABEL: Record<string, string> = {
  labels: "Inline labels (buttons, small headings)",
  hero: "Home — hero", programs: "Home — programs strip", hosts: "Podcasts — hosts", shows: "Podcasts — shows", stats: "Home — numbers",
  incubator: "Home — incubator", academy: "Home — academy", newsletter: "Newsletter band", team: "Our Team page", faq: "FAQ (contact page)",
  ui: "Navigation · footer · labels", mission: "Mission", orgRegistration: "Registration details", register: "Funding register",
};
export const humanize = (k: string) => (SECTION_LABEL[k] || k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
const isBilingual = (v: any) => v && typeof v === "object" && !Array.isArray(v) && "en" in v && "ar" in v;
const looksLong = (s: string) => s.length > 70 || s.includes("\n");

export type T = (s: string) => string;
/** Recursive editor for one JSON value. Keeps the shape; only leaves change. */
export function Field({ value, onChange, path, canEdit, t }: { value: any; onChange: (v: any) => void; path: string; canEdit: boolean; t: T }) {
  if (typeof value === "string") {
    const key = path.split(/[.\[]/).pop() || "";
    if (/^(img|image|cover|photo|thumb|logo|avatar|picture|background)$/i.test(key) || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(value)) {
      const siteUrl = (window as any).__siteUrl || "";
      const src = /^https?:/.test(value) ? value : value ? siteUrl + value : "";
      return (
        <div className="flex items-center gap-2">
          {src ? <img src={src} alt="" className="h-14 w-20 rounded border border-slate-200 object-cover" /> : <div className="h-14 w-20 rounded bg-slate-100" />}
          <input value={value} disabled={!canEdit} dir="ltr" onChange={e => onChange(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="/uploads/website/… or https://…" />
          {canEdit && <label className="cursor-pointer rounded border px-2 py-1 text-xs">{t("Upload")}<input type="file" accept="image/*" className="hidden" onChange={async ev => {
            const f = ev.target.files?.[0]; if (!f) return;
            const b64 = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
            const up = await post("/api/website/image", { filename: f.name, mimeType: f.type, base64: b64 });
            if (up.success) onChange(up.path); else window.alert(up.error || t("Upload failed"));
          }} /></label>}
        </div>
      );
    }
    const dir = /[؀-ۿ]/.test(value) || path.includes("ar.") ? "rtl" : "ltr";
    return looksLong(value)
      ? <textarea value={value} disabled={!canEdit} dir={dir} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))} onChange={e => onChange(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
      : <input value={value} disabled={!canEdit} dir={dir} onChange={e => onChange(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />;
  }
  if (typeof value === "number") return <input type="number" value={value} disabled={!canEdit} onChange={e => onChange(Number(e.target.value))} className="w-32 rounded border border-slate-300 px-2 py-1 text-xs" />;
  if (typeof value === "boolean") return <input type="checkbox" checked={value} disabled={!canEdit} onChange={e => onChange(e.target.checked)} />;
  if (value === null || value === undefined) return <span className="text-xs text-slate-400">—</span>;
  if (Array.isArray(value)) {
    const template = value.length ? JSON.parse(JSON.stringify(value[value.length - 1])) : "";
    const blank = (x: any): any => typeof x === "string" ? "" : typeof x === "number" ? 0 : typeof x === "boolean" ? false : Array.isArray(x) ? [] : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).map(k => [k, blank(x[k])])) : "";
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50/60 p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>#{i + 1}</span>
              {canEdit && <span className="flex gap-2">
                <button onClick={() => { if (i > 0) { const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); } }} className="hover:text-slate-700">↑</button>
                <button onClick={() => { if (i < value.length - 1) { const n = [...value]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); } }} className="hover:text-slate-700">↓</button>
                <button onClick={() => { if (window.confirm(t("Remove this entry?"))) onChange(value.filter((_, j) => j !== i)); }} className="text-red-600">{t("remove")}</button>
              </span>}
            </div>
            <Field value={item} onChange={v => onChange(value.map((x, j) => j === i ? v : x))} path={`${path}[${i}]`} canEdit={canEdit} t={t} />
          </div>
        ))}
        {canEdit && <button onClick={() => onChange([...value, blank(template)])} className="rounded border px-2 py-0.5 text-xs">+ {t("add")}</button>}
      </div>
    );
  }
  if (typeof value === "object") {
    if (isBilingual(value)) {
      const keys = Object.keys(value).filter(k => k !== "en" && k !== "ar");
      return (
        <div className="space-y-2">
          {(["en", "ar"] as const).map(l => (
            <div key={l} className="rounded border border-slate-200 p-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{l === "en" ? "English" : "العربية"}</p>
              <Field value={value[l]} onChange={v => onChange({ ...value, [l]: v })} path={`${path}.${l}`} canEdit={canEdit} t={t} />
            </div>
          ))}
          {keys.map(k => <label key={k} className="block text-xs"><span className="text-slate-500">{t(humanize(k))}</span><Field value={value[k]} onChange={v => onChange({ ...value, [k]: v })} path={`${path}.${k}`} canEdit={canEdit} t={t} /></label>)}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([k, v]) => (
          <label key={k} className="block text-xs">
            <span className="text-slate-500">{t(humanize(k))}</span>
            <Field value={v} onChange={nv => onChange({ ...value, [k]: nv })} path={`${path}.${k}`} canEdit={canEdit} t={t} />
          </label>
        ))}
      </div>
    );
  }
  return <span className="text-xs text-slate-400">{String(value)}</span>;
}

export type Focus = { file: string; section: string } | null;

/** The panel: one section as a form (from a click on the page, or picked from the list). */
export function SectionsPanel({ canEdit, t, triggerToast, siteUrl, focus }: { canEdit: boolean; t: T; triggerToast: (m: string, k?: "success" | "error") => void; siteUrl: string; focus: Focus }) {
  useEffect(() => { (window as any).__siteUrl = siteUrl; }, [siteUrl]);
  const [content, setContent] = useState<Record<string, any>>({});
  const [file, setFile] = useState<string>("site");
  const [section, setSection] = useState<string>("");
  const [listing, setListing] = useState(true);       // "Sections" list vs one section's form
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/website/content").then(r => r.json()).then(setContent); }, []);
  // a click on the page lands here: open that section, even over an unsaved draft elsewhere
  useEffect(() => { if (focus && content[focus.file]?.[focus.section] !== undefined) { setFile(focus.file); setSection(focus.section); setListing(false); } }, [focus, content]);
  const files = Object.keys(content).filter(f => f !== "home");
  const sections = useMemo(() => Object.keys(content[file] || {}), [content, file]);
  useEffect(() => { setDraft(section ? JSON.parse(JSON.stringify(content[file]?.[section] ?? null)) : null); }, [file, section, content]);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(content[file]?.[section]);

  const save = async () => {
    setSaving(true);
    const r = await post("/api/website/content", { file, section, value: draft });
    setSaving(false);
    if (r.success) { triggerToast(`${t("Saved — site refreshed")} (${r.refreshed?.invalidated ?? 0})`); setContent(c => ({ ...c, [file]: { ...c[file], [section]: draft } })); }
    else triggerToast(r.error || t("Save failed"), "error");
  };
  const pick = (f: string, s: string) => { if (dirty && !window.confirm(t("Discard unsaved changes in this section?"))) return; setFile(f); setSection(s); setListing(false); };

  if (listing || !section) return (
    <div className="flex-1 overflow-y-auto p-1.5 text-xs">
      <p className="mb-2 text-[11px] text-slate-500">{t("Click anything on the page to open its section here.")}</p>
      {files.map(f => (
        <div key={f} className="mb-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t(FILE_LABEL[f] || f)}</p>
          {Object.keys(content[f] || {}).map(s => (
            <button key={s} onClick={() => pick(f, s)} className={`block w-full rounded px-2 py-1 text-start ${f === file && s === section ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{t(humanize(s))}</button>
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div className="flex items-center gap-1 border-b px-2 py-1.5 text-xs">
        <button onClick={() => setListing(true)} className="rounded border px-1.5 py-0.5" title={t("All sections")}>☰</button>
        <span className="min-w-0 flex-1 truncate font-semibold" title={`${file} › ${section}`}>{t(humanize(section))}</span>
        {canEdit && <button onClick={save} disabled={!dirty || saving} className="rounded bg-red-700 px-2 py-0.5 font-bold text-white disabled:opacity-40">{saving ? t("Saving…") : dirty ? t("Save & refresh site") : t("Saved")}</button>}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {draft === null ? <p className="text-xs text-slate-500">{t("Choose a section.")}</p> : <Field value={draft} onChange={setDraft} path={`${file}.${section}`} canEdit={canEdit} t={t} />}
      </div>
    </>
  );
}
