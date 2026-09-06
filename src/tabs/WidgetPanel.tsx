import React, { useEffect, useMemo, useState } from "react";
import type { T } from "./SitePanel";

/**
 * A widget's panel in the Live editor — the hero slider, the latest-articles strip, the
 * episode rails, the Articles and Podcasts pages. The page reports the widget's entries in
 * the order it renders them; here they are a list you can reorder, remove and add to from
 * the library. Save writes home.json (pinned = exactly the order you see, removed = what you
 * took out) and reloads the page. "Back to automatic" clears the pins so the newest items
 * lead again. One panel for every widget; the page decides how many it shows.
 */
export const WIDGET_LABEL: Record<string, string> = { hero: "Home hero slider", episodes: "Latest episodes", articles: "Latest articles", articlesPage: "Articles page", podcastsPage: "Podcasts page" };
/** Where each widget lives, per language — the Sections list navigates there. */
export const WIDGET_PAGE: Record<string, { en: string; ar: string }> = {
  hero: { en: "/", ar: "/ar/" }, articles: { en: "/", ar: "/ar/" }, episodes: { en: "/", ar: "/ar/" },
  articlesPage: { en: "/articles/", ar: "/ar/المقالات/" }, podcastsPage: { en: "/podcasts/", ar: "/ar/بودكاست/" },
};
const SHOWS: Record<string, number> = { hero: 5, articles: 3, episodes: 6 };   // Home.astro's caps
const BY_SLUG = new Set(["articles", "articlesPage"]);                       // these pin article slugs, the rest archive ids

export type ArchiveItem = { id: string; platform: string; kind: string; title: string; thumb: string; date: string; tags: string[]; series: string };
export type Article = { slug: string; lang: string; title: string; date: string };
type Row = { id: string; title: string; thumb?: string; date: string; onSite?: boolean };
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

