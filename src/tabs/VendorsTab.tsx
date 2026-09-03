import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { Account, Vendor } from "../types";
import { tr } from "../i18n";
import { SharedProps } from "./shared";

export default function VendorsTab({ contractBusy, contractFor, contractForm, contractParty, currentUser, formatUSD, handleGenerateContract, partyFileFor, refreshState, renderPartyFile, setContractFor, setContractForm, setContractParty, setPartyFileFor, state, t, triggerToast }: SharedProps) {
  // Subscriptions sheet (Vendor Registry) — renewal tracking with alerts.
  const [subForm, setSubForm] = useState<any | null>(null);

  const [subSuggestions, setSubSuggestions] = useState<any[] | null>(null);

  const [subBusy, setSubBusy] = useState(false);

  const [aiVendorScanning, setAiVendorScanning] = useState(false);

  // Vendor registration states
  const [newVendorName, setNewVendorName] = useState("");

  const [newVendorCategory, setNewVendorCategory] = useState("");

  // Supplier by default; only ticked for someone we engage under an agreement.
  const [newVendorEngageable, setNewVendorEngageable] = useState(false);

  const [newVendorTaxId, setNewVendorTaxId] = useState("");

  const [newVendorBankInfo, setNewVendorBankInfo] = useState("");

  const [newVendorContact, setNewVendorContact] = useState("");

  // Marking a vendor engageable permits a signed agreement in their name, so it asks for
  // a reason and is audit-logged. Turning it off needs no reason.
  const handleSetEngageable = async (vendorId: string, vendorName: string, engageable: boolean) => {
    let reason = "";
    if (engageable) {
      reason = (window.prompt(
        `Mark "${vendorName}" as engageable?\n\nThis allows a signed service agreement to be issued in their name. Only do this for someone you ENGAGE under an agreement (a trainer, editor, consultant) — not for a shop or subscription you buy from.\n\nReason:`
      ) || "").trim();
      if (!reason) return;
    }
    try {
      const res = await fetch("/api/vendors/engageable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, engageable, reason, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast(`${vendorName} is now ${engageable ? "engageable — a service agreement may be issued" : "a supplier (purchases only)"}.`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // AI vendor scan: reads a supplier invoice and prefills the vendor registration form.
  // Vetting and registration stay manual (Policy 7.3).
  const handleAiVendorScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = (reader.result as string).split(",")[1];
      setAiVendorScanning(true);
      try {
        const res = await fetch("/api/vendor/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: base64String, mimeType: file.type, filename: file.name, user: currentUser })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI scan failed.");
        const x = data.extracted;
        if (x.duplicateOfVendorId) {
          const dup = state.vendors.find(v => v.id === x.duplicateOfVendorId);
          triggerToast(`⚠️ "${x.name}" looks already registered as "${dup?.name || x.duplicateOfVendorId}" — check the directory before creating a duplicate.`, "error");
        }
        if (x.name) setNewVendorName(x.name);
        if (x.category) setNewVendorCategory(x.category);
        if (x.taxId) setNewVendorTaxId(x.taxId);
        if (x.bankInfo) setNewVendorBankInfo(x.bankInfo);
        if (x.contact) setNewVendorContact(x.contact);
        const warn = (x.warnings || []).length ? ` ⚠️ ${x.warnings.join("; ")}` : "";
        if (!x.duplicateOfVendorId) {
          triggerToast(`AI prefilled supplier "${x.name}" (confidence: ${x.confidence}). Verify against the document, complete vetting, then register.${warn}`);
        }
      } catch (err: any) {
        triggerToast(err.message, "error");
      } finally {
        setAiVendorScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVendorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName || !newVendorCategory) {
      triggerToast("Vendor name and primary category are required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/vendors/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVendorName,
          category: newVendorCategory,
          taxId: newVendorTaxId,
          bankInfo: newVendorBankInfo,
          contact: newVendorContact,
          engageable: newVendorEngageable,
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast(`Vendor ${newVendorName} registered successfully!`);
        setNewVendorName("");
        setNewVendorCategory("");
        setNewVendorTaxId("");
        setNewVendorBankInfo("");
        setNewVendorContact("");
        setNewVendorEngageable(false);
        refreshState();
      } else {
        const data = await res.json();
        triggerToast(data.error || "Failed to register vendor.", "error");
      }
    } catch {
      triggerToast("Error registering new vendor.", "error");
    }
  };

  const saveSubscription = async (payload: any) => {
    try {
      const res = await fetch("/api/subscriptions/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save subscription");
      triggerToast(`Tracking ${payload.name}.`);
      setSubForm(null);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const verifySubscription = async (sub: any, stillActive: boolean) => {
    try {
      const res = await fetch("/api/subscriptions/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, stillActive, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to confirm");
      triggerToast(stillActive ? `${sub.name} confirmed still active today.` : `${sub.name} marked as ended.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const rollSubscription = async (sub: any) => {
    try {
      const res = await fetch("/api/subscriptions/roll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to roll forward");
      triggerToast(`${sub.name} → next renewal ${d.nextRenewal}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const deleteSubscription = async (sub: any) => {
    if (!window.confirm(`Stop tracking ${sub.name}?`)) return;
    try {
      const res = await fetch("/api/subscriptions/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove");
      triggerToast(`Stopped tracking ${sub.name}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const detectSubscriptions = async () => {
    setSubBusy(true);
    try {
      const res = await fetch("/api/subscriptions/detect");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Detection failed");
      setSubSuggestions(d.suggestions);
      triggerToast(`${d.suggestions.length} recurring merchant${d.suggestions.length === 1 ? "" : "s"} found on the statements.`);
    } catch (err: any) { triggerToast(err.message, "error"); }
    setSubBusy(false);
  };

  // Days until renewal drives the alert colour. Overdue and "due soon" are the two
  // states worth interrupting someone for.
  const subDaysLeft = (iso: string) => iso ? Math.ceil((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
  return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold"> Tripoli Vendor Master & Partners Directory</h2>
                <p className="text-xs text-slate-500">
                  Every contractor, freelancer and supplier must certify conflict of interest waivers periodically. Sanction-marked providers are locked automatically.
                </p>
              </div>

              {/* ── Subscriptions & renewals ─────────────────────────────────
                  Small recurring charges are the easiest money to lose track of:
                  each one is trivial, the total is not. */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">🔁 Subscriptions & Renewals</h3>
                  <div className="flex items-center gap-2">
                    {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                      <>
                        <button type="button" disabled={subBusy} onClick={detectSubscriptions}
                          className="text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 disabled:opacity-50 transition-all">
                          {subBusy ? "Scanning…" : "🔍 Find in statements"}
                        </button>
                        <button type="button" onClick={() => setSubForm({ name: "", amount: "", currency: "USD", cycle: "Monthly", nextRenewal: "", status: "Active", bankAccountId: "ba-blom-usd", matchText: "", notes: "" })}
                          className="text-xs font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg px-3 py-2 transition-all">
                          ➕ Track a subscription
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(() => {
                  const active = state.subscriptions.filter(x => x.status === "Active");
                  const monthly = active.reduce((sum, x) => sum + (x.amount || 0) / (x.cycle === "Annual" ? 12 : x.cycle === "Quarterly" ? 3 : 1), 0);
                  if (!active.length) return null;
                  return (
                    <div className="flex flex-wrap gap-4 text-xs">
                      <span className="text-slate-500">Active: <strong className="text-slate-800">{active.length}</strong></span>
                      <span className="text-slate-500">Monthly equivalent: <strong className="font-mono text-slate-800">{formatUSD(monthly)}</strong></span>
                      <span className="text-slate-500">Annualised: <strong className="font-mono text-slate-800">{formatUSD(monthly * 12)}</strong></span>
                    </div>
                  );
                })()}

                {subForm && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label htmlFor="sb-name" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Subscription</label>
                      <input id="sb-name" type="text" placeholder="e.g. Anthropic Claude Max" value={subForm.name}
                        onChange={e => setSubForm({ ...subForm, name: e.target.value })} className="finance-input w-full text-xs" />
                    </div>
                    <div>
                      <label htmlFor="sb-amt" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount</label>
                      <input id="sb-amt" type="number" min="0" step="any" value={subForm.amount}
                        onChange={e => setSubForm({ ...subForm, amount: e.target.value })} className="finance-input w-full font-mono text-xs" />
                    </div>
                    <div>
                      <label htmlFor="sb-cycle" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Cycle</label>
                      <select id="sb-cycle" value={subForm.cycle} onChange={e => setSubForm({ ...subForm, cycle: e.target.value })} className="finance-input w-full text-xs">
                        <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sb-next" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Next renewal</label>
                      <input id="sb-next" type="date" value={subForm.nextRenewal}
                        onChange={e => setSubForm({ ...subForm, nextRenewal: e.target.value })} className="finance-input w-full font-mono text-xs" />
                    </div>
                    <div>
                      <label htmlFor="sb-acct" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Paid from</label>
                      <select id="sb-acct" value={subForm.bankAccountId} onChange={e => setSubForm({ ...subForm, bankAccountId: e.target.value })} className="finance-input w-full text-xs">
                        <option value="">—</option>
                        {state.bankAccounts.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="sb-note" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Note (optional)</label>
                      <input id="sb-note" type="text" value={subForm.notes} onChange={e => setSubForm({ ...subForm, notes: e.target.value })} className="finance-input w-full text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveSubscription(subForm)} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">💾 Save</button>
                      <button type="button" onClick={() => setSubForm(null)} className="bg-slate-100 text-slate-600 text-xs font-medium rounded-lg px-3 py-2 hover:bg-slate-200 transition-all">Cancel</button>
                    </div>
                  </div>
                )}

                {subSuggestions && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                    <p className="text-[11px] font-bold text-indigo-900">Recurring merchants on the statements — not yet tracked</p>
                    {subSuggestions.length === 0 && <p className="text-[11px] text-indigo-700">Nothing untracked found.</p>}
                    {subSuggestions.map(sug => (
                      <div key={sug.key} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white border border-indigo-100 rounded px-2 py-1.5">
                        <span className="text-slate-700">
                          <strong>{sug.key}</strong> · {sug.charges} charges · last {sug.lastCharge} · typically {formatUSD(sug.typicalAmount)}
                          {sug.varies && <span className="text-amber-700"> (amount varies)</span>} · looks {sug.cycle.toLowerCase()}
                        </span>
                        <button type="button"
                          onClick={() => { setSubForm({ name: sug.key, amount: String(sug.typicalAmount), currency: "USD", cycle: sug.cycle, nextRenewal: sug.suggestedNextRenewal, status: "Active", bankAccountId: sug.bankAccountId, matchText: sug.key, notes: `Detected from ${sug.charges} statement charges; last ${sug.lastCharge}.` }); setSubSuggestions(null); }}
                          className="text-[11px] font-bold text-indigo-700 hover:underline">＋ track this</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSubSuggestions(null)} className="text-[10px] text-slate-500 hover:underline">close</button>
                  </div>
                )}

                {state.subscriptions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nothing tracked yet — "Find in statements" proposes the recurring charges already on your bank feed.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500">
                        <th scope="col" className="p-2">Subscription</th>
                        <th scope="col" className="p-2 text-right">Amount</th>
                        <th scope="col" className="p-2">Cycle</th>
                        <th scope="col" className="p-2">Next renewal</th>
                        <th scope="col" className="p-2">Paid from</th>
                        <th scope="col" className="p-2">Status</th>
                        <th scope="col" className="p-2">Still active?</th>
                        <th scope="col" className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.subscriptions.slice().sort((a, b) => (a.nextRenewal || "9999").localeCompare(b.nextRenewal || "9999")).map(sub => {
                        const days = subDaysLeft(sub.nextRenewal);
                        const overdue = days !== null && days < 0 && sub.status === "Active";
                        const soon = days !== null && days >= 0 && days <= 7 && sub.status === "Active";
                        return (
                          <tr key={sub.id} className={`border-b border-slate-100 ${overdue ? "bg-red-50" : soon ? "bg-amber-50" : ""}`}>
                            <td className="p-2 font-bold text-slate-800">{sub.name}{sub.notes && <span className="block text-[10px] font-normal text-slate-400">{sub.notes}</span>}</td>
                            <td className="p-2 text-right font-mono">{sub.currency} {sub.amount.toLocaleString()}</td>
                            <td className="p-2 text-slate-600">{sub.cycle}</td>
                            <td className="p-2 font-mono">
                              {sub.nextRenewal || "—"}
                              {sub.status === "Active" && days !== null && (
                                <span className={`block text-[10px] font-bold ${overdue ? "text-red-700" : soon ? "text-amber-700" : "text-slate-400"}`}>
                                  {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "renews today" : `in ${days}d`}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-500">{state.bankAccounts.find(b => b.id === sub.bankAccountId)?.name || "—"}</td>
                            <td className="p-2">
                              <select value={sub.status} onChange={e => saveSubscription({ ...sub, status: e.target.value })}
                                aria-label={`Status for ${sub.name}`} className="finance-input text-[10px] py-1">
                                <option>Active</option><option>Paused</option><option>Cancelled</option>
                              </select>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {(() => {
                                const v = (sub as any).verifiedOn;
                                const vDays = v ? Math.floor((Date.now() - new Date(`${v}T00:00:00`).getTime()) / 86400000) : null;
                                const stale = vDays === null || vDays > 90;
                                return (
                                  <span className="inline-flex items-center gap-1">
                                    <button onClick={() => verifySubscription(sub, true)} title="Confirm it is still running today"
                                      className="text-[10px] font-bold text-emerald-700 hover:underline">✓ yes</button>
                                    <button onClick={() => { if (window.confirm(`Mark ${sub.name} as no longer running?`)) verifySubscription(sub, false); }}
                                      title="No longer running — mark cancelled"
                                      className="text-[10px] font-bold text-slate-400 hover:text-red-600 hover:underline">✕ no</button>
                                    <span className={`block text-[9px] ${stale ? "text-amber-700 font-bold" : "text-slate-400"}`}>
                                      {v ? (vDays === 0 ? "checked today" : `checked ${vDays}d ago`) : "never checked"}
                                    </span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {sub.nextRenewal && sub.status === "Active" && (
                                <button onClick={() => rollSubscription(sub)} title="Paid — roll to the next period" aria-label={`Roll ${sub.name} forward`}
                                  className="text-emerald-700 hover:underline font-bold px-1">✓ paid</button>
                              )}
                              <button onClick={() => setSubForm({ ...sub, amount: String(sub.amount) })} title="Edit" aria-label={`Edit ${sub.name}`} className="text-slate-400 hover:text-slate-700 px-1">✏️</button>
                              <button onClick={() => deleteSubscription(sub)} title="Stop tracking" aria-label={`Stop tracking ${sub.name}`} className="text-slate-400 hover:text-red-600 px-1"><Trash2 className="h-3.5 w-3.5 inline" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Register New Vendor Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Onboard New Provider (Supplier / Consultant / Freelancer)</h3>
                  <div className="p-2 rounded-lg border border-indigo-200 bg-indigo-50/40 md:w-1/2">
                    <label className={`block text-xs font-bold mb-1 ${aiVendorScanning ? "text-slate-400" : "text-indigo-700"}`}>
                      {aiVendorScanning ? "🤖 Reading supplier details…" : "🤖 Scan an invoice with AI (auto-fill supplier details)"}
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      disabled={aiVendorScanning}
                      onChange={handleAiVendorScan}
                      className="finance-input w-full text-xs"
                    />
                    <span className="text-[10px] text-indigo-600 block mt-0.5">
                      Fills the fields from the supplier's invoice — vet and register manually (Policy 7.3).
                    </span>
                  </div>
                  <form onSubmit={handleVendorRegister} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Provider / Vendor Name")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Layale El-Khatib (Consultant)"
                        required
                        value={newVendorName}
                        onChange={(e) => setNewVendorName(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Contract / Provider Category")}</label>
                      <select
                        required
                        value={newVendorCategory}
                        onChange={(e) => setNewVendorCategory(e.target.value)}
                        className="finance-input w-full text-xs bg-white"
                      >
                        <option value="">-- Choose Category --</option>
                        <option value="Consultant / Freelancer">Consultant / Freelancer</option>
                        <option value="Service Provider">Service Provider (engaged under agreement)</option>
                        <option value="Software Subscriptions">Software Subscriptions</option>
                        <option value="General Supplier">General Supplier</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Telecommunications">Telecommunications</option>
                        <option value="Landlord">Landlord (Rent Services)</option>
                        <option value="Government / Tax Authority">Government / Tax Authority</option>
                        <option value="Other">Other Category</option>
                      </select>
                      {/* Explicit, not inferred from the category — a mislabelled category
                          must never be enough to permit a signed agreement. */}
                      <label htmlFor="vendor-engageable" className="mt-2 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          id="vendor-engageable"
                          checked={newVendorEngageable}
                          onChange={(e) => setNewVendorEngageable(e.target.checked)}
                          className="h-4 w-4 mt-0.5 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-600 leading-snug">
                          We <strong>engage</strong> this party under a service agreement<br />
                          <span className="text-slate-400">Leave unticked for anyone we simply buy from — a shop, a taxi, a subscription. Only ticked vendors can be issued an agreement.</span>
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("MoF Tax Registry ID (If Registered)")}</label>
                      <input
                        type="text"
                        placeholder="e.g. MoF-9382LB (or leave blank/N/A)"
                        value={newVendorTaxId}
                        onChange={(e) => setNewVendorTaxId(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Contact Email / Phone")}</label>
                      <input
                        type="text"
                        placeholder="e.g. consultant@anahon.org"
                        value={newVendorContact}
                        onChange={(e) => setNewVendorContact(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Bank Account / Payment Details")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Bank Audi Tripoli, Account 2981..."
                        value={newVendorBankInfo}
                        onChange={(e) => setNewVendorBankInfo(e.target.value)}
                        className="finance-input w-full text-xs"
                      />
                    </div>
                    <button type="submit" className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all h-[36px] flex items-center justify-center">
                      Onboard Provider
                    </button>
                  </form>

                  {["Consultant / Freelancer", "Service Provider"].includes(newVendorCategory) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex flex-col gap-1 font-mono">
                      <span className="font-bold flex items-center gap-1">🏛️ Lebanese MoF Statutory Compliance Alert:</span>
                      <p className="leading-relaxed">
                        Individuals and consultants who do not have an official, active **Tax Registry ID** (MoF number) are subject to a **7.5% Withholding Tax (WHT)**.
                        The system will automatically calculate and withhold this tax at the payment stage unless a valid Tax Registry ID is entered above.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-100">
                    <tr className="border-b border-sub-200 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Vendor Account</th>
                      <th className="px-6 py-3">Primary Category</th>
                      <th className="px-6 py-3 hidden md:table-cell">Tax Registry ID</th>
                      <th className="px-6 py-3 hidden md:table-cell">Audit Disclosures</th>
                      <th className="px-6 py-3 hidden md:table-cell">Sanctions Rating</th>
                      <th className="px-6 py-3">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-sans">
                    {state.vendors.map(v => (
                      <React.Fragment key={v.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{v.name}</p>
                          <span className="text-[11px] text-slate-550 font-mono">{v.contact}</span>
                          <button
                            type="button"
                            onClick={() => setPartyFileFor(partyFileFor === v.id ? null : v.id)}
                            aria-expanded={partyFileFor === v.id}
                            className="block text-[10px] font-bold text-slate-500 hover:text-red-650 hover:underline mt-0.5 min-h-[24px]"
                          >
                            {partyFileFor === v.id ? "▾ close file" : "📂 open file (agreement + invoices)"}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{v.category}</td>
                        <td className="px-6 py-4 font-mono font-medium hidden md:table-cell">{v.taxId}</td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${v.declarationSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {v.declarationSigned ? "Signed Conflict Code" : "Pending Signature"}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          {v.blocked ? (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                              🚨 blocked - direct fail-safe
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                              Passed clear
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {/* Only engagement-type vendors can hold an agreement. A software
                              subscription or a taxi is a purchase — it needs a voucher, not a contract. */}
                          {(() => {
                            const canManage = ["Super Admin", "Finance Officer", "Executive Director"].includes(currentUser.role);
                            if (!v.engageable) {
                              return (
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400 italic block">Supplier — purchases only</span>
                                  {canManage && !v.blocked && v.active && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetEngageable(v.id, v.name, true)}
                                      className="text-[10px] text-slate-500 hover:text-red-650 hover:underline"
                                    >
                                      mark engageable…
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            if (v.blocked || !v.active) return <span className="text-[10px] text-slate-400 italic">Engageable · unavailable</span>;
                            if (!canManage) return <span className="text-[10px] text-emerald-700">Engageable</span>;
                            return (
                              <div className="space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => { setContractFor(contractFor === v.id ? null : v.id); setContractParty("vendor"); }}
                                  aria-expanded={contractFor === v.id}
                                  className="text-[10px] font-bold text-red-650 hover:text-red-700 hover:underline min-h-[44px] md:min-h-0 md:py-1 block"
                                >
                                  {contractFor === v.id ? "✕ Cancel" : "📄 Service agreement"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetEngageable(v.id, v.name, false)}
                                  className="text-[10px] text-slate-400 hover:text-slate-700 hover:underline"
                                >
                                  revert to supplier
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                      {partyFileFor === v.id && (
                        <tr>
                          <td colSpan={6} className="px-6 py-3 bg-slate-50/60">
                            {renderPartyFile(v.id, v.name)}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Service agreement generator — vendors only. Figures are typed by a human;
                  nothing is inferred, because an agreement is a signed instrument. */}
              {contractFor && contractParty === "vendor" && (() => {
                const v = state.vendors.find(x => x.id === contractFor);
                if (!v) return null;
                return (
                  <form
                    onSubmit={(e) => handleGenerateContract(e, v.id, "vendor")}
                    aria-label={`Generate service agreement for ${v.name}`}
                    className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-sm font-bold text-slate-900">📄 Service agreement — {v.name}</h3>
                      <span className="text-[10px] font-mono text-slate-500">{v.category}{v.taxId ? ` · Tax ID ${v.taxId}` : ""}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="md:col-span-2">
                        <label htmlFor="sa-role" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Role / scope of services")}</label>
                        <input id="sa-role" type="text" placeholder={`e.g. Field logistics & volunteer coordination (blank = "${v.category}")`}
                          value={contractForm.role}
                          onChange={(e) => setContractForm({ ...contractForm, role: e.target.value })}
                          className="finance-input w-full text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-project" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Project")}</label>
                        <select id="sa-project" required value={contractForm.projectId}
                          onChange={(e) => setContractForm({ ...contractForm, projectId: e.target.value })}
                          className="finance-input w-full text-xs">
                          <option value="">— Select —</option>
                          {state.projects.filter(p => p.status === "Active").map(p => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="sa-start" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Start")}</label>
                        <input id="sa-start" type="date" required value={contractForm.startDate}
                          onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                          className="finance-input w-full text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-end" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("End")}</label>
                        <input id="sa-end" type="date" required value={contractForm.endDate}
                          onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                          className="finance-input w-full text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-fee" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Fee per period (USD)")}</label>
                        <input id="sa-fee" type="number" step="0.01" required value={contractForm.monthlyFee}
                          onChange={(e) => setContractForm({ ...contractForm, monthlyFee: e.target.value })}
                          className="finance-input w-full font-mono text-xs" />
                      </div>
                      <div>
                        <label htmlFor="sa-total" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Agreement Total (USD)")}</label>
                        <input id="sa-total" type="number" step="0.01" required value={contractForm.contractTotal}
                          onChange={(e) => setContractForm({ ...contractForm, contractTotal: e.target.value })}
                          className="finance-input w-full font-mono text-xs" />
                      </div>
                      <button type="submit" disabled={contractBusy}
                        className="bg-slate-900 hover:bg-slate-955 disabled:opacity-50 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all min-h-[44px]">
                        {contractBusy ? "Generating…" : "Generate agreement"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      Fees are payable against the provider's invoice on delivery — not against a timesheet.
                      Generated unsigned and filed in the project's vault folder. Never backdate: issue a dated addendum instead (Policy §6.8).
                    </p>
                  </form>
                );
              })()}
            </div>
  );
}
