import React, { useEffect, useRef, useState } from "react";
import { SharedProps } from "./shared";
import Info from "../Info";
import { SITE_EDITORS } from "../roles";
import { tr } from "../i18n";
import { SectionsPanel, Focus } from "./SitePanel";

/**
 * Live editor — the website itself, framed from its editing server, edited in place.
 *
 * Edit mode on: click any text on the page to change it, drop a picture from the
 * library on the right onto any image. Each change is matched to the site's content
 * files (site.json, i18n.json, programs.json, home.json) and written; the preview
 * reloads with the new content. Publish builds the public site and pushes it out.
 *
 * Elementor's shape, without Elementor: the page in front, a panel beside it. A click on
 * text edits it in place AND opens its whole section as a form in the Section panel (the
 * other language, links, pictures, list order); Sections lists everything the page cannot
 * show. Since 6 Sep 2026 this is the one website editor — "Site content" was folded in.
 *
 * Two edges, both by design: a published article's words live in the Editorial desk (the
 * page names its record; a click hands it over), and drag-and-drop is a mouse gesture, so
 * the library panel is hidden below md and the phone keeps tap-to-edit only.
 */
const EDIT_ROLES = SITE_EDITORS;
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

const PAGES: { label: string; en: string; ar: string }[] = [
  { label: "Home", en: "/", ar: "/ar/" },
  { label: "About", en: "/about-us/", ar: "/ar/من-نحن/" },
  { label: "Programs", en: "/programs/", ar: "/ar/programs/" },
  { label: "Articles", en: "/articles/", ar: "/ar/المقالات/" },
  { label: "Podcasts", en: "/podcasts/", ar: "/ar/بودكاست/" },
  { label: "Documentaries", en: "/documentaries/", ar: "/ar/documentaries/" },
  { label: "Library", en: "/library/", ar: "/ar/library/" },
  { label: "Team", en: "/team/", ar: "/ar/team-2/" },
  { label: "Transparency", en: "/transparency/", ar: "/ar/transparency/" },
  { label: "Contact", en: "/contact/", ar: "/ar/تواصل-معنا/" },
  { label: "iContent", en: "/icontent/", ar: "/ar/icontent/" },
  { label: "iContent — Studio", en: "/icontent/studio/", ar: "/ar/icontent/studio/" },
  { label: "iContent — Trainings", en: "/icontent/trainings/", ar: "/ar/icontent/trainings/" },
];

type LibItem = { path: string; name: string; size: number; mtime: number };
type ArchiveItem = { id: string; platform: string; kind: string; title: string; thumb: string; date: string; tags: string[]; series: string };
type Article = { slug: string; lang: string; title: string; date: string };
const WIDGET_LABEL: Record<string, string> = { hero: "Home hero slider", episodes: "Latest episodes", articles: "Latest articles", articlesPage: "Articles page", podcastsPage: "Podcasts page" };

