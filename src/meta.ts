/**
 * Meta client for the Social desk — Facebook Pages and the Instagram Business accounts linked to
 * them. The system publishes itself; nothing sits between the editorial gate and the Graph API
 * (decided 6 Sep 2026 after a day with Postiz: it published nothing our own client could not,
 * and the four networks that would justify it are all behind reviews or money).
 *
 * Pure helpers first — scripts/check-social.ts asserts them without any network — then the
 * Graph calls. Accounts are rows in SocialAccount (one per Page, connected through Meta's own
 * login dialog); posts are rows in SocialPost, a small queue the server drains every minute.
 *
 * Video (6 Sep 2026, evening): a Facebook video is one multipart POST of the bytes; a Facebook
 * Reel and an Instagram Reel upload their bytes to rupload.facebook.com with the Page token in an
 * OAuth header. Both networks then transcode: the Instagram container and the Facebook Reel are
 * checked once a minute until ready, and only then is the row marked published. Meta cannot fetch
 * anything from this network, so every video comes
 * from the vault as bytes; images for Instagram still need a public address (image_url only).
 */

export const GRAPH = "https://graph.facebook.com/v25.0";
const GRAPH_VERSION = GRAPH.split("/").pop()!;
export const META_SCOPES_FB = [
  "pages_show_list", "pages_manage_posts", "pages_read_engagement", "pages_manage_engagement",
  "pages_read_user_content", "business_management", "read_insights"
];
// Instagram publishing needs these too — they live in a separate Meta use case on the app and are
// requested only when the person connecting ticks "include Instagram".
export const META_SCOPES_IG = ["instagram_basic", "instagram_content_publish", "instagram_manage_insights"];

/** Instagram's Reel ceiling (ig-user/media reference). Facebook takes 2 GB, but one cap keeps the desk honest. */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
export const VIDEO_MIMES = ["video/mp4", "video/quicktime"];
/** Facebook photo posts from bytes. Instagram cannot take image bytes at all (image_url only), whatever the size. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_SPEC = "MP4 or MOV (H.264 video, AAC audio), up to 300 MB. A Facebook video: 3 seconds to 15 minutes. A Reel is vertical 9:16 — Facebook 3–90 seconds, Instagram 3 seconds to 15 minutes";
/** How long an Instagram container may stay in processing before the desk gives up on it. */
export const CONTAINER_TIMEOUT_MS = 30 * 60_000;

export type SocialPostRow = {
  id: string; accountId: string; network: string; contentItemId: string; message: string; link: string;
  imageUrl: string; videoRef: string; asReel: boolean; containerId: string;
  publishAt: string; state: string; attempts: number; lastError: string;
  postId: string; permalink: string; statsJson: string; createdBy: string; createdAt: string; publishedAt: string;
};
export type SocialAccountRow = {
  id: string; name: string; picture: string; token: string; igId: string; igUsername: string;
  connectedBy: string; connectedAt: string; tokenCheckedAt: string; tokenValid: boolean;
};

export const POST_STATES = ["Draft", "Queued", "Publishing", "Published", "Failed", "Cancelled"] as const;
/** Retry gaps in minutes after the 1st, 2nd and 3rd failure; a 4th failure is final. */
export const BACKOFF_MINUTES = [1, 5, 15];

/** When to try again after `attempts` failures, or null when the row has had its chances. */
export function nextAttemptAt(attempts: number, now = new Date()): string | null {
  const gap = BACKOFF_MINUTES[attempts - 1];
  return gap == null ? null : new Date(now.getTime() + gap * 60_000).toISOString();
}
export const isDue = (row: Pick<SocialPostRow, "state" | "publishAt">, now = new Date()) =>
  row.state === "Queued" && row.publishAt <= now.toISOString();

