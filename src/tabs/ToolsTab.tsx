import React, { useMemo, useState } from "react";
import { Tool } from "../types";
import { STREAMS } from "../constants";
import { SharedProps } from "./shared";
import { TOOL_EDITORS } from "../roles";

const CATEGORIES = [
  "Automation", "Models & APIs", "Research", "OSINT & Satellite",
  "Scraping & Export", "Media Monitoring", "Arabic & Voice", "Media & Production", "Other"
];
const STATUSES = ["Evaluating", "Trialling", "In use", "Dropped"];
const PRICING = ["Free", "Free tier", "Trial", "Paid", "Pay-as-you-go"];

const STATUS_STYLE: Record<string, string> = {
  "In use": "bg-green-100 text-green-800",
  Trialling: "bg-amber-100 text-amber-800",
  Evaluating: "bg-slate-100 text-slate-700",
  Dropped: "bg-slate-200 text-slate-500 line-through"
};
const PRICING_STYLE: Record<string, string> = {
  Paid: "bg-red-100 text-red-800",
  "Pay-as-you-go": "bg-orange-100 text-orange-800",
  Trial: "bg-amber-100 text-amber-800",
  "Free tier": "bg-blue-100 text-blue-800",
  Free: "bg-slate-100 text-slate-600"
};

const BLANK = {
  id: "", name: "", url: "", category: "Other", purpose: "", stream: "",
  status: "Evaluating", pricing: "Free", owner: "", source: "",
  addedOn: "", reviewBy: "", subscriptionId: "", notes: ""
};

