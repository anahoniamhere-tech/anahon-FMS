import React, { useCallback, useEffect, useState } from "react";
import { SharedProps } from "./shared";
import { FINANCE, REPORT_READERS } from "../roles";
import { CASH_CLEARING_LEDGER, CLEARING_ALERT_DAYS, FLOAT_TYPE, isLiveChannel } from "../pettyCash";

type Props = Pick<SharedProps, "state" | "currentUser" | "t" | "triggerToast" | "refreshState" | "formatUSD">;

type Link = { expenseId: string; voucherNo: string; netUSD: number; paid: boolean };
type Draw = {
  id: string; date: string; amountUSD: number; sourceAccountId: string; transitAccountId: string; note: string; recordedByName: string;
  remainingUSD: number; cleared: boolean; paidUSD: number; redepositedUSD: number; toFloatUSD: number;
  links: Link[]; unpaidLinks: number; ageDays: number; overdue: boolean;
};
type Request = { expenseId: string; voucherNo: string; title: string; netUSD: number; alreadyDrawnIn: string };
type Clearing = { transit: { id: string; balance: number } | null; openedOn: string; today: string; draws: Draw[]; requests: Request[] };

const post = async (url: string, body: any, currentUser: any) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, user: currentUser }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The request was refused.");
  return data;
};

/**
 * Cash in transit (1127): cash withdrawn from the bank for approved payment requests. Each
 * withdrawal names the requests it pays and stays open until they are paid and any leftover is
 * redeposited or moved to the float. Past seven days with cash still out, it is flagged.
 */
