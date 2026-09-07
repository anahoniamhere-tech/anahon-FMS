import React, { useEffect, useState } from "react";

/**
 * What the networks say about a Page — read-only, on the Social desk.
 *
 * Every figure comes from Meta's own insights endpoints (src/insights.ts names the metrics that
 * still exist; Meta retired most of the old Page ones). Nothing here is computed by us except sums
 * over the chosen window, so a number on this panel is a number Meta would show in its own app.
 *
 * The drawing rules: one hue for every mark, identity carried by the label beside it and never by
 * colour alone; a tile where a single number is the answer; a table where the answer is a list.
 */
const INK = "#6D1A1A";                    // the brand maroon — one hue, used for every mark
const nf = new Intl.NumberFormat("en-US");
const n = (v: any) => nf.format(Math.round(Number(v) || 0));
const RANGES = [7, 28, 90];

const Tile = ({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-bold text-slate-900" dir="ltr">{value}</div>
    {note && <div className="text-[11px] text-slate-500">{note}</div>}
  </div>
);

/** One series over the window. No legend: the caption above it names the only line there is. */
function Spark({ points, label, total }: { points: { date: string; value: number }[]; label: string; total?: number }) {
  const vals = points.map(p => Number(p.value) || 0);
  const max = Math.max(...vals, 1), w = 260, h = 44, pad = 3;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(vals.length - 1, 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = vals.length - 1;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
        {total != null && <span className="text-sm font-bold text-slate-900" dir="ltr">{n(total)}</span>}
      </div>
      {vals.length > 1 ? (
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" role="img" aria-label={`${label}: ${vals.length} days, highest ${n(max)}`}>
          <title>{`${label} — highest ${n(max)} on ${points[vals.indexOf(max)]?.date || ""}`}</title>
          <path d={d} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(vals[last])} r="3" fill={INK} />
        </svg>
      ) : <p className="mt-2 text-xs text-slate-500">Not enough days yet.</p>}
      {vals.length > 1 && <div className="flex justify-between text-[10px] text-slate-400" dir="ltr"><span>{points[0]?.date}</span><span>{points[last]?.date}</span></div>}
    </div>
  );
}