/** The gate has passed for a content item: its drafts become queued, never earlier than now. */
export function gateRelease<T extends Pick<SocialPostRow, "state" | "publishAt">>(rows: T[], now = new Date()): T[] {
  const nowIso = now.toISOString();
  return rows.filter(r => r.state === "Draft").map(r => ({ ...r, state: "Queued", publishAt: r.publishAt > nowIso ? r.publishAt : nowIso }));
}

export const composeText = (message: string, link: string) => [message.trim(), link.trim()].filter(Boolean).join("\n\n");

export type Plan = { kind: "fb-feed" | "fb-photo" | "fb-video" | "fb-reel" | "ig-image" | "ig-reel"; error?: string };
type PlanInput = Pick<SocialPostRow, "network" | "message" | "link" | "imageUrl"> & Partial<Pick<SocialPostRow, "videoRef" | "asReel">>;
/** What publishing this row means on its network, and why it cannot happen if it cannot. */
export function planPublish(row: PlanInput): Plan {
  const text = composeText(row.message, row.link);
  const video = row.videoRef || "";
  if (video && row.imageUrl) return { kind: "fb-feed", error: "One media per post — a video or an image, not both." };
  if (video) {
    if (!/^doc:.+/.test(video)) return { kind: "fb-video", error: "A video must be a file in the vault — upload it from the desk." };
    if (row.network === "instagram") return { kind: "ig-reel" };
    if (row.network === "facebook") return { kind: row.asReel ? "fb-reel" : "fb-video" };
    return { kind: "fb-video", error: `Unknown network ${row.network}.` };
  }
  if (row.network === "instagram") {
    if (!row.imageUrl) return { kind: "ig-image", error: "Instagram needs an image or a video." };
    if (!/^https:\/\//.test(row.imageUrl)) return { kind: "ig-image", error: "Instagram needs a public HTTPS image address — Meta fetches the file itself, so an uploaded image or an item's cover on the vault cannot go to Instagram until the media has a public address. A video from the vault can: it is uploaded as a Reel." };
    return { kind: "ig-image" };
  }
  if (row.network === "facebook") {
    if (row.imageUrl) return { kind: "fb-photo" };
    if (!text) return { kind: "fb-feed", error: "A Facebook post needs a message or a link." };
    return { kind: "fb-feed" };
  }
  return { kind: "fb-feed", error: `Unknown network ${row.network}.` };
}

/** The state a new row starts in: drafts wait for the gate when their item has not passed it. */
export const initialState = (item: { status: string; retractedAt: string } | null) =>
  item && (item.status !== "Published" || item.retractedAt) ? "Draft" : "Queued";

// ---- Errors -------------------------------------------------------------------------------
export class GraphError extends Error { constructor(message: string, public code?: number, public subcode?: number) { super(message); } }
/**
 * A non-Graph failure (timeout, dropped connection) on the one request that publishes: the post
 * may already be on the Page, so the queue must not send it again blind. Meta's own refusals are
 * GraphErrors and stay retryable.
 */
const committing = <T>(p: Promise<T>) => p.catch(e => { if (!(e instanceof GraphError)) (e as any).maybePublished = true; throw e; });
export const isMaybePublished = (e: unknown) => (e as any)?.maybePublished === true;

// Meta's numbers, turned into sentences a person on the desk can act on.
const CODE_HINTS: Record<number, string> = {
  190: "the Page's token has expired or been revoked; connect the Page again.",
  200: "the connection lacks a permission; connect the Page again with the missing one.",
  10: "the connection lacks a permission; connect the Page again with the missing one.",
  613: "Facebook's Reels limit for today is reached (30 a day); try again tomorrow.",
  1363022: "the video file is too small for Facebook.",
  1363023: "the video is larger than Facebook allows (2 GB).",
  1363025: "the video is shorter than one second.",
  1363026: "the video is longer than Facebook allows (40 minutes).",
  1363040: "Facebook rejected the Reel's shape — it must be vertical 9:16, at least 540×960, 3–90 seconds, 24–60 fps.",
  1363127: "Facebook rejected the Reel's shape — it must be vertical 9:16, at least 540×960, 3–90 seconds, 24–60 fps.",
  1363128: "Facebook rejected the Reel's shape — it must be vertical 9:16, at least 540×960, 3–90 seconds, 24–60 fps.",
  1363129: "Facebook rejected the Reel's frame rate — 24 to 60 fps."
};
const SUBCODE_HINTS: Record<number, string> = {
  2207027: "Instagram is still processing the video; it will be checked again shortly.",
  2207026: "Instagram rejected the video format — export as MP4 (H.264 video, AAC audio) and try again.",
  2207008: "the Instagram upload session is gone; the post will be re-sent.",
  2207020: "the Instagram upload session is gone; the post will be re-sent.",
  2207053: "the Instagram upload session is gone; the post will be re-sent.",
  2207052: "Instagram could not fetch the media address — it must be public.",
  2207042: "Instagram's daily posting limit is reached; try again tomorrow.",
  2207050: "Instagram has restricted this account — someone must sign in to the Instagram app and clear it.",
  2207051: "Instagram has restricted this account — someone must sign in to the Instagram app and clear it.",
  2207010: "the caption is longer than 2,200 characters.",
  2207009: "the image's aspect ratio must be between 4:5 and 1.91:1.",
  2207057: "the cover offset is beyond the end of the video.",
  2207023: "Instagram no longer accepts plain videos — every video is a Reel."
};
/** Errors no retry can fix: the file itself is wrong. The queue marks these Failed at once. */
const FINAL_CODES = new Set([1363022, 1363023, 1363025, 1363026, 1363040, 1363127, 1363128, 1363129]);
const FINAL_SUBCODES = new Set([2207026, 2207010, 2207009, 2207057, 2207023]);
export const hintFor = (code?: number, subcode?: number) => (subcode && SUBCODE_HINTS[subcode]) || (code && CODE_HINTS[code]) || "";
export const isFinalError = (e: unknown) => e instanceof GraphError && (FINAL_CODES.has(e.code ?? -1) || FINAL_SUBCODES.has(e.subcode ?? -1));

// ---- Graph -------------------------------------------------------------------------------
export async function graph<T = any>(p: string, o: { method?: string; params?: Record<string, string>; token?: string; form?: FormData; timeoutMs?: number } = {}): Promise<T> {
  const url = new URL(GRAPH + p);
  const method = o.method || "GET";
  if (o.token) url.searchParams.set("access_token", o.token);
  const init: RequestInit = { method, signal: AbortSignal.timeout(o.timeoutMs ?? 60_000) };
  if (method === "GET") for (const [k, v] of Object.entries(o.params || {})) url.searchParams.set(k, v);
  else if (o.form) { for (const [k, v] of Object.entries(o.params || {})) o.form.set(k, v); init.body = o.form; }
  else { init.body = new URLSearchParams(o.params || {}); init.headers = { "content-type": "application/x-www-form-urlencoded" }; }
  const r = await fetch(url, init);
  const j: any = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) {
    // Every Graph answer is JSON. A 5xx HTML page, an empty body or a body cut mid-stream is a
    // failure the queue must retry — never a "success" whose id is the string "undefined".
    const e = j?.error || { message: `Meta answered HTTP ${r.status}${j ? "" : " with no readable body"}` };
    const hint = hintFor(e.code, e.error_subcode);
    throw new GraphError(`${e.message}${hint ? ` — ${hint}` : ""}`, e.code, e.error_subcode);
  }
  return j;
}

