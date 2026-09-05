import React, { useMemo, useState } from "react";
import { NetworkContact, Engagement } from "../types";
import { STREAMS, ENGAGEMENT_KINDS, ENGAGEMENT_PARTS, CONTACT_KINDS } from "../constants";
import { SharedProps } from "./shared";
import { CONTACT_EDITORS } from "../roles";

const KINDS = CONTACT_KINDS;   // Trainer, Coach, Partner, Participant, Organiser, Speaker, Other
const STATUSES = ["New", "Contacted", "Warm", "Dormant"];

const STATUS_STYLE: Record<string, string> = {
  New: "bg-slate-100 text-slate-700",
  Contacted: "bg-blue-100 text-blue-800",
  Warm: "bg-green-100 text-green-800",
  Dormant: "bg-amber-100 text-amber-800"
};

const KIND_STYLE: Record<string, string> = {
  Trainer: "bg-red-100 text-red-800",
  Coach: "bg-rose-100 text-rose-800",
  Partner: "bg-teal-100 text-teal-800",
  Organiser: "bg-purple-100 text-purple-800",
  Speaker: "bg-indigo-100 text-indigo-800",
  Participant: "bg-slate-100 text-slate-700",
  Other: "bg-slate-100 text-slate-700"
};

const BLANK = {
  id: "", name: "", nameAr: "", org: "", role: "", country: "", email: "", phone: "",
  links: "", kind: "Participant", metAt: "", engagementId: "", metOn: "", stream: "",
  followUp: "", followUpBy: "", status: "New", notes: ""
};

// An engagement is a thing that happened: one we attended, or one we ran. Kept beside the
// people because you always arrive at one from the other.
const BLANK_ENG = {
  id: "", title: "", kind: "Conference", ourPart: "Attended", org: "", place: "",
  startDate: "", endDate: "", stream: "", projectId: "", outcome: "", notes: ""
};
const PART_STYLE: Record<string, string> = {
  Attended: "bg-slate-100 text-slate-700",
  Delivered: "bg-red-100 text-red-800",
  "Co-hosted": "bg-purple-100 text-purple-800",
  Sponsored: "bg-amber-100 text-amber-800",
};

