import React, { useEffect, useMemo, useRef, useState } from "react";
import { ic } from "../nav";
import { TriangleAlert } from "lucide-react";
import { socialPostBlockers, socialRendition, CAPTION_KIND } from "../editorialGates";
import { CAROUSEL_MIN, CAROUSEL_MAX } from "../meta";

/**
 * The piece's channel panel (Newsroom, 12 Sep 2026). Lifted whole out of the old Social desk:
 * the piece is no longer picked from a list — it is the piece whose drawer this sits in, so the
 * composer, the gate line and the queue all belong to that one piece.
 *
 * **Not one rule moved.** `socialPostBlockers` and `socialRendition` are called exactly as the
 * Social desk called them, and the server re-checks both at /api/social/queue. A rehearsal is
 * refused twice over: the composer is never drawn, and the gate would refuse it anyway.
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
const MAX_VIDEO_MB = 300; const MAX_IMAGE_MB = 10;
type Media = "none" | "cover" | "image" | "video";

export default function ChannelPanel({ item, accounts, rows, reload, canPost, triggerToast, t }: {
  item: any; accounts: any[]; rows: any[]; reload: () => void;
  canPost: boolean; triggerToast: (m: string, k?: string) => void; t: (s: string) => string;
}) {
  const [targets, setTargets] = useState<string[]>([]);          // "accountId|network"
  const [message, setMessage] = useState(""); const [link, setLink] = useState("");
  const [media, setMedia] = useState<Media>("none"); const [imageUrl, setImageUrl] = useState("");
  const [videoId, setVideoId] = useState(""); const [asReel, setAsReel] = useState(false);
  const [pics, setPics] = useState<{ v: string; label: string }[]>([]);
  const [publishing, setPublishing] = useState("");
  const addPic = (v: string, label: string) => setPics(p =>
    p.length >= CAROUSEL_MAX || p.some(x => x.v === v) ? p : [...p, { v, label }]);
  const [library, setLibrary] = useState<{ videos: any[]; images: any[] } | null>(null); const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null); const imgRef = useRef<HTMLInputElement>(null);
  const [when, setWhen] = useState(""); const [busy, setBusy] = useState(false);

  // The piece IS the unit of work, so the caption starts as the one the desk wrote and the
  // fact-checker saw — no picking, no fresh text typed at a separate desk.
  const rendition = socialRendition(item || null);
  useEffect(() => {
    setMessage(socialRendition(item).text); setLink(item.websiteUrl || "");
    setMedia(item.coverPath ? "cover" : "none");
    setPics([]); setVideoId(""); setWhen("");
  }, [item.id]);

  const targetOptions = accounts.flatMap(a => [{ key: `${a.id}|facebook`, label: `Facebook · ${a.name}` }, ...(a.igId ? [{ key: `${a.id}|instagram`, label: `Instagram · @${a.igUsername}` }] : [])]);
  useEffect(() => { if (!targets.length && accounts.length) setTargets(accounts.map(a => `${a.id}|facebook`)); }, [accounts.length]);
  const loadLibrary = () => fetch("/api/social/media").then(r => r.json()).then(d => setLibrary(d.ok ? d : { videos: [], images: [] })).catch(() => setLibrary({ videos: [], images: [] }));
  useEffect(() => { if ((media === "video" || media === "image") && library == null) loadLibrary(); }, [media]);

  const uploadMedia = async (f: File, kind: "video" | "image") => {
    const type = kind === "video"
      ? (/\.mov$/i.test(f.name) ? "video/quicktime" : /\.mp4$/i.test(f.name) ? "video/mp4" : f.type)
      : (/\.jpe?g$/i.test(f.name) ? "image/jpeg" : /\.png$/i.test(f.name) ? "image/png" : /\.webp$/i.test(f.name) ? "image/webp" : f.type);
    if (kind === "video" && !/^video\/(mp4|quicktime)$/.test(type)) return triggerToast("Only MP4 or MOV videos", "error");
    if (kind === "image" && !/^image\/(jpeg|png|webp)$/.test(type)) return triggerToast("Only JPEG, PNG or WebP images", "error");
    const capMb = kind === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (f.size > capMb * 1048576) return triggerToast(`That file is ${Math.round(f.size / 1048576)} MB; the limit is ${capMb} MB`, "error");
    setUploading(f.size);
    const r = await fetch(`/api/social/media?name=${encodeURIComponent(f.name)}&item=${encodeURIComponent(item.id)}`, { method: "POST", headers: { "content-type": type }, body: f })
      .then(async res => { try { return await res.json(); } catch { return { error: res.status === 413 ? `The server refused the size (over ${capMb} MB)` : `Upload failed (HTTP ${res.status})` }; } }).catch(e => ({ error: e.message }));
    setUploading(0);
    if (r.success) { triggerToast(r.duplicate ? "That file was already in the vault — reused" : `Uploaded ${r.doc.filename} (${r.doc.sizeStr})`); if (kind === "video") setVideoId(r.doc.id); else addPic(r.doc.id, r.doc.filename); loadLibrary(); }
    else triggerToast(r.error || "Upload failed", "error");
  };

  const igChosen = targets.some(t2 => t2.endsWith("|instagram")); const fbChosen = targets.some(t2 => t2.endsWith("|facebook"));
  const willDraft = item.status !== "Published";
  const hasMedia = media === "cover" ? !!item.coverPath : media === "image" ? pics.length > 0 : media === "video" ? !!videoId : false;
  const isCarousel = media === "image" && pics.length >= CAROUSEL_MIN;
  const igNeedsPublic = igChosen && media === "image" && pics.some(p => !/^https:\/\//.test(p.v));
  // The same function the server refuses with, so the button and the 403 cannot disagree.
  const gate = socialPostBlockers(item);
  const edited = message.trim() !== rendition.text.trim();
  const canSend = !gate.length && targets.length > 0 && !busy && !uploading && (message.trim() || link.trim() || hasMedia) && (media === "none" || hasMedia)
    && !(igChosen && media !== "video" && media !== "image") && !igNeedsPublic;

  const makePublic = async (docId: string) => {
    setPublishing(docId);
    const r = await post("/api/social/image-public", { docId }).finally(() => setPublishing(""));
    if (r.ok && r.url) {
      setPics(a => a.map(x => x.v === docId ? { v: r.url, label: r.url.split("/").pop() || r.url } : x));
      triggerToast(r.rebuilt ? `On the website now (site rebuilt in ${r.seconds ?? "?"}s)` : "Already on the website");
    } else triggerToast(r.error || "Could not publish that image", "error");
  };

  const queueIt = async () => {
    const names = targetOptions.filter(o => targets.includes(o.key)).map(o => o.label).join(", ");
    const timing = willDraft ? "when the piece passes the editorial gate" : when ? `at ${when.replace("T", " ")}` : "now";
    if (!window.confirm(`Post to ${names} ${timing}?\n\n${message.slice(0, 200)}${media === "video" ? "\n\n(with the video)" : media === "image" ? "\n\n(with the image)" : media === "cover" ? "\n\n(with the piece's cover)" : ""}`)) return;
    setBusy(true);
    const r = await post("/api/social/queue", {
      targets: targets.map(t2 => { const [accountId, network] = t2.split("|"); return { accountId, network }; }),
      message, link: link || undefined, images: media === "image" ? pics.map(p => p.v) : undefined, useCover: media === "cover",
      videoRef: media === "video" ? videoId : undefined, asReel: media === "video" && asReel,
      publishAt: when ? new Date(when).toISOString() : undefined, contentItemId: item.id
    }).catch(e => ({ error: e.message }));
    setBusy(false);
    if (r.success) { triggerToast(r.drafted ? "Drafted — it goes out when the piece passes the gate" : when ? "Scheduled" : media === "video" ? (igChosen ? "Uploading to the networks — Instagram takes a few minutes to process a Reel" : "Uploading to Facebook — the queue reports when it is live") : "Publishing — the queue reports within a minute"); setImageUrl(""); setPics([]); setVideoId(""); setMedia("none"); setWhen(""); reload(); }
    else triggerToast(r.error || "Could not queue the post", "error");
  };
  const act = async (route: string, id: string, ok: string) => {
    const r = await post(route, { id }); if (r.success) { triggerToast(ok); reload(); } else triggerToast(r.error || "Failed", "error");
  };

  const mediaBtn = (m: Media, label: string, disabled = false) => (
    <button key={m} type="button" disabled={disabled} onClick={() => setMedia(m)} className={`rounded-full px-3 py-1 font-bold disabled:opacity-40 ${media === m ? "bg-slate-900 text-white" : "text-slate-600"}`}>{label}</button>
  );

  return (
    <div className="space-y-2 text-xs">
      <h5 className="font-bold text-slate-700 uppercase text-[10px]">{t("Facebook & Instagram")}</h5>

      {/* What this piece already has on the networks. */}
      {rows.length > 0 && (
        <div className="space-y-1">
          {rows.map(r => {
            const a = accounts.find(x => x.id === r.accountId);
            const word = r.state === "Publishing" && r.containerId ? `${NET(r.network)} is processing the video…` : STATE_WORD[r.state] || r.state;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-2">
                <span className={`rounded-full px-2 py-0.5 font-bold ${STATE_PILL[r.state] || STATE_PILL.Draft}`}>{word}</span>
                <span className="font-bold">{NET(r.network)} · {a?.name || r.accountId}</span>
                <span className="text-slate-500" dir="ltr">{fmtWhen(r.state === "Published" ? r.publishedAt : r.publishAt)}</span>
                <span className="min-w-0 flex-1 truncate" dir="auto" title={r.message}>{r.message || r.link}</span>
                {r.videoRef ? <span className="text-slate-400" title={r.asReel || r.network === "instagram" ? "Reel" : "video"}>🎬{r.asReel || r.network === "instagram" ? " Reel" : ""}</span>
                  : (JSON.parse(r.imagesJson || "[]").length > 1) ? <span className="text-slate-400" title="carousel">🖼 <span dir="ltr">{JSON.parse(r.imagesJson).length}</span></span>
                  : r.imageUrl && <span className="text-slate-400">📷</span>}
                {r.state === "Published" && (r.stats?.likes != null) && <span className="text-slate-500" dir="ltr">♥ {r.stats.likes} · 💬 {r.stats.comments}{r.stats.shares != null ? ` · ↗ ${r.stats.shares}` : ""}</span>}
                {r.permalink && <a href={r.permalink} target="_blank" rel="noopener" className="text-slate-500 underline">open ↗</a>}
                {r.lastError && r.state !== "Published" && <span dir="ltr" className="text-red-700" title={r.lastError}>{r.lastError.slice(0, 90)}{r.attempts ? ` (attempt ${r.attempts})` : ""}</span>}
                {canPost && ["Draft", "Queued", "Failed"].includes(r.state) && <button onClick={() => act("/api/social/queue/cancel", r.id, "Cancelled")} className="text-red-700 underline">cancel</button>}
                {canPost && ["Failed", "Cancelled"].includes(r.state) && <button onClick={() => act("/api/social/queue/retry", r.id, "Queued again")} className="text-red-700 underline">retry now</button>}
              </div>
            );
          })}
        </div>
      )}

      {/* The gate speaks first. A rehearsal, a retracted piece or no piece at all stops here — the
          composer is not drawn at all, and the server refuses the same case at the route. */}
      {gate.length > 0 ? <p className="rounded bg-amber-50 p-2 text-amber-900">{gate[0]}</p>
        : !canPost ? <p className="text-slate-400">{t("Posting to the networks needs an editor or the Digital Officer.")}</p>
        : !accounts.length ? <p className="text-slate-500">{t("No Facebook Page is connected. Admin connects one in Settings & compliance.")}</p>
        : (
        <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
          <div className="flex flex-wrap items-center gap-3">
            <b>{t("New post for this piece")}</b>
            {targetOptions.map(o => (
              <label key={o.key} className="flex items-center gap-1"><input type="checkbox" checked={targets.includes(o.key)} onChange={e => setTargets(e.target.checked ? [...targets, o.key] : targets.filter(t2 => t2 !== o.key))} /> {o.label}</label>
            ))}
          </div>
          {rendition.source === "caption" && (
            <p className="text-slate-500">
              Caption from the piece{rendition.draft?.label ? ` — “${rendition.draft.label}”` : ""}
              {rendition.draft?.by ? `, by ${rendition.draft.by}` : ""}
              {rendition.draft?.date ? <> on <span dir="ltr">{rendition.draft.date}</span></> : null}.
              {edited && <b className="text-amber-800"> Edited here — this is no longer the text on the piece.</b>}
            </p>
          )}
          {rendition.source === "improvised" && (
            <p className="rounded bg-amber-50 p-2 text-amber-900">
              This piece has no {CAPTION_KIND} draft, so the text below was assembled from its title and brief —
              nobody wrote or checked it as a caption. Add a {CAPTION_KIND} draft above and it will be verified
              with the piece.
            </p>
          )}
          {willDraft && <p className="text-amber-700">This piece has not passed the editorial gate (it is {item.status}). The post is kept as a draft and goes out the moment the piece is published.</p>}
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} dir="auto" placeholder="What are you posting?" className="w-full rounded border border-slate-300 p-2" />
          <input value={link} onChange={e => setLink(e.target.value)} dir="ltr" placeholder="Link (optional) — https://anahon.org/…" className="w-full rounded border border-slate-300 px-2 py-1" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">Media</span>
            <div className="flex rounded-full bg-slate-100 p-0.5">
              {mediaBtn("none", "none")}{mediaBtn("cover", "the piece's cover", !item.coverPath)}{mediaBtn("image", "image")}{mediaBtn("video", "video")}
            </div>
          </div>
          {media === "image" && (
            <div className="space-y-2 rounded border border-slate-200 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <select value="" onChange={e => { const v = library?.images.find(x => x.id === e.target.value); if (v) addPic(v.id, v.filename); }} dir="ltr" className="min-w-[16rem] flex-1 rounded border border-slate-300 px-2 py-1">
                  <option value="">{library == null ? "loading the vault's images…" : library.images.length ? "add an image from the vault…" : "no images in the vault yet"}</option>
                  {(library?.images || []).map(v => <option key={v.id} value={v.id}>{`${v.filename} · ${v.sizeStr} · ${v.created_at.slice(0, 10)}${v.refNo ? ` · ${v.refNo}` : ""}`}</option>)}
                </select>
                <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, "image"); e.target.value = ""; }} />
                <button type="button" onClick={() => imgRef.current?.click()} disabled={!!uploading} className="rounded border border-slate-300 px-3 py-1 font-bold disabled:opacity-40">{uploading ? `Uploading ${Math.max(1, Math.round(uploading / 1048576))} MB…` : "Upload an image"}</button>
                <span className="text-slate-400">or</span>
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && imageUrl.trim()) { e.preventDefault(); addPic(imageUrl.trim(), imageUrl.trim()); setImageUrl(""); } }}
                  dir="ltr" placeholder="a public https:// address" className="min-w-[14rem] flex-1 rounded border border-slate-300 px-2 py-1" />
                <button type="button" disabled={!imageUrl.trim()} onClick={() => { addPic(imageUrl.trim(), imageUrl.trim()); setImageUrl(""); }}
                  className="rounded border border-slate-300 px-3 py-1 font-bold disabled:opacity-40">add</button>
              </div>
              {pics.length > 0 && (
                <ol className="space-y-1">
                  {pics.map((p, i) => (
                    <li key={p.v} className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                      <span className="w-4 shrink-0 text-slate-400" dir="ltr">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate" dir="auto" title={p.v}>{p.label}</span>
                      {!/^https:\/\//.test(p.v) && (
                        <button type="button" onClick={() => makePublic(p.v)} disabled={!!publishing}
                          title="Copy it onto the website so Instagram can fetch it"
                          className="whitespace-nowrap rounded border border-slate-300 px-2 py-0.5 font-bold disabled:opacity-40">
                          {publishing === p.v ? "publishing…" : "make public"}
                        </button>
                      )}
                      {i > 0 && <button type="button" onClick={() => setPics(a => { const b = [...a]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; return b; })} className="text-slate-500" title="earlier">↑</button>}
                      <button type="button" onClick={() => setPics(a => a.filter(x => x.v !== p.v))} className="text-red-700 underline">remove</button>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-slate-500">
                JPEG, PNG or WebP up to <span dir="ltr">{MAX_IMAGE_MB} MB</span> each. One image is a photo;{" "}
                <span dir="ltr">{CAROUSEL_MIN}</span>–<span dir="ltr">{CAROUSEL_MAX}</span> is a carousel, published in the order above.
                An uploaded image reaches Facebook; Instagram only takes a public address, because Meta fetches every image itself.
              </p>
            </div>
          )}
          {media === "video" && (
            <div className="space-y-2 rounded border border-slate-200 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <select value={videoId} onChange={e => setVideoId(e.target.value)} dir="ltr" className="min-w-[16rem] flex-1 rounded border border-slate-300 px-2 py-1">
                  <option value="">{library == null ? "loading the vault's videos…" : library.videos.length ? "choose a video in the vault…" : "no videos in the vault yet"}</option>
                  {(library?.videos || []).map(v => <option key={v.id} value={v.id}>{`${v.filename} · ${v.sizeStr} · ${v.created_at.slice(0, 10)}${v.refNo ? ` · ${v.refNo}` : ""}`}</option>)}
                </select>
                <input ref={fileRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, "video"); e.target.value = ""; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading} className="rounded border border-slate-300 px-3 py-1 font-bold disabled:opacity-40">{uploading ? `Uploading ${Math.round(uploading / 1048576)} MB…` : "Upload a video"}</button>
                {fbChosen && <label className="flex items-center gap-1"><input type="checkbox" checked={asReel} onChange={e => setAsReel(e.target.checked)} /> as a Reel on Facebook (vertical 9:16, 3–90 s)</label>}
              </div>
              <p className="text-slate-500">MP4 or MOV (H.264 video, AAC audio), up to <span dir="ltr">{MAX_VIDEO_MB} MB</span>. A Facebook video: 3 seconds to 15 minutes, any shape. A Reel is vertical 9:16 — Facebook 3–90 seconds, Instagram up to 15 minutes; Instagram always publishes a video as a Reel. Both networks take a few minutes to process a Reel; the queue reports when it is live.</p>
            </div>
          )}
          {igChosen && media !== "video" && media !== "image" && <p className="text-amber-700">Instagram needs an image or a video. An image must be a public HTTPS address (Meta fetches the file itself); a video from the vault works, as a Reel.</p>}
          {igChosen && (media === "cover" || igNeedsPublic) && (
            <p className="text-amber-700">
              An image on the vault reaches Facebook only — Instagram needs a public image address.
              {igNeedsPublic && <> Press <b>make public</b> beside each one: it copies the image onto the website and uses that address.</>}
            </p>
          )}
          {isCarousel && <p className="text-slate-500">A carousel of <span dir="ltr">{pics.length}</span> images{fbChosen ? " — on Facebook a post with several photos" : ""}{igChosen ? " — on Instagram a swipeable carousel" : ""}.</p>}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-slate-600">when <input type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={e => setWhen(e.target.value)} dir="ltr" disabled={!!willDraft} className="rounded border border-slate-300 px-1 py-0.5 disabled:opacity-40" /> <span className="text-slate-400">(empty = now)</span></label>
            <button onClick={queueIt} disabled={!canSend} className="ms-auto rounded bg-red-700 px-4 py-1.5 font-bold text-white disabled:opacity-40">{busy ? "Sending…" : willDraft ? "Draft for the gate" : when ? "Schedule" : "Post now"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only token health for the daily door — the connect/disconnect buttons live in Admin. */
export function TokenHealth({ status, t }: { status: any; t: (s: string) => string }) {
  const accounts: any[] = status?.accounts || [];
  if (!status) return null;
  const bad = accounts.filter(a => !a.status?.valid || !a.status?.canPublishFB || (a.igId && !a.status?.canPublishIG));
  return (
    <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
      {!accounts.length
        ? <span>{t("No Facebook Page connected — Admin connects one in Settings & compliance.")}</span>
        : bad.length === 0
          ? <span className="text-emerald-700">{accounts.length === 1 ? accounts[0].name : `${accounts.length} Pages`} · {t("tokens healthy")}</span>
          : <span className="text-amber-700 inline-flex items-center gap-1">{ic(TriangleAlert, "h-3 w-3")}{bad.map(a => a.name).join(", ")} — {t("needs reconnecting in Settings & compliance")}</span>}
    </p>
  );
}
