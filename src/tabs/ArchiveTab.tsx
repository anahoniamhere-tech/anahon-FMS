import React, { useEffect, useMemo, useState } from "react";
import { ic } from "../nav";
import { Archive as ArchiveIcon } from "lucide-react";
import { SharedProps } from "./shared";
import Info from "../Info";
import { ARCHIVE_EDITORS, SITE_EDITORS } from "../roles";

/**
 * Archive — the whole media archive, curated here; the website takes only what is chosen.
 *
 * Opt-in model (decision 6 Sep 2026, replacing the opt-out of 3 Sep): an item is on the
 * public site only when it carries the `website` tag — the switch on each card here, or
 * automatically when it is pinned into a widget from the Live editor. `hidden` still means
 * never. Tags and captions are human overrides that survive every rebuild. The tag schema
 * is curated here too; the website's widgets moved to the Live editor's panel.
 * "Publish to website" rebuilds the whole library.
 */
type Item = { id: string; platform: string; kind: string; title: string; thumb: string; date: string; tags: string[]; series: string; url: string; duration: number | null };
type Schema = { formats?: string[]; topics_extra?: string[]; topics_icontent?: string[]; suppressed?: string[]; order?: string[]; facets?: Record<string, string> };

const PAGE = 60;
const EDIT_ROLES = ARCHIVE_EDITORS;
const PUBLISH_ROLES = SITE_EDITORS;
const LANES = ["format", "genre", "series", "topic", "place", "person"] as const;
const ONSITE = "website"; // the opt-in switch: only items carrying it appear on the public site

const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

