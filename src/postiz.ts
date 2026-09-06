/**
 * Postiz bridge — the FMS keeps the editorial gate, Postiz publishes.
 *
 * The Digital Officer composes in Postiz and leaves the posts as DRAFTS. The Social desk links
 * a draft group to a content item; when `/api/content/publish` passes Policy 002/005, the server
 * flips each linked post from draft to scheduled and Postiz posts it. Postiz webhooks cannot call
 * a private address (its validator blocks 192.168/16 and 100.64/10), so state comes back by polling.
 *
 * Pure helpers first (scripts/check-postiz.ts asserts them, no network), then a thin client over
 * Postiz's public API. Env: POSTIZ_URL (the NAS-local address the container reaches, e.g.
 * http://172.17.0.1:4007), POSTIZ_API_KEY (Postiz → Settings → Public API), POSTIZ_PUBLIC_URL
 * (what a person opens; the tailnet door).
 */

export type PostizPost = {
  id: string; content: string; publishDate: string; releaseURL: string | null; state: string; group: string;
  integration: { id: string; providerIdentifier: string; name: string; picture?: string | null };
};
export type PostizLink = {
  postId: string; integrationId: string; channel: string; network: string; account: string;
  state: string; releaseURL: string; publishDate: string; preview: string;
};

/** Postiz provider identifier → the channel name the editorial register uses. */
export const NETWORK_CHANNEL: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", "instagram-standalone": "Instagram", youtube: "YouTube",
  tiktok: "TikTok", linkedin: "LinkedIn", "linkedin-page": "LinkedIn", x: "X"
};
export const channelOf = (providerIdentifier: string) => NETWORK_CHANNEL[providerIdentifier] ?? providerIdentifier;

export function toLinks(posts: PostizPost[]): PostizLink[] {
  return posts.map(p => ({
    postId: p.id, integrationId: p.integration.id, channel: channelOf(p.integration.providerIdentifier),
    network: p.integration.providerIdentifier, account: p.integration.name, state: p.state,
    releaseURL: p.releaseURL || "", publishDate: p.publishDate, preview: String(p.content || "").replace(/<[^>]+>/g, "").slice(0, 140)
  }));
}

/** Bring stored links up to date with what Postiz reports; `changed` says whether anything moved. */
export function mergeStates(links: PostizLink[], posts: PostizPost[]): { links: PostizLink[]; changed: boolean; errors: PostizLink[] } {
  const byId = new Map(posts.map(p => [p.id, p]));
  let changed = false; const errors: PostizLink[] = [];
  const next = links.map(l => {
    const p = byId.get(l.postId); if (!p) return l;
    const url = p.releaseURL || "";
    if (p.state === l.state && url === l.releaseURL && p.publishDate === l.publishDate) return l;
    changed = true;
    const n = { ...l, state: p.state, releaseURL: url, publishDate: p.publishDate };
    if (p.state === "ERROR" && l.state !== "ERROR") errors.push(n);
    return n;
  });
  return { links: next, changed, errors };
}

/** Published in Postiz with no content item behind it — the gate was walked around. */
export function outsideGate(posts: PostizPost[], linked: Set<string>): PostizPost[] {
  return posts.filter(p => p.state === "PUBLISHED" && !linked.has(p.id));
}

/** Drafts grouped the way Postiz's composer made them (one group = one composed post across accounts). */
export function draftGroups(posts: PostizPost[], linked: Set<string>) {
  const groups = new Map<string, PostizPost[]>();
  for (const p of posts) if (p.state === "DRAFT" && !linked.has(p.id)) groups.set(p.group, [...(groups.get(p.group) || []), p]);
  return [...groups.entries()].map(([group, ps]) => ({
    group, publishDate: ps[0].publishDate, preview: toLinks(ps)[0].preview,
    accounts: ps.map(p => ({ id: p.integration.id, name: p.integration.name, network: p.integration.providerIdentifier, channel: channelOf(p.integration.providerIdentifier) }))
  })).sort((a, b) => a.publishDate.localeCompare(b.publishDate));
}

/**
 * "Publish from the desk": one text (with an optional link) to a set of Postiz accounts, without
 * opening Postiz. Only offered for items that already passed the gate. Text and links only —
 * photos need a public media address Postiz does not have yet (PLAN.md §2).
 */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function buildDeskPost(o: { integrationIds: string[]; message: string; link?: string; when?: string }) {
  const text = [o.message.trim(), (o.link || "").trim()].filter(Boolean).join("\n\n");
  if (!text) throw new Error("a post needs a message or a link");
  if (!o.integrationIds.length) throw new Error("pick at least one account");
  const content = text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const when = o.when && o.when !== "now" ? new Date(o.when) : new Date(Date.now() + 60_000);
  if (isNaN(when.getTime())) throw new Error("the date is not valid");
  const group = `desk-${Date.now().toString(36)}`;
  return {
    type: o.when && o.when !== "now" ? "schedule" : "now",
    date: when.toISOString(), shortLink: false, tags: [],
    posts: o.integrationIds.map(id => ({ integration: { id }, group, value: [{ content, image: [] }], settings: {} }))
  };
}

// ---- client ------------------------------------------------------------------------------
const base = () => (process.env.POSTIZ_URL || "").trim().replace(/\/$/, "");
const key = () => (process.env.POSTIZ_API_KEY || "").trim();
export const postizPublicUrl = () => (process.env.POSTIZ_PUBLIC_URL || base()).replace(/\/$/, "");
export const postizConfigured = () => !!(base() && key());

async function api<T = any>(path: string, init: { method?: string; body?: any } = {}): Promise<T> {
  if (!postizConfigured()) throw new Error("Postiz is not configured — set POSTIZ_URL and POSTIZ_API_KEY in the FMS .env and restart.");
  const r = await fetch(`${base()}/api/public/v1${path}`, {
    method: init.method || "GET",
    headers: { Authorization: key(), "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Postiz ${r.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text as any; }
}
const iso = (d: Date) => d.toISOString();
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

export const postiz = {
  integrations: () => api<any[]>("/integrations"),
  /** Every post whose publish date falls in the window — drafts, queued, published and errored alike. */
  posts: (from = days(-30), to = days(120)) =>
    api<{ posts: PostizPost[] }>(`/posts?startDate=${encodeURIComponent(iso(from))}&endDate=${encodeURIComponent(iso(to))}`).then(r => r.posts || []),
  /** Returns one {postId, integration} per account. */
  create: (body: ReturnType<typeof buildDeskPost>) => api<{ postId: string; integration: string }[]>("/posts", { method: "POST", body }),
  schedule: (postId: string) => api(`/posts/${postId}/status`, { method: "PUT", body: { status: "schedule" } }),
  unschedule: (postId: string) => api(`/posts/${postId}/status`, { method: "PUT", body: { status: "draft" } })
};
