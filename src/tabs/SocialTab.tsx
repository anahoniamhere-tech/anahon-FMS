import React, { useEffect, useMemo, useState } from "react";
import { SharedProps } from "./shared";
import { SITE_EDITORS } from "../roles";

/**
 * Social desk — the system publishes to the AnaHon Facebook Pages and their Instagram accounts
 * itself (rebuilt 6 Sep 2026). Pages are connected through Meta's own login; posts go into a
 * queue the server drains every minute. A post tied to a content item that has not passed the
 * editorial gate waits as a draft and is released when the item is published. Nothing here posts
 * on its own; every action is a click with a confirm, audit-logged server-side.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
const NET = (n: string) => n === "instagram" ? "Instagram" : "Facebook";
const STATE_PILL: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700", Queued: "bg-amber-50 text-amber-800", Publishing: "bg-amber-50 text-amber-800",
  Published: "bg-emerald-50 text-emerald-800", Failed: "bg-red-50 text-red-800", Cancelled: "bg-slate-100 text-slate-500 line-through"
};
const STATE_WORD: Record<string, string> = { Draft: "waiting for the gate", Queued: "scheduled", Publishing: "publishing…", Published: "published", Failed: "failed", Cancelled: "cancelled" };
const fmtWhen = (iso: string) => iso ? iso.slice(0, 16).replace("T", " ") : "";
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function SocialTab({ state, currentUser, triggerToast }: SharedProps) {
  const canPost = SITE_EDITORS.includes(currentUser?.role);
  const [status, setStatus] = useState<any>(null);
  const [queue, setQueue] = useState<{ rows: any[]; items: Record<string, any> } | null>(null);
  const [withIg, setWithIg] = useState(false);
  const loadStatus = () => fetch("/api/social/status").then(r => r.json()).then(setStatus).catch(() => setStatus({ ok: false, error: "unreachable" }));
  const loadQueue = () => fetch("/api/social/queue").then(r => r.json()).then(d => setQueue(d.ok ? d : { rows: [], items: {} })).catch(() => setQueue({ rows: [], items: {} }));
  useEffect(() => {
    loadStatus(); loadQueue();
    // back from Meta's dialog: the callback reports through ?connect=
    const u = new URL(window.location.href); const msg = u.searchParams.get("connect");
    if (msg) { triggerToast(msg, /expired|not return|no Pages|Error|error/i.test(msg) ? "error" : "success"); u.searchParams.delete("connect"); window.history.replaceState({}, "", u.toString()); }
    const t = setInterval(loadQueue, 60_000); return () => clearInterval(t);
  }, []);
  const accounts: any[] = status?.accounts || [];

  const connect = async () => {
    const r = await fetch(`/api/social/meta/connect${withIg ? "?ig=1" : ""}`).then(r => r.json()).catch(e => ({ error: e.message }));
    if (r.url) window.location.href = r.url; else triggerToast(r.error || "Could not start the connection", "error");
  };
  const removeAccount = async (a: any) => {
    if (window.prompt(`Disconnect ${a.name}? Pending posts for it are cancelled.\nType DISCONNECT to confirm:`) !== "DISCONNECT") return;
    const r = await post("/api/social/accounts/remove", { id: a.id });
    if (r.success) { triggerToast("Disconnected"); loadStatus(); loadQueue(); } else triggerToast(r.error || "Failed", "error");
  };

  // ---- composer ----
  const items: any[] = useMemo(() => ((state as any)?.contentItems || []).filter((i: any) => !i.retractedAt), [state]);
  const [targets, setTargets] = useState<string[]>([]);          // "accountId|network"
  const [message, setMessage] = useState(""); const [link, setLink] = useState(""); const [imageUrl, setImageUrl] = useState("");
  const [itemId, setItemId] = useState(""); const [useCover, setUseCover] = useState(false); const [when, setWhen] = useState(""); const [busy, setBusy] = useState(false);
  const item = items.find(i => i.id === itemId);
  const targetOptions = accounts.flatMap(a => [{ key: `${a.id}|facebook`, label: `Facebook · ${a.name}` }, ...(a.igId ? [{ key: `${a.id}|instagram`, label: `Instagram · @${a.igUsername}` }] : [])]);
  useEffect(() => { if (!targets.length && accounts.length) setTargets(accounts.map(a => `${a.id}|facebook`)); }, [accounts.length]);
  const pickItem = (id: string) => {
    setItemId(id); const it = items.find(i => i.id === id); if (!it) { setUseCover(false); return; }
    setMessage(`${it.title}\n\n${it.brief || ""}`.trim()); setLink(it.websiteUrl || ""); setUseCover(!!it.coverPath);
  };
  const igChosen = targets.some(t => t.endsWith("|instagram"));
  const willDraft = item && item.status !== "Published";
  const queueIt = async () => {
    const names = targetOptions.filter(o => targets.includes(o.key)).map(o => o.label).join(", ");
    const timing = willDraft ? "when the item passes the editorial gate" : when ? `at ${when.replace("T", " ")}` : "now";
    if (!window.confirm(`Post to ${names} ${timing}?\n\n${message.slice(0, 200)}`)) return;
    setBusy(true);
    const r = await post("/api/social/queue", {
      targets: targets.map(t => { const [accountId, network] = t.split("|"); return { accountId, network }; }),
      message, link: link || undefined, imageUrl: useCover ? undefined : (imageUrl || undefined), useCover, publishAt: when ? new Date(when).toISOString() : undefined, contentItemId: itemId || undefined
    }).catch(e => ({ error: e.message }));
    setBusy(false);
    if (r.success) { triggerToast(r.drafted ? "Drafted — it goes out when the item passes the gate" : when ? "Scheduled" : "Publishing — the queue reports within a minute"); setMessage(""); setLink(""); setImageUrl(""); setItemId(""); setUseCover(false); setWhen(""); loadQueue(); }
    else triggerToast(r.error || "Could not queue the post", "error");
  };
  const act = async (route: string, id: string, ok: string) => {
    const r = await post(route, { id }); if (r.success) { triggerToast(ok); loadQueue(); } else triggerToast(r.error || "Failed", "error");
  };

  // ---- recent posts on the network ----
  const [listAccount, setListAccount] = useState(""); const [posts, setPosts] = useState<any>(null);
  useEffect(() => { if (!listAccount && accounts.length) setListAccount(accounts[0].id); }, [accounts.length]);
  useEffect(() => { if (listAccount) fetch(`/api/social/list?accountId=${encodeURIComponent(listAccount)}`).then(r => r.json()).then(setPosts).catch(() => setPosts({ fb: [], ig: [] })); }, [listAccount]);
  const edit = async (id: string, current: string) => {
    const next = window.prompt("New text for this post:", current); if (next == null || next === current) return;
    const r = await post("/api/social/edit", { accountId: listAccount, target: "fb", postId: id, message: next });
    if (r.ok) { triggerToast("Post updated"); setListAccount(a => a); fetch(`/api/social/list?accountId=${listAccount}`).then(r => r.json()).then(setPosts); } else triggerToast(r.error || "Edit failed", "error");
  };
  const remove = async (kind: "fb" | "ig", id: string) => {
    if (window.prompt(`This permanently deletes the post from ${kind === "fb" ? "Facebook" : "Instagram"}.\nType DELETE to confirm:`) !== "DELETE") return;
    const r = await post("/api/social/delete", { accountId: listAccount, target: kind, postId: id, confirm: "yes" });
    if (r.ok) { triggerToast("Post deleted"); fetch(`/api/social/list?accountId=${listAccount}`).then(r => r.json()).then(setPosts); loadQueue(); } else triggerToast(r.error || "Delete failed", "error");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">📣 Social desk</h2>

      {/* accounts */}
      <div className={`space-y-2 rounded-lg border-s-4 bg-white p-3 text-xs ${!status ? "border-slate-300" : accounts.length && accounts.every(a => a.status?.valid) ? "border-emerald-500" : "border-amber-500"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">Connected Pages</b>
          {!status ? <span className="text-slate-500">Checking…</span> : !accounts.length && <span className="text-slate-500">none yet</span>}
          {canPost && (
            <span className="ms-auto flex items-center gap-2">
              <label className="flex items-center gap-1 text-slate-600"><input type="checkbox" checked={withIg} onChange={e => setWithIg(e.target.checked)} /> include Instagram</label>
              <button onClick={connect} disabled={status && !status.configured} title={status && !status.configured ? "META_APP_ID, META_APP_SECRET and FMS_PUBLIC_URL must be set on the server" : ""} className="rounded bg-red-700 px-3 py-1 font-bold text-white disabled:opacity-40">Connect a Facebook Page</button>
            </span>
          )}
        </div>
        {status && !status.configured && <p className="text-amber-700">The server has no Meta app configured (META_APP_ID / META_APP_SECRET / FMS_PUBLIC_URL). Admin sets them in the FMS .env.</p>}
        {accounts.map(a => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
            {a.picture ? <img src={a.picture} alt="" className="h-8 w-8 rounded-full" /> : <span className="h-8 w-8 rounded-full bg-slate-100" />}
            <b dir="auto">{a.name}</b>
            {a.status?.followers != null && <span className="text-slate-500"><span dir="ltr">{a.status.followers.toLocaleString()}</span> followers</span>}
            {a.igUsername ? <span className="rounded-full bg-pink-50 px-2 py-0.5 text-pink-700">Instagram @{a.igUsername}{a.status?.igFollowers != null && <> · <span dir="ltr">{a.status.igFollowers.toLocaleString()}</span></>}{a.status?.igQuotaUsed != null && <> · <span dir="ltr">{a.status.igQuotaUsed}/100</span> today</>}</span> : <span className="text-slate-400">no Instagram linked</span>}
            <span className={`rounded-full px-2 py-0.5 font-bold ${a.status?.valid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{a.status?.valid ? `token ok · expires ${a.status.expires === "never" ? "never" : a.status.expires.slice(0, 10)}` : `token invalid${a.status?.error ? `: ${a.status.error}` : ""}`}</span>
            {a.status?.valid && !a.status?.canPublishFB && <span className="text-amber-700">⚠ no pages_manage_posts — reconnect</span>}
            {a.igId && a.status?.valid && !a.status?.canPublishIG && <span className="text-amber-700">⚠ no instagram_content_publish — reconnect with Instagram ticked</span>}
            {canPost && <button onClick={() => removeAccount(a)} className="ms-auto text-red-700 underline">disconnect</button>}
          </div>
        ))}
      </div>

      {/* composer */}
      {canPost && accounts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <b className="text-sm">New post</b>
            {targetOptions.map(o => (
              <label key={o.key} className="flex items-center gap-1"><input type="checkbox" checked={targets.includes(o.key)} onChange={e => setTargets(e.target.checked ? [...targets, o.key] : targets.filter(t => t !== o.key))} /> {o.label}</label>
            ))}
            <select value={itemId} onChange={e => pickItem(e.target.value)} className="ms-auto rounded border border-slate-300 px-2 py-1">
              <option value="">no content item</option>
              {items.map((i: any) => <option key={i.id} value={i.id}>{i.title.slice(0, 60)} ({i.status})</option>)}
            </select>
          </div>
          {willDraft && <p className="text-amber-700">This item has not passed the editorial gate (it is {item.status}). The post is kept as a draft and goes out the moment the item is published.</p>}
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} dir="auto" placeholder="What are you posting?" className="w-full rounded border border-slate-300 p-2" />
          <input value={link} onChange={e => setLink(e.target.value)} dir="ltr" placeholder="Link (optional) — https://anahon.org/…" className="w-full rounded border border-slate-300 px-2 py-1" />
          <div className="flex flex-wrap items-center gap-3">
            {item?.coverPath && <label className="flex items-center gap-1"><input type="checkbox" checked={useCover} onChange={e => setUseCover(e.target.checked)} /> post the item's cover as the photo</label>}
            {!useCover && <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} dir="ltr" placeholder="Image URL (optional) — public HTTPS" className="min-w-[16rem] flex-1 rounded border border-slate-300 px-2 py-1" />}
            <label className="flex items-center gap-1 text-slate-600">when <input type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={e => setWhen(e.target.value)} dir="ltr" disabled={!!willDraft} className="rounded border border-slate-300 px-1 py-0.5 disabled:opacity-40" /> <span className="text-slate-400">(empty = now)</span></label>
            <button onClick={queueIt} disabled={busy || !targets.length || (!message.trim() && !link.trim() && !useCover && !imageUrl)} className="ms-auto rounded bg-red-700 px-4 py-1.5 font-bold text-white disabled:opacity-40">{busy ? "Sending…" : willDraft ? "Draft for the gate" : when ? "Schedule" : "Post now"}</button>
          </div>
          {igChosen && (useCover || (imageUrl && !/^https:\/\//.test(imageUrl)) || (!useCover && !imageUrl)) && <p className="text-slate-500">Instagram needs a public HTTPS image address — Meta fetches the file itself. The item's cover on the vault reaches Facebook only, until the media has a public address.</p>}
        </div>
      )}

      {/* queue */}
      <div className="space-y-2">
        <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-slate-900">Queue</h3><button onClick={loadQueue} className="text-xs text-red-700 underline">refresh</button></div>
        {!queue ? <p className="text-xs text-slate-500">Loading…</p> : !queue.rows.length ? <p className="text-xs text-slate-500">Nothing queued yet.</p> : (
          <div className="space-y-1">
            {queue.rows.map(r => {
              const a = accounts.find(x => x.id === r.accountId); const it = r.contentItemId ? queue.items[r.contentItemId] : null;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${STATE_PILL[r.state] || STATE_PILL.Draft}`}>{STATE_WORD[r.state] || r.state}</span>
                  <span className="font-bold">{NET(r.network)} · {a?.name || r.accountId}</span>
                  <span className="text-slate-500" dir="ltr">{fmtWhen(r.state === "Published" ? r.publishedAt : r.publishAt)}</span>
                  {it && <span className="text-slate-500" dir="auto">for “{it.title.slice(0, 40)}”</span>}
                  <span className="min-w-0 flex-1 truncate" dir="auto" title={r.message}>{r.message || r.link}</span>
                  {r.imageUrl && <span className="text-slate-400">📷</span>}
                  {r.state === "Published" && (r.stats?.likes != null) && <span className="text-slate-500" dir="ltr">♥ {r.stats.likes} · 💬 {r.stats.comments}{r.stats.shares != null ? ` · ↗ ${r.stats.shares}` : ""}</span>}
                  {r.permalink && <a href={r.permalink} target="_blank" rel="noopener" className="text-slate-500 underline">open ↗</a>}
                  {r.lastError && r.state !== "Published" && <span className="text-red-700" title={r.lastError}>{r.lastError.slice(0, 90)}{r.attempts ? ` (attempt ${r.attempts})` : ""}</span>}
                  {canPost && ["Draft", "Queued", "Failed"].includes(r.state) && <button onClick={() => act("/api/social/queue/cancel", r.id, "Cancelled")} className="text-red-700 underline">cancel</button>}
                  {canPost && ["Failed", "Cancelled"].includes(r.state) && <button onClick={() => act("/api/social/queue/retry", r.id, "Queued again")} className="text-red-700 underline">retry now</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* what is on the network */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">On the network</h3>
            <select value={listAccount} onChange={e => setListAccount(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          {!posts ? <p className="text-xs text-slate-500">Loading…</p> : (
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
                      <p><span className={`rounded px-1.5 py-0.5 font-bold ${p.kind === "fb" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>{p.kind === "fb" ? "Facebook" : "Instagram"}</span> <span className="text-slate-500" dir="ltr">{(p.created_time || p.timestamp || "").slice(0, 10)}</span>{p.kind === "fb" && p.is_published === false && <span className="ms-1 text-amber-700">· unpublished</span>}{likes != null && <span className="ms-2 text-slate-500" dir="ltr">♥ {likes} · 💬 {comments ?? 0}</span>}</p>
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
        </div>
      )}
    </div>
  );
}
