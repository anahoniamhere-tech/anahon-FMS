import React, { useEffect, useState } from "react";
import { SharedProps } from "./shared";
import { EQUIPMENT_VERIFIERS, SUPPLIER_EDITORS } from "../roles";
import { withTicket } from "../docTicket";
import { CONDITIONS, CURRENCIES, NO_SERIAL, CHECK_EVERY_MONTHS, DEFAULT_CHECK_MONTHS, STICKER_SIZES, DEFAULT_STICKER_MM, checkOutBlocker, equipmentStatus, mayVerifyEquipment } from "../equipment";
import { addDays, localToday } from "../workflow";

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

export default function AssetsTab({ currentUser, focusId, lang, openDoc, refreshState, setFocusId, state, t, triggerToast }: SharedProps) {
  const [f, setF] = useState({ ...BLANK, custodian: currentUser?.name || "" });
  const set = (k: keyof typeof BLANK, v: string | boolean) => setF(prev => ({ ...prev, [k]: v }));
  const [labelPhoto, setLabelPhoto] = useState<Photo | null>(null);
  const [itemPhoto, setItemPhoto] = useState<Photo | null>(null);
  const [scan, setScan] = useState<{ busy: boolean; confidence?: string; warnings?: string[]; duplicateOfTag?: string }>({ busy: false });
  const [saving, setSaving] = useState(false);
  const [verifyDraft, setVerifyDraft] = useState<Record<string, { condition: string; location: string; months: string }>>({});
  // One open panel at a time — check out, check in or a repair — and its fields.
  const [panel, setPanel] = useState<{ id: string; kind: "out" | "in" | "repair" } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  // Which items to print stickers for, and at what size.
  const [stickersOpen, setStickersOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stickerMm, setStickerMm] = useState<number>(DEFAULT_STICKER_MM);
  // Print after scan: every item registered since this screen opened, printed in one go.
  const [justReceived, setJustReceived] = useState<string[]>([]);

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
      // A scan replaces what the last one read, blanks included. Keeping the previous value
      // when this label shows nothing would leave one item's serial in another item's form.
      // Only the person's own "No serial on item" tick survives a scan.
      setF(prev => ({
        ...prev,
        name: x.name || "", brand: x.brand || "", model: x.model || "",
        serial: x.serialNumber || "", noSerial: x.serialNumber ? false : prev.noSerial,
        specs: x.specs || "",
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
      setJustReceived(prev => [...prev, id]);
      // Photos are filed after the item exists, because they are filed against it. A photo
      // that fails leaves the item registered and says so — it can be added from the card.
      const filed = await Promise.all([
        labelPhoto ? fileOn(id, { ...labelPhoto, filename: `${tag}_label${extOf(labelPhoto)}` }, "Equipment Label") : true,
        itemPhoto ? fileOn(id, { ...itemPhoto, filename: `${tag}_item${extOf(itemPhoto)}` }, "Equipment Photo") : true,
      ]);
      if (filed.every(Boolean)) triggerToast(`${t("Received")} — ${tag}. ${t("Added to the stickers to print below.")}`);
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
    const d = verifyDraft[a.id] || { condition: a.condition, location: a.location, months: String(DEFAULT_CHECK_MONTHS) };
    const res = await fetch("/api/assets/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: a.id, condition: d.condition, location: d.location, checkEveryMonths: Number(d.months) }),
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

  const today = localToday();
  const dayFmt = (ymd?: string | null) => ymd
    ? new Date(`${ymd.slice(0, 10)}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-LB" : "en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "";
  const activeUsers = state.users.filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name));

  // A sticker's QR, or a desk row, opens /?door=assets&focus=<id>: bring that item into view.
  useEffect(() => {
    if (!focusId) return;
    // A desk row or a notification names the item's id; a sticker's short link (/e/EQ-004)
    // names its tag, because the open route that redirects it looks nothing up.
    const want = focusId.replace(/^fixedAssets:/, "");
    const hit = /^tag:/i.test(want)
      ? assets.find(a => (a.tag || "").toUpperCase() === want.slice(4).toUpperCase())
      : assets.find(a => a.id === want);
    if (!hit) return;
    const id = hit.id;
    setFocusId(null);
    setHighlight(id);
    setTimeout(() => document.getElementById(`asset-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    const off = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(off);
  }, [focusId, assets.length]);

  const openPanel = (id: string, kind: "out" | "in" | "repair", seed: Record<string, string> = {}) => {
    setPanel(panel?.id === id && panel.kind === kind ? null : { id, kind });
    setDraft(seed);
  };
  const field = (k: string) => draft[k] ?? "";
  const setField = (k: string, v: string) => setDraft(prev => ({ ...prev, [k]: v }));

  // The three custody writes go one way. The route decides, and a refusal is shown as it says it.
  const send = async (path: string, body: object, done: string) => {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return triggerToast(data.error || "Refused.", "error");
    triggerToast(done);
    setPanel(null);
    setDraft({});
    refreshState();
  };

  const btn = "inline-flex min-h-[44px] items-center gap-1 rounded bg-slate-900 px-3 text-[11px] font-bold text-white hover:bg-slate-950 md:min-h-0 md:py-1.5";
  const btnGhost = "inline-flex min-h-[44px] items-center gap-1 rounded border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 md:min-h-0 md:py-1.5";
  const btnOff = "inline-flex min-h-[44px] cursor-not-allowed items-center rounded bg-slate-100 px-3 text-[11px] font-semibold text-slate-500 md:min-h-0 md:py-1.5";
  const lbl = "block text-[10px] font-bold text-slate-600 uppercase mb-1";
  const inp = "finance-input w-full text-xs min-h-[44px] md:min-h-0";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t("Fixed Assets capitalization Register")}</h2>
          <p className="text-xs text-slate-500 md:max-w-xl">
            {t("Photograph the label when equipment arrives. The person who took delivery registers it; somebody else confirms it is really here.")}
          </p>
        </div>
        {assets.some(a => a.tag) && (
          <button
            type="button" aria-expanded={stickersOpen}
            onClick={() => {
              // Opens on the new ones: whatever arrived this week, the usual reason to print.
              if (!stickersOpen) setPicked(new Set(assets.filter(a => a.tag && (a.receivedAt || "").slice(0, 10) >= addDays(today, -7)).map(a => a.id)));
              setStickersOpen(!stickersOpen);
            }}
            className={btnGhost}
          >
            🏷 {t("Stickers")}
          </button>
        )}
      </div>

      {stickersOpen && (() => {
        const tagged = assets.filter(a => a.tag).sort((x, y) => String(y.receivedAt || "").localeCompare(String(x.receivedAt || "")));
        const sample = tagged.find(a => picked.has(a.id)) || tagged[0];
        return (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{t("Stickers")}</h3>
              <button type="button" onClick={() => setPicked(new Set(tagged.map(a => a.id)))} className={btnGhost}>{t("All")}</button>
              <button type="button" onClick={() => setPicked(new Set(tagged.filter(a => (a.receivedAt || "").slice(0, 10) >= addDays(today, -7)).map(a => a.id)))} className={btnGhost}>{t("Received this week")}</button>
              <button type="button" onClick={() => setPicked(new Set())} className={btnGhost}>{t("None")}</button>
              <select aria-label={t("Sticker size")} value={stickerMm} onChange={e => setStickerMm(Number(e.target.value))} className="finance-input min-h-[44px] bg-white text-xs md:min-h-0">
                {STICKER_SIZES.map(mm => <option key={mm} value={mm}>{t("QR {n} cm").replace("{n}", String(mm / 10))}</option>)}
              </select>
            </div>
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto md:grid-cols-2">
              {tagged.map(a => (
                <label key={a.id} className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded px-1 text-xs hover:bg-slate-50">
                  <input
                    type="checkbox" className="h-4 w-4" checked={picked.has(a.id)}
                    onChange={e => { const next = new Set(picked); e.target.checked ? next.add(a.id) : next.delete(a.id); setPicked(next); }}
                  />
                  <span dir="ltr" className="font-mono font-bold">{a.tag}</span>
                  <span className="truncate">{a.name}</span>
                  <span dir="ltr" className="ms-auto shrink-0 text-[10px] text-slate-400">{(a.receivedAt || "").slice(0, 10)}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {picked.size > 0 ? (
                <a href={withTicket(`/api/assets/stickers?size=${stickerMm}&ids=${[...picked].map(encodeURIComponent).join(",")}`)} target="_blank" rel="noreferrer" className={btn}>
                  🖨 {t("Print {n} stickers").replace("{n}", String(picked.size))}
                </a>
              ) : (
                <button type="button" disabled className={btnOff}>🖨 {t("Print")} — {t("choose at least one item")}</button>
              )}
              {sample && (
                <a href={withTicket(`/api/assets/stickers?strip=1&ids=${encodeURIComponent(sample.id)}`)} target="_blank" rel="noreferrer" className={btnGhost}>
                  📏 {t("Test strip")} — <span dir="ltr">{sample.tag}</span>
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{t("Print at 100% (actual size), never “fit to page”. Test the printed strip with a phone's own camera — not the screen.")}</p>
          </div>
        );
      })()}

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
              {scan.warnings?.map((w, i) => <p key={i} dir="auto">⚠ {w}</p>)}
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

      {/* Print after scan: scan the whole lot, then print every one of them on A4 in one go —
          one tiny sticker per sheet would waste the sheet. */}
      {receiving && justReceived.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <span className="text-xs font-bold text-emerald-900">
            🏷 {t("{n} received just now — print their stickers when you have scanned the lot.").replace("{n}", String(justReceived.length))}
          </span>
          <select aria-label={t("Sticker size")} value={stickerMm} onChange={e => setStickerMm(Number(e.target.value))} className="finance-input min-h-[44px] bg-white text-xs md:min-h-0">
            {STICKER_SIZES.map(mm => <option key={mm} value={mm}>{t("QR {n} cm").replace("{n}", String(mm / 10))}</option>)}
          </select>
          <a href={withTicket(`/api/assets/stickers?size=${stickerMm}&ids=${justReceived.map(encodeURIComponent).join(",")}`)} target="_blank" rel="noreferrer" className={btn}>
            🖨 {t("Print {n} stickers").replace("{n}", String(justReceived.length))}
          </a>
          <button type="button" onClick={() => setJustReceived([])} className={btnGhost}>{t("Done — clear the list")}</button>
        </div>
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
          const d = verifyDraft[a.id] || { condition: a.condition, location: a.location, months: String(DEFAULT_CHECK_MONTHS) };
          return (
            <div key={a.id} id={`asset-${a.id}`} className={`p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3 ${highlight === a.id ? "ring-2 ring-amber-400" : ""}`}>
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

              {a.holderId && (
                <p className={`rounded-lg px-3 py-2 text-xs font-bold ${a.dueBack && a.dueBack < today ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>
                  📤 {t("With {name} — {purpose} — due {date}")
                    .replace("{name}", nameOf(a.holderId).split(/\s+/)[0])
                    .replace("{purpose}", a.heldFor || "")
                    .replace("{date}", dayFmt(a.dueBack))}
                  {a.dueBack && a.dueBack < today ? ` · ${t("overdue")}` : ""}
                </p>
              )}
              {a.nextCheckDue && !a.holderId && (
                <p className={`text-[11px] ${a.nextCheckDue < today ? "font-bold text-red-700" : "text-slate-500"}`}>
                  🔎 {t("Next physical check")}: <span dir="ltr">{a.nextCheckDue}</span>
                </p>
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

              {receiving && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {a.holderId ? (
                    <button type="button" onClick={() => openPanel(a.id, "in", { location: a.location })} className={btn}>📥 {t("Check in")}</button>
                  ) : checkOutBlocker(a) ? (
                    // The route's own reason, as the label — never a tooltip a phone cannot show.
                    <button type="button" disabled className={btnOff}>📤 {t("Check out")} — {t(checkOutBlocker(a)!)}</button>
                  ) : (
                    <button type="button" onClick={() => openPanel(a.id, "out")} className={btn}>📤 {t("Check out")}</button>
                  )}
                  <button type="button" onClick={() => openPanel(a.id, "repair", { date: today })} className={btnGhost}>🔧 {t("Log a repair")}</button>
                  {a.tag && (
                    <a href={withTicket(`/api/assets/stickers?ids=${encodeURIComponent(a.id)}`)} target="_blank" rel="noreferrer" className={btnGhost}>🏷 {t("Print sticker")}</a>
                  )}
                </div>
              )}

              {panel?.id === a.id && panel.kind === "out" && (
                <form
                  onSubmit={e => { e.preventDefault(); send("/api/assets/checkout", { assetId: a.id, holderId: field("holderId"), heldFor: field("heldFor"), projectId: field("projectId"), dueBack: field("dueBack") }, `${a.tag} — ${t("checked out")}`); }}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2"
                >
                  <div>
                    <label htmlFor={`out-who-${a.id}`} className={lbl}>{t("Who is taking it")}</label>
                    <select id={`out-who-${a.id}`} required value={field("holderId")} onChange={e => setField("holderId", e.target.value)} className={`${inp} bg-white`}>
                      <option value="">{t("— choose —")}</option>
                      {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`out-for-${a.id}`} className={lbl}>{t("What for — the project or the shoot")}</label>
                    <input id={`out-for-${a.id}`} required value={field("heldFor")} onChange={e => setField("heldFor", e.target.value)} placeholder={t("e.g. Tripoli shoot")} className={inp} />
                  </div>
                  <div>
                    <label htmlFor={`out-proj-${a.id}`} className={lbl}>{t("Funded by project")}</label>
                    <select id={`out-proj-${a.id}`} value={field("projectId")} onChange={e => setField("projectId", e.target.value)} className={`${inp} bg-white`}>
                      <option value="">{t("— none —")}</option>
                      {state.projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`out-due-${a.id}`} className={lbl}>{t("Due back")}</label>
                    <input id={`out-due-${a.id}`} type="date" required min={today} value={field("dueBack")} onChange={e => setField("dueBack", e.target.value)} className={inp} />
                  </div>
                  <button type="submit" className={`${btn} justify-center md:col-span-2`}>📤 {t("Check out")}</button>
                </form>
              )}

              {panel?.id === a.id && panel.kind === "in" && (
                <form
                  onSubmit={e => { e.preventDefault(); send("/api/assets/checkin", { assetId: a.id, condition: field("condition"), location: field("location"), note: field("note") }, `${a.tag} — ${t("checked in")}`); }}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-3"
                >
                  <div>
                    <label htmlFor={`in-cond-${a.id}`} className={lbl}>{t("Condition on return")}</label>
                    <select id={`in-cond-${a.id}`} required value={field("condition")} onChange={e => setField("condition", e.target.value)} className={`${inp} bg-white`}>
                      <option value="">{t("— choose —")}</option>
                      {CONDITIONS.map(c => <option key={c} value={c}>{t(c)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`in-loc-${a.id}`} className={lbl}>{t("Kept at")}</label>
                    <input id={`in-loc-${a.id}`} value={field("location")} onChange={e => setField("location", e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label htmlFor={`in-note-${a.id}`} className={lbl}>{t("Note")}</label>
                    <input id={`in-note-${a.id}`} value={field("note")} onChange={e => setField("note", e.target.value)} placeholder={t("e.g. lens cap missing")} className={inp} />
                  </div>
                  <button type="submit" className={`${btn} justify-center md:col-span-3`}>📥 {t("Check in")}</button>
                </form>
              )}

              {panel?.id === a.id && panel.kind === "repair" && (() => {
                const v = vouchers.find(e => e.id === field("expenseId"));
                return (
                  <form
                    onSubmit={e => { e.preventDefault(); send("/api/assets/repair", { assetId: a.id, date: field("date"), work: field("work"), doneBy: field("doneBy"), cost: field("cost"), currency: field("currency"), expenseId: field("expenseId") }, `${a.tag} — ${t("repair logged")}`); }}
                    className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2"
                  >
                    <div className="md:col-span-2">
                      <label htmlFor={`rp-work-${a.id}`} className={lbl}>{t("What was done")}</label>
                      <input id={`rp-work-${a.id}`} required value={field("work")} onChange={e => setField("work", e.target.value)} placeholder={t("e.g. replaced the battery door")} className={inp} />
                    </div>
                    <div>
                      <label htmlFor={`rp-by-${a.id}`} className={lbl}>{t("Done by")}</label>
                      <input id={`rp-by-${a.id}`} required value={field("doneBy")} onChange={e => setField("doneBy", e.target.value)} placeholder={t("a person or a repair shop")} className={inp} />
                    </div>
                    <div>
                      <label htmlFor={`rp-date-${a.id}`} className={lbl}>{t("Date")}</label>
                      <input id={`rp-date-${a.id}`} type="date" required value={field("date")} onChange={e => setField("date", e.target.value)} className={inp} />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor={`rp-v-${a.id}`} className={lbl}>{t("Paid on payment request")}</label>
                      <select id={`rp-v-${a.id}`} value={field("expenseId")} onChange={e => setField("expenseId", e.target.value)} className={`${inp} bg-white`}>
                        <option value="">{t("— not paid on a payment request —")}</option>
                        {vouchers.map(e => <option key={e.id} value={e.id}>{e.voucherNo} · {supplierOf(e.vendorId)} · {money(e.amount, e.currency)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`rp-cost-${a.id}`} className={lbl}>{t("Cost")}</label>
                      <div className="flex gap-2">
                        <input id={`rp-cost-${a.id}`} type="number" step="0.01" min="0" required dir="ltr" value={field("cost")} onChange={e => setField("cost", e.target.value)} className={`${inp} font-mono`} />
                        {v ? (
                          <span className="self-center font-mono text-xs font-bold">{v.currency}</span>
                        ) : (
                          <select aria-label={t("Currency")} required value={field("currency")} onChange={e => setField("currency", e.target.value)} className="finance-input min-h-[44px] bg-white text-xs md:min-h-0">
                            <option value="">—</option>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                    <p className="self-end text-[10px] text-slate-500">{t("A repair is an expense — the item's cost does not change.")}</p>
                    <button type="submit" className={`${btn} justify-center md:col-span-2`}>🔧 {t("Log the repair")}</button>
                  </form>
                );
              })()}

              {((a.movements?.length || 0) + (a.repairs?.length || 0)) > 0 && (
                <div>
                  <button type="button" onClick={() => setHistoryFor(historyFor === a.id ? null : a.id)} aria-expanded={historyFor === a.id} className="text-[11px] font-bold text-slate-500 hover:underline min-h-[24px]">
                    🗂 {t("History")} ({(a.movements?.length || 0) + (a.repairs?.length || 0)})
                  </button>
                  {historyFor === a.id && (
                    <div className="mt-1 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                      {[...(a.movements || [])].reverse().map(m => (
                        <p key={m.id}>
                          📤 <span dir="ltr">{m.outAt.slice(0, 10)}</span> → {nameOf(m.holderId)} · {m.heldFor} · {t("due")} <span dir="ltr">{m.dueBack}</span>
                          {m.inAt
                            ? <> · 📥 <span dir="ltr">{m.inAt.slice(0, 10)}</span> · {t(m.returnCondition || "")}{m.note ? ` — ${m.note}` : ""}</>
                            : <> · <b>{t("still out")}</b></>}
                        </p>
                      ))}
                      {[...(a.repairs || [])].reverse().map(r => (
                        <p key={r.id}>
                          🔧 <span dir="ltr">{r.date}</span> · {r.work} · {r.doneBy} · <span dir="ltr">{money(r.cost, r.currency)}</span>
                          {r.expenseId ? ` · ${state.expenses.find(e => e.id === r.expenseId)?.voucherNo || t("Bought on a payment request on file")}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* The same predicate the route asks. The keeper of the register is not a
                  verifier at all; a verifier who took delivery sees why they cannot confirm. */}
              {verifier && (a.holderId ? (
                <button type="button" disabled className="w-full cursor-not-allowed rounded bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
                  ✓ {t("Confirm it is here")} — {t("it is out; confirm it once it is back")}
                </button>
              ) : mayVerifyEquipment(currentUser, a) ? (
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
                  <select
                    aria-label={t("Next check")} value={d.months}
                    onChange={e => setVerifyDraft({ ...verifyDraft, [a.id]: { ...d, months: e.target.value } })}
                    className="finance-input min-h-[44px] bg-white text-xs md:min-h-0"
                  >
                    {CHECK_EVERY_MONTHS.map(n => <option key={n} value={n}>{t("check again in {n} months").replace("{n}", String(n))}</option>)}
                  </select>
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