/**
 * Meta's byte uploader for Reels (both networks): the raw file in one POST, the Page token in an
 * OAuth header, the exact byte count in file_size. Not graph(): different host, different auth.
 */
export async function rupload(url: string, token: string, bytes: Buffer, timeoutMs = 10 * 60_000): Promise<void> {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(bytes.byteLength), "content-type": "application/octet-stream" },
    body: new Blob([bytes], { type: "application/octet-stream" }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.success !== true) {
    const e = j.debug_info || j.error || {};
    const hint = hintFor(e.code, e.error_subcode);
    throw new GraphError(`Upload to Meta failed: ${e.message || j.message || `HTTP ${r.status}`}${hint ? ` — ${hint}` : ""}`, e.code, e.error_subcode);
  }
}

/** Meta's login dialog for connecting Pages. `state` binds the return to the person who started it. */
export function connectUrl(appId: string, redirectUri: string, state: string, withInstagram: boolean) {
  const scope = [...META_SCOPES_FB, ...(withInstagram ? META_SCOPES_IG : [])].join(",");
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}&response_type=code`;
}

/** code → long-lived user token → every Page the person manages, each with its own long-lived token. */
export async function pagesFromCode(appId: string, appSecret: string, redirectUri: string, code: string) {
  const short: any = await graph("/oauth/access_token", { params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code } });
  const long: any = await graph("/oauth/access_token", { params: { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token } });
  const pages: any = await graph("/me/accounts", { token: long.access_token, params: { fields: "id,name,access_token,picture{url},instagram_business_account{id,username}", limit: "100" } });
  return (pages.data || []).map((p: any) => ({
    id: String(p.id), name: String(p.name || ""), picture: String(p.picture?.data?.url || ""), token: String(p.access_token),
    igId: String(p.instagram_business_account?.id || ""), igUsername: String(p.instagram_business_account?.username || "")
  }));
}

export async function accountStatus(a: SocialAccountRow) {
  const dbg: any = await graph("/debug_token", { token: a.token, params: { input_token: a.token } }).then(d => d.data ?? {}).catch(e => ({ error: e.message }));
  const page: any = await graph(`/${a.id}`, { token: a.token, params: { fields: "name,fan_count,followers_count" } }).catch(e => ({ error: e.message }));
  const ig: any = a.igId ? await graph(`/${a.igId}`, { token: a.token, params: { fields: "username,followers_count" } }).catch(e => ({ error: e.message })) : null;
  // Meta documents the daily Instagram quota as both 50 and 100: read what the account is actually given.
  const quota: any = a.igId ? await graph(`/${a.igId}/content_publishing_limit`, { token: a.token, params: { fields: "quota_usage,config" } }).then((d: any) => d.data?.[0] ?? null).catch(() => null) : null;
  return {
    valid: dbg.is_valid ?? !page.error, expires: dbg.expires_at ? new Date(dbg.expires_at * 1000).toISOString() : "never", scopes: dbg.scopes ?? [],
    followers: page.followers_count ?? page.fan_count ?? null, igFollowers: ig?.followers_count ?? null,
    igQuotaUsed: quota?.quota_usage ?? null, igQuotaTotal: quota?.config?.quota_total ?? null,
    canPublishFB: (dbg.scopes ?? []).includes("pages_manage_posts"), canPublishIG: (dbg.scopes ?? []).includes("instagram_content_publish"),
    error: page.error || dbg.error
  };
}

export async function recentPosts(a: SocialAccountRow) {
  const fb: any = await graph(`/${a.id}/posts`, { token: a.token, params: { fields: "id,message,created_time,permalink_url,full_picture,is_published,shares,likes.summary(true),comments.summary(true)", limit: "25" } }).catch(e => ({ error: e.message, data: [] }));
  const ig: any = a.igId ? await graph(`/${a.igId}/media`, { token: a.token, params: { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: "25" } }).catch(e => ({ error: e.message, data: [] })) : { data: [] };
  return { fb: fb.data ?? [], ig: ig.data ?? [], fbError: fb.error, igError: ig.error };
}

export type MediaBytes = { buffer: Buffer; mime: string; name: string; size: number };
/** Either the post is on the network, or Instagram is still transcoding it and the container must be watched. */
export type PublishResult = { postId: string; permalink: string } | { containerId: string };
export const isPending = (r: PublishResult): r is { containerId: string } => "containerId" in r;

export const fbPermalink = async (id: string, token: string, fallback: string) => {
  const p: any = await graph(`/${id}`, { token, params: { fields: "permalink_url" } }).catch(() => ({}));
  const u = String(p.permalink_url || "");
  return u ? (u.startsWith("/") ? `https://www.facebook.com${u}` : u) : fallback;
};

