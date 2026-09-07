/**
 * What the Pages and Instagram accounts report about themselves.
 *
 * Every metric name below was probed against AnaHon's own Pages on 7 Sep 2026 and answered; the
 * ones Meta has retired (page_impressions, page_fans, page_fans_country, post_impressions,
 * post_engaged_users…) are gone from the Graph API and are deliberately absent. Ask for a retired
 * name and Meta refuses the whole call, which is why the lists here are explicit rather than
 * hopeful, and why the fetchers ask for each group separately: one bad group cannot blank the page.
 *
 * Pure helpers first (scripts/check-social.ts asserts them); the Graph calls follow.
 */
import { graph, type SocialAccountRow } from "./meta.js";

/** Facebook, one value per day. */
export const PAGE_DAY_METRICS = [
  "page_post_engagements", "page_views_total", "page_video_views",
  "page_daily_follows_unique", "page_daily_unfollows_unique", "page_total_actions"
];
/** Instagram, one value per day, asked plainly. */
export const IG_DAY_METRICS = ["reach", "follower_count"];
/** Instagram, one total for the whole window; Meta insists on metric_type=total_value for these. */
export const IG_TOTAL_METRICS = [
  "views", "likes", "comments", "shares", "saves", "total_interactions",
  "accounts_engaged", "profile_views", "website_clicks", "profile_links_taps", "replies"
];
export const IG_BREAKDOWNS = ["age", "gender", "country", "city"];
/** Per-post: what each network will say about a single piece. */
export const IG_MEDIA_METRICS = ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions"];
export const FB_POST_METRICS = ["post_reactions_by_type_total", "post_activity_by_action_type", "post_clicks_by_type", "post_video_views"];

export type Point = { date: string; value: number };
export type Series = { metric: string; points: Point[] };
export type Row = { key: string; value: number };

// ---- pure ---------------------------------------------------------------------------------
export const sumOf = (s?: Series) => (s?.points || []).reduce((t, p) => t + (Number(p.value) || 0), 0);
export const lastOf = (s?: Series) => (s?.points || []).at(-1)?.value ?? 0;
/** Meta answers a breakdown as nested dimension arrays; flatten to rows, biggest first. */
export function breakdownRows(total: any, limit = 0): Row[] {
  const results = total?.breakdowns?.[0]?.results || [];
  const rows: Row[] = results.map((r: any) => ({ key: String(r.dimension_values?.[0] ?? ""), value: Number(r.value) || 0 }))
    .filter((r: Row) => r.key).sort((a: Row, b: Row) => b.value - a.value);
  return limit ? rows.slice(0, limit) : rows;
}
/** A day range Meta accepts: it refuses windows longer than 93 days on page insights. */
export function windowFor(days: number, now = new Date()) {
  const d = Math.min(Math.max(Math.round(days) || 28, 1), 90);
  const until = new Date(now); until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until.getTime() - d * 86_400_000);
  return { days: d, since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}
/** Facebook counts reactions in an object; the desk wants one number and the pieces. */
export const sumValues = (o: any): number => Object.values(o || {}).reduce<number>((t, v) => t + (Number(v) || 0), 0);

const toSeries = (data: any[]): Series[] => (data || []).map(d => ({
  metric: String(d.name), points: (d.values || []).map((v: any) => ({ date: String(v.end_time || "").slice(0, 10), value: Number(v.value) || 0 }))
}));
const byMetric = (list: Series[]) => Object.fromEntries(list.map(s => [s.metric, s]));

// ---- Facebook -----------------------------------------------------------------------------
export async function pageInsights(a: SocialAccountRow, days: number) {
  const w = windowFor(days);
  const [profile, series] = await Promise.all([
    graph<any>(`/${a.id}`, { token: a.token, params: { fields: "name,fan_count,followers_count,talking_about_count,link,about,category,picture{url}" } }).catch(e => ({ error: e.message })),
    graph<any>(`/${a.id}/insights`, { token: a.token, params: { metric: PAGE_DAY_METRICS.join(","), period: "day", since: w.since, until: w.until } }).catch(e => ({ error: e.message, data: [] }))
  ]);
  const s = byMetric(toSeries(series.data));
  return {
    window: w, error: series.error || profile.error,
    profile: { name: profile.name, followers: profile.followers_count ?? profile.fan_count ?? null, talkingAbout: profile.talking_about_count ?? null, link: profile.link, about: profile.about, category: profile.category, picture: profile.picture?.data?.url },
    totals: {
      engagements: sumOf(s.page_post_engagements), views: sumOf(s.page_views_total), videoViews: sumOf(s.page_video_views),
      follows: sumOf(s.page_daily_follows_unique), unfollows: sumOf(s.page_daily_unfollows_unique), actions: sumOf(s.page_total_actions)
    },
    series: s
  };
}

