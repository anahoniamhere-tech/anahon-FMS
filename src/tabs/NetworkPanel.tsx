import React, { useEffect, useState } from "react";
import InsightsPanel from "./InsightsPanel";
import StoredSeries from "./StoredSeries";

/**
 * What is already on the accounts, and what it did — the last part of the old Social desk that is
 * not about a single piece (12 Sep 2026). It is parked here, collapsed, because the **Insights**
 * door that should hold it belongs to the Social platform room and is not built yet; when it is,
 * this component moves there whole and the Newsroom loses nothing but a fold.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

export default function NetworkPanel({ accounts, role, canPost, triggerToast, t }: {
  accounts: any[]; role?: string; canPost: boolean; triggerToast: (m: string, k?: string) => void; t: (s: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [listAccount, setListAccount] = useState(""); const [posts, setPosts] = useState<any>(null);
  const [view, setView] = useState<"posts" | "insights">("posts");
  const loadPosts = (id: string) => fetch(`/api/social/list?accountId=${encodeURIComponent(id)}`).then(r => r.json()).then(setPosts).catch(() => setPosts({ fb: [], ig: [] }));
  useEffect(() => { if (!listAccount && accounts.length) setListAccount(accounts[0].id); }, [accounts.length]);
  useEffect(() => { if (open && listAccount && view === "posts") loadPosts(listAccount); }, [open, listAccount, view]);

  const edit = async (id: string, current: string) => {
    const next = window.prompt("New text for this post:", current); if (next == null || next === current) return;
    const r = await post("/api/social/edit", { accountId: listAccount, target: "fb", postId: id, message: next });
    if (r.ok) { triggerToast("Post updated"); loadPosts(listAccount); } else triggerToast(r.error || "Edit failed", "error");
  };
  const remove = async (kind: "fb" | "ig", id: string) => {
    if (window.prompt(`This permanently deletes the post from ${kind === "fb" ? "Facebook" : "Instagram"}.\nType DELETE to confirm:`) !== "DELETE") return;
    const r = await post("/api/social/delete", { accountId: listAccount, target: kind, postId: id, confirm: "yes" });
    if (r.ok) { triggerToast("Post deleted"); loadPosts(listAccount); } else triggerToast(r.error || "Delete failed", "error");
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 text-sm font-bold text-slate-800 uppercase font-mono">
        <span>{open ? "▾" : "▸"}</span>{t("On the accounts")}
        <span className="ms-auto text-[10px] font-normal normal-case text-slate-400">{t("what is already out, and the long record")}</span>
      </button>

      {open && (
        <div className="space-y-3">
          {accounts.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
                  {(["posts", "insights"] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 ${view === v ? "bg-slate-900 text-white" : "text-slate-600"}`}>{v === "posts" ? t("On the network") : t("Figures")}</button>
                  ))}
                </div>
                <select value={listAccount} onChange={e => setListAccount(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </div>
              {view === "insights" ? <InsightsPanel accountId={listAccount} accountName={accounts.find(a => a.id === listAccount)?.name || ""} /> : !posts ? <p className="text-xs text-slate-500">Loading…</p> : (
                <div className="space-y-2">
                  {posts.fbError && <p className="text-xs text-amber-700">Facebook: {posts.fbError}</p>}
                  {posts.igError && <p className="text-xs text-amber-700">Instagram: {posts.igError}</p>}
                  {[...(posts.fb || []).map((p: any) => ({ ...p, kind: "fb" as const })), ...(posts.ig || []).map((p: any) => ({ ...p, kind: "ig" as const }))].map((p: any) => {
                    const text = (p.kind === "fb" ? p.message : p.caption) || "(no caption)";
                    const img = p.kind === "fb" ? p.full_picture : (p.thumbnail_url || p.media_url);
                    const likes = p.kind === "fb" ? p.likes?.summary?.total_count : p.like_count; const comments = p.kind === "fb" ? p.comments?.summary?.total_count : p.comments_count;
                    return (
                      <div key={p.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                        {img ? <img src={img} alt="" className="h-20 w-28 flex-none rounded object-cover" loading="lazy" /> : <div className="h-20 w-28 flex-none rounded bg-slate-100" />}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p><span className={`rounded px-1.5 py-0.5 font-bold ${p.kind === "fb" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>{p.kind === "fb" ? "Facebook" : "Instagram"}</span> <span className="text-slate-500" dir="ltr">{(p.created_time || p.timestamp || "").slice(0, 10)}</span>{p.kind === "fb" && p.is_published === false && <span className="ms-1 text-amber-700">· unpublished</span>}{p.kind === "ig" && p.media_type && <span className="ms-1 text-slate-400">· {String(p.media_type).toLowerCase()}</span>}{likes != null && <span className="ms-2 text-slate-500" dir="ltr">♥ {likes} · 💬 {comments ?? 0}</span>}</p>
                          <p className="line-clamp-3" dir="auto">{text}</p>
                          <div className="flex gap-3">
                            {canPost && p.kind === "fb" && <button onClick={() => edit(p.id, p.message || "")} className="text-red-700 underline">edit text</button>}
                            {p.kind === "ig" && <span className="text-slate-400" title="Meta has never exposed caption editing">captions not editable</span>}
                            {canPost && <button onClick={() => remove(p.kind, p.id)} className="text-red-700 underline">delete</button>}
                            <a href={p.permalink_url || p.permalink} target="_blank" rel="noopener" className="ms-auto text-slate-500 underline">open ↗</a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!(posts.fb || []).length && !(posts.ig || []).length && !posts.fbError && !posts.igError && <p className="text-xs text-slate-500">No posts returned.</p>}
                </div>
              )}
            </>
          )}
          {/* Outside the block above on purpose: YouTube and TikTok have no connected Page, and the
              lifetime figures must show even with nothing connected at all. */}
          <StoredSeries role={role} triggerToast={triggerToast} />
        </div>
      )}
    </div>
  );
}