/** Publish one row. `media` resolves a vault reference (cover:…, doc:…) to bytes. */
export async function publishRow(row: SocialPostRow, a: SocialAccountRow, media: (ref: string) => Promise<MediaBytes | null>): Promise<PublishResult> {
  const plan = planPublish(row);
  if (plan.error) throw new Error(plan.error);
  const text = composeText(row.message, row.link);

  if (plan.kind === "fb-video" || plan.kind === "fb-reel" || plan.kind === "ig-reel") {
    const bytes = await media(row.videoRef);
    if (!bytes) throw new Error(`The video "${row.videoRef}" could not be read from the vault.`);
    if (!VIDEO_MIMES.includes(bytes.mime)) throw new Error(`Not a video the networks accept (${bytes.mime}). ${VIDEO_SPEC}.`);
    if (bytes.size > MAX_VIDEO_BYTES) throw new Error(`The video is ${Math.round(bytes.size / 1048576)} MB; the limit is ${MAX_VIDEO_BYTES / 1048576} MB.`);

    if (plan.kind === "fb-video") {
      const form = new FormData();
      form.set("source", new Blob([bytes.buffer], { type: bytes.mime }), bytes.name);
      const r: any = await committing(graph(`/${a.id}/videos`, { method: "POST", token: a.token, form, params: { description: text }, timeoutMs: 15 * 60_000 }));
      const postId = String(r.id);
      return { postId, permalink: await fbPermalink(postId, a.token, `https://www.facebook.com/${a.id}/videos/${postId}`) };
    }
    if (plan.kind === "fb-reel") {
      const start: any = await graph(`/${a.id}/video_reels`, { method: "POST", token: a.token, params: { upload_phase: "start" } });
      const videoId = String(start.video_id);
      await rupload(`https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`, a.token, bytes.buffer);
      await committing(graph(`/${a.id}/video_reels`, { method: "POST", token: a.token, params: { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description: text } }));
      // finish only answers {success:true}; Facebook transcodes afterwards — the queue watches /{video_id}?fields=status like an Instagram container
      return { containerId: videoId };
    }
    // ig-reel: container → bytes → Instagram transcodes; the queue checks the container each minute
    if (!a.igId) throw new Error("No Instagram account is linked to this Page.");
    const c: any = await graph(`/${a.igId}/media`, { method: "POST", token: a.token, params: { media_type: "REELS", upload_type: "resumable", caption: text, share_to_feed: "true" } });
    const containerId = String(c.id);
    await rupload(c.uri || `https://rupload.facebook.com/ig-api-upload/${GRAPH_VERSION}/${containerId}`, a.token, bytes.buffer);
    return { containerId };
  }

  if (plan.kind === "ig-image") {
    if (!a.igId) throw new Error("No Instagram account is linked to this Page.");
    const c: any = await graph(`/${a.igId}/media`, { method: "POST", token: a.token, params: { image_url: row.imageUrl, caption: text } });
    return publishContainer(String(c.id), a);
  }
  if (plan.kind === "fb-photo") {
    let r: any;
    if (/^https?:\/\//.test(row.imageUrl)) {
      r = await committing(graph(`/${a.id}/photos`, { method: "POST", token: a.token, params: { url: row.imageUrl, message: text } }));
    } else {
      const bytes = await media(row.imageUrl);
      if (!bytes) throw new Error(`The image "${row.imageUrl}" could not be read from the vault.`);
      if (!IMAGE_MIMES.includes(bytes.mime)) throw new Error(`Not an image Facebook accepts (${bytes.mime}) — JPEG, PNG or WebP.`);
      if (bytes.size > MAX_IMAGE_BYTES) throw new Error(`The image is ${Math.round(bytes.size / 1048576)} MB; the limit is ${MAX_IMAGE_BYTES / 1048576} MB.`);
      const form = new FormData();
      form.set("source", new Blob([bytes.buffer], { type: bytes.mime }), bytes.name);
      r = await committing(graph(`/${a.id}/photos`, { method: "POST", token: a.token, form, params: { message: text } }));
    }
    const postId = String(r.post_id || r.id);
    return { postId, permalink: await fbPermalink(postId, a.token, "") };
  }
  const params: Record<string, string> = { message: row.message.trim() };
  if (row.link.trim()) params.link = row.link.trim();
  const r: any = await committing(graph(`/${a.id}/feed`, { method: "POST", token: a.token, params }));
  return { postId: String(r.id), permalink: await fbPermalink(String(r.id), a.token, `https://facebook.com/${r.id}`) };
}