/** The Page's own recent posts, each with what Meta will say about it. */
export async function pagePosts(a: SocialAccountRow, limit = 10) {
  const list: any = await graph(`/${a.id}/posts`, { token: a.token, params: { fields: "id,message,created_time,permalink_url,full_picture,status_type,shares,likes.summary(true),comments.summary(true)", limit: String(limit) } }).catch(e => ({ error: e.message, data: [] }));
  const posts = await Promise.all((list.data || []).map(async (p: any) => {
    const ins: any = await graph(`/${p.id}/insights`, { token: a.token, params: { metric: FB_POST_METRICS.join(",") } }).catch(() => ({ data: [] }));
    const m = Object.fromEntries((ins.data || []).map((d: any) => [d.name, d.values?.[0]?.value]));
    return {
      id: p.id, network: "facebook", text: p.message || "", date: p.created_time, permalink: p.permalink_url, picture: p.full_picture,
      likes: p.likes?.summary?.total_count ?? sumValues(m.post_reactions_by_type_total), comments: p.comments?.summary?.total_count ?? 0,
      shares: p.shares?.count ?? 0, videoViews: Number(m.post_video_views) || 0,
      clicks: sumValues(m.post_clicks_by_type), reactions: m.post_reactions_by_type_total || {}
    };
  }));
  return { error: list.error, posts };
}

// ---- Instagram ----------------------------------------------------------------------------
export async function igInsights(a: SocialAccountRow, days: number) {
  if (!a.igId) return null;
  const w = windowFor(days);
  const p = { since: w.since, until: w.until };
  const [profile, daily, totals, ...breakdowns] = await Promise.all([
    graph<any>(`/${a.igId}`, { token: a.token, params: { fields: "username,followers_count,follows_count,media_count,profile_picture_url,biography,website" } }).catch(e => ({ error: e.message })),
    graph<any>(`/${a.igId}/insights`, { token: a.token, params: { metric: IG_DAY_METRICS.join(","), period: "day", ...p } }).catch(e => ({ error: e.message, data: [] })),
    graph<any>(`/${a.igId}/insights`, { token: a.token, params: { metric: IG_TOTAL_METRICS.join(","), period: "day", metric_type: "total_value", ...p } }).catch(e => ({ error: e.message, data: [] })),
    ...IG_BREAKDOWNS.map(b => graph<any>(`/${a.igId}/insights`, { token: a.token, params: { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: b } }).catch(() => ({ data: [] })))
  ]);
  const s = byMetric(toSeries(daily.data));
  return {
    window: w, error: daily.error || totals.error || profile.error,
    profile: { username: profile.username, followers: profile.followers_count ?? null, following: profile.follows_count ?? null, posts: profile.media_count ?? null, picture: profile.profile_picture_url, bio: profile.biography, website: profile.website },
    totals: Object.fromEntries((totals.data || []).map((d: any) => [d.name, Number(d.total_value?.value) || 0])) as Record<string, number>,
    reach: sumOf(s.reach), newFollowers: sumOf(s.follower_count),
    series: s,
    audience: Object.fromEntries(IG_BREAKDOWNS.map((b, i) => [b, breakdownRows(breakdowns[i]?.data?.[0]?.total_value, b === "age" || b === "gender" ? 0 : 8)]))
  };
}

export async function igPosts(a: SocialAccountRow, limit = 10) {
  if (!a.igId) return { posts: [] };
  const list: any = await graph(`/${a.igId}/media`, { token: a.token, params: { fields: "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count", limit: String(limit) } }).catch(e => ({ error: e.message, data: [] }));
  const posts = await Promise.all((list.data || []).map(async (m: any) => {
    const reel = m.media_product_type === "REELS";
    const metrics = [...IG_MEDIA_METRICS, ...(reel ? ["ig_reels_avg_watch_time"] : [])];
    const ins: any = await graph(`/${m.id}/insights`, { token: a.token, params: { metric: metrics.join(",") } }).catch(() => ({ data: [] }));
    const v = Object.fromEntries((ins.data || []).map((d: any) => [d.name, Number(d.values?.[0]?.value ?? d.total_value?.value) || 0]));
    return {
      id: m.id, network: "instagram", kind: reel ? "Reel" : String(m.media_type || "").toLowerCase(), text: m.caption || "", date: m.timestamp,
      permalink: m.permalink, picture: m.thumbnail_url || m.media_url,
      reach: v.reach || 0, views: v.views || 0, likes: v.likes ?? m.like_count ?? 0, comments: v.comments ?? m.comments_count ?? 0,
      saves: v.saved || 0, shares: v.shares || 0, interactions: v.total_interactions || 0,
      watchSeconds: v.ig_reels_avg_watch_time ? Math.round(v.ig_reels_avg_watch_time / 1000) : null
    };
  }));
  return { error: list.error, posts };
}
