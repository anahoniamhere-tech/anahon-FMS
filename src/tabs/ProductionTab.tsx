import { useState, FormEvent } from "react";
import { Trash2, Download } from "lucide-react";
import { Client, Quotation, QuotationItem } from "../types";
import { EXTRAS_DEFAULT, FINANCIAL_TERMS, PRODUCTION_NOTE, QUOTE_STATUSES, SERVICE_CATALOG, TECHNICAL_NOTE } from "../constants";
import { tr } from "../i18n";
import { SharedProps } from "./shared";
import { FINANCE, MANAGERS } from "../roles";
import { withTicket } from "../docTicket";

export default function ProductionTab({ currentUser, formatIn, formatUSD, openDoc, refreshState, state, t, triggerToast }: SharedProps) {
  // Production stream: client / quotation being added-edited (null = form closed)
  const [clientForm, setClientForm] = useState<Partial<Client> | null>(null);

  const [quoteForm, setQuoteForm] = useState<Partial<Quotation> | null>(null);

  // Off-bank settlement (OMT / BOB / Whish / cash) being recorded for a quotation
  const [settleForm, setSettleForm] = useState<{ q: Quotation; method: string; reference: string; date: string; amount: number } | null>(null);
  // Receipt being issued for a quotation (null = form closed). Separate from settlement:
  // the receipt is written first, then its number is what gets entered as the evidence.
  const [receiptForm, setReceiptForm] = useState<{ q: Quotation; date: string; amount: number; method: string; receivedBy: string } | null>(null);

  // ── Production stream handlers (clients & quotations) ────────────────────
  const saveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientForm?.name) {
      triggerToast("Client name is required.", "error");
      return;
    }
    try {
      const res = await fetch("/api/clients/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...clientForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save client");
      triggerToast(`Client ${clientForm.id ? "updated" : "registered"}: ${clientForm.name}`);
      setClientForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const saveQuotation = async (e: FormEvent) => {
    e.preventDefault();
    if (!quoteForm?.clientId || !quoteForm?.title) {
      triggerToast("A quotation needs a client and a title.", "error");
      return;
    }
    try {
      const res = await fetch("/api/quotations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quoteForm, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save quotation");
      triggerToast(`Quotation ${quoteForm.id ? "updated" : "created"}: ${quoteForm.title}`);
      setQuoteForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const issueReceipt = async (e: FormEvent) => {
    e.preventDefault();
    if (!receiptForm) return;
    try {
      const res = await fetch("/api/quotations/issue-receipt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: receiptForm.q.id, date: receiptForm.date, amount: receiptForm.amount,
          method: receiptForm.method, receivedBy: receiptForm.receivedBy, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue receipt");
      triggerToast(`Receipt ${data.receiptNo} issued — enter it as the receipt number when recording the settlement.`);
      setReceiptForm(null);
      refreshState();
      openDoc({ id: data.docId, filename: data.filename, mimeType: data.mimeType });
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  /** Attach the client's SIGNED copy to a quotation. The generated document is what we
   *  sent; this is what came back with signatures and stamp on it — the thing that turns
   *  a quotation into a booked job, and the only acceptance evidence an auditor accepts. */
  const attachSignedCopy = async (q: Quotation, file: File) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/document/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, mimeType: file.type || "application/octet-stream",
          sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`, base64,
          category: "Quotation (Signed)",
          linkedRecordType: "Quotation", linkedRecordId: q.id, user: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      triggerToast(data.duplicate
        ? `Already on file as ${data.doc?.refNo || "an existing document"} — not stored twice.`
        : `Signed copy filed against ${q.quoteNo}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  // Line-item helpers for the quotation form. Total is always derived, never typed.
  const quoteItems = quoteForm?.items || [];

  const quoteTotal = quoteItems.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 1), 0);

  const setQuoteItem = (i: number, patch: Partial<QuotationItem>) => {
    const items = quoteItems.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    setQuoteForm({ ...quoteForm, items });
  };

  const pickCatalogService = (i: number, name: string) => {
    const cat = SERVICE_CATALOG.find(c => c.service === name);
    setQuoteItem(i, cat ? { service: cat.service, description: cat.description, output: cat.output, unitPrice: cat.unitPrice } : { service: name });
  };

  const quoteTerms = quoteForm?.terms || {};

  const setQuoteTerms = (patch: Partial<Quotation["terms"]>) => setQuoteForm({ ...quoteForm, terms: { ...quoteTerms, ...patch } });

  const generateQuoteDoc = async (q: Quotation) => {
    try {
      const res = await fetch("/api/quotations/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate document");
      triggerToast(`Quotation document ${q.quoteNo} filed to vault (GENERAL/Quotations).`);
      // Pass the real filename: the viewer picks its renderer from the extension, and a
      // bare "document" falls through to the download fallback instead of showing the quote.
      openDoc({ id: data.docId, filename: data.filename || "quotation.html", mimeType: data.mimeType || "text/html" });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const moveQuotation = async (q: Quotation, status: string) => {
    try {
      const res = await fetch("/api/quotations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q, status, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update quotation");
      triggerToast(`${q.quoteNo} → ${status}`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const linkQuotePayment = async (q: Quotation, txId: string) => {
    try {
      const res = await fetch("/api/quotations/link-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, txId, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to link payment");
      triggerToast(txId ? `${q.quoteNo} settled by bank deposit — status Paid.` : `${q.quoteNo} payment link removed.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const submitOffbankSettlement = async (e: FormEvent) => {
    e.preventDefault();
    if (!settleForm) return;
    try {
      const res = await fetch("/api/quotations/settle-offbank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: settleForm.q.id,
          method: settleForm.method,
          reference: settleForm.reference,
          date: settleForm.date,
          amount: settleForm.amount,
          user: currentUser
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to record settlement");
      triggerToast(`${settleForm.q.quoteNo} settled via ${settleForm.method} — recorded on the off-bank evidence account.`);
      setSettleForm(null);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const deleteQuotation = async (q: Quotation) => {
    if (!window.confirm(`Delete quotation ${q.quoteNo} — "${q.title}"?`)) return;
    try {
      const res = await fetch("/api/quotations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete quotation");
      triggerToast(`Deleted ${q.quoteNo}.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };
  return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Production Stream — Clients & Quotations")}</h2>
                <p className="text-xs text-slate-500">
                  Earned income: clients pay AnaHon for production services. A quotation is never income —
                  income exists only when the client's payment shows on a BLOM statement (4200 service income).
                </p>
              </div>

              {/* Clients register */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-800 uppercase font-mono">👥 Client Log</h3>
                  {MANAGERS.includes(currentUser.role) && !clientForm && (
                    <button onClick={() => setClientForm({})} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">
                      ➕ Register Client
                    </button>
                  )}
                </div>

                {clientForm && (
                  <form onSubmit={saveClient} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">{clientForm.id ? "✏️ Edit Client" : "➕ New Client"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="cli-name" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Client Name")}</label>
                        <input id="cli-name" type="text" placeholder="e.g. Local NGO / company" value={clientForm.name || ""} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-contact" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Contact Person")}</label>
                        <input id="cli-contact" type="text" value={clientForm.contact || ""} onChange={e => setClientForm({ ...clientForm, contact: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-email" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Email")}</label>
                        <input id="cli-email" type="email" value={clientForm.email || ""} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-phone" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Phone")}</label>
                        <input id="cli-phone" type="text" value={clientForm.phone || ""} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-taxid" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Tax ID (for invoicing)")}</label>
                        <input id="cli-taxid" type="text" value={clientForm.taxId || ""} onChange={e => setClientForm({ ...clientForm, taxId: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="cli-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes")}</label>
                        <input id="cli-notes" type="text" value={clientForm.notes || ""} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save Client</button>
                      <button type="button" onClick={() => setClientForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {state.clients.map(c => {
                    const cQuotes = state.quotations.filter(q => q.clientId === c.id);
                    const acceptedTotal = cQuotes.filter(q => ["Accepted", "Invoiced", "Paid"].includes(q.status)).reduce((s, q) => s + q.amount, 0);
                    return (
                      <div key={c.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                          <button onClick={() => setClientForm({ ...c })} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Edit client" aria-label={`Edit ${c.name}`}>✏️</button>
                        </div>
                        {(c.contact || c.email || c.phone) && (
                          <p className="text-xs text-slate-500">{[c.contact, c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        )}
                        {c.taxId && <p className="text-[10px] text-slate-400 font-mono">Tax ID: {c.taxId}</p>}
                        {c.notes && (
                          <div className="mt-2 p-2 bg-slate-50 border border-slate-105 rounded text-[11px] text-slate-600 leading-relaxed italic">ℹ️ {c.notes}</div>
                        )}
                        <div className="border-t border-slate-100 mt-3 pt-2 flex justify-between text-[10px]">
                          <span className="text-slate-400 uppercase">{cQuotes.length} quotation{cQuotes.length === 1 ? "" : "s"}</span>
                          <strong className="font-mono text-slate-800">accepted: {formatUSD(acceptedTotal)}</strong>
                        </div>
                      </div>
                    );
                  })}
                  {state.clients.length === 0 && <p className="text-xs text-slate-400 italic">No clients registered yet.</p>}
                </div>
              </div>

              {/* Quotations log */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-800 uppercase font-mono">📄 Quotations</h3>
                  {MANAGERS.includes(currentUser.role) && !quoteForm && (
                    <button onClick={() => setQuoteForm({
                      status: "Draft",
                      currency: "USD",
                      date: new Date().toISOString().slice(0, 10),
                      items: [{ service: "", description: "", output: "", unitPrice: 0, qty: 1 }],
                      terms: { financial: FINANCIAL_TERMS[1], production: PRODUCTION_NOTE, technical: TECHNICAL_NOTE, extras: EXTRAS_DEFAULT }
                    })} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all" disabled={state.clients.length === 0}>
                      ➕ New Quotation
                    </button>
                  )}
                </div>

                {quoteForm && (
                  <form onSubmit={saveQuotation} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">{quoteForm.id ? `✏️ Edit ${quoteForm.quoteNo}` : "➕ New Quotation"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="qt-client" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Client")}</label>
                        <select id="qt-client" value={quoteForm.clientId || ""} onChange={e => setQuoteForm({ ...quoteForm, clientId: e.target.value })} className="finance-input w-full text-xs">
                          <option value="">— Select client —</option>
                          {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="qt-title" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Service / Title")}</label>
                        <input id="qt-title" type="text" placeholder="e.g. Event video production — 2-day shoot + edit" value={quoteForm.title || ""} onChange={e => setQuoteForm({ ...quoteForm, title: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div>
                        <label htmlFor="qt-status" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Status")}</label>
                        <select id="qt-status" value={quoteForm.status || "Draft"} onChange={e => setQuoteForm({ ...quoteForm, status: e.target.value as Quotation["status"] })} className="finance-input w-full text-xs">
                          {QUOTE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="qt-no" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Quote № (automatic)")}</label>
                        <input id="qt-no" type="text" placeholder={currentUser.role === "Super Admin" ? "blank = auto · master override" : "assigned automatically"} value={quoteForm.quoteNo || ""} onChange={e => setQuoteForm({ ...quoteForm, quoteNo: e.target.value })} disabled={!!quoteForm.id || currentUser.role !== "Super Admin"} className="finance-input w-full font-mono text-xs disabled:opacity-60" />
                      </div>
                      <div>
                        <label htmlFor="qt-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{quoteItems.length ? "Total (from lines)" : "Amount"}</label>
                        <input id="qt-amount" type="number" min="0" step="any" value={quoteItems.length ? quoteTotal : (quoteForm.amount ?? "")} onChange={e => setQuoteForm({ ...quoteForm, amount: Number(e.target.value) })} disabled={quoteItems.length > 0} className="finance-input w-full font-mono text-xs disabled:opacity-60" />
                      </div>
                      <div>
                        <label htmlFor="qt-currency" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Currency")}</label>
                        <select id="qt-currency" value={quoteForm.currency || "USD"} onChange={e => setQuoteForm({ ...quoteForm, currency: e.target.value })} className="finance-input w-full text-xs">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="qt-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Quote Date")}</label>
                        <input id="qt-date" type="date" value={quoteForm.date || ""} onChange={e => setQuoteForm({ ...quoteForm, date: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="qt-valid" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Valid Until")}</label>
                        <input id="qt-valid" type="date" value={quoteForm.validUntil || ""} onChange={e => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="qt-desc" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Scope / Line Breakdown")}</label>
                        <textarea id="qt-desc" rows={2} placeholder="What's included — deliverables, days, crew, equipment…" value={quoteForm.description || ""} onChange={e => setQuoteForm({ ...quoteForm, description: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="qt-notes" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Notes")}</label>
                        <textarea id="qt-notes" rows={2} value={quoteForm.notes || ""} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} className="finance-input w-full font-sans text-xs" />
                      </div>

                      {/* Line items — pick from the real AnaHon service catalog, everything editable */}
                      <div className="md:col-span-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Line Items</span>
                          <button type="button" onClick={() => setQuoteForm({ ...quoteForm, items: [...quoteItems, { service: "", description: "", output: "", unitPrice: 0, qty: 1 }] })} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-all">
                            ➕ Add line
                          </button>
                        </div>
                        {quoteItems.map((it, i) => (
                          <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="col-span-2 md:col-span-3">
                              <label htmlFor={`qi-svc-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Service")}</label>
                              <select id={`qi-svc-${i}`} value={SERVICE_CATALOG.some(c => c.service === it.service) ? it.service : "__custom"} onChange={e => pickCatalogService(i, e.target.value === "__custom" ? "" : e.target.value)} className="finance-input w-full text-xs mb-1">
                                <option value="__custom">✏️ Custom service…</option>
                                {SERVICE_CATALOG.map(c => <option key={c.service} value={c.service}>{c.service} — ${c.unitPrice}</option>)}
                              </select>
                              <input aria-label={`Service name, line ${i + 1}`} type="text" placeholder="Service name" value={it.service} onChange={e => setQuoteItem(i, { service: e.target.value })} className="finance-input w-full text-xs" />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                              <label htmlFor={`qi-desc-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Description")}</label>
                              <textarea id={`qi-desc-${i}`} rows={3} value={it.description} onChange={e => setQuoteItem(i, { description: e.target.value })} className="finance-input w-full text-xs" />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                              <label htmlFor={`qi-out-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Output / Deliverables")}</label>
                              <textarea id={`qi-out-${i}`} rows={3} value={it.output} onChange={e => setQuoteItem(i, { output: e.target.value })} className="finance-input w-full text-xs" />
                            </div>
                            <div className="md:col-span-1">
                              <label htmlFor={`qi-price-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Unit")}</label>
                              <input id={`qi-price-${i}`} type="number" min="0" step="any" value={it.unitPrice} onChange={e => setQuoteItem(i, { unitPrice: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                            </div>
                            <div className="md:col-span-1">
                              <label htmlFor={`qi-qty-${i}`} className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Qty")}</label>
                              <input id={`qi-qty-${i}`} type="number" min="1" step="1" value={it.qty} onChange={e => setQuoteItem(i, { qty: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                            </div>
                            <div className="md:col-span-1 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-1">
                              <span className="text-[11px] font-mono font-bold text-slate-800 md:mt-6">{((Number(it.unitPrice) || 0) * (Number(it.qty) || 1)).toLocaleString()}</span>
                              <button type="button" onClick={() => setQuoteForm({ ...quoteForm, items: quoteItems.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Remove line" aria-label={`Remove line ${i + 1}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {quoteItems.length > 0 && (
                          <p className="text-right text-xs font-mono font-bold text-slate-800">TOTAL: {quoteForm.currency || "USD"} {quoteTotal.toLocaleString()}</p>
                        )}
                      </div>

                      {/* Standard note blocks — printed on the generated document */}
                      <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="md:col-span-2">
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Standard Notes (printed on the document)</span>
                        </div>
                        <div>
                          <label htmlFor="qt-fin" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Financial Terms")}</label>
                          <select id="qt-fin" value={quoteTerms.financial && FINANCIAL_TERMS.includes(quoteTerms.financial) ? quoteTerms.financial : (quoteTerms.financial ? "__custom" : "")} onChange={e => { if (e.target.value !== "__custom") setQuoteTerms({ financial: e.target.value }); }} className="finance-input w-full text-xs mb-1">
                            <option value="">— None —</option>
                            {FINANCIAL_TERMS.map(t => <option key={t} value={t}>{t.slice(0, 70)}…</option>)}
                            <option value="__custom">✏️ Custom…</option>
                          </select>
                          <textarea aria-label="Financial terms text" rows={2} value={quoteTerms.financial || ""} onChange={e => setQuoteTerms({ financial: e.target.value })} className="finance-input w-full text-xs" />
                        </div>
                        <div>
                          <label htmlFor="qt-extras" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Extras (upsells)")}</label>
                          <textarea id="qt-extras" rows={2} value={quoteTerms.extras || ""} onChange={e => setQuoteTerms({ extras: e.target.value })} className="finance-input w-full text-xs" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="qt-prod" checked={!!quoteTerms.production} onChange={e => setQuoteTerms({ production: e.target.checked ? PRODUCTION_NOTE : "" })} />
                          <label htmlFor="qt-prod" className="text-xs text-slate-700">{t("Production notes (2 modification sets included, +$30/extra)")}</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="qt-tech" checked={!!quoteTerms.technical} onChange={e => setQuoteTerms({ technical: e.target.checked ? TECHNICAL_NOTE : "" })} />
                          <label htmlFor="qt-tech" className="text-xs text-slate-700">{t("Technical notes (Sony full-frame, HD/4K, licensed music)")}</label>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Save Quotation</button>
                      <button type="button" onClick={() => setQuoteForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Payment-match suggestions: unclaimed statement deposits whose account
                    currency + amount (±1%) fit an open quote. Human confirms — never auto-linked. */}
                {(() => {
                  const claimedTx = new Set(state.quotations.map(q => q.paymentTxId).filter(Boolean));
                  const suggestions = state.quotations
                    .filter(q => !q.paymentTxId && ["Sent", "Accepted", "Invoiced"].includes(q.status))
                    .map(q => ({
                      q,
                      txs: state.bankTransactions.filter(bt =>
                        bt.type === "Deposit" && !bt.pending && !bt.projectId && !claimedTx.has(bt.id) &&
                        (state.bankAccounts.find(ba => ba.id === bt.bankAccountId)?.currency || "USD") === q.currency &&
                        Math.abs(bt.amount - q.amount) <= Math.max(1, q.amount * 0.01))
                    }))
                    .filter(s => s.txs.length > 0);
                  if (!suggestions.length) return null;
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <p className="text-[11px] font-bold text-amber-800 uppercase">🏦 Possible payment matches on the bank statement</p>
                      {suggestions.map(({ q, txs }) => txs.map(tx => {
                        const acct = state.bankAccounts.find(ba => ba.id === tx.bankAccountId);
                        return (
                          <div key={`${q.id}-${tx.id}`} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                            <span><strong>{q.quoteNo}</strong> ({q.currency} {q.amount.toLocaleString()}) ↔ deposit {tx.date} · {formatIn(tx.amount, acct?.currency || "USD")} · "{tx.description.slice(0, 50)}"</span>
                            {MANAGERS.includes(currentUser.role) && (
                              <button onClick={() => linkQuotePayment(q, tx.id)} className="bg-emerald-600 text-white text-[10px] font-bold rounded px-2 py-1 hover:bg-emerald-700 transition-all">
                                ✓ Confirm settlement
                              </button>
                            )}
                          </div>
                        );
                      }))}
                    </div>
                  );
                })()}

                {/* Receipt first, settlement second: the number this produces is the evidence
                    the settlement asks for. Issued by the Finance Officer, naming the person
                    who actually took the money. */}
                {receiptForm && (
                  <form onSubmit={issueReceipt} className="p-4 bg-white border border-amber-200 rounded-xl shadow-sm space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">🧾 Issue receipt — {receiptForm.q.quoteNo}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="rc-method" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Method")}</label>
                        <select id="rc-method" value={receiptForm.method} onChange={e => setReceiptForm({ ...receiptForm, method: e.target.value })} className="finance-input w-full text-xs">
                          {["Cash", "OMT", "BOB Finance", "Whish"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        {/* Deliberately blank. It used to prefill the signed-in user, and on the first real
                            receipt that produced a document stating the Finance Officer had taken cash
                            he never handled. Whoever issues the receipt must name the recipient on purpose. */}
                        <label htmlFor="rc-by" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Received by</label>
                        <input id="rc-by" type="text" required placeholder="who physically took the money" value={receiptForm.receivedBy} onChange={e => setReceiptForm({ ...receiptForm, receivedBy: e.target.value })} className="finance-input w-full text-xs" />
                        <p className="mt-1 text-[9px] leading-snug text-slate-500">Whoever handled the cash — not necessarily you.</p>
                      </div>
                      <div>
                        <label htmlFor="rc-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Received on")}</label>
                        <input id="rc-date" type="date" value={receiptForm.date} onChange={e => setReceiptForm({ ...receiptForm, date: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="rc-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount ({receiptForm.q.currency})</label>
                        <input id="rc-amount" type="number" min="0" step="any" value={receiptForm.amount} onChange={e => setReceiptForm({ ...receiptForm, amount: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">Numbered RC-nnn/year from the receipts already on file, filed against this quotation, and printed with the amount in words. Print it and have both sides sign.</p>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">🧾 Issue receipt</button>
                      <button type="button" onClick={() => setReceiptForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Off-bank settlement: OMT / BOB / Whish / cash. Evidence ref mandatory. */}
                {settleForm && (
                  <form onSubmit={submitOffbankSettlement} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">💵 Record off-bank payment — {settleForm.q.quoteNo}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="st-method" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Method")}</label>
                        <select id="st-method" value={settleForm.method} onChange={e => setSettleForm({ ...settleForm, method: e.target.value })} className="finance-input w-full text-xs">
                          {["OMT", "BOB Finance", "Whish", "Cash"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="st-ref" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{settleForm.method === "Cash" ? "Signed receipt №" : "Transfer reference"}</label>
                        <input id="st-ref" type="text" required placeholder={settleForm.method === "Cash" ? "receipt number" : "e.g. 512-045-8198"} value={settleForm.reference} onChange={e => setSettleForm({ ...settleForm, reference: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="st-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Received on")}</label>
                        <input id="st-date" type="date" value={settleForm.date} onChange={e => setSettleForm({ ...settleForm, date: e.target.value })} className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="st-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount received ({settleForm.q.currency})</label>
                        <input id="st-amount" type="number" min="0" step="any" value={settleForm.amount} onChange={e => setSettleForm({ ...settleForm, amount: Number(e.target.value) })} className="finance-input w-full font-mono text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">Recorded as a deposit on the off-bank evidence account (like the FPU BOB Finance tranches). No evidence reference, no booking.</p>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">💾 Record settlement</button>
                      <button type="button" onClick={() => setSettleForm(null)} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500">
                        <th scope="col" className="p-3">Quote №</th>
                        <th scope="col" className="p-3">Date</th>
                        <th scope="col" className="p-3">Client</th>
                        <th scope="col" className="p-3">Service</th>
                        <th scope="col" className="p-3 text-right">Amount</th>
                        <th scope="col" className="p-3">Valid Until</th>
                        <th scope="col" className="p-3">Status</th>
                        <th scope="col" className="p-3">Payment</th>
                        <th scope="col" className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.quotations.sort((a, b) => b.date.localeCompare(a.date)).map(q => {
                        const client = state.clients.find(c => c.id === q.clientId);
                        return (
                          <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-700">{q.quoteNo}</td>
                            <td className="p-3 font-mono text-slate-500">{q.date}</td>
                            <td className="p-3 text-slate-700">{client?.name || q.clientId}</td>
                            <td className="p-3 text-slate-700">{q.title}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">{q.currency} {q.amount.toLocaleString()}</td>
                            <td className="p-3 font-mono text-slate-500">{q.validUntil || "—"}</td>
                            <td className="p-3">
                              {MANAGERS.includes(currentUser.role) ? (
                                <select value={q.status} onChange={e => moveQuotation(q, e.target.value)} className="finance-input text-[10px] py-1" aria-label={`Status for ${q.quoteNo}`}>
                                  {QUOTE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                              ) : (
                                <span className="text-[10px] font-bold">{q.status}</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {q.paymentTxId ? (() => {
                                const tx = state.bankTransactions.find(bt => bt.id === q.paymentTxId);
                                return (
                                  <span className="text-[10px] font-bold text-emerald-700">
                                    🏦 settled {tx?.date || ""}
                                    {FINANCE.includes(currentUser.role) && (
                                      <button onClick={() => linkQuotePayment(q, "")} className="ml-1 text-slate-400 hover:text-red-600" title="Unlink payment" aria-label={`Unlink payment for ${q.quoteNo}`}>✕</button>
                                    )}
                                  </span>
                                );
                              })() : (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">—</span>
                                  {MANAGERS.includes(currentUser.role) && !["Rejected", "Expired"].includes(q.status) && (
                                    <>
                                    <button onClick={() => setSettleForm({ q, method: "OMT", reference: "", date: new Date().toLocaleDateString("en-CA"), amount: q.amount })} className="text-slate-400 hover:text-emerald-700 p-1 transition-colors rounded hover:bg-slate-100" title="Record off-bank payment (OMT / BOB / Whish / cash)" aria-label={`Record off-bank payment for ${q.quoteNo}`}>💵</button>
                                    <button onClick={() => setReceiptForm({ q, date: new Date().toLocaleDateString("en-CA"), amount: q.amount, method: "Cash", receivedBy: "" })} className="text-slate-400 hover:text-amber-700 p-1 transition-colors rounded hover:bg-slate-100" title="Issue AnaHon's receipt for this payment" aria-label={`Issue receipt for ${q.quoteNo}`}>🧾</button>
                                    </>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <button onClick={() => generateQuoteDoc(q)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="View client document" aria-label={`View document for ${q.quoteNo}`}>📄</button>
                              <a href={withTicket(`/api/quotations/${q.id}/pdf`)} download
                                className="text-slate-400 hover:text-red-700 p-1 transition-colors rounded hover:bg-slate-100 inline-block" title="Download PDF" aria-label={`Download PDF for ${q.quoteNo}`}>
                                <Download className="h-3.5 w-3.5 inline" />
                              </a>
                              {(() => {
                                const signed = (state.documents || []).filter((d: any) => d.linkedRecordType === "Quotation" && d.linkedRecordId === q.id);
                                return (
                                  <>
                                    <label className="text-slate-400 hover:text-emerald-700 p-1 transition-colors rounded hover:bg-slate-100 cursor-pointer inline-block" title="Attach the signed copy returned by the client">
                                      📎
                                      <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) attachSignedCopy(q, f); e.currentTarget.value = ""; }} />
                                    </label>
                                    {signed.map((d: any) => (
                                      <button key={d.id} onClick={() => openDoc({ id: d.id, filename: d.filename, mimeType: d.mimeType })}
                                        className="text-emerald-700 hover:text-emerald-900 p-1 text-[10px] font-bold transition-colors rounded hover:bg-emerald-50"
                                        title={`Signed copy on file — ${d.refNo || d.filename}`}>✓signed</button>
                                    ))}
                                  </>
                                );
                              })()}
                              <button onClick={() => setQuoteForm({ ...q })} className="text-slate-400 hover:text-slate-700 p-1 transition-colors rounded hover:bg-slate-100" title="Edit" aria-label={`Edit ${q.quoteNo}`}>✏️</button>
                              <button onClick={() => deleteQuotation(q)} className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-slate-100" title="Delete" aria-label={`Delete ${q.quoteNo}`}>
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {state.quotations.length === 0 && (
                        <tr><td colSpan={9} className="p-4 text-center text-slate-400 italic">No quotations yet — register a client, then create the first quote.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400">
                  💡 When an accepted quote is delivered and invoiced, the client's payment arrives on the BLOM
                  statement and books as service income (4200) — same route as the SKF service payments.
                </p>
              </div>
            </div>
  );
}
