import { FormEvent, useState } from "react";
import { Banknote } from "lucide-react";
import { ic } from "../nav";
import { SharedProps } from "./shared";
import { receiptLog } from "../receipts";

type Props = Pick<SharedProps, "state" | "currentUser" | "t" | "triggerToast" | "refreshState"> & {
  purpose: "quotation" | "project";
  quotation?: { id: string; quoteNo: string; currency: string };
  project?: { id: string; code: string; channelRule?: string; channelRuleSource?: string };
  defaultAmount?: number;
  onClose: () => void;
};

/**
 * Money received outside the bank — BOB Finance, OMT, Whish, a cheque, cash — recorded on the
 * channel's own account with its evidence (Policy 020 §4.4.4), through the one route every
 * off-bank receipt uses. Used for a quotation's payment and for a project's further tranche.
 * For cash the evidence is the RC number of the receipt signed by both sides; until its signed
 * scan is filed the receipt is listed as missing it.
 */
export default function ReceiveOffbankForm({ state, currentUser, t, triggerToast, refreshState, purpose, quotation, project, defaultAmount, onClose }: Props) {
  const today = new Date().toLocaleDateString("en-CA");
  const [f, setF] = useState({ accountId: "", date: today, amount: defaultAmount ? String(defaultAmount) : "", reference: "" });
  const [busy, setBusy] = useState(false);

  // The channels, never the 1120 clearing account; a quotation is paid in its own currency.
  const channels = (state.bankAccounts || []).filter((a: any) =>
    a.type === "Off-bank channel" && a.active && a.ledgerCode !== "1120" && (!quotation || a.currency === quotation.currency));
  const channel: any = channels.find((a: any) => a.id === f.accountId);
  const isCash = channel?.accountNo === "Cash";
  // For a quotation, cash evidence is one of the receipts issued against it — picked, not retyped,
  // so the RC number matches the receipt log exactly and its signed scan can be found.
  const receipts = receiptLog((state.documents || []) as any);
  const offered = quotation ? receipts.filter(r => r.quotationId === quotation.id) : [];
  const chosenReceipt = receipts.find(r => r.receiptNo === f.reference.trim());
  const bankOnly = project?.channelRule === "bank";

  const label = busy ? t("Recording…")
    : bankOnly ? t("Cannot record — this project may use the bank only")
    : !f.accountId ? (channels.length ? t("Record — choose the channel") : t("No active channel in this currency"))
    : !(Number(f.amount) > 0) ? t("Record — enter the amount")
    : !f.reference.trim() ? (isCash ? t("Record — enter the RC number of the signed receipt") : t("Record — enter the channel's reference"))
    : t("Record money received");
  const ready = !busy && !bankOnly && !!f.accountId && Number(f.amount) > 0 && !!f.reference.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      const res = await fetch("/api/offbank/receive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: f.accountId, date: f.date, amount: Number(f.amount), reference: f.reference.trim(), purpose,
          ...(quotation ? { quotationId: quotation.id } : {}), ...(project ? { projectId: project.id } : {}), user: currentUser
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The receipt was refused.");
      triggerToast(`${quotation?.quoteNo || project?.code}: ${t("received through")} ${channel?.name} — ${t("recorded with its evidence")}.`);
      onClose();
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const lbl = "block text-[10px] font-bold text-slate-600 uppercase mb-1";
  const fld = "finance-input w-full text-xs min-h-[44px]";
  return (
    <form onSubmit={submit} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
      <h4 className="text-sm font-bold text-slate-800 uppercase font-mono">
        <span className="inline-flex items-center gap-1.5">{ic(Banknote)}{purpose === "quotation" ? t("Record money received outside the bank") : t("Record a further tranche")} — <span dir="ltr">{quotation?.quoteNo || project?.code}</span></span>
      </h4>
      {bankOnly && (
        <p className="text-[11px] font-bold text-red-700">
          {t("Its agreement makes this project bank only: the donor's money must arrive through the bank.")}{project?.channelRuleSource ? <> (<span dir="ltr">{project.channelRuleSource}</span>)</> : null}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="ob-channel" className={lbl}>{t("Channel")}</label>
          <select id="ob-channel" value={f.accountId} onChange={e => setF({ ...f, accountId: e.target.value, reference: "" })} className={fld}>
            <option value="">—</option>
            {channels.map((a: any) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ob-ref" className={lbl}>{isCash ? t("Signed receipt №") : t("Reference or cheque number")}</label>
          {isCash && offered.length ? (
            <select id="ob-ref" value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} className={`${fld} font-mono`}>
              <option value="">—</option>
              {offered.map(r => <option key={r.receiptNo} value={r.receiptNo}>{r.receiptNo}</option>)}
            </select>
          ) : (
            <input id="ob-ref" type="text" value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder={isCash ? "RC-001/2026" : ""} className={`${fld} font-mono`} dir="ltr" />
          )}
        </div>
        <div>
          <label htmlFor="ob-date" className={lbl}>{t("Received on")}</label>
          <input id="ob-date" type="date" max={today} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={`${fld} font-mono`} />
        </div>
        <div>
          <label htmlFor="ob-amount" className={lbl}>{t("Amount received")}{channel ? <> (<span dir="ltr">{channel.currency}</span>)</> : null}</label>
          <input id="ob-amount" type="number" min="0" step="any" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className={`${fld} font-mono`} />
        </div>
      </div>
      {isCash && quotation && !offered.length && (
        <p className="text-[11px] text-amber-800">{t("No receipt has been issued for this quotation yet — issue one with the receipt button, have it signed, then record the cash against its number.")}</p>
      )}
      {isCash && chosenReceipt && !chosenReceipt.signed && (
        <p className="text-[11px] font-bold text-red-700">
          {t("Signed scan missing")} — <a href="#receipt-log" className="underline">{t("attach it in the receipt log")}</a>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!ready} className="bg-red-600 text-white font-medium text-xs rounded-lg px-4 min-h-[44px] hover:bg-red-700 disabled:opacity-60 transition-all">{label}</button>
        <button type="button" onClick={onClose} className="bg-slate-100 text-slate-600 font-medium text-xs rounded-lg px-4 min-h-[44px] hover:bg-slate-200 transition-all">{t("Cancel")}</button>
      </div>
    </form>
  );
}
