import React, { useState } from "react";
import { Lock } from "lucide-react";
import { withTicket } from "../docTicket";
import { SANCTIONS_RESULTS } from "../sources";

/**
 * Policy 010 §6 — the sealed file behind a confidential payment. Nothing here is in app state: the
 * file is fetched only when the ED or the Finance Officer asks for it, the server logs that opening,
 * and closing the panel drops it from memory. Anyone else sees only that the payment is confidential.
 */
export default function SealedSourcePanel({ exp, currentUser, acting, triggerToast, refreshState }: {
  exp: any; currentUser: any; acting: boolean; triggerToast: (m: string, k?: any) => void; refreshState: () => void;
}) {
  const [file, setFile] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const mayOpen = !acting && ["Super Admin", "Finance Officer"].includes(currentUser?.role);

  const open = async () => {
    const res = await fetch(`/api/sources/${encodeURIComponent(exp.sourceId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return triggerToast(data.error || "Refused.", "error");
    setFile(data);
    setForm({ realName: data.file.realName, contact: data.file.contact, idDocument: data.file.idDocument, sanctionsResult: data.file.sanctionsResult, sanctionsNote: data.file.sanctionsNote });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/sources/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: exp.sourceId, ...form }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return triggerToast(data.error || "Refused.", "error");
    triggerToast("Sealed file saved."); open();
  };
  const upload = (kind: string) => async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]; ev.target.value = "";
    if (!f) return;
    const base64: string = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = bad; r.readAsDataURL(f); });
    const res = await fetch("/api/sources/document", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: exp.sourceId, kind, expenseId: kind === "signed-receipt" ? exp.id : "", filename: f.name, mimeType: f.type, base64 }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return triggerToast(data.error || "Refused.", "error");
    triggerToast("Filed into the sealed file."); open(); refreshState();
  };

  const inp = "finance-input w-full text-xs";
  return (
    <div className="space-y-2 rounded-lg border border-slate-400 bg-slate-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700"><Lock className="inline h-3 w-3" /> Confidential payment — Policy 010 §6</p>
      <p className="text-xs text-slate-700">Paid to <b>{exp.title}</b>. Who this is lives only in the sealed file.{exp.evidence === "proof" ? "" : " The receipt signed in the real name is not filed yet."}</p>
      {!mayOpen && <p className="text-[11px] text-slate-500">Only the Executive Director (as themselves) and the Finance Officer open the sealed file.</p>}
      {mayOpen && !file && <button type="button" onClick={open} className="text-[11px] bg-slate-800 hover:bg-slate-950 text-white px-3 py-1.5 rounded font-medium">Open the sealed file (the opening is logged)</button>}
      {mayOpen && file && (
        <form onSubmit={save} className="space-y-2">
          <label className="block text-[11px] font-bold">Real name<input className={inp} value={form.realName || ""} onChange={e => setForm({ ...form, realName: e.target.value })} /></label>
          <label className="block text-[11px] font-bold">Contact<input className={inp} value={form.contact || ""} onChange={e => setForm({ ...form, contact: e.target.value })} /></label>
          <label className="block text-[11px] font-bold">Identity document (type and number)<input className={inp} value={form.idDocument || ""} onChange={e => setForm({ ...form, idDocument: e.target.value })} /></label>
          <label className="block text-[11px] font-bold">Sanctions check (Policy 001 §4)
            <select className={inp} value={form.sanctionsResult || ""} onChange={e => setForm({ ...form, sanctionsResult: e.target.value })}>
              {SANCTIONS_RESULTS.map(r => <option key={r} value={r}>{r || "— not recorded —"}</option>)}
            </select>
          </label>
          <label className="block text-[11px] font-bold">Note on the check<input className={inp} value={form.sanctionsNote || ""} onChange={e => setForm({ ...form, sanctionsNote: e.target.value })} /></label>
          {file.file.sanctionsCheckedAt && <p className="text-[10px] text-slate-500">Checked <span dir="ltr">{file.file.sanctionsCheckedAt.slice(0, 10)}</span></p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="text-[11px] bg-slate-800 text-white px-3 py-1.5 rounded font-medium">Save the sealed file</button>
            <button type="button" onClick={() => setFile(null)} className="text-[11px] border border-slate-400 px-3 py-1.5 rounded">Close it</button>
          </div>
          <p className="text-[11px] font-bold pt-1">Papers ({file.file.docs.length})</p>
          {file.file.docs.map((d: any) => (
            <a key={d.id} href={withTicket(`/api/sources/${encodeURIComponent(exp.sourceId)}/document/${d.id}`)} target="_blank" rel="noreferrer" className="block text-[11px] text-blue-700 underline">{d.kind} · {d.filename}</a>
          ))}
          <label className="block text-[11px] cursor-pointer">File the receipt signed in the real name, for {exp.voucherNo}<input type="file" className="block mt-1" onChange={upload("signed-receipt")} /></label>
          <label className="block text-[11px] cursor-pointer">File an identity paper<input type="file" className="block mt-1" onChange={upload("identity")} /></label>
          <p className="text-[11px] text-slate-600">Payments under this code name: {file.payments.map((p: any) => p.voucherNo).join(", ")}</p>
        </form>
      )}
    </div>
  );
}