export default function NetworkTab({ state, currentUser, refreshState, triggerToast }: SharedProps) {
  const [form, setForm] = useState<any>(BLANK);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [engForm, setEngForm] = useState<any>(null);   // null = the engagement form is closed
  const [engBusy, setEngBusy] = useState(false);

  const contacts: NetworkContact[] = state.networkContacts || [];
  const engagements: Engagement[] = state.engagements || [];
  const canEdit = CONTACT_EDITORS.includes(currentUser?.role);
  const today = new Date().toISOString().slice(0, 10);

  // The filter lists both: engagements that have a record, and the older free-text labels
  // of meetings that never got one.
  const events = useMemo(
    () => Array.from(new Set([...engagements.map(e => e.title), ...contacts.map(c => c.metAt)].filter(Boolean))).sort(),
    [contacts, engagements]
  );
  const engById = useMemo(() => new Map(engagements.map(e => [e.id, e])), [engagements]);
  /** What we call this meeting: the engagement's name when it has one, else the label typed on the contact. */
  const whereMet = (c: NetworkContact) => (c.engagementId && engById.get(c.engagementId)?.title) || c.metAt || "";
  const metCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contacts) if (c.engagementId) m.set(c.engagementId, (m.get(c.engagementId) || 0) + 1);
    return m;
  }, [contacts]);
  const projectName = (id?: string | null) =>
    id ? ((state.projects || []).find(p => p.id === id)?.code || "a project") : "";

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts
      .filter(c => !eventFilter || whereMet(c) === eventFilter)
      .filter(c => !kindFilter || c.kind === kindFilter)
      .filter(c => !needle || [c.name, c.nameAr, c.org, c.role, c.email, c.country, c.notes, c.followUp]
        .some(v => (v || "").toLowerCase().includes(needle)))
      .sort((a, b) => (b.metOn || "").localeCompare(a.metOn || "") || a.name.localeCompare(b.name));
  }, [contacts, q, eventFilter, kindFilter]);

  // A follow-up that has no date can still be owed; only a dated one can be overdue.
  const dueSoon = contacts.filter(c => c.followUpBy && c.followUpBy <= today && c.status !== "Dormant");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { triggerToast("A name is the one field we cannot infer later.", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/contacts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      triggerToast(`${form.id ? "Updated" : "Added"} ${data.contact.name}.`);
      setForm(BLANK); setOpen(false);
      await refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    } finally { setBusy(false); }
  };

  const remove = async (c: NetworkContact) => {
    if (!confirm(`Remove ${c.name} from the networking register?`)) return;
    try {
      const res = await fetch("/api/contacts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      triggerToast(`Removed ${c.name}.`);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const edit = (c: NetworkContact) => { setForm({ ...c, engagementId: c.engagementId || "" }); setOpen(true); };

  const saveEng = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engForm.title.trim()) { triggerToast("The engagement needs a name.", "error"); return; }
    setEngBusy(true);
    try {
      const res = await fetch("/api/engagements/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...engForm, projectId: engForm.projectId || null, user: currentUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      triggerToast(`${engForm.id ? "Updated" : "Added"} ${data.engagement.title}.`);
      setEngForm(null);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); } finally { setEngBusy(false); }
  };

  const removeEng = async (e: Engagement) => {
    const met = metCount.get(e.id) || 0;
    if (!confirm(`Remove "${e.title}" from the register?${met ? ` The ${met} contact(s) met there stay — only the link goes.` : ""}`)) return;
    try {
      const res = await fetch("/api/engagements/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, user: currentUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      triggerToast(`Removed ${e.title}.`);
      await refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const exportCsv = () => {
    const cols = ["name", "nameAr", "org", "role", "country", "email", "phone", "kind", "metAt", "metOn", "stream", "status", "followUp", "followUpBy", "links", "notes"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc((r as any)[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `anahon-network-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const field = (k: string, label: string, opts: any = {}) => (
    <div className={opts.wide ? "md:col-span-2" : ""}>
      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{label}</label>
      {opts.options ? (
        <select value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="finance-input w-full">
          {opts.blank && <option value=""></option>}
          {opts.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
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
          <h2 className="text-xl font-bold font-sans">Networking Register</h2>
          <p className="text-xs text-slate-500">
            People met at trainings, conferences and events — trainers, participants, organisers.
            Not a billing record: nothing here touches the ledger.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">
            Export CSV
          </button>
          {canEdit && (
            <button onClick={() => { setForm(BLANK); setOpen(!open); }}
              className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">
              {open ? "Close" : "+ Add contact"}
            </button>
          )}
        </div>
      </div>

      {/* Events and engagements — what we attended and what we ran. Above the people,
          because a contact is usually reached through the event you met them at. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold uppercase font-mono text-slate-800">🎓 Events &amp; engagements</h3>
          {canEdit && (
            <button
              onClick={() => setEngForm(engForm ? null : { ...BLANK_ENG })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >{engForm ? "Close" : "+ Add an event"}</button>
          )}
        </div>

        {engForm && (
          <form onSubmit={saveEng} className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">What was it</label>
              <input value={engForm.title} onChange={e => setEngForm({ ...engForm, title: e.target.value })}
                placeholder="ICFJ AI Boot Camp — Istanbul" className="finance-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Kind</label>
              <select value={engForm.kind} onChange={e => setEngForm({ ...engForm, kind: e.target.value })} className="finance-input w-full">
                {ENGAGEMENT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Our part</label>
              <select value={engForm.ourPart} onChange={e => setEngForm({ ...engForm, ourPart: e.target.value })} className="finance-input w-full">
                {ENGAGEMENT_PARTS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Run by</label>
              <input value={engForm.org} onChange={e => setEngForm({ ...engForm, org: e.target.value })}
                placeholder="ICFJ · Samir Kassir Foundation" className="finance-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Where</label>
              <input value={engForm.place} onChange={e => setEngForm({ ...engForm, place: e.target.value })}
                placeholder="Istanbul" className="finance-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">From</label>
              <input type="date" value={engForm.startDate} onChange={e => setEngForm({ ...engForm, startDate: e.target.value })} className="finance-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">To</label>
              <input type="date" value={engForm.endDate} onChange={e => setEngForm({ ...engForm, endDate: e.target.value })} className="finance-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Programme</label>
              <select value={engForm.stream} onChange={e => setEngForm({ ...engForm, stream: e.target.value })} className="finance-input w-full">
                <option value=""></option>
                {STREAMS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Project — only if it belongs to one</label>
              <select value={engForm.projectId} onChange={e => setEngForm({ ...engForm, projectId: e.target.value })} className="finance-input w-full">
                <option value="">— none, and that is normal —</option>
                {(state.projects || []).map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">What came of it</label>
              <textarea rows={2} value={engForm.outcome} onChange={e => setEngForm({ ...engForm, outcome: e.target.value })}
                placeholder="Three trainers met; NewsScope access to ask for; an Arabic data-journalism module to explore." className="finance-input w-full" />
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" disabled={engBusy} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40">
                {engBusy ? "Saving…" : engForm.id ? "Save changes" : "Add it"}
              </button>
              <button type="button" onClick={() => setEngForm(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        )}

        {engagements.length === 0 && !engForm && (
          <p className="mt-3 text-xs text-slate-500">
            Nothing recorded yet. Every training, coaching session, conference and workshop — the ones you attend and the ones you run — belongs here.
          </p>
        )}

        <div className="mt-2">
          {engagements.map(e => (
            <div key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-slate-100 py-2 last:border-0">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PART_STYLE[e.ourPart] || "bg-slate-100 text-slate-700"}`}>{e.ourPart}</span>
              <span className="text-[13px] font-medium text-slate-900">{e.title}</span>
              <span className="text-[11px] text-slate-500">
                {[e.kind, e.org, e.place, e.startDate && (e.endDate && e.endDate !== e.startDate ? `${e.startDate} → ${e.endDate}` : e.startDate)]
                  .filter(Boolean).join(" · ")}
              </span>
              {e.projectId
                ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">{projectName(e.projectId)}</span>
                : <span className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] text-slate-400">no project</span>}
              {(metCount.get(e.id) || 0) > 0 && (
                <button onClick={() => setEventFilter(e.title)} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-100">
                  {metCount.get(e.id)} met here
                </button>
              )}
              {canEdit && (
                <span className="ml-auto flex gap-2">
                  <button onClick={() => setEngForm({ ...e, projectId: e.projectId || "" })} className="text-[10px] font-bold text-slate-500 hover:text-red-700">Edit</button>
                  <button onClick={() => removeEng(e)} className="text-[10px] font-bold text-slate-400 hover:text-red-700">Remove</button>
                </span>
              )}
              {e.outcome && <p className="w-full text-[11px] leading-relaxed text-slate-500">{e.outcome}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Contacts", contacts.length],
          ["Trainers", contacts.filter(c => c.kind === "Trainer").length],
          ["Events & engagements", engagements.length],
          ["Follow-ups due", dueSoon.length]
        ].map(([label, n]) => (
          <div key={label as string} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
            <div className={`text-2xl font-bold ${label === "Follow-ups due" && (n as number) > 0 ? "text-red-600" : "text-slate-800"}`}>{n as number}</div>
          </div>
        ))}
      </div>

      {dueSoon.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <div className="font-bold text-red-800 text-xs uppercase mb-1">Follow-up owed</div>
          <ul className="space-y-1 text-red-900">
            {dueSoon.map(c => (
              <li key={c.id}>
                <strong>{c.name}</strong>{c.org ? ` — ${c.org}` : ""}: {c.followUp || "no note written"}
                <span className="text-xs text-red-700"> (due {c.followUpBy})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && canEdit && (
        <form onSubmit={save} className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3">
          {field("name", "Name")}
          {field("nameAr", "Name (Arabic)")}
          {field("org", "Organisation")}
          {field("role", "Role / title")}
          {field("country", "Country")}
          {field("email", "Email", { type: "email" })}
          {field("phone", "Phone / WhatsApp")}
          {field("kind", "Kind", { options: KINDS })}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Met at</label>
            <select
              value={form.engagementId}
              onChange={e => setForm({ ...form, engagementId: e.target.value })}
              className="finance-input w-full"
            >
              <option value="">— not from a recorded event —</option>
              {engagements.map(e => (
                <option key={e.id} value={e.id}>{e.title}{e.startDate ? ` · ${e.startDate}` : ""}</option>
              ))}
            </select>
            {!form.engagementId && field("metAt", "…or type where", { ph: "a call, an introduction, a corridor" })}
          </div>
          {field("metOn", "Met on", { type: "date" })}
          {field("stream", "Programme", { options: STREAMS, blank: true })}
          {field("status", "Status", { options: STATUSES })}
          {field("followUp", "Follow-up — what we want", { wide: true, ph: "Propose AnaHon as Arabic AI-for-newsrooms trainer" })}
          {field("followUpBy", "Follow-up by", { type: "date" })}
          <div />
          {field("links", "Links (one per line)", { wide: true, area: true })}
          {field("notes", "Notes", { wide: true, area: true, rows: 3 })}
          <div className="md:col-span-4 flex gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? "Saving…" : form.id ? "Update contact" : "Add contact"}
            </button>
            <button type="button" onClick={() => { setForm(BLANK); setOpen(false); }} className="px-4 py-2 text-sm rounded-lg border border-slate-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, org, country, notes…" className="finance-input flex-1" />
        <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} className="finance-input md:w-64">
          <option value="">All events</option>
          {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className="finance-input md:w-40">
          <option value="">All kinds</option>
          {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-600">
            <tr>
              <th className="text-start p-2">Name</th>
              <th className="text-start p-2">Organisation</th>
              <th className="text-start p-2">Kind</th>
              <th className="text-start p-2">Met at</th>
              <th className="text-start p-2">Contact</th>
              <th className="text-start p-2">Follow-up</th>
              <th className="text-start p-2">Status</th>
              {canEdit && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={canEdit ? 8 : 7} className="p-6 text-center text-slate-400 text-sm">
                No contacts yet. Add the name cards from the last event.
              </td></tr>
            )}
            {rows.map(c => (
              <tr key={c.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                <td className="p-2">
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  {c.nameAr && <div className="text-xs text-slate-500" dir="rtl">{c.nameAr}</div>}
                  {c.role && <div className="text-xs text-slate-500">{c.role}</div>}
                </td>
                <td className="p-2">
                  <div>{c.org || "—"}</div>
                  {c.country && <div className="text-xs text-slate-500">{c.country}</div>}
                </td>
                <td className="p-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${KIND_STYLE[c.kind] || KIND_STYLE.Other}`}>{c.kind}</span>
                  {c.stream && <div className="text-[10px] text-slate-500 mt-1">{c.stream}</div>}
                </td>
                <td className="p-2 text-xs">
                  <div>{whereMet(c) || "—"}</div>
                  {c.metOn && <div className="text-slate-500">{c.metOn}</div>}
                </td>
                <td className="p-2 text-xs">
                  {c.email && <div><a className="text-blue-700 hover:underline" href={`mailto:${c.email}`}>{c.email}</a></div>}
                  {c.phone && <div className="text-slate-600">{c.phone}</div>}
                  {c.links && c.links.split("\n").filter(Boolean).map(l => (
                    <div key={l}><a className="text-blue-700 hover:underline break-all" href={l} target="_blank" rel="noreferrer">{l}</a></div>
                  ))}
                  {!c.email && !c.phone && !c.links && "—"}
                </td>
                <td className="p-2 text-xs max-w-xs">
                  <div>{c.followUp || "—"}</div>
                  {c.followUpBy && (
                    <div className={c.followUpBy <= today && c.status !== "Dormant" ? "font-bold text-red-600" : "text-slate-500"}>
                      by {c.followUpBy}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[c.status] || STATUS_STYLE.New}`}>{c.status}</span>
                </td>
                {canEdit && (
                  <td className="p-2 whitespace-nowrap">
                    <button onClick={() => edit(c)} className="text-xs text-blue-700 hover:underline">Edit</button>
                    <button onClick={() => remove(c)} className="text-xs text-red-600 hover:underline ms-2">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.map(c => c.notes && (
        <details key={c.id} className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">{c.name} — notes</summary>
          <p className="mt-2 whitespace-pre-wrap text-slate-600 text-xs leading-relaxed">{c.notes}</p>
        </details>
      ))}
    </div>
  );
}