export function WidgetPanel({ widget, pageItems, items, articles, pageLang, canEdit, t, triggerToast, tell, onBack }: {
  widget: string; pageItems: string[]; items: ArchiveItem[]; articles: Article[]; pageLang: "en" | "ar";
  canEdit: boolean; t: T; triggerToast: (m: string, k?: "success" | "error") => void; tell: (m: any) => void; onBack: () => void;
}) {
  const bySlug = BY_SLUG.has(widget);
  const resolve = (id: string): Row => bySlug
    ? (() => { const a = articles.find(x => x.slug === id && x.lang === pageLang) || articles.find(x => x.slug === id); return { id, title: a?.title || id, date: a?.date || "" }; })()
    : (() => { const i = items.find(x => x.id === id); return { id, title: i?.title || id, thumb: i?.thumb, date: i?.date || "" }; })();
  const [cfg, setCfg] = useState<{ title_en?: string; title_ar?: string; pinned?: string[]; removed?: string[] }>({});
  const [order, setOrder] = useState<string[]>(pageItems);
  const [removed, setRemoved] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/archive/home").then(r => r.json()).then(d => setCfg((d.home || {})[widget] || {})).catch(() => {}); }, [widget]);
  useEffect(() => { setOrder(pageItems); setRemoved([]); }, [pageItems.join("|")]);
  const pinnedSet = new Set(cfg.pinned || []);
  const dirty = order.join("|") !== pageItems.join("|") || removed.length > 0;

  const move = (i: number, d: -1 | 1) => setOrder(o => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const drop = (id: string) => { setOrder(o => o.filter(x => x !== id)); setRemoved(r => [...new Set([...r, id])]); };
  const add = (id: string) => { setOrder(o => o.includes(id) ? o : [...o, id]); setRemoved(r => r.filter(x => x !== id)); };
  const save = async (next: { pinned: string[]; removed: string[]; title_en?: string; title_ar?: string }) => {
    setSaving(true);
    const r = await post("/api/archive/home", { widgets: { [widget]: next } });
    setSaving(false);
    if (r.success) { setCfg((r.home || {})[widget] || next); triggerToast(`${t("Saved")} — ${t(WIDGET_LABEL[widget] || widget)}`, "success"); tell({ type: "reload" }); }
    else triggerToast(r.error || t("Not saved"), "error");
  };
  const saveOrder = () => save({ ...cfg, pinned: order, removed: [...new Set([...(cfg.removed || []).filter(x => !order.includes(x)), ...removed])] });
  const backToAuto = () => { if (window.confirm(t("Let the newest items lead again? Your order is forgotten; removals stay."))) save({ ...cfg, pinned: [], removed: cfg.removed || [] }); };

  const pool: Row[] = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (bySlug) return articles.filter(a => a.lang === pageLang && (!n || a.title.toLowerCase().includes(n))).slice(0, 40).map(a => ({ id: a.slug, title: a.title, date: a.date }));
    const wants = widget === "episodes" || widget === "podcastsPage" ? (i: ArchiveItem) => i.tags.includes("podcast") : () => true;
    return items.filter(i => wants(i) && (!n || i.title.toLowerCase().includes(n))).slice(0, 40).map(i => ({ id: i.id, title: i.title, thumb: i.thumb, date: i.date, onSite: i.tags.includes("website") }));
  }, [q, items, articles, widget, pageLang]);
  const shows = SHOWS[widget];

  return (
    <>
      <div className="flex items-center gap-1 border-b px-2 py-1.5 text-xs">
        <button onClick={onBack} className="rounded border px-1.5 py-0.5" title={t("All sections")}>☰</button>
        <span className="min-w-0 flex-1 truncate font-semibold">{t(WIDGET_LABEL[widget] || widget)}</span>
        {canEdit && <button onClick={saveOrder} disabled={!dirty || saving} className="rounded bg-red-700 px-2 py-0.5 font-bold text-white disabled:opacity-40">{saving ? t("Saving…") : dirty ? t("Save & refresh site") : t("Saved")}</button>}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2 text-xs">
        <div className="grid grid-cols-2 gap-1">
          <input value={cfg.title_en || ""} disabled={!canEdit} onChange={e => setCfg(c => ({ ...c, title_en: e.target.value }))} onBlur={() => canEdit && cfg.title_en !== undefined && save({ ...cfg, pinned: cfg.pinned || [], removed: cfg.removed || [] })} placeholder={t("Title (EN) — empty = default")} className="rounded border border-slate-300 px-2 py-1" />
          <input value={cfg.title_ar || ""} disabled={!canEdit} dir="rtl" onChange={e => setCfg(c => ({ ...c, title_ar: e.target.value }))} onBlur={() => canEdit && cfg.title_ar !== undefined && save({ ...cfg, pinned: cfg.pinned || [], removed: cfg.removed || [] })} placeholder={t("Title (AR) — empty = default")} className="rounded border border-slate-300 px-2 py-1" />
        </div>
        <p className="text-[11px] text-slate-500">{t("In the order the page shows them.")}{shows ? ` ${t("The page shows the first")} ${shows}.` : ""}</p>
        <ol className="space-y-1">
          {order.map((id, i) => { const r = resolve(id); return (
            <li key={id} className={`flex items-center gap-1.5 rounded border p-1 ${shows && i >= shows ? "border-dashed border-slate-200 opacity-60" : "border-slate-200"}`}>
              <span className="w-4 text-center text-[10px] text-slate-400">{i + 1}</span>
              {r.thumb && <img src={r.thumb} alt="" className="h-9 w-12 shrink-0 rounded object-cover" />}
              <span className="min-w-0 flex-1"><span className="line-clamp-2 leading-tight" dir="auto">{r.title}</span><span className="text-[10px] text-slate-400">{r.date}{pinnedSet.has(id) ? ` · ${t("pinned")}` : ` · ${t("automatic")}`}</span></span>
              {canEdit && <span className="flex shrink-0 flex-col text-[11px] leading-none">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 hover:text-slate-900 disabled:opacity-30" title={t("Move up")}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="px-1 hover:text-slate-900 disabled:opacity-30" title={t("Move down")}>▼</button>
              </span>}
              {canEdit && <button onClick={() => drop(id)} className="shrink-0 px-1 text-red-600" title={t("Remove from this widget")}>×</button>}
            </li>); })}
          {!order.length && <li className="p-2 text-slate-400">—</li>}
        </ol>
        {canEdit && (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setAdding(a => !a)} className={`rounded border px-2 py-1 ${adding ? "bg-slate-800 text-white" : ""}`}>+ {t("Add from the library")}</button>
            {(cfg.pinned || []).length > 0 && <button onClick={backToAuto} className="rounded border px-2 py-1">{t("Back to automatic order")}</button>}
          </div>
        )}
        {adding && canEdit && (
          <div className="rounded border border-slate-200 bg-slate-50 p-1.5">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t("Search titles…")} className="mb-1 w-full rounded border border-slate-300 px-2 py-1" />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {pool.map(r => { const on = order.includes(r.id); return (
                <button key={r.id} onClick={() => on ? drop(r.id) : add(r.id)} className={`flex w-full items-center gap-1.5 rounded border p-1 text-start ${on ? "border-red-600 bg-white" : "border-slate-200 bg-white hover:border-red-400"}`}>
                  {r.thumb && <img src={r.thumb} alt="" className="h-8 w-11 shrink-0 rounded object-cover" />}
                  <span className="min-w-0 flex-1 line-clamp-2 leading-tight" dir="auto">{r.title}</span><span className="shrink-0 text-[10px] text-slate-400">{on ? "✓" : r.onSite ? t("on the website") : r.date}</span>
                </button>); })}
              {!pool.length && <p className="p-1 text-slate-400">—</p>}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{t("Added items go to the end — move them up, then Save.")} {bySlug ? "" : t("Pinning an item puts it on the website.")}</p>
          </div>
        )}
      </div>
    </>
  );
}