export default function CashClearingPanel({ state, currentUser, t, triggerToast, refreshState, formatUSD }: Props) {
  const [data, setData] = useState<Clearing | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("ba-blom-usd");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [back, setBack] = useState<Record<string, string>>({});

  const mayRead = REPORT_READERS.includes(currentUser.role);
  const load = useCallback(async () => {
    const res = await fetch("/api/cash/clearing");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { if (mayRead) load(); }, [mayRead, load]);

  if (!mayRead || !data || !data.transit) return null;
  const isFinance = FINANCE.includes(currentUser.role);
  const box = (state.bankAccounts || []).find(a => a.type === FLOAT_TYPE);
  const isCustodian = !!box && currentUser.id === box.custodianUserId;
  // Cash is drawn from the bank, or from money received outside it (Policy 020 §4.4.4).
  const banks = (state.bankAccounts || []).filter(a => a.active && (a.type === "Bank" || isLiveChannel(a)));
  const open = data.draws.filter(d => !d.cleared);
  const done = data.draws.filter(d => d.cleared).slice(0, 5);
  const free = data.requests.filter(r => !r.alreadyDrawnIn);
  const chosen = free.filter(r => picked[r.expenseId]);
  const needed = chosen.reduce((s, r) => s + r.netUSD, 0);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); triggerToast(ok); setPicked({}); setAmount(""); setNote(""); setBack({}); await load(); refreshState(); }
    catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const drawLabel = busy ? t("Recording…")
    : !data.openedOn ? t("Record withdrawal — the float has not had its opening count")
    : chosen.length === 0 ? t("Record withdrawal — tick the requests it pays")
    : !(Number(amount) > 0) ? t("Record withdrawal — enter the amount")
    : Number(amount) + 0.005 < needed ? t("Record withdrawal — less than the requests need")
    : t("Record withdrawal");

  const row = (d: Draw) => (
    <li key={d.id} className={`py-3 space-y-2 ${d.overdue ? "bg-red-50/70 -mx-3 px-3 rounded" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-mono text-slate-600 whitespace-nowrap"><span dir="ltr">{d.date}</span></span>
        <span className="text-slate-700">{t("drawn")} <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{formatUSD(d.amountUSD)}</span></span>
        <span className="text-slate-700">{t("left")} <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{formatUSD(d.remainingUSD)}</span></span>
        {!d.cleared && (
          <span className={`whitespace-nowrap ${d.overdue ? "text-red-700 font-bold" : "text-slate-600"}`}>
            {d.overdue ? t("Uncleared, days out") : t("days out")}: <span dir="ltr">{d.ageDays}</span>
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {d.links.map(l => (
          <li key={l.expenseId} className={`text-[11px] border rounded px-2 py-1 ${l.paid ? "border-slate-200 text-slate-600" : "border-amber-300 text-amber-900 bg-amber-50"}`}>
            <span dir="ltr" className="font-mono whitespace-nowrap">{l.voucherNo}</span> · <span dir="ltr" className="font-mono whitespace-nowrap">{formatUSD(l.netUSD)}</span> · {l.paid ? t("paid") : t("not paid yet")}
          </li>
        ))}
      </ul>
      {!d.cleared && d.unpaidLinks === 0 && d.remainingUSD > 0.004 && (isFinance || isCustodian) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input aria-label={t("Leftover amount (USD)")} placeholder={t("Leftover amount (USD)")} type="number" min="0" step="0.01" inputMode="decimal"
            value={back[d.id] ?? String(d.remainingUSD)} onChange={e => setBack(b => ({ ...b, [d.id]: e.target.value }))}
            className="finance-input text-xs font-mono min-h-[44px]" />
          {isFinance && (
            <button type="button" disabled={busy}
              onClick={() => act(() => post("/api/cash/draw/return", { drawId: d.id, amountUSD: back[d.id] ?? d.remainingUSD, targetAccountId: d.sourceAccountId }, currentUser), t("Leftover redeposited."))}
              className="min-h-[44px] border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium rounded-lg px-3 disabled:opacity-50">
              {t("Redeposit to the bank")}
            </button>
          )}
          {isCustodian && (
            <button type="button" disabled={busy}
              onClick={() => act(() => post("/api/cash/topup/raise", {
                sourceAccountId: d.transitAccountId, sourceDrawId: d.id, amountUSD: back[d.id] ?? d.remainingUSD,
                reason: `Leftover of withdrawal ${d.id} (${d.date}) moved to the float`,
              }, currentUser), t("Top-up raised for the Executive Director."))}
              className="min-h-[44px] border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium rounded-lg px-3 disabled:opacity-50">
              {t("Move to the float (top-up)")}
            </button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-md font-bold text-slate-900">{t("Cash in transit")}</h3>
          <p className="text-xs text-slate-500">{t("Cash withdrawn for approved payment requests")} · {t("ledger")} <span dir="ltr">{CASH_CLEARING_LEDGER}</span></p>
        </div>
        <span className="text-2xl font-bold font-mono text-slate-900"><span dir="ltr">{formatUSD(data.transit.balance)}</span></span>
      </div>

      {open.some(d => d.overdue) && (
        <p role="alert" className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
          {t("Withdrawals still not cleared against their requests after this many days")}: <span dir="ltr">{CLEARING_ALERT_DAYS}</span> · {t("count")}: <span dir="ltr">{open.filter(d => d.overdue).length}</span>
        </p>
      )}

      {open.length > 0 ? (
        <div>
          <h4 className="text-sm font-bold text-slate-900">{t("Open withdrawals")}</h4>
          <ul className="divide-y divide-slate-100">{open.map(row)}</ul>
        </div>
      ) : (
        <p className="text-xs text-slate-600">{t("No withdrawal is waiting to be cleared.")}</p>
      )}

      {isFinance && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">{t("Record a withdrawal")}</h4>
          <p className="text-[11px] text-slate-600">{t("Tick the approved requests this cash pays. A request is paid from one withdrawal only.")} {t("Cleared within")} <span dir="ltr">{CLEARING_ALERT_DAYS}</span> {t("days")}.</p>
          {free.length === 0 ? (
            <p className="text-xs text-slate-600">{t("No approved, unpaid request is waiting for cash.")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 border-y border-slate-100">
              {free.map(r => (
                <li key={r.expenseId}>
                  <label className="flex items-start gap-3 py-2 min-h-[44px] cursor-pointer text-xs">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={!!picked[r.expenseId]} onChange={e => setPicked(p => ({ ...p, [r.expenseId]: e.target.checked }))} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap justify-between gap-x-3">
                        <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{r.voucherNo}</span>
                        <span dir="ltr" className="font-mono whitespace-nowrap">{formatUSD(r.netUSD)}</span>
                      </span>
                      <span className="block text-slate-600 break-words">{r.title}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="cc-source" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("From the bank or a channel")}</label>
              <select id="cc-source" value={source} onChange={e => setSource(e.target.value)} className="finance-input w-full text-xs min-h-[44px]">
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cc-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Withdrawn on")}</label>
              <input id="cc-date" type="date" max={data.today} value={date} onChange={e => setDate(e.target.value)} className="finance-input w-full font-mono text-xs min-h-[44px]" />
            </div>
            <div>
              <label htmlFor="cc-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Amount (USD)")}</label>
              <input id="cc-amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder={needed ? needed.toFixed(2) : ""} value={amount} onChange={e => setAmount(e.target.value)} className="finance-input w-full font-mono text-xs min-h-[44px]" />
            </div>
          </div>
          <input aria-label={t("Note")} placeholder={t("Note")} value={note} onChange={e => setNote(e.target.value)} className="finance-input w-full text-xs min-h-[44px]" />
          {chosen.length > 0 && <p className="text-[11px] text-slate-600">{t("The ticked requests need")} <span dir="ltr" className="font-mono font-bold">{formatUSD(needed)}</span></p>}
          <button type="button"
            disabled={busy || !data.openedOn || chosen.length === 0 || !(Number(amount) > 0) || Number(amount) + 0.005 < needed}
            onClick={() => act(() => post("/api/cash/draw", { sourceAccountId: source, date, amountUSD: amount, expenseIds: chosen.map(r => r.expenseId), note }, currentUser), t("Withdrawal recorded."))}
            className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg px-4">
            {drawLabel}
          </button>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-900">{t("Cleared withdrawals")}</h4>
          <ul className="divide-y divide-slate-100">{done.map(row)}</ul>
        </div>
      )}
    </section>
  );
}