export default function LiveTab({ state, currentUser, triggerToast, lang, openDoor }: SharedProps) {
  const canEdit = EDIT_ROLES.includes(currentUser?.role);
  const t = (s: string) => tr(lang, s);
  const siteUrl = String(state.siteUrl || "").replace(/\/$/, "");
  const siteOrigin = siteUrl ? new URL(siteUrl).origin : "";
  const frame = useRef<HTMLIFrameElement>(null);
  const [edit, setEdit] = useState(false);
  const [path, setPath] = useState("/");
  const [pageLang, setPageLang] = useState<"en" | "ar">("en");
  const [articleId, setArticleId] = useState("");   // the desk record behind the framed page, when it is an article
  const [lib, setLib] = useState<LibItem[]>([]);
  const [panel, setPanel] = useState<"section" | "library" | "pictures">("section");
  const [focus, setFocus] = useState<Focus>(null);        // the section behind the last clicked text
  const [device, setDevice] = useState<"desktop" | "tablet" | "phone">("desktop");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"podcast" | "documentary" | "video" | "article" | "all">("podcast");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const editRef = useRef(edit); editRef.current = edit;

  const tell = (m: any) => frame.current?.contentWindow?.postMessage({ anahon: true, ...m }, siteOrigin || "*");
  const loadLib = () => fetch("/api/website/library").then(r => r.json()).then(setLib).catch(() => {});
  useEffect(() => {
    loadLib();
    fetch("/api/archive/items").then(r => r.json()).then(j => setItems((j.items || []).filter((i: ArchiveItem) => i.thumb && i.date).sort((a: ArchiveItem, b: ArchiveItem) => b.date.localeCompare(a.date)))).catch(() => {});
    fetch("/api/archive/home").then(r => r.json()).then(j => setArticles(j.articles || [])).catch(() => {});
  }, []);
  useEffect(() => { tell({ type: "edit", on: edit }); }, [edit]);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data; if (!d || d.anahon !== true) return;
      if (siteOrigin && e.origin !== siteOrigin) return;
      if (d.type === "ready") { setPath(d.url || "/"); setPageLang(d.lang === "ar" ? "ar" : "en"); setArticleId(String(d.articleId || "")); tell({ type: "edit", on: editRef.current }); return; }
      if (d.type === "article") { if (d.id) openDoor("editorial", String(d.id)); return; }
      if (d.type === "select") {
        const r = await post("/api/website/locate", { text: d.text, lang: d.lang }).catch(() => ({ paths: [] }));
        const first = String((r.paths || [])[0] || ""); const [file, section] = first.split(".");
        if (file && section) { setFocus({ file, section }); setPanel("section"); }
        return;
      }
      if (d.type === "widget") {
        const w = String(d.widget || ""); const id = String(d.id || "");
        if (!WIDGET_LABEL[w] || !id) return;
        const cur = await fetch("/api/archive/home").then(r => r.json()).catch(() => ({}));
        const c = (cur.home || {})[w] || {};
        const pinned: string[] = (c.pinned || []).filter((x: string) => x !== id), removed: string[] = (c.removed || []).filter((x: string) => x !== id);
        const next = d.op === "pin" ? { pinned: [id, ...pinned], removed } : { pinned, removed: [...removed, id] };
        const r = await post("/api/archive/home", { widgets: { [w]: next } });
        if (r.success) triggerToast(`${t(d.op === "pin" ? "Pinned to" : "Removed from")} ${t(WIDGET_LABEL[w])}`, "success");
        else triggerToast(r.error || t("Not saved"), "error");
        tell({ type: "result", ok: !!r.success });
        return;
      }
      if (d.type === "text" || d.type === "image") {
        const r = await post("/api/website/edit", { kind: d.type, from: d.from, to: d.to, lang: d.lang, url: d.url });
        if (r.success) triggerToast(`${t("Saved")} — ${r.count} ${t(r.count === 1 ? "place" : "places")}: ${r.paths.join(", ")}`, "success");
        else triggerToast(r.error || t("Not saved"), "error");
        tell({ type: "result", ok: !!r.success });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [siteOrigin, triggerToast]);

  const go = (p: string) => { setPath(p); if (frame.current) frame.current.src = siteUrl + p; };
  const current = PAGES.find(p => p.en === path || p.ar === path);
  const publish = async () => {
    if (!window.confirm(t("Build the public website from what you see here and push it to the host?"))) return;
    setBusy(true); setLog(null);
    const r = await post("/api/website/build", {});
    setBusy(false); setLog(r.log || r.error || JSON.stringify(r));
    triggerToast(r.ok ? `${t("Published in")} ${r.seconds}s${r.deployed === null ? ` (${t("built only — no host configured yet")})` : ""}` : (r.error || t("Publish failed")), r.ok ? "success" : "error");
  };
  const upload = async (f: File) => {
    const b64 = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
    const up = await post("/api/website/image", { filename: f.name, mimeType: f.type, base64: b64 });
    if (up.success) { triggerToast(`${t("Uploaded")} ${up.path}`, "success"); loadLib(); } else triggerToast(up.error || t("Upload failed"), "error");
  };

  if (!siteUrl) return <div className="p-6 text-sm text-slate-500">{t("The site's editing server is not configured (SITE_URL).")}</div>;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        <select value={current ? current.label : ""} onChange={e => { const p = PAGES.find(x => x.label === e.target.value); if (p) go(p[pageLang]); }} className="rounded border border-slate-300 px-2 py-1 text-xs">
          <option value="">{current ? "" : path}</option>
          {PAGES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
        <div className="flex overflow-hidden rounded border border-slate-300 text-xs">
          {(["en", "ar"] as const).map(l => (
            <button key={l} onClick={() => { setPageLang(l); go((current || PAGES[0])[l]); }} className={`px-2 py-1 ${pageLang === l ? "bg-slate-800 text-white" : "bg-white"}`}>{l.toUpperCase()}</button>
          ))}
        </div>
        <span className="font-mono text-xs text-slate-500" dir="ltr">{path}</span>
        <div className="hidden overflow-hidden rounded border border-slate-300 text-xs md:flex">
          {(["desktop", "tablet", "phone"] as const).map(w => (
            <button key={w} onClick={() => setDevice(w)} className={`px-2 py-1 ${device === w ? "bg-slate-800 text-white" : "bg-white"}`}>{t(w === "desktop" ? "Desktop" : w === "tablet" ? "Tablet" : "Phone")}</button>
          ))}
        </div>
        <div className="flex-1" />
        {canEdit && (
          <label className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1 text-xs font-semibold ${edit ? "bg-red-600 text-white" : "bg-slate-100"}`}>
            <input type="checkbox" checked={edit} onChange={e => setEdit(e.target.checked)} className="hidden" />
            {edit ? `✎ ${t("Editing — click text, drop pictures")}` : t("Browse (turn on editing)")}
          </label>
        )}
        {canEdit && (
          <Info id="live-editor" lang={lang} />
        )}
        {canEdit && <><button onClick={publish} disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{busy ? t("Publishing…") : `⬆ ${t("Publish")}`}</button><Info id="publish-site" lang={lang} /></>}
        <a href={siteUrl + path} target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline">{t("open")} ↗</a>
      </div>
      {canEdit && edit && articleId && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>{t("This is a published article — its words are edited in the Editorial desk, not here.")}</span>
          <button onClick={() => openDoor("editorial", articleId)} className="ms-auto rounded bg-amber-700 px-3 py-1 font-semibold text-white">{t("Open in the Editorial desk")}</button>
        </div>
      )}
      {canEdit && <p className="text-[11px] text-slate-500 md:hidden">{t("On a phone you can tap text to edit it; dropping pictures and library items needs a computer.")}</p>}
      <div className="flex min-h-0 flex-1 gap-2">
        <div className={`flex min-w-0 flex-1 justify-center ${device === "desktop" ? "" : "bg-slate-200 rounded-lg"}`}>
          <iframe ref={frame} src={siteUrl + "/"} title="AnaHon website" style={{ maxWidth: device === "tablet" ? 768 : device === "phone" ? 390 : undefined }} className="h-full w-full min-w-0 rounded-lg border border-slate-200 bg-white" />
        </div>
        {canEdit && (
          <aside className={`hidden shrink-0 flex-col rounded-lg border border-slate-200 bg-white md:flex ${panel === "section" ? "w-96" : "w-64"}`}>
            <div className="flex border-b text-xs font-semibold">
              {(["section", "library", "pictures"] as const).map(p => <button key={p} onClick={() => setPanel(p)} className={`flex-1 px-2 py-1.5 ${panel === p ? "bg-slate-800 text-white" : ""}`}>{t(p === "section" ? "Section" : p === "library" ? "Library" : "Pictures")}</button>)}
            </div>
            {panel === "section" && <SectionsPanel canEdit={canEdit} t={t} triggerToast={triggerToast} siteUrl={siteUrl} focus={focus} />}
            {panel === "library" && (
              <>
                <div className="space-y-1 border-b p-1.5">
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Search titles…")} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {(["podcast", "documentary", "video", "article", "all"] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-1.5 py-0.5 ${filter === f ? "border-red-600 bg-red-600 text-white" : "border-slate-300"}`}>{t(f)}</button>)}
                  </div>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto p-1">
                  {filter === "article"
                    ? articles.filter(a => a.lang === pageLang && (!q || a.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 60).map(a => (
                      <div key={a.slug + a.lang} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", "item:" + a.slug); e.dataTransfer.effectAllowed = "copy"; }} title={t("Drag onto the Latest articles widget")}
                        className="cursor-grab rounded border border-slate-200 px-2 py-1 text-xs hover:border-red-400"><div className="line-clamp-2">{a.title}</div><div className="text-[10px] text-slate-400">{a.date}</div></div>))
                    : items.filter(i => (filter === "all" || (filter === "video" ? ["video", "reel"].includes(i.kind) && !i.tags.includes("podcast") : i.tags.includes(filter))) && (!q || i.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 80).map(i => (
                      <div key={i.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", "item:" + i.id); e.dataTransfer.effectAllowed = "copy"; }} title={t("Drag onto a widget on the page")}
                        className="flex cursor-grab gap-1.5 rounded border border-slate-200 p-1 text-xs hover:border-red-400">
                        <img src={i.thumb} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                        <div className="min-w-0"><div className="line-clamp-2 leading-tight">{i.title}</div><div className="text-[10px] text-slate-400">{i.date} · {i.tags.includes("podcast") ? "podcast" : i.tags.includes("documentary") ? "documentary" : i.kind}</div></div>
                      </div>))}
                  {!items.length && <div className="p-2 text-xs text-slate-400">{t("Loading the library…")}</div>}
                </div>
                <div className="border-t px-2 py-1 text-[10px] text-slate-400">{t("Drop on the hero, episodes or articles widget to pin it first. Hover an entry on the page and click × to remove it.")}</div>
              </>
            )}
            {panel === "pictures" && <>
            <div className="flex items-center justify-between border-b px-2 py-1.5 text-xs font-semibold">
              <span>{t("Pictures")}</span>
              <label className="cursor-pointer rounded border px-1.5 py-0.5 font-normal">+ {t("upload")}<input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-1 overflow-y-auto p-1">
              {lib.map(it => (
                <img key={it.path} src={siteUrl + it.path} alt={it.name} title={`${it.name} — ${t("drag onto a picture on the page")}`} draggable
                  onDragStart={e => { e.dataTransfer.setData("text/plain", it.path); e.dataTransfer.effectAllowed = "copy"; }}
                  className="h-16 w-full cursor-grab rounded border border-slate-200 object-cover" />
              ))}
              {!lib.length && <div className="col-span-2 p-2 text-xs text-slate-400">{t("No pictures yet — upload one.")}</div>}
            </div>
            </>}
          </aside>
        )}
      </div>
      {log !== null && (
        <details open className="rounded-lg border border-slate-200 bg-white text-xs">
          <summary className="cursor-pointer px-3 py-1.5 font-semibold">{t("Publish log")}</summary>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-2 font-mono text-[11px] text-slate-600">{log}</pre>
        </details>
      )}
    </div>
  );
}