export default function ToolsTab({ state, currentUser, refreshState, triggerToast, handleNavClick }: SharedProps) {
  const [form, setForm] = useState<any>(BLANK);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const tools: Tool[] = state.tools || [];
  const subs = state.subscriptions || [];
  const canEdit = TOOL_EDITORS.includes(currentUser?.role);
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tools
      .filter(t => !catFilter || t.category === catFilter)
      .filter(t => !statusFilter || t.status === statusFilter)
      .filter(t => !needle || [t.name, t.purpose, t.url, t.notes, t.source, t.owner, t.stream]
        .some(v => (v || "").toLowerCase().includes(needle)))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [tools, q, catFilter, statusFilter]);

  // A trial with a review date that has passed is money about to leak, or access about
  // to lapse. Either way somebody has to look at it.
  const dueReview = tools.filter(t => t.reviewBy && t.reviewBy <= today && t.status !== "Dropped");
  const costing = tools.filter(t => ["Paid", "Pay-as-you-go", "Trial"].includes(t.pricing) && t.status !== "Dropped");
  const unlinked = costing.filter(t => !t.subscriptionId);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { triggerToast("A tool needs a name.", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/tools/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      triggerToast(`${form.id ? "Updated" : "Registered"} ${data.tool.name}.`);
      setForm(BLANK); setOpen(false);
      await refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    } finally { setBusy(false); }
  };

  const remove = async (t: Tool) => {
    if (!confirm(`Remove ${t.name} from the tool register?`)) return;
    try {
      const res = await fetch("/api/tools/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      triggerToast(`Removed ${t.name}.`);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const exportCsv = () => {
    const cols = ["name", "url", "category", "purpose", "stream", "status", "pricing", "owner", "source", "addedOn", "reviewBy", "subscriptionId", "notes"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc((r as any)[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `anahon-tools-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const field = (k: string, label: string, opts: any = {}) => (
    <div className={opts.wide ? "md:col-span-2" : ""}>
      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{label}</label>
      {opts.options ? (
        <select value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="finance-input w-full">
          {opts.blank && <option value=""></option>}
          {opts.options.map((o: any) =>
            typeof o === "string"
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : opts.area ? (
        <textarea rows={opts.rows || 2} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
          placeholder={opts.ph} className="finance-input w-full" />
      ) : (
        <input type={opts.type || "text"} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
          placeholder={opts.ph} className="finance-input w-full" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans">Tool Register</h2>
          <p className="text-xs text-slate-500">
            Software we evaluate and use. A tool becomes a <strong>Subscription</strong> only once it costs
            money — until then this register is not a financial record.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">Export CSV</button>
          {canEdit && (
            <button onClick={() => { setForm(BLANK); setOpen(!open); }}
              className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">
              {open ? "Close" : "+ Add tool"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Registered", tools.length, false],
          ["In use", tools.filter(t => t.status === "In use").length, false],
          ["Costs money", costing.length, false],
          ["Review due", dueReview.length, dueReview.length > 0]
        ].map(([label, n, alert]) => (
          <div key={label as string} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">{label as string}</div>
            <div className={`text-2xl font-bold ${alert ? "text-red-600" : "text-slate-800"}`}>{n as number}</div>
          </div>
        ))}
      </div>

      {dueReview.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <div className="font-bold text-red-800 text-xs uppercase mb-1">Review date passed</div>
          <ul className="space-y-1 text-red-900">
            {dueReview.map(t => (
              <li key={t.id}><strong>{t.name}</strong> — {t.status}, {t.pricing}. Due {t.reviewBy}.</li>
            ))}
          </ul>
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <div className="font-bold text-amber-800 text-xs uppercase mb-1">Costs money, no subscription record</div>
          <p className="text-amber-900 text-xs">
            {unlinked.map(t => t.name).join(", ")} — a charge the books do not know about yet.{" "}
            <button onClick={() => handleNavClick("vendors")} className="underline font-semibold">Open subscriptions</button>
          </p>
        </div>
      )}

      {open && canEdit && (
        <form onSubmit={save} className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3">
          {field("name", "Tool name")}
          {field("url", "URL", { wide: true, ph: "https://" })}
          {field("category", "Category", { options: CATEGORIES })}
          {field("purpose", "What we use it for", { wide: true })}
          {field("stream", "Programme", { options: STREAMS, blank: true })}
          {field("owner", "Owner")}
          {field("status", "Status", { options: STATUSES })}
          {field("pricing", "Pricing", { options: PRICING })}
          {field("addedOn", "Added on", { type: "date" })}
          {field("reviewBy", "Review by", { type: "date" })}
          {field("subscriptionId", "Linked subscription", {
            options: [...subs.map((s: any) => ({ value: s.id, label: `${s.name} — ${s.currency} ${s.amount}` }))],
            blank: true
          })}
          {field("source", "Source — where we found it", { wide: true, ph: "ICFJ AI Boot Camp — Istanbul" })}
          {field("notes", "Notes", { wide: true, area: true, rows: 3 })}
          <div className="md:col-span-4 flex gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? "Saving…" : form.id ? "Update tool" : "Register tool"}
            </button>
            <button type="button" onClick={() => { setForm(BLANK); setOpen(false); }} className="px-4 py-2 text-sm rounded-lg border border-slate-300">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, purpose, notes…" className="finance-input flex-1" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="finance-input md:w-56">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="finance-input md:w-40">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-600">
            <tr>
              <th className="text-start p-2">Tool</th>
              <th className="text-start p-2">Category</th>
              <th className="text-start p-2">What we use it for</th>
              <th className="text-start p-2">Status</th>
              <th className="text-start p-2">Pricing</th>
              <th className="text-start p-2">Owner</th>
              <th className="text-start p-2">Review</th>
              {canEdit && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={canEdit ? 8 : 7} className="p-6 text-center text-slate-400 text-sm">No tools registered yet.</td></tr>
            )}
            {rows.map(t => (
              <tr key={t.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                <td className="p-2">
                  <div className="font-semibold text-slate-800">{t.name}</div>
                  {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline break-all">{t.url.replace(/^https?:\/\//, "")}</a>}
                </td>
                <td className="p-2 text-xs">
                  <div>{t.category}</div>
                  {t.stream && <div className="text-slate-500">{t.stream}</div>}
                </td>
                <td className="p-2 text-xs max-w-sm">{t.purpose || "—"}</td>
                <td className="p-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[t.status] || STATUS_STYLE.Evaluating}`}>{t.status}</span>
                </td>
                <td className="p-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${PRICING_STYLE[t.pricing] || PRICING_STYLE.Free}`}>{t.pricing}</span>
                  {t.subscriptionId && (
                    <div className="text-[10px] text-slate-500 mt-1">
                      → {subs.find((s: any) => s.id === t.subscriptionId)?.name || t.subscriptionId}
                    </div>
                  )}
                </td>
                <td className="p-2 text-xs">{t.owner || "—"}</td>
                <td className="p-2 text-xs">
                  {t.reviewBy
                    ? <span className={t.reviewBy <= today && t.status !== "Dropped" ? "font-bold text-red-600" : "text-slate-600"}>{t.reviewBy}</span>
                    : "—"}
                </td>
                {canEdit && (
                  <td className="p-2 whitespace-nowrap">
                    <button onClick={() => { setForm({ ...t }); setOpen(true); }} className="text-xs text-blue-700 hover:underline">Edit</button>
                    <button onClick={() => remove(t)} className="text-xs text-red-600 hover:underline ms-2">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.filter(t => t.notes || t.source).map(t => (
        <details key={t.id} className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">{t.name} — notes</summary>
          {t.source && <p className="mt-2 text-[11px] text-slate-500">Source: {t.source}</p>}
          {t.notes && <p className="mt-1 whitespace-pre-wrap text-slate-600 text-xs leading-relaxed">{t.notes}</p>}
        </details>
      ))}
    </div>
  );
}
