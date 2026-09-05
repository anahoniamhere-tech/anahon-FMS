import React, { useEffect, useMemo, useState } from "react";
import { SharedProps } from "./shared";
import { SITE_EDITORS } from "../roles";

/**
 * Website — every piece of copy the site renders, edited here.
 *
 * The site imports JSON data files (site.json: hero, programs, hosts, shows, stats,
 * incubator, academy, newsletter, team, faq · i18n.json: navigation, footer, labels ·
 * programs.json / home.json when present). This tab renders any section as a form:
 * objects with `en` / `ar` keys become two columns; strings, numbers, booleans and
 * lists are edited in place. Saving a section writes the file and refreshes the site.
 */
const EDIT_ROLES = SITE_EDITORS;
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

const FILE_LABEL: Record<string, string> = { site: "Pages & sections", i18n: "Navigation, footer & labels", programs: "Programs & mission", home: "Home widgets (see Archive › Website home)" };
const SECTION_LABEL: Record<string, string> = {
  labels: "Inline labels (buttons, small headings)",
  hero: "Home — hero", programs: "Home — programs strip", hosts: "Podcasts — hosts", shows: "Podcasts — shows", stats: "Home — numbers",
  incubator: "Home — incubator", academy: "Home — academy", newsletter: "Newsletter band", team: "Our Team page", faq: "FAQ (contact page)",
  ui: "Navigation · footer · labels", mission: "Mission", orgRegistration: "Registration details", register: "Funding register",
};
const humanize = (k: string) => (SECTION_LABEL[k] || k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
const isBilingual = (v: any) => v && typeof v === "object" && !Array.isArray(v) && "en" in v && "ar" in v;
const looksLong = (s: string) => s.length > 70 || s.includes("\n");

/** Recursive editor for one JSON value. Keeps the shape; only leaves change. */
function Field({ value, onChange, path, canEdit }: { value: any; onChange: (v: any) => void; path: string; canEdit: boolean }) {
  if (typeof value === "string") {
    const key = path.split(/[.\[]/).pop() || "";
    if (/^(img|image|cover|photo|thumb|logo|avatar|picture|background)$/i.test(key) || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(value)) {
      const siteUrl = (window as any).__siteUrl || "";
      const src = /^https?:/.test(value) ? value : value ? siteUrl + value : "";
      return (
        <div className="flex items-center gap-2">
          {src ? <img src={src} alt="" className="h-14 w-20 rounded border border-slate-200 object-cover" /> : <div className="h-14 w-20 rounded bg-slate-100" />}
          <input value={value} disabled={!canEdit} dir="ltr" onChange={e => onChange(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="/uploads/website/… or https://…" />
          {canEdit && <label className="cursor-pointer rounded border px-2 py-1 text-xs">Upload<input type="file" accept="image/*" className="hidden" onChange={async ev => {
            const f = ev.target.files?.[0]; if (!f) return;
            const b64 = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
            const up = await post("/api/website/image", { filename: f.name, mimeType: f.type, base64: b64 });
            if (up.success) onChange(up.path); else window.alert(up.error || "Upload failed");
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
    const blank = (t: any): any => typeof t === "string" ? "" : typeof t === "number" ? 0 : typeof t === "boolean" ? false : Array.isArray(t) ? [] : t && typeof t === "object" ? Object.fromEntries(Object.keys(t).map(k => [k, blank(t[k])])) : "";
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50/60 p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>#{i + 1}</span>
              {canEdit && <span className="flex gap-2">
                <button onClick={() => { if (i > 0) { const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); } }} className="hover:text-slate-700">↑</button>
                <button onClick={() => { if (i < value.length - 1) { const n = [...value]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); } }} className="hover:text-slate-700">↓</button>
                <button onClick={() => { if (window.confirm("Remove this entry?")) onChange(value.filter((_, j) => j !== i)); }} className="text-red-600">remove</button>
              </span>}
            </div>
            <Field value={item} onChange={v => onChange(value.map((x, j) => j === i ? v : x))} path={`${path}[${i}]`} canEdit={canEdit} />
          </div>
        ))}
        {canEdit && <button onClick={() => onChange([...value, blank(template)])} className="rounded border px-2 py-0.5 text-xs">+ add</button>}
      </div>
    );
  }
  if (typeof value === "object") {
    if (isBilingual(value)) {
      const keys = Object.keys(value).filter(k => k !== "en" && k !== "ar");
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(["en", "ar"] as const).map(l => (
              <div key={l} className="rounded border border-slate-200 p-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{l === "en" ? "English" : "العربية"}</p>
                <Field value={value[l]} onChange={v => onChange({ ...value, [l]: v })} path={`${path}.${l}`} canEdit={canEdit} />
              </div>
            ))}
          </div>
          {keys.map(k => <label key={k} className="block text-xs"><span className="text-slate-500">{humanize(k)}</span><Field value={value[k]} onChange={v => onChange({ ...value, [k]: v })} path={`${path}.${k}`} canEdit={canEdit} /></label>)}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([k, v]) => (
          <label key={k} className="block text-xs">
            <span className="text-slate-500">{humanize(k)}</span>
            <Field value={v} onChange={nv => onChange({ ...value, [k]: nv })} path={`${path}.${k}`} canEdit={canEdit} />
          </label>
        ))}
      </div>
    );
  }
  return <span className="text-xs text-slate-400">{String(value)}</span>;
}

