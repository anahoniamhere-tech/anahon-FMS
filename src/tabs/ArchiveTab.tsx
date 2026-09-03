import React, { useEffect, useMemo, useState } from "react";
import { SharedProps } from "./shared";

/**
 * Archive — the whole media archive, curated here and published to the website.
 *
 * Opt-out model (decision 3 Sep 2026): every item is on the site unless it carries the
 * `hidden` tag. Tags and captions are human overrides that survive every rebuild.
 * "Publish to website" rebuilds the library on the NAS and tells the site to re-read.
 */
type Item = { id: string; platform: string; kind: string; title: string; thumb: string; date: string; tags: string[]; series: string; url: string; duration: number | null };

const PAGE = 60;
const EDIT_ROLES = ["Production Manager", "Program Director", "Super Admin", "Project Officer"];
const PUBLISH_ROLES = ["Production Manager", "Program Director", "Super Admin"];

export default function ArchiveTab({ currentUser, triggerToast }: SharedProps) {
  const [collection, setCollection] = useState<"anahon" | "icontent">("anahon");
  const [items, setItems] = useState<Item[]>([]);
  const [schema, setSchema] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [platform, setPlatform] = useState("");
  const [show, setShow] = useState<"published" | "hidden" | "all">("published");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [lastPublish, setLastPublish] = useState<string>("");

  const canEdit = EDIT_ROLES.includes(currentUser?.role);
  const canPublish = PUBLISH_ROLES.includes(currentUser?.role);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        fetch(`/api/archive/items?collection=${collection}`).then(r => r.json()),
        fetch("/api/archive/schema").then(r => r.json())
      ]);
      setItems(a.items || []); setSchema(s || {});
    } catch (e: any) { triggerToast(`Archive failed to load: ${e.message}`, "error"); }
    setLoading(false);
  };
  useEffect(() => { load(); setPage(0); setEditing(null); }, [collection]);

  const knownTags = useMemo(() => {
    const t = new Set<string>(Object.keys(schema.facets || {}));
    for (const i of items) for (const x of i.tags) t.add(x);
    return [...t].filter(x => x !== "hidden").sort();
  }, [schema, items]);
  const facetOf = (t: string) => (schema.facets || {})[t] || "topic";
  const platforms = useMemo(() => [...new Set(items.map(i => i.platform))].sort(), [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(i => {
      const hidden = i.tags.includes("hidden");
      if (show === "published" && hidden) return false;
      if (show === "hidden" && !hidden) return false;
      if (platform && i.platform !== platform) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (needle && !(`${i.title} ${i.id} ${i.series}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [items, q, tag, platform, show]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const hiddenCount = items.filter(i => i.tags.includes("hidden")).length;

  const startEdit = (i: Item) => { setEditing(i.id); setDraftTags(i.tags); setDraftTitle(i.title); setNewTag(""); };
  const save = async (i: Item, tags: string[], title: string) => {
    const r = await fetch("/api/archive/item", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: i.id, tags, title: title !== i.title ? title : undefined, collection }) }).then(x => x.json());
    if (!r.success) { triggerToast(r.error || "Save failed", "error"); return false; }
    setItems(prev => prev.map(x => x.id === i.id ? { ...x, tags: r.tags, title: r.title || x.title } : x));
    return true;
  };
  const togglePublished = async (i: Item) => {
    const hidden = i.tags.includes("hidden");
    const tags = hidden ? i.tags.filter(t => t !== "hidden") : [...i.tags, "hidden"];
    if (await save(i, tags, i.title)) triggerToast(hidden ? "Published on the next website update" : "Unpublished on the next website update");
  };
  const publish = async () => {
    setPublishing(true);
    const r = await fetch("/api/archive/publish", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then(x => x.json()).catch(e => ({ error: e.message }));
    setPublishing(false);
    if (r.success) { setLastPublish(`${new Date().toLocaleTimeString()} — ${(r.log || "").split("\n").filter((l: string) => /->|articles/.test(l)).join(" · ")}`); triggerToast("Website updated"); load(); }
    else triggerToast(r.error || "Publish failed", "error");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900">🗂 Archive</h2>
        <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
          {(["anahon", "icontent"] as const).map(c => (
            <button key={c} onClick={() => setCollection(c)} className={`rounded-full px-3 py-1 ${collection === c ? "bg-slate-900 text-white" : "text-slate-600"}`}>{c === "anahon" ? "AnaHon" : "iContent"}</button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{items.length.toLocaleString()} items · {hiddenCount} unpublished</span>
        {canPublish && (
          <button onClick={publish} disabled={publishing} className="ml-auto rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
            {publishing ? "Publishing…" : "⬆ Publish to website"}
          </button>
        )}
      </div>
      {lastPublish && <p className="text-xs text-emerald-700">Last publish {lastPublish}</p>}

      <div className="flex flex-wrap gap-2 text-xs">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search title / id…" className="w-64 rounded border border-slate-300 px-2 py-1" dir="auto" />
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(0); }} className="rounded border border-slate-300 px-2 py-1">
          <option value="">all platforms</option>{platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={tag} onChange={e => { setTag(e.target.value); setPage(0); }} className="rounded border border-slate-300 px-2 py-1">
          <option value="">all tags</option>{knownTags.map(t => <option key={t} value={t}>{t} · {facetOf(t)}</option>)}
        </select>
        <div className="flex rounded-full bg-slate-100 p-0.5 font-bold">
          {(["published", "hidden", "all"] as const).map(s => (
            <button key={s} onClick={() => { setShow(s); setPage(0); }} className={`rounded-full px-3 py-1 ${show === s ? "bg-slate-900 text-white" : "text-slate-600"}`}>{s === "hidden" ? "unpublished" : s}</button>
          ))}
        </div>
        <span className="self-center text-slate-500">{filtered.length.toLocaleString()} shown · page {page + 1}/{pages}</span>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">‹</button>
        <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">›</button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading the archive…</p> : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(i => {
            const hidden = i.tags.includes("hidden");
            const isEditing = editing === i.id;
            return (
              <div key={i.id} className={`flex gap-3 rounded-lg border p-2 text-xs ${hidden ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
                {i.thumb ? <img src={i.thumb} alt="" className="h-20 w-28 flex-none rounded object-cover" loading="lazy" /> : <div className="h-20 w-28 flex-none rounded bg-slate-100" />}
                <div className="min-w-0 flex-1 space-y-1">
                  {isEditing
                    ? <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} dir="auto" className="w-full rounded border border-slate-300 px-1 py-0.5 font-bold" />
                    : <p className="truncate font-bold text-slate-900" dir="auto" title={i.title}>{i.title}</p>}
                  <p className="text-slate-500">{i.platform} · {i.kind} · {i.date}{i.series ? ` · ${i.series}` : ""} {hidden && <span className="font-bold text-amber-700">· unpublished</span>}</p>
                  <div className="flex flex-wrap gap-1">
                    {(isEditing ? draftTags : i.tags).filter(t => t !== "hidden").map(t => (
                      <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5" title={facetOf(t)}>{t}{isEditing && <button onClick={() => setDraftTags(d => d.filter(x => x !== t))} className="ml-1 text-red-600">×</button>}</span>
                    ))}
                    {isEditing && (
                      <span className="flex gap-1">
                        <input list="archive-tags" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="+ tag"
                          onKeyDown={e => { if (e.key === "Enter" && newTag.trim()) { setDraftTags(d => [...new Set([...d, newTag.trim().toLowerCase().replace(/\s+/g, "-")])]); setNewTag(""); } }}
                          className="w-28 rounded border border-slate-300 px-1 py-0.5" />
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 pt-1">
                      {isEditing ? (<>
                        <button onClick={async () => { if (await save(i, hidden ? [...draftTags, "hidden"] : draftTags, draftTitle)) { setEditing(null); triggerToast("Saved — on the site after the next publish"); } }} className="rounded bg-slate-900 px-2 py-0.5 text-white">Save</button>
                        <button onClick={() => setEditing(null)} className="rounded border px-2 py-0.5">Cancel</button>
                      </>) : (<>
                        <button onClick={() => startEdit(i)} className="rounded border px-2 py-0.5">✎ Edit</button>
                        <button onClick={() => togglePublished(i)} className={`rounded border px-2 py-0.5 ${hidden ? "text-emerald-700" : "text-amber-700"}`}>{hidden ? "Publish" : "Unpublish"}</button>
                        <a href={i.url} target="_blank" rel="noopener" className="ml-auto text-slate-500 underline">original ↗</a>
                      </>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <datalist id="archive-tags">{knownTags.map(t => <option key={t} value={t} />)}</datalist>
    </div>
  );
}
