import React, { useState } from "react";
import { SharedProps } from "./shared";
import { EQUIPMENT_VERIFIERS, SUPPLIER_EDITORS } from "../roles";
import { withTicket } from "../docTicket";
import { CONDITIONS, CURRENCIES, NO_SERIAL, equipmentStatus, mayVerifyEquipment } from "../equipment";

/** A request equipment can be booked against: the money is committed. The route asks the same. */
const BOOKABLE = ["Approved", "Paid", "Posted"];

type Photo = { base64: string; mimeType: string; filename: string };

/**
 * A phone photo is 3–8 MB; a label needs a fraction of that to be read and kept. Shrunk in
 * the browser with a canvas — no library — so the upload over the tailnet and the model call
 * stay quick on a phone. A format this browser cannot decode (HEIC on a desktop) goes up as
 * it is: the model still reads it and the vault still keeps it.
 */
async function shrinkPhoto(file: File, maxSide = 1600): Promise<Photo> {
  const stem = file.name.replace(/\.\w+$/, "") || "photo";
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mimeType: "image/jpeg", filename: `${stem}.jpg` };
  } catch {
    const url: string = await new Promise((done, fail) => {
      const r = new FileReader();
      r.onload = () => done(String(r.result));
      r.onerror = fail;
      r.readAsDataURL(file);
    });
    return { base64: url.split(",")[1], mimeType: file.type || "application/octet-stream", filename: file.name };
  }
}