export default function ArchiveTab({ currentUser, triggerToast, lang }: SharedProps) {
  const [view, setView] = useState<"items" | "schema">("items");
  const [collection, setCollection] = useState<"anahon" | "icontent">("anahon");
  const [items, setItems] = useState<Item[]>([]);
  const [schema, setSchema] = useState<Schema>({});
  const [loading, setLoading] = useState(false);
  const canEdit = EDIT_ROLES.includes(currentUser?.role);
  const canPublish = PUBLISH_ROLES.includes(currentUser?.role);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([fetch(`/api/archive/items?collection=${collection}`).then(r => r.json()), fetch("/api/archive/schema").then(r => r.json())]);
      setItems(a.items || []); setSchema(s || {});
    } catch (e: any) { triggerToast(`Archive failed to load: ${e.message}`, "error"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [collection]);

  const facetOf = (t: string) => (schema.facets || {})[t] || "topic";
  const knownTags = useMemo(() => {
    const t = new Set<string>(Object.keys(schema.facets || {}));
    for (const i of items) for (const x of i.tags) t.add(x);
    return [...t].filter(x => x !== ONSITE && x !== "hidden").sort();
  }, [schema, items]);

  // ---------------------------------------------------------------- publish
  const [publishing, setPublishing] = useState(false);
  const [lastPublish, setLastPublish] = useState("");
  const publish = async () => {
    setPublishing(true);
    const r = await post("/api/archive/publish", {}).catch(e => ({ error: e.message }));
    setPublishing(false);
    if (r.success) { setLastPublish(`${new Date().toLocaleTimeString()} — ${(r.log || "").split("\n").filter((l: string) => /->|articles/.test(l)).join(" · ")}`); triggerToast("Website updated"); load(); }
    else triggerToast(r.error || "Publish failed", "error");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900"><span className="inline-flex items-center gap-1.5">{ic(ArchiveIcon, "h-5 w-5")}Archive</span></h2>
        <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
          {(["items", "schema"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 ${view === v ? "bg-slate-900 text-white" : "text-slate-600"}`}>{v === "items" ? "Items" : "Tag schema"}</button>
          ))}
        </div>
        {(
          <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
            {(["anahon", "icontent"] as const).map(c => (
              <button key={c} onClick={() => setCollection(c)} className={`rounded-full px-3 py-1 ${collection === c ? "bg-red-700 text-white" : "text-slate-600"}`}>{c === "anahon" ? "AnaHon" : "iContent"}</button>
            ))}
          </div>
        )}
        {canPublish && (
          <><button onClick={publish} disabled={publishing} className="ms-auto rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
            {publishing ? "Publishing…" : "⬆ Publish to website"}
          </button><Info id="archive-rebuild" lang={lang} /></>
        )}
      </div>
      {lastPublish && <p className="text-xs text-emerald-700">Last publish {lastPublish}</p>}
      {loading ? <p className="text-sm text-slate-500">Loading the archive…</p>
        : view === "items" ? <ItemsView items={items} setItems={setItems} collection={collection} facetOf={facetOf} knownTags={knownTags} canEdit={canEdit} triggerToast={triggerToast} /> : <SchemaView schema={schema} setSchema={setSchema} items={items} collection={collection} canEdit={canPublish} triggerToast={triggerToast} />}
      <datalist id="archive-tags">{knownTags.map(t => <option key={t} value={t} />)}</datalist>
    </div>
  );
}

// ====================================================================== items
function ItemsView({ items, setItems, collection, facetOf, knownTags, canEdit, triggerToast }: any) {
  const [q, setQ] = useState(""); const [tag, setTag] = useState(""); const [platform, setPlatform] = useState("");
  const [show, setShow] = useState<"published" | "unpublished" | "all">("published");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<string[]>([]); const [draftTitle, setDraftTitle] = useState(""); const [newTag, setNewTag] = useState("");
  const platforms = useMemo(() => [...new Set(items.map((i: Item) => i.platform))].sort(), [items]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i: Item) => {
      const on = i.tags.includes(ONSITE);
      if (show === "published" && !on) return false;
      if (show === "unpublished" && on) return false;
      if (platform && i.platform !== platform) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (needle && !(`${i.title} ${i.id} ${i.series}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [items, q, tag, platform, show]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const onSiteCount = items.filter((i: Item) => i.tags.includes(ONSITE)).length;

  const save = async (i: Item, tags: string[], title: string) => {
    const r = await post("/api/archive/item", { id: i.id, tags, title: title !== i.title ? title : undefined, collection });
    if (!r.success) { triggerToast(r.error || "Save failed", "error"); return false; }
    setItems((prev: Item[]) => prev.map(x => x.id === i.id ? { ...x, tags: r.tags, title: r.title || x.title } : x));
    return true;
  };
  const togglePublished = async (i: Item) => {
    const on = i.tags.includes(ONSITE);
    if (await save(i, on ? i.tags.filter(t => t !== ONSITE) : [...i.tags, ONSITE], i.title)) triggerToast(on ? "Taken off the website" : "On the website");
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="self-center text-slate-500">{items.length.toLocaleString()} items · {onSiteCount} on the website</span>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search title / id…" className="w-64 rounded border border-slate-300 px-2 py-1" dir="auto" />
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(0); }} className="rounded border border-slate-300 px-2 py-1"><option value="">all platforms</option>{platforms.map((p: string) => <option key={p} value={p}>{p}</option>)}</select>
        <select value={tag} onChange={e => { setTag(e.target.value); setPage(0); }} className="rounded border border-slate-300 px-2 py-1"><option value="">all tags</option>{knownTags.map((t: string) => <option key={t} value={t}>{t} · {facetOf(t)}</option>)}</select>
        <div className="flex rounded-full bg-slate-100 p-0.5 font-bold">
          {(["published", "unpublished", "all"] as const).map(s => <button key={s} onClick={() => { setShow(s); setPage(0); }} className={`rounded-full px-3 py-1 ${show === s ? "bg-slate-900 text-white" : "text-slate-600"}`}>{s === "published" ? "on the website" : s === "unpublished" ? "not on the website" : "all"}</button>)}
        </div>
        <span className="self-center text-slate-500">{filtered.length.toLocaleString()} shown · page {page + 1}/{pages}</span>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">‹</button>
        <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">›</button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((i: Item) => {
          const on = i.tags.includes(ONSITE); const isEditing = editing === i.id;
          return (
            <div key={i.id} className={`flex gap-3 rounded-lg border p-2 text-xs ${on ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
              {i.thumb ? <img src={i.thumb} alt="" className="h-20 w-28 flex-none rounded object-cover" loading="lazy" /> : <div className="h-20 w-28 flex-none rounded bg-slate-100" />}
              <div className="min-w-0 flex-1 space-y-1">
                {isEditing ? <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} dir="auto" className="w-full rounded border border-slate-300 px-1 py-0.5 font-bold" />
                  : <p className="truncate font-bold text-slate-900" dir="auto" title={i.title}>{i.title}</p>}
                <p className="text-slate-500">{i.platform} · {i.kind} · {i.date}{i.series ? ` · ${i.series}` : ""} {on && <span className="font-bold text-emerald-700">· on the website</span>}</p>
                <div className="flex flex-wrap gap-1">
                  {(isEditing ? draftTags : i.tags).filter(t => t !== ONSITE).map(t => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5" title={facetOf(t)}>{t}{isEditing && <button onClick={() => setDraftTags(d => d.filter(x => x !== t))} className="ms-1 text-red-600">×</button>}</span>
                  ))}
                  {isEditing && <input list="archive-tags" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="+ tag"
                    onKeyDown={e => { if (e.key === "Enter" && newTag.trim()) { setDraftTags(d => [...new Set([...d, newTag.trim().toLowerCase().replace(/\s+/g, "-")])]); setNewTag(""); } }}
                    className="w-28 rounded border border-slate-300 px-1 py-0.5" />}
                </div>
                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    {isEditing ? (<>
                      <button onClick={async () => { if (await save(i, on ? [...new Set([...draftTags, ONSITE])] : draftTags.filter(t => t !== ONSITE), draftTitle)) { setEditing(null); triggerToast("Saved"); } }} className="rounded bg-slate-900 px-2 py-0.5 text-white">Save</button>
                      <button onClick={() => setEditing(null)} className="rounded border px-2 py-0.5">Cancel</button>
                    </>) : (<>
                      <button onClick={() => { setEditing(i.id); setDraftTags(i.tags); setDraftTitle(i.title); setNewTag(""); }} className="rounded border px-2 py-0.5">✎ Edit</button>
                      <button onClick={() => togglePublished(i)} className={`rounded border px-2 py-0.5 ${on ? "text-amber-700" : "text-emerald-700"}`}>{on ? "Take off the website" : "Put on the website"}</button>
                      <a href={i.url} target="_blank" rel="noopener" className="ms-auto text-slate-500 underline">original ↗</a>
                    </>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ===================================================================== schema
function SchemaView({ schema, setSchema, items, collection, canEdit, triggerToast }: any) {
  // lanes = the facet map laid out as rows; "removed" = suppressed tags
  const [facets, setFacets] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [newTag, setNewTag] = useState(""); const [newLane, setNewLane] = useState<string>("topic");
  useEffect(() => {
    const f: Record<string, string> = { ...(schema.facets || {}) };
    for (const t of (schema.order || [])) if (!f[t]) f[t] = "topic";
    for (const i of items as Item[]) for (const t of i.tags) if (t !== ONSITE && t !== "hidden" && !f[t]) f[t] = "topic";
    for (const t of (schema.suppressed || [])) delete f[t];
    setFacets(f); setRemoved(schema.suppressed || []);
  }, [schema, items]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const i of items as Item[]) for (const t of i.tags) c[t] = (c[t] || 0) + 1; return c; }, [items]);
  const inLane = (lane: string) => Object.entries(facets).filter(([, f]) => f === lane).map(([t]) => t).sort();
  const move = (t: string, lane: string) => { if (lane === "removed") { setFacets(f => { const n = { ...f }; delete n[t]; return n; }); setRemoved(r => [...new Set([...r, t])]); } else { setRemoved(r => r.filter(x => x !== t)); setFacets(f => ({ ...f, [t]: lane })); } };
  const save = async () => {
    const order = LANES.flatMap(l => inLane(l));
    const r = await post("/api/archive/schema", { facets, order, suppressed: removed, collection });
    if (r.success) { setSchema(r.schema); triggerToast(`Schema saved — site refreshed (${r.refreshed?.invalidated ?? 0} modules)`); } else triggerToast(r.error || "Save failed", "error");
  };
  const Lane = ({ lane, label, tags }: { lane: string; label: string; tags: string[] }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label} <span className="font-normal">· {tags.length}</span></p>
      <div className="flex flex-wrap gap-1">
        {tags.map(t => (
          <span key={t} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${lane === "removed" ? "bg-red-50 text-red-700 line-through" : "bg-slate-100"}`} title={`${counts[t] || 0} items`}>
            {t}<small className="text-slate-400">{counts[t] || 0}</small>
            {canEdit && <select value={lane} onChange={e => move(t, e.target.value)} className="ms-1 rounded border border-slate-200 bg-white text-[10px]">
              {[...LANES, "removed"].map(l => <option key={l} value={l}>{l}</option>)}</select>}
          </span>
        ))}
        {!tags.length && <span className="text-xs text-slate-400">—</span>}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Each tag lives in one row of the website's library filters. Change a tag's row here to re-file it everywhere; <b>removed</b> tags disappear from the site's filters (the items keep them). Saving refreshes the site at once.</p>
      {LANES.map(l => <Lane key={l} lane={l} label={l} tags={inLane(l)} />)}
      <Lane lane="removed" label="removed from the site's filters" tags={removed} />
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="new tag" className="rounded border border-slate-300 px-2 py-1" />
          <select value={newLane} onChange={e => setNewLane(e.target.value)} className="rounded border border-slate-300 px-2 py-1">{LANES.map(l => <option key={l} value={l}>{l}</option>)}</select>
          <button onClick={() => { const t = newTag.trim().toLowerCase().replace(/\s+/g, "-"); if (t) { move(t, newLane); setNewTag(""); } }} className="rounded border px-2 py-1">+ Add</button>
          <button onClick={save} className="ms-auto rounded bg-slate-900 px-4 py-1.5 font-bold text-white">Save schema</button>
        </div>
      )}
    </div>
  );
}