/** Where an Instagram container stands. ERROR carries Meta's subcode in `status`, as text. */
export async function checkContainer(containerId: string, a: SocialAccountRow): Promise<{ code: string; detail: string }> {
  const s: any = await graph(`/${containerId}`, { token: a.token, params: { fields: "status_code,status" } });
  const code = String(s.status_code || "");
  const raw = String(s.status || "");
  const sub = Number((raw.match(/\b(22\d{5})\b/) || [])[1]);
  const hint = sub ? hintFor(undefined, sub) : "";
  return { code, detail: hint ? `${raw} — ${hint}` : raw };
}

/** Where a Facebook Reel stands after finish — Facebook transcodes it too; the same {code, detail} shape as checkContainer. */
export async function checkReel(videoId: string, a: SocialAccountRow): Promise<{ code: string; detail: string }> {
  const s: any = (await graph(`/${videoId}`, { token: a.token, params: { fields: "status" } })).status || {};
  const v = String(s.video_status || "");
  const err = s.processing_phase?.errors?.[0] || s.publishing_phase?.errors?.[0] || s.uploading_phase?.errors?.[0];
  const code = v === "ready" ? "FINISHED" : ["error", "upload_failed", "expired"].includes(v) ? "ERROR" : "IN_PROGRESS";
  const hint = err ? hintFor(Number(err.code), Number(err.error_subcode)) : "";
  return { code, detail: err ? `${err.message || v}${hint ? ` — ${hint}` : ""}` : v };
}

