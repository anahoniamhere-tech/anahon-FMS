/**
 * Meta client for the Social desk — Facebook Pages and the Instagram Business accounts linked to
 * them. The system publishes itself; nothing sits between the editorial gate and the Graph API
 * (decided 6 Sep 2026 after a day with Postiz: it published nothing our own client could not,
 * and the four networks that would justify it are all behind reviews or money).
 *
 * Pure helpers first — scripts/check-social.ts asserts them without any network — then the
 * Graph calls. Accounts are rows in SocialAccount (one per Page, connected through Meta's own
 * login dialog); posts are rows in SocialPost, a small queue the server drains every minute.
 */

export const GRAPH = "https://graph.facebook.com/v25.0";
export const META_SCOPES_FB = [
  "pages_show_list", "pages_manage_posts", "pages_read_engagement", "pages_manage_engagement",
  "pages_read_user_content", "business_management", "read_insights"
];
// Instagram publishing needs these too — they live in a separate Meta use case on the app and are
// requested only when the person connecting ticks "include Instagram".
export const META_SCOPES_IG = ["instagram_basic", "instagram_content_publish", "instagram_manage_insights"];

export type SocialPostRow = {
  id: string; accountId: string; network: string; contentItemId: string; message: string; link: string;
  imageUrl: string; publishAt: string; state: string; attempts: number; lastError: string;
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

export type Plan = { kind: "fb-feed" | "fb-photo" | "ig-image"; error?: string };
/** What publishing this row means on its network, and why it cannot happen if it cannot. */
export function planPublish(row: Pick<SocialPostRow, "network" | "message" | "link" | "imageUrl">): Plan {
  const text = composeText(row.message, row.link);
  if (row.network === "instagram") {
    if (!row.imageUrl) return { kind: "ig-image", error: "Instagram needs an image." };
    if (!/^https:\/\//.test(row.imageUrl)) return { kind: "ig-image", error: "Instagram needs a public HTTPS image address — Meta fetches the file itself, so an item's cover on the vault cannot go to Instagram until the media has a public address." };
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

// ---- Graph -------------------------------------------------------------------------------
export class GraphError extends Error { constructor(message: string, public code?: number, public subcode?: number) { super(message); } }

export async function graph<T = any>(p: string, o: { method?: string; params?: Record<string, string>; token?: string; form?: FormData } = {}): Promise<T> {
  const url = new URL(GRAPH + p);
  const method = o.method || "GET";
  if (o.token) url.searchParams.set("access_token", o.token);
  const init: RequestInit = { method, signal: AbortSignal.timeout(60_000) };
  if (method === "GET") for (const [k, v] of Object.entries(o.params || {})) url.searchParams.set(k, v);
  else if (o.form) { for (const [k, v] of Object.entries(o.params || {})) o.form.set(k, v); init.body = o.form; }
  else { init.body = new URLSearchParams(o.params || {}); init.headers = { "content-type": "application/x-www-form-urlencoded" }; }
  const r = await fetch(url, init);
  const j: any = await r.json().catch(() => ({}));
  if (j.error) {
    const e = j.error;
    const hint = e.code === 190 ? " — the Page's token has expired or been revoked; connect the Page again."
      : (e.code === 200 || e.code === 10) ? " — the connection lacks a permission; connect the Page again with the missing one."
      : "";
    throw new GraphError(`${e.message}${hint}`, e.code, e.error_subcode);
  }
  return j;
}

/** Meta's login dialog for connecting Pages. `state` binds the return to the person who started it. */
export function connectUrl(appId: string, redirectUri: string, state: string, withInstagram: boolean) {
  const scope = [...META_SCOPES_FB, ...(withInstagram ? META_SCOPES_IG : [])].join(",");
  return `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}&response_type=code`;
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
  const quota = a.igId ? await graph(`/${a.igId}/content_publishing_limit`, { token: a.token }).then((d: any) => d.data?.[0]?.quota_usage ?? null).catch(() => null) : null;
  return {
    valid: dbg.is_valid ?? !page.error, expires: dbg.expires_at ? new Date(dbg.expires_at * 1000).toISOString() : "never", scopes: dbg.scopes ?? [],
    followers: page.followers_count ?? page.fan_count ?? null, igFollowers: ig?.followers_count ?? null, igQuotaUsed: quota,
    canPublishFB: (dbg.scopes ?? []).includes("pages_manage_posts"), canPublishIG: (dbg.scopes ?? []).includes("instagram_content_publish"),
    error: page.error || dbg.error
  };
}

export async function recentPosts(a: SocialAccountRow) {
  const fb: any = await graph(`/${a.id}/posts`, { token: a.token, params: { fields: "id,message,created_time,permalink_url,full_picture,is_published,shares,likes.summary(true),comments.summary(true)", limit: "25" } }).catch(e => ({ error: e.message, data: [] }));
  const ig: any = a.igId ? await graph(`/${a.igId}/media`, { token: a.token, params: { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: "25" } }).catch(e => ({ error: e.message, data: [] })) : { data: [] };
  return { fb: fb.data ?? [], ig: ig.data ?? [], fbError: fb.error, igError: ig.error };
}

export type ImageBytes = { buffer: Buffer; mime: string; name: string };

/** Publish one row. `image` resolves a non-URL imageUrl (an item's cover on the vault) to bytes. */
export async function publishRow(row: SocialPostRow, a: SocialAccountRow, image: (ref: string) => Promise<ImageBytes | null>): Promise<{ postId: string; permalink: string }> {
  const plan = planPublish(row);
  if (plan.error) throw new Error(plan.error);
  const text = composeText(row.message, row.link);
  if (plan.kind === "ig-image") {
    if (!a.igId) throw new Error("No Instagram account is linked to this Page.");
    const c: any = await graph(`/${a.igId}/media`, { method: "POST", token: a.token, params: { image_url: row.imageUrl, caption: text } });
    const r: any = await graph(`/${a.igId}/media_publish`, { method: "POST", token: a.token, params: { creation_id: c.id } });
    const m: any = await graph(`/${r.id}`, { token: a.token, params: { fields: "permalink" } }).catch(() => ({}));
    return { postId: String(r.id), permalink: String(m.permalink || "") };
  }
  if (plan.kind === "fb-photo") {
    let r: any;
    if (/^https?:\/\//.test(row.imageUrl)) {
      r = await graph(`/${a.id}/photos`, { method: "POST", token: a.token, params: { url: row.imageUrl, message: text } });
    } else {
      const bytes = await image(row.imageUrl);
      if (!bytes) throw new Error(`The image "${row.imageUrl}" could not be read from the vault.`);
      const form = new FormData();
      form.set("source", new Blob([bytes.buffer], { type: bytes.mime }), bytes.name);
      r = await graph(`/${a.id}/photos`, { method: "POST", token: a.token, form, params: { message: text } });
    }
    const postId = String(r.post_id || r.id);
    const p: any = await graph(`/${postId}`, { token: a.token, params: { fields: "permalink_url" } }).catch(() => ({}));
    return { postId, permalink: String(p.permalink_url || "") };
  }
  const params: Record<string, string> = { message: row.message.trim() };
  if (row.link.trim()) params.link = row.link.trim();
  const r: any = await graph(`/${a.id}/feed`, { method: "POST", token: a.token, params });
  const p: any = await graph(`/${r.id}`, { token: a.token, params: { fields: "permalink_url" } }).catch(() => ({}));
  return { postId: String(r.id), permalink: String(p.permalink_url || `https://facebook.com/${r.id}`) };
}

/** Likes and comments on a published row — enough for the desk; the insights API is a later step. */
export async function postStats(row: SocialPostRow, a: SocialAccountRow) {
  if (row.network === "instagram") {
    const m: any = await graph(`/${row.postId}`, { token: a.token, params: { fields: "like_count,comments_count" } });
    return { likes: m.like_count ?? 0, comments: m.comments_count ?? 0 };
  }
  const p: any = await graph(`/${row.postId}`, { token: a.token, params: { fields: "shares,likes.summary(true),comments.summary(true)" } });
  return { likes: p.likes?.summary?.total_count ?? 0, comments: p.comments?.summary?.total_count ?? 0, shares: p.shares?.count ?? 0 };
}