/** Magnitude by category: one hue, every bar labelled, biggest first. */
function Bars({ title, rows, total, suffix }: { title: string; rows: { key: string; value: number }[]; total?: number; suffix?: string }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map(r => r.value), 1);
  const sum = total ?? rows.reduce((t, r) => t + r.value, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 space-y-1.5">
        {rows.map(r => (
          <div key={r.key} className="flex items-center gap-2 text-xs" title={`${r.key}: ${n(r.value)}${suffix || ""}`}>
            <span className="w-28 shrink-0 truncate text-slate-700" dir="auto">{r.key}</span>
            <span className="h-2.5 flex-1 rounded-sm bg-slate-100">
              <span className="block h-2.5 rounded-sm" style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: INK }} />
            </span>
            <span className="w-20 shrink-0 text-end tabular-nums text-slate-600" dir="ltr">{n(r.value)}{sum ? ` · ${Math.round((r.value / sum) * 100)}%` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InsightsPanel({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [days, setDays] = useState(28);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = (refresh = false) => {
    setBusy(true); setData(null);
    fetch(`/api/social/insights?accountId=${encodeURIComponent(accountId)}&days=${days}${refresh ? "&refresh=1" : ""}`)
      .then(r => r.json()).then(setData).catch(e => setData({ ok: false, error: e.message })).finally(() => setBusy(false));
  };
  useEffect(() => { if (accountId) load(); }, [accountId, days]);

  const page = data?.page, ig = data?.ig, posts: any[] = data?.posts || [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-900">Figures for {accountName}</h3>
        <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
          {RANGES.map(d => <button key={d} onClick={() => setDays(d)} className={`rounded-full px-3 py-1 ${days === d ? "bg-slate-900 text-white" : "text-slate-600"}`}>{d} days</button>)}
        </div>
        <button onClick={() => load(true)} disabled={busy} className="text-xs text-red-700 underline disabled:opacity-40">{busy ? "asking Meta…" : "refresh"}</button>
        {data?.cached && <span className="text-[11px] text-slate-400">from the last quarter-hour</span>}
      </div>

      {busy && <p className="text-xs text-slate-500">Meta answers slowly; this takes a few seconds.</p>}
      {data && !data.ok && <p className="text-xs text-red-700">{data.error}</p>}

      {page && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Facebook followers" value={n(page.profile?.followers)} note={page.profile?.category} />
            <Tile label="New follows" value={n(page.totals?.follows)} note={`${n(page.totals?.unfollows)} left`} />
            <Tile label="Page views" value={n(page.totals?.views)} />
            <Tile label="Post engagements" value={n(page.totals?.engagements)} />
            <Tile label="Video views" value={n(page.totals?.videoViews)} />
            <Tile label="Actions on the Page" value={n(page.totals?.actions)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Spark label="Page views a day" points={page.series?.page_views_total?.points || []} total={page.totals?.views} />
            <Spark label="Post engagements a day" points={page.series?.page_post_engagements?.points || []} total={page.totals?.engagements} />
            <Spark label="Video views a day" points={page.series?.page_video_views?.points || []} total={page.totals?.videoViews} />
          </div>
          {page.error && <p className="text-xs text-amber-700">Facebook: {page.error}</p>}
        </>
      )}

      {ig && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Instagram followers" value={n(ig.profile?.followers)} note={`@${ig.profile?.username} · ${n(ig.profile?.posts)} posts`} />
            <Tile label="New followers" value={n(ig.newFollowers)} />
            <Tile label="Accounts reached" value={n(ig.reach)} />
            <Tile label="Views" value={n(ig.totals?.views)} />
            <Tile label="Interactions" value={n(ig.totals?.total_interactions)} note={`${n(ig.totals?.likes)} likes · ${n(ig.totals?.comments)} comments`} />
            <Tile label="Profile visits" value={n(ig.totals?.profile_views)} note={`${n(ig.totals?.website_clicks)} website taps`} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Spark label="Accounts reached a day" points={ig.series?.reach?.points || []} total={ig.reach} />
            <Spark label="New followers a day" points={ig.series?.follower_count?.points || []} total={ig.newFollowers} />
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Shared, saved, replied</div>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <div className="flex justify-between"><span>Shares</span><span className="tabular-nums" dir="ltr">{n(ig.totals?.shares)}</span></div>
                <div className="flex justify-between"><span>Saves</span><span className="tabular-nums" dir="ltr">{n(ig.totals?.saves)}</span></div>
                <div className="flex justify-between"><span>Replies</span><span className="tabular-nums" dir="ltr">{n(ig.totals?.replies)}</span></div>
                <div className="flex justify-between"><span>Accounts engaged</span><span className="tabular-nums" dir="ltr">{n(ig.totals?.accounts_engaged)}</span></div>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Bars title="Followers by age" rows={ig.audience?.age || []} />
            <Bars title="Followers by gender" rows={(ig.audience?.gender || []).map((r: any) => ({ ...r, key: r.key === "F" ? "Women" : r.key === "M" ? "Men" : "Not stated" }))} />
            <Bars title="Top countries" rows={ig.audience?.country || []} />
            <Bars title="Top cities" rows={ig.audience?.city || []} />
          </div>
          {ig.error && <p className="text-xs text-amber-700">Instagram: {ig.error}</p>}
        </>
      )}

      {posts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Recent posts, and how they did</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[46rem] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Post", "Where", "When", "Reach", "Views", "Likes", "Comments", "Shares", "Saves"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-start font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((p: any) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="max-w-[18rem] px-2 py-1.5">
                      <a href={p.permalink} target="_blank" rel="noopener" className="line-clamp-2 text-slate-800 underline decoration-slate-300" dir="auto">{p.text || "(no caption)"}</a>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{p.network === "instagram" ? `Instagram${p.kind ? ` · ${p.kind}` : ""}` : "Facebook"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-500" dir="ltr">{String(p.date || "").slice(0, 10)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">{p.reach ? n(p.reach) : "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">{p.views || p.videoViews ? n(p.views || p.videoViews) : "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">{n(p.likes)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">{n(p.comments)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">{n(p.shares)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">{p.saves ? n(p.saves) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">Reach and saves are Instagram's; Facebook reports reactions, clicks and video views instead. Meta retired the rest of the Page figures.</p>
        </div>
      )}
    </div>
  );
}