/** Publish a FINISHED Instagram container (also the second half of an image post). */
export async function publishContainer(containerId: string, a: SocialAccountRow): Promise<{ postId: string; permalink: string }> {
  const r: any = await graph(`/${a.igId}/media_publish`, { method: "POST", token: a.token, params: { creation_id: containerId } });
  const m: any = await graph(`/${r.id}`, { token: a.token, params: { fields: "permalink" } }).catch(() => ({}));
  return { postId: String(r.id), permalink: String(m.permalink || "") };
}

/** Likes and comments on a published row — enough for the desk; the insights API is a later step. */
export async function postStats(row: SocialPostRow, a: SocialAccountRow) {
  if (row.network === "instagram") {
    const m: any = await graph(`/${row.postId}`, { token: a.token, params: { fields: "like_count,comments_count" } });
    return { likes: m.like_count ?? 0, comments: m.comments_count ?? 0 };
  }
  // A Facebook video or Reel is a Video node: likes and comments, but no `shares` field.
  const fields = row.videoRef ? "likes.summary(true),comments.summary(true)" : "shares,likes.summary(true),comments.summary(true)";
  const p: any = await graph(`/${row.postId}`, { token: a.token, params: { fields } });
  const stats: Record<string, number> = { likes: p.likes?.summary?.total_count ?? 0, comments: p.comments?.summary?.total_count ?? 0 };
  if (!row.videoRef) stats.shares = p.shares?.count ?? 0;
  return stats;
}
