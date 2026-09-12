import React, { useEffect, useState } from "react";
import { ic } from "../nav";
import { TriangleAlert } from "lucide-react";

/**
 * Connected Facebook Pages and their Instagram accounts — configuration, not daily work, so since
 * 12 Sep 2026 it lives in Settings & compliance rather than in the newsroom (the Newsroom keeps a
 * read-only health line). Connecting, reconnecting for a missing scope and disconnecting are all
 * here; nothing about what may be published moved with it.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

function PageLogo({ src }: { src?: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img src={src} alt="" onError={() => setBad(true)} className="h-8 w-8 rounded-full" /> : <span className="h-8 w-8 rounded-full bg-slate-100" />;
}

export default function MetaAccounts({ canManage, triggerToast, t }: {
  canManage: boolean; triggerToast: (m: string, k?: string) => void; t: (s: string) => string;
}) {
  const [status, setStatus] = useState<any>(null);
  const [withIg, setWithIg] = useState(false);
  const loadStatus = () => fetch("/api/social/status").then(r => r.json()).then(setStatus).catch(() => setStatus({ ok: false, error: "unreachable" }));
  useEffect(() => {
    loadStatus();
    // back from Meta's dialog: the callback reports through ?connect=
    const u = new URL(window.location.href); const msg = u.searchParams.get("connect");
    if (msg) { triggerToast(msg, /expired|not return|no Pages|Error|error/i.test(msg) ? "error" : "success"); u.searchParams.delete("connect"); window.history.replaceState({}, "", u.toString()); }
  }, []);
  const accounts: any[] = status?.accounts || [];

  const connect = async () => {
    const r = await fetch(`/api/social/meta/connect${withIg ? "?ig=1" : ""}`).then(r => r.json()).catch(e => ({ error: e.message }));
    if (r.url) window.location.href = r.url; else triggerToast(r.error || "Could not start the connection", "error");
  };
  const removeAccount = async (a: any) => {
    if (window.prompt(`Disconnect ${a.name}? Pending posts for it are cancelled.\nType DISCONNECT to confirm:`) !== "DISCONNECT") return;
    const r = await post("/api/social/accounts/remove", { id: a.id });
    if (r.success) { triggerToast("Disconnected"); loadStatus(); } else triggerToast(r.error || "Failed", "error");
  };

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
        {t("Connected Pages")} — Facebook & Instagram
      </h4>
      <p className="text-[11px] text-slate-500">
        {t("Which accounts the Newsroom may publish to. What may be published is the Newsroom's gate, not this screen.")}
      </p>
      <div className={`space-y-2 rounded-lg border-s-4 p-3 text-xs ${!status ? "border-slate-300" : accounts.length && accounts.every(a => a.status?.valid) ? "border-emerald-500" : "border-amber-500"}`}>
        <div className="flex flex-wrap items-center gap-2">
          {!status ? <span className="text-slate-500">Checking…</span> : !accounts.length && <span className="text-slate-500">none yet</span>}
          {canManage && (
            <span className="ms-auto flex items-center gap-2">
              <label className="flex items-center gap-1 text-slate-600"><input type="checkbox" checked={withIg} onChange={e => setWithIg(e.target.checked)} /> include Instagram</label>
              <button onClick={connect} disabled={status && !status.configured} title={status && !status.configured ? "META_APP_ID, META_APP_SECRET and FMS_PUBLIC_URL must be set on the server" : ""} className="rounded bg-red-700 px-3 py-1 font-bold text-white disabled:opacity-40">Connect a Facebook Page</button>
            </span>
          )}
        </div>
        {status && !status.configured && <p className="text-amber-700">The server has no Meta app configured (META_APP_ID / META_APP_SECRET / FMS_PUBLIC_URL). Set them in the FMS .env.</p>}
        {accounts.map(a => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
            <PageLogo src={a.picture} />
            <b dir="auto">{a.name}</b>
            {a.status?.followers != null && <span className="text-slate-500"><span dir="ltr">{a.status.followers.toLocaleString()}</span> followers</span>}
            {a.igUsername ? <span className="rounded-full bg-pink-50 px-2 py-0.5 text-pink-700">Instagram @{a.igUsername}{a.status?.igFollowers != null && <> · <span dir="ltr">{a.status.igFollowers.toLocaleString()}</span></>}{a.status?.igQuotaUsed != null && <> · <span dir="ltr">{a.status.igQuotaUsed}/{a.status.igQuotaTotal ?? "?"}</span> today</>}</span> : <span className="text-slate-400">no Instagram linked</span>}
            <span className={`rounded-full px-2 py-0.5 font-bold ${a.status?.valid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{a.status?.valid ? `token ok · expires ${a.status.expires === "never" ? "never" : a.status.expires.slice(0, 10)}` : `token invalid${a.status?.error ? `: ${a.status.error}` : ""}`}</span>
            {a.status?.valid && !a.status?.canPublishFB && <span className="text-amber-700 inline-flex items-center gap-1">{ic(TriangleAlert, "h-3 w-3")}no pages_manage_posts — reconnect</span>}
            {a.igId && a.status?.valid && !a.status?.canPublishIG && <span className="text-amber-700 inline-flex items-center gap-1">{ic(TriangleAlert, "h-3 w-3")}no instagram_content_publish — reconnect with Instagram ticked</span>}
            {canManage && <button onClick={() => removeAccount(a)} className="ms-auto text-red-700 underline">disconnect</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
