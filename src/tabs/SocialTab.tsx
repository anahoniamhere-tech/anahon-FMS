import React, { useEffect, useMemo, useState } from "react";
import { SharedProps } from "./shared";
import { SITE_EDITORS } from "../roles";

/**
 * Social desk — publish, edit and remove posts on the AnaHon Facebook Page and the
 * linked Instagram account, from the system. Nothing posts on its own: every action
 * is a deliberate click with a confirm, and it is audit-logged server-side.
 *
 * What Meta allows (v25):  Facebook publish · edit text · delete
 *                          Instagram publish (public HTTPS image) · delete — no caption edits
 */
const PUBLISH_ROLES = SITE_EDITORS;
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

export default function SocialTab({ state, currentUser, triggerToast, refreshState }: SharedProps) {
  const canPost = PUBLISH_ROLES.includes(currentUser?.role);
  const [status, setStatus] = useState<any>(null);
  const [posts, setPosts] = useState<{ fb: any[]; ig: any[]; fbError?: string; igError?: string } | null>(null);
  const [target, setTarget] = useState<"fb" | "ig">("fb");
  const [message, setMessage] = useState(""); const [link, setLink] = useState(""); const [imageUrl, setImageUrl] = useState("");
  const [unpublished, setUnpublished] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadStatus = () => fetch("/api/social/status").then(r => r.json()).then(setStatus);
  const loadPosts = () => fetch("/api/social/list").then(r => r.json()).then(d => setPosts(d.ok ? d : { fb: [], ig: [], fbError: d.error }));
  useEffect(() => { loadStatus().then(loadPosts); }, []);

  // ---- Postiz: the publishing engine behind the gate (6 Sep 2026) ----
  const [pz, setPz] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[] | null>(null);
  const [linkItem, setLinkItem] = useState(""); const [linkGroup, setLinkGroup] = useState(""); const [linking, setLinking] = useState(false);
  const loadPz = () => fetch("/api/social/postiz/status").then(r => r.json()).then(setPz).catch(() => setPz({ ok: false, error: "unreachable" }));
  const loadDrafts = () => fetch("/api/social/postiz/drafts").then(r => r.json()).then(d => setDrafts(d.ok ? d.groups : [])).catch(() => setDrafts([]));
  useEffect(() => { loadPz(); }, []);
  const items: any[] = (state as any)?.contentItems || [];
  const awaiting = useMemo(() => items.filter(i => i.postiz?.length && i.status !== "Published"), [items]);
  const linkable = useMemo(() => items.filter(i => !i.postiz?.length && ["Editorial Review", "Approved"].includes(i.status)), [items]);
  const released = useMemo(() => items.filter(i => i.postiz?.length && i.status === "Published").slice(0, 20), [items]);
  const linkDraft = async () => {
    if (!linkItem || !linkGroup) return;
    setLinking(true);
    const r = await post("/api/social/postiz/link", { id: linkItem, group: linkGroup }).catch(e => ({ error: e.message }));
    setLinking(false);
    if (r.success) { triggerToast("Draft linked — it releases when the item passes the gate"); setLinkItem(""); setLinkGroup(""); setDrafts(null); await refreshState(); }
    else triggerToast(r.error || "Link failed", "error");
  };
  const unlink = async (id: string) => {
    if (!window.confirm("Unlink this Postiz draft from the item? The draft stays in Postiz.")) return;
    const r = await post("/api/social/postiz/unlink", { id }).catch(e => ({ error: e.message }));
    if (r.success) { triggerToast("Unlinked"); await refreshState(); } else triggerToast(r.error || "Unlink failed", "error");
  };
  const STATE_PILL: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-700", QUEUE: "bg-amber-50 text-amber-800", PUBLISHED: "bg-emerald-50 text-emerald-800", ERROR: "bg-red-50 text-red-800" };
  const STATE_WORD: Record<string, string> = { DRAFT: "draft, waiting for the gate", QUEUE: "scheduled", PUBLISHED: "published", ERROR: "failed" };
  const pill = (l: any) => (
    <span key={l.postId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_PILL[l.state] || STATE_PILL.DRAFT}`} title={l.preview}>
      {l.channel} · {l.account} · {STATE_WORD[l.state] || l.state}
      {l.releaseURL && <a href={l.releaseURL} target="_blank" rel="noopener" className="underline">↗</a>}
    </span>
  );

  // published pieces with a live page — one click fills the composer
  const publishedItems = useMemo(() => ((state as any)?.contentItems || []).filter((i: any) => i.status === "Published" && !i.retractedAt && i.websiteUrl), [state]);
  const prefill = (id: string) => { const it = publishedItems.find((i: any) => i.id === id); if (!it) return; setMessage(`${it.title}\n\n${it.brief || ""}`.trim()); setLink(it.websiteUrl); setTarget("fb"); };

  const publish = async () => {
    const where = target === "fb" ? `the AnaHon Facebook Page${unpublished ? " (UNPUBLISHED — admins only)" : ""}` : "Instagram";
    if (!window.confirm(`Publish this to ${where} now?\n\n${message.slice(0, 200)}`)) return;
    setBusy(true);
    const r = await post("/api/social/publish", { target, message, link: link || undefined, imageUrl: imageUrl || undefined, unpublished: target === "fb" && unpublished }).catch(e => ({ error: e.message }));
    setBusy(false);
    if (r.ok) { triggerToast(r.unpublished ? "Posted as unpublished (admins only)" : "Published ✓"); setMessage(""); setLink(""); setImageUrl(""); loadPosts(); loadStatus(); }
    else triggerToast(r.error || "Publish failed", "error");
  };
  const edit = async (kind: "fb" | "ig", id: string, current: string) => {
    const next = window.prompt("New text for this post:", current); if (next == null || next === current) return;
    const r = await post("/api/social/edit", { target: kind, postId: id, message: next });
    if (r.ok) { triggerToast("Post updated"); loadPosts(); } else triggerToast(r.error || "Edit failed", "error");
  };
  const remove = async (kind: "fb" | "ig", id: string) => {
    if (window.prompt(`This permanently deletes the post from ${kind === "fb" ? "Facebook" : "Instagram"}.\nType DELETE to confirm:`) !== "DELETE") return;
    const r = await post("/api/social/delete", { target: kind, postId: id, confirm: "yes" });
    if (r.ok) { triggerToast("Post deleted"); loadPosts(); } else triggerToast(r.error || "Delete failed", "error");
  };

  const t = status?.token;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">📣 Social desk</h2>

      {/* Postiz — approve here, publish there, status comes back */}
      <div className={`space-y-3 rounded-lg border-s-4 bg-white p-3 text-xs ${!pz ? "border-slate-300" : pz.ok ? "border-emerald-500" : "border-amber-500"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">Postiz</b>
          {!pz ? <span className="text-slate-500">Checking…</span>
            : !pz.ok ? <span className="text-amber-700">{pz.error}</span>
            : pz.integrations.length ? pz.integrations.map((i: any) => <span key={i.id} className={`rounded-full px-2 py-0.5 font-bold ${i.disabled ? "bg-slate-100 text-slate-400 line-through" : "bg-slate-100 text-slate-700"}`}>{i.channel} · {i.name}</span>)
            : <span className="text-slate-500">no accounts connected yet</span>}
          {pz?.url && <a href={pz.url} target="_blank" rel="noopener" className="ms-auto text-red-700 underline">Open Postiz ↗</a>}
        </div>
        <p className="text-slate-500">Compose in Postiz and leave the post as a <b>draft</b>. Link it to its content item here; when the item passes the editorial gate the draft is scheduled. Nothing here publishes on its own.</p>

        {pz?.ok && pz.outside?.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
            <b>Published outside the gate</b> — Postiz posted these with no content item behind them:
            <ul className="mt-1 list-disc ps-5">
              {pz.outside.map((o: any) => <li key={o.id}>{o.channel} · {o.account} · <span dir="ltr">{o.publishDate.slice(0, 10)}</span> — <span dir="auto">{o.preview}</span> {o.releaseURL && <a href={o.releaseURL} target="_blank" rel="noopener" className="underline">↗</a>}</li>)}
            </ul>
          </div>
        )}

        {awaiting.length > 0 && (
          <div>
            <b>Waiting for the gate</b>
            <ul className="mt-1 space-y-1">
              {awaiting.map(i => <li key={i.id} className="flex flex-wrap items-center gap-1"><span className="me-1 font-bold" dir="auto">{i.title}</span><span className="text-slate-500">({i.status})</span> {i.postiz.map(pill)}{canPost && <button onClick={() => unlink(i.id)} className="ms-2 text-red-700 underline">unlink</button>}</li>)}
            </ul>
          </div>
        )}

        {canPost && pz?.ok && linkable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={linkItem} onChange={e => { setLinkItem(e.target.value); if (drafts == null) loadDrafts(); }} className="rounded border border-slate-300 px-2 py-1">
              <option value="">link a draft to an item…</option>
              {linkable.map(i => <option key={i.id} value={i.id}>{i.title.slice(0, 60)} ({i.status})</option>)}
            </select>
            {linkItem && (drafts == null ? <span className="text-slate-500">loading drafts…</span> : drafts.length === 0 ? <span className="text-slate-500">no unlinked drafts in Postiz</span> : (
              <select value={linkGroup} onChange={e => setLinkGroup(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
                <option value="">which draft?</option>
                {drafts.map(g => <option key={g.group} value={g.group}>{g.publishDate.slice(0, 16).replace("T", " ")} · {g.accounts.map((a: any) => a.channel).join("+")} · {g.preview.slice(0, 50)}</option>)}
              </select>
            ))}
            {linkGroup && <button onClick={linkDraft} disabled={linking} className="rounded bg-red-700 px-3 py-1 font-bold text-white disabled:opacity-40">{linking ? "Linking…" : "Link"}</button>}
          </div>
        )}

        {released.length > 0 && (
          <div>
            <b>Released through the gate</b>
            <ul className="mt-1 space-y-1">
              {released.map(i => <li key={i.id} className="flex flex-wrap items-center gap-1"><span className="me-1 font-bold" dir="auto">{i.title}</span> {i.postiz.map(pill)}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* connection */}
      <div className={`rounded-lg border-s-4 bg-white p-3 text-xs ${!status ? "border-slate-300" : status.ok ? (t?.canPublishFB && t?.canPublishIG ? "border-emerald-500" : "border-amber-500") : "border-red-500"}`}>
        {!status ? "Checking the connection…" : !status.ok ? (
          <>Not connected: {status.error}<br /><span className="text-slate-500">On the Mac: <code>node scripts/meta-token.mjs &lt;explorer-token&gt;</code> → copy META_PAGE_TOKEN + META_PAGE_ID into the NAS <code>.env</code> → restart the FMS.</span></>
        ) : (
          <>
            <b>{status.page?.name}</b>{status.page?.followers ? ` · ${status.page.followers.toLocaleString()} followers` : ""} &nbsp;·&nbsp;
            {status.instagram ? <><b>@{status.instagram.username}</b> · {(status.instagram.followers_count ?? 0).toLocaleString()} followers</> : "no Instagram linked"} &nbsp;·&nbsp;
            token expires: <b>{t.expires === "never" ? "never" : t.expires.slice(0, 10)}</b>
            {status.igQuotaUsed != null && <> &nbsp;·&nbsp; Instagram {status.igQuotaUsed}/100 posts today</>}
            {!t.canPublishFB && <div className="text-amber-700">⚠ token lacks <code>pages_manage_posts</code> — Facebook publishing is off</div>}
            {!t.canPublishIG && <div className="text-amber-700">⚠ token lacks <code>instagram_content_publish</code> — Instagram publishing is off</div>}
          </>
        )}
      </div>

      {/* composer */}
      {canPost && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-slate-100 p-0.5 font-bold">
              {(["fb", "ig"] as const).map(k => <button key={k} onClick={() => setTarget(k)} className={`rounded-full px-3 py-1 ${target === k ? "bg-slate-900 text-white" : "text-slate-600"}`}>{k === "fb" ? "Facebook Page" : "Instagram"}</button>)}
            </div>
            {publishedItems.length > 0 && (
              <select onChange={e => { prefill(e.target.value); e.target.value = ""; }} className="rounded border border-slate-300 px-2 py-1">
                <option value="">fill from a published piece…</option>
                {publishedItems.map((i: any) => <option key={i.id} value={i.id}>{i.title.slice(0, 70)}</option>)}
              </select>
            )}
          </div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} dir="auto" placeholder="What are you posting?" className="w-full rounded border border-slate-300 p-2" />
          {target === "fb" ? (<>
            <input value={link} onChange={e => setLink(e.target.value)} dir="ltr" placeholder="Link (optional) — https://anahon.org/…" className="w-full rounded border border-slate-300 px-2 py-1" />
            <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={unpublished} onChange={e => setUnpublished(e.target.checked)} /> Post as <b>unpublished</b> — visible to page admins only (the safe way to test)</label>
          </>) : (<>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} dir="ltr" placeholder="Image URL — must be public HTTPS" className="w-full rounded border border-slate-300 px-2 py-1" />
            <p className="text-slate-500">Instagram will not accept a local file: Meta downloads the image itself, so it has to be reachable on the open internet.</p>
          </>)}
          <div className="flex justify-end"><button onClick={publish} disabled={busy || !status?.ok} className="rounded bg-red-700 px-4 py-1.5 font-bold text-white disabled:opacity-40">{busy ? "Publishing…" : "Publish"}</button></div>
        </div>
      )}

      {/* recent posts */}
      <div className="space-y-2">
        <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-slate-900">Recent posts</h3><button onClick={loadPosts} className="text-xs text-red-700 underline">refresh</button></div>
        {!posts ? <p className="text-xs text-slate-500">Load the connection first.</p> : (
          <div className="space-y-2">
            {posts.fbError && <p className="text-xs text-amber-700">Facebook: {posts.fbError}</p>}
            {posts.igError && <p className="text-xs text-amber-700">Instagram: {posts.igError}</p>}
            {[...posts.fb.map(p => ({ ...p, kind: "fb" as const })), ...posts.ig.map(p => ({ ...p, kind: "ig" as const }))].map(p => {
              const text = (p.kind === "fb" ? p.message : p.caption) || "(no caption)";
              const img = p.kind === "fb" ? p.full_picture : (p.thumbnail_url || p.media_url);
              return (
                <div key={p.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  {img ? <img src={img} alt="" className="h-20 w-28 flex-none rounded object-cover" loading="lazy" /> : <div className="h-20 w-28 flex-none rounded bg-slate-100" />}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p><span className={`rounded px-1.5 py-0.5 font-bold ${p.kind === "fb" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>{p.kind === "fb" ? "Facebook" : "Instagram"}</span> <span className="text-slate-500">{(p.created_time || p.timestamp || "").slice(0, 10)}</span>{p.kind === "fb" && p.is_published === false && <span className="ms-1 text-amber-700">· unpublished</span>}</p>
                    <p className="line-clamp-3" dir="auto">{text}</p>
                    <div className="flex gap-3">
                      {canPost && p.kind === "fb" && <button onClick={() => edit("fb", p.id, p.message || "")} className="text-red-700 underline">edit text</button>}
                      {p.kind === "ig" && <span className="text-slate-400" title="Meta has never exposed caption editing">captions not editable</span>}
                      {canPost && <button onClick={() => remove(p.kind, p.id)} className="text-red-700 underline">delete</button>}
                      <a href={p.permalink_url || p.permalink} target="_blank" rel="noopener" className="ms-auto text-slate-500 underline">open ↗</a>
                    </div>
                  </div>
                </div>
              );
            })}
            {!posts.fb.length && !posts.ig.length && !posts.fbError && !posts.igError && <p className="text-xs text-slate-500">No posts returned.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