const money = (n: number, cur: string) =>
  `${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const extOf = (p: Photo) => p.filename.match(/\.\w+$/)?.[0] || "";

const BLANK = {
  name: "", brand: "", model: "", serial: "", noSerial: false, specs: "",
  expenseId: "", cost: "", currency: "", purchaseDate: "", projectId: "",
  life: "3", custodian: "", location: "", condition: "",
};

const STATUS_CHIP: Record<string, string> = {
  Registered: "bg-slate-100 text-slate-700",
  Received: "bg-amber-100 text-amber-800",
  Verified: "bg-emerald-100 text-emerald-800",
};

export default function AssetsTab({ currentUser, openDoc, refreshState, state, t, triggerToast }: SharedProps) {
  const [f, setF] = useState({ ...BLANK, custodian: currentUser?.name || "" });
  const set = (k: keyof typeof BLANK, v: string | boolean) => setF(prev => ({ ...prev, [k]: v }));
  const [labelPhoto, setLabelPhoto] = useState<Photo | null>(null);
  const [itemPhoto, setItemPhoto] = useState<Photo | null>(null);
  const [scan, setScan] = useState<{ busy: boolean; confidence?: string; warnings?: string[]; duplicateOfTag?: string }>({ busy: false });
  const [saving, setSaving] = useState(false);
  const [verifyDraft, setVerifyDraft] = useState<Record<string, { condition: string; location: string }>>({});

  const assets = state.fixedAssets || [];
  const receiving = SUPPLIER_EDITORS.includes(currentUser.role);
  const verifier = EQUIPMENT_VERIFIERS.includes(currentUser.role);
  const docsOf = (id: string) => (state.documents || []).filter(d => d.linkedRecordType === "FixedAsset" && d.linkedRecordId === id);
  const nameOf = (id?: string | null) => state.users.find(u => u.id === id)?.name || id || "";
  const supplierOf = (vendorId?: string) => state.vendors.find(v => v.id === vendorId)?.name || t("Direct Reimbursement");
  const projectOf = (id?: string) => state.projects.find(p => p.id === id)?.code || "";

  // One request can buy several items, so the next may only take what is left of it.
  const bookedOn = (expenseId: string) => assets.filter(a => a.expenseId === expenseId).reduce((s, a) => s + (a.cost || 0), 0);
  const leftOn = (e: { id: string; amount: number }) => Math.max(0, (e.amount || 0) - bookedOn(e.id));
  const vouchers = (state.expenses || [])
    .filter(e => BOOKABLE.includes(e.status))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const voucher = vouchers.find(e => e.id === f.expenseId);

  const chooseVoucher = (id: string) => {
    const v = vouchers.find(e => e.id === id);
    setF(prev => ({ ...prev, expenseId: id, cost: v ? String(leftOn(v)) : "" }));
  };

  // Reads the label; never saves. The person holding the item checks every field.
  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScan({ busy: true });
    try {
      const photo = await shrinkPhoto(file);
      setLabelPhoto(photo);
      const res = await fetch("/api/assets/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The label could not be read.");
      const x = data.extracted;
      setF(prev => ({
        ...prev,
        name: x.name || prev.name, brand: x.brand || prev.brand, model: x.model || prev.model,
        serial: x.serialNumber || prev.serial, noSerial: x.serialNumber ? false : prev.noSerial,
        specs: x.specs || prev.specs,
      }));
      setScan({ busy: false, confidence: x.confidence, warnings: x.warnings || [], duplicateOfTag: x.duplicateOfTag });
    } catch (err: any) {
      setScan({ busy: false });
      triggerToast(err.message, "error");
    }
  };

  const handleItemPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setItemPhoto(await shrinkPhoto(file));
  };

  // Filed the way every other document is: into the vault through the one upload route.
  const fileOn = (assetId: string, p: Photo, category: string) =>
    fetch("/api/document/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, category, linkedRecordType: "FixedAsset", linkedRecordId: assetId }),
    }).then(r => r.ok).catch(() => false);

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/assets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, brand: f.brand, model: f.model, specs: f.specs,
          serialNumber: f.serial, noSerial: f.noSerial,
          expenseId: f.expenseId, cost: f.cost, currency: f.currency,
          purchaseDate: f.purchaseDate, fundingProjectId: f.projectId,
          usefulLifeYears: f.life, custodian: f.custodian, location: f.location, condition: f.condition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The item could not be registered.");
      const { id, tag } = data.asset;
      // Photos are filed after the item exists, because they are filed against it. A photo
      // that fails leaves the item registered and says so — it can be added from the card.
      const filed = await Promise.all([
        labelPhoto ? fileOn(id, { ...labelPhoto, filename: `${tag}_label${extOf(labelPhoto)}` }, "Equipment Label") : true,
        itemPhoto ? fileOn(id, { ...itemPhoto, filename: `${tag}_item${extOf(itemPhoto)}` }, "Equipment Photo") : true,
      ]);
      if (filed.every(Boolean)) triggerToast(`${t("Received")} — ${tag}. ${t("Write it on the sticker.")}`);
      else triggerToast(`${t("Received")} — ${tag}. ${t("A photo did not upload; add it from the item's card.")}`, "error");
      setF({ ...BLANK, custodian: currentUser?.name || "" });
      setLabelPhoto(null);
      setItemPhoto(null);
      setScan({ busy: false });
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (a: { id: string; condition: string; location: string }) => {
    const d = verifyDraft[a.id] || { condition: a.condition, location: a.location };
    const res = await fetch("/api/assets/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: a.id, condition: d.condition, location: d.location }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return triggerToast(data.error || "Confirmation was refused.", "error");
    triggerToast(t("Confirmed on physical check."));
    refreshState();
  };

  const addPhoto = async (assetId: string, tag: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const p = await shrinkPhoto(file);
    if (await fileOn(assetId, { ...p, filename: `${tag || assetId}_item${extOf(p)}` }, "Equipment Photo")) refreshState();
    else triggerToast(t("The photo did not upload."), "error");
  };

  const lbl = "block text-[10px] font-bold text-slate-600 uppercase mb-1";
  const inp = "finance-input w-full text-xs min-h-[44px] md:min-h-0";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t("Fixed Assets capitalization Register")}</h2>
        <p className="text-xs text-slate-500 md:max-w-xl">
          {t("Photograph the label when equipment arrives. The person who took delivery registers it; somebody else confirms it is really here.")}
        </p>
      </div>

      {receiving && (
        <form onSubmit={handleReceive} className="p-4 bg-white border border-slate-200 rounded-lg space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900">{t("Receive equipment")}</h3>
            <label className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-4 text-xs font-bold text-white ${scan.busy ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-950"}`}>
              📷 {scan.busy ? t("Reading the label…") : labelPhoto ? t("Scan the label again") : t("Scan the label")}
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={scan.busy} onChange={handleScan} />
            </label>
            <span className="text-[11px] text-slate-500">{t("Fills the fields from a photo of the serial label — check every one before saving.")}</span>
          </div>

          {scan.confidence && (
            <div className={`rounded-lg border p-2.5 text-[11px] ${scan.confidence === "high" && !scan.warnings?.length ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-bold">{t("Read from the label")} — {t("confidence")}: {t(scan.confidence)}. {t("Compare each field with the label before saving.")}</p>
              {scan.warnings?.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}
          {scan.duplicateOfTag && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] font-bold text-red-800">
              ⚠ <span dir="ltr">{scan.duplicateOfTag}</span> {t("already carries this serial — this is probably the same item.")}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="eq-name" className={lbl}>{t("Item")}</label>
              <input id="eq-name" required value={f.name} onChange={e => set("name", e.target.value)} placeholder={t("e.g. Sony FX6 cinema camera")} className={inp} />
            </div>
            <div>
              <label htmlFor="eq-brand" className={lbl}>{t("Brand")}</label>
              <input id="eq-brand" value={f.brand} onChange={e => set("brand", e.target.value)} className={inp} />
            </div>
            <div>
              <label htmlFor="eq-model" className={lbl}>{t("Model")}</label>
              <input id="eq-model" dir="ltr" value={f.model} onChange={e => set("model", e.target.value)} className={`${inp} font-mono`} />
            </div>
            <div>
              <label htmlFor="eq-serial" className={lbl}>{t("Serial number")}</label>
              <input
                id="eq-serial" dir="ltr" required={!f.noSerial} disabled={f.noSerial}
                value={f.noSerial ? "" : f.serial} onChange={e => set("serial", e.target.value)}
                placeholder={f.noSerial ? t(NO_SERIAL) : t("As printed on the label")}
                className={`${inp} font-mono`}
              />
              <label className="mt-1 flex min-h-[44px] items-center gap-2 text-[11px] text-slate-600 md:min-h-0">
                <input type="checkbox" checked={f.noSerial} onChange={e => set("noSerial", e.target.checked)} className="h-4 w-4" />
                {t(NO_SERIAL)}
              </label>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="eq-specs" className={lbl}>{t("Specifications")}</label>
              <textarea id="eq-specs" rows={2} value={f.specs} onChange={e => set("specs", e.target.value)} className="finance-input w-full text-xs" />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="eq-voucher" className={lbl}>{t("Bought on payment request")}</label>
              <select id="eq-voucher" value={f.expenseId} onChange={e => chooseVoucher(e.target.value)} className={`${inp} bg-white`}>
                <option value="">{t("— not bought on a payment request (a gift, or bought before the system) —")}</option>
                {vouchers.map(e => (
                  <option key={e.id} value={e.id} disabled={leftOn(e) <= 0}>
                    {e.voucherNo} · {supplierOf(e.vendorId)} · {money(e.amount, e.currency)}
                    {leftOn(e) < e.amount ? ` (${money(leftOn(e), e.currency)} ${t("left to book")})` : ""}
                  </option>
                ))}
              </select>
              {voucher && (
                <p className="mt-1 text-[11px] text-slate-600">
                  {t("From the request")}: {supplierOf(voucher.vendorId)} · <span dir="ltr">{money(voucher.amount, voucher.currency)}</span>
                  {" · "}<span dir="ltr">{String(voucher.paid_at || voucher.approved_at || voucher.created_at || "").slice(0, 10)}</span>
                  {projectOf(voucher.projectId) ? ` · ${projectOf(voucher.projectId)}` : ""}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="eq-cost" className={lbl}>{t("Cost of this item")}</label>
              <div className="flex gap-2">
                <input id="eq-cost" type="number" step="0.01" min="0" required dir="ltr" value={f.cost} onChange={e => set("cost", e.target.value)} className={`${inp} font-mono`} />
                {voucher ? (
                  <span className="self-center font-mono text-xs font-bold">{voucher.currency}</span>
                ) : (
                  <select aria-label={t("Currency")} required value={f.currency} onChange={e => set("currency", e.target.value)} className="finance-input min-h-[44px] bg-white text-xs md:min-h-0">
                    <option value="">—</option>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              {voucher && <span className="text-[10px] text-slate-500">{t("One request can buy several items — book only this one's share.")}</span>}
            </div>
            {!voucher && (<>
              <div>
                <label htmlFor="eq-date" className={lbl}>{t("Bought on")}</label>
                <input id="eq-date" type="date" required value={f.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} className={inp} />
              </div>
              <div>
                <label htmlFor="eq-project" className={lbl}>{t("Funded by project")}</label>
                <select id="eq-project" value={f.projectId} onChange={e => set("projectId", e.target.value)} className={`${inp} bg-white`}>
                  <option value="">{t("— none —")}</option>
                  {state.projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </div>
            </>)}
            <div>
              <label htmlFor="eq-life" className={lbl}>{t("Useful Life (Years)")}</label>
              <select id="eq-life" value={f.life} onChange={e => set("life", e.target.value)} className={`${inp} bg-white`}>
                {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="eq-custodian" className={lbl}>{t("Held by")}</label>
              <input id="eq-custodian" required value={f.custodian} onChange={e => set("custodian", e.target.value)} className={inp} />
            </div>
            <div>
              <label htmlFor="eq-location" className={lbl}>{t("Kept at")}</label>
              <input id="eq-location" required value={f.location} onChange={e => set("location", e.target.value)} placeholder={t("e.g. Tripoli office, studio cupboard")} className={inp} />
            </div>
            <div>
              <label htmlFor="eq-condition" className={lbl}>{t("Condition on arrival")}</label>
              <select id="eq-condition" required value={f.condition} onChange={e => set("condition", e.target.value)} className={`${inp} bg-white`}>
                <option value="">{t("— choose —")}</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            </div>
            <div>
              <span className={lbl}>{t("Photo of the item")}</span>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                📷 {itemPhoto ? t("Taken — retake") : t("Photograph the item")}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleItemPhoto} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving || scan.busy} className="min-h-[44px] rounded bg-emerald-700 px-5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
            {saving ? t("Registering…") : t("Register as received")}
          </button>
        </form>
      )}

      {assets.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {t("Nothing is on the register yet.")}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assets.map(a => {
          const status = equipmentStatus(a);
          const docs = docsOf(a.id);
          const v = a.expenseId ? state.expenses.find(e => e.id === a.expenseId) : undefined;
          const d = verifyDraft[a.id] || { condition: a.condition, location: a.location };
          return (
            <div key={a.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                {a.tag ? (
                  // Big enough to copy onto a sticker by hand; a tap copies it for a label printer.
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(a.tag!).then(() => triggerToast(`${a.tag} — ${t("copied")}`))}
                    aria-label={`${t("Copy the tag")} ${a.tag}`}
                    className="text-start"
                  >
                    <span className="block text-[10px] font-bold uppercase text-slate-400">{t("Sticker")}</span>
                    <span dir="ltr" className="block font-mono text-4xl font-black tracking-wider text-slate-900">{a.tag}</span>
                  </button>
                ) : (
                  <span className="text-[11px] italic text-slate-400">{t("No tag — registered before receiving existed")}</span>
                )}
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CHIP[status]}`}>{t(status)}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">{a.name}</h4>
                {(a.brand || a.model) && (
                  <p className="text-xs text-slate-600">{a.brand}{a.brand && a.model ? " · " : ""}<span dir="ltr" className="font-mono">{a.model}</span></p>
                )}
                <p className="text-[11px] text-slate-600">{t("Serial number")}: <span dir="ltr" className="font-mono font-bold">{a.serialNumber}</span></p>
                {a.specs && <p className="mt-1 whitespace-pre-line text-[11px] text-slate-500">{a.specs}</p>}
              </div>

              <p className="text-[11px] text-slate-600">{t("Kept at")}: {a.location} · {t("Held by")}: {a.custodian}</p>
              {a.expenseId && (
                <p className="text-[11px] text-slate-600">
                  🧾 {v ? (<>
                    <span dir="ltr" className="font-mono">{v.voucherNo}</span> · {supplierOf(v.vendorId)} · <span dir="ltr">{a.purchaseDate}</span>
                    {projectOf(a.fundingProjectId) ? ` · ${projectOf(a.fundingProjectId)}` : ""}
                  </>) : t("Bought on a payment request on file")}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 font-mono text-[11px]">
                <div>
                  <span className="block text-[9px] text-slate-400">{t("COST")}</span>
                  <span dir="ltr" className="font-bold text-slate-800">{money(a.cost, a.currency)}</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">{t("ACCUM DEP")}</span>
                  <span dir="ltr" className="font-bold text-slate-800">-{money(a.accumulatedDepreciation, a.currency)}</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">{t("BOOK VALUE")}</span>
                  <span dir="ltr" className="font-bold text-red-650">{money(a.currentBookValue, a.currency)}</span>
                </div>
              </div>

              {a.receivedAt && (
                <p className="text-[11px] text-slate-600">📦 {t("Received by")} {nameOf(a.receivedBy)} · <span dir="ltr">{a.receivedAt.slice(0, 10)}</span></p>
              )}
              {a.verifiedAt && (
                <p className="text-[11px] text-emerald-800">✓ {t("Confirmed by")} {nameOf(a.verifiedBy)} · <span dir="ltr">{a.verifiedAt.slice(0, 10)}</span> · {t(a.condition)}</p>
              )}

              {(docs.length > 0 || receiving) && (
                <div className="flex flex-wrap items-center gap-2">
                  {docs.map(doc => (
                    <button
                      key={doc.id} type="button" onClick={() => openDoc(doc)}
                      aria-label={`${doc.category} ${doc.refNo || ""}`}
                      className="h-16 w-16 overflow-hidden rounded border border-slate-200 bg-slate-50"
                    >
                      <img src={withTicket(`/api/document/content/${doc.id}`)} alt={doc.category} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                  {receiving && (
                    <label className="inline-flex h-16 min-w-16 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50">
                      📷 {t("Add photo")}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addPhoto(a.id, a.tag || "", e)} />
                    </label>
                  )}
                </div>
              )}

              {/* The same predicate the route asks. The keeper of the register is not a
                  verifier at all; a verifier who took delivery sees why they cannot confirm. */}
              {verifier && (mayVerifyEquipment(currentUser, a) ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <select
                    aria-label={t("Condition found")} value={d.condition}
                    onChange={e => setVerifyDraft({ ...verifyDraft, [a.id]: { ...d, condition: e.target.value } })}
                    className="finance-input min-h-[44px] bg-white text-xs md:min-h-0"
                  >
                    {CONDITIONS.map(c => <option key={c} value={c}>{t(c)}</option>)}
                  </select>
                  <input
                    aria-label={t("Kept at")} value={d.location}
                    onChange={e => setVerifyDraft({ ...verifyDraft, [a.id]: { ...d, location: e.target.value } })}
                    className="finance-input min-h-[44px] w-40 text-xs md:min-h-0"
                  />
                  <button type="button" onClick={() => handleVerify(a)} className="min-h-[44px] rounded bg-slate-900 px-3 text-[11px] font-bold text-white hover:bg-slate-950 md:min-h-0 md:py-1.5">
                    ✓ {status === "Verified" ? t("Confirm again") : t("Confirm it is here")}
                  </button>
                </div>
              ) : (
                <button type="button" disabled className="w-full cursor-not-allowed rounded bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
                  ✓ {t("Confirm it is here")} — {t("you took delivery of this; someone else confirms it")}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