export default function WebsiteTab({ state, currentUser, triggerToast }: SharedProps) {
  const canEdit = EDIT_ROLES.includes(currentUser?.role);
  useEffect(() => { (window as any).__siteUrl = (state as any)?.siteUrl || ""; }, [state]);
  const [content, setContent] = useState<Record<string, any>>({});
  const [file, setFile] = useState<string>("site");
  const [section, setSection] = useState<string>("");
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const load = () => fetch("/api/website/content").then(r => r.json()).then(d => { setContent(d); });
  useEffect(() => { load(); }, []);
  const files = Object.keys(content).filter(f => f !== "home");
  const sections = useMemo(() => Object.keys(content[file] || {}), [content, file]);
  useEffect(() => { if (!section || !sections.includes(section)) setSection(sections[0] || ""); }, [sections]);
  useEffect(() => { setDraft(section ? JSON.parse(JSON.stringify(content[file]?.[section] ?? null)) : null); }, [file, section, content]);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(content[file]?.[section]);

  const save = async () => {
    setSaving(true);
    const r = await post("/api/website/content", { file, section, value: draft });
    setSaving(false);
    if (r.success) { triggerToast(`Saved — site refreshed (${r.refreshed?.invalidated ?? 0} modules)`); setContent(c => ({ ...c, [file]: { ...c[file], [section]: draft } })); }
    else triggerToast(r.error || "Save failed", "error");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900">🌐 Website</h2>
        <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
          {files.map(f => <button key={f} onClick={() => setFile(f)} className={`rounded-full px-3 py-1 ${file === f ? "bg-slate-900 text-white" : "text-slate-600"}`}>{FILE_LABEL[f] || f}</button>)}
        </div>
        {canEdit && <button onClick={save} disabled={!dirty || saving} className="ms-auto rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40">{saving ? "Saving…" : dirty ? "Save & refresh site" : "Saved"}</button>}
      </div>
      <p className="text-xs text-slate-500">What you save here is what the website renders — no editing on the site itself. Structure (which sections exist, which fields) is set in the site's code; the words, links and lists are yours.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_1fr]">
        <nav className="space-y-1">
          {sections.map(s => (
            <button key={s} onClick={() => { if (dirty && !window.confirm("Discard unsaved changes in this section?")) return; setSection(s); }}
              className={`block w-full rounded px-3 py-1.5 text-start text-xs ${section === s ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{humanize(s)}</button>
          ))}
        </nav>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          {draft === null ? <p className="text-xs text-slate-500">Choose a section.</p> : <Field value={draft} onChange={setDraft} path={`${file}.${section}`} canEdit={canEdit} />}
        </div>
      </div>
    </div>
  );
}
