import React, { useCallback, useEffect, useState } from "react";
import { SharedProps } from "./shared";
import { FINANCE, REPORT_READERS } from "../roles";
import { CASH_AWAITING_VOUCHERS_NAME, HISTORICAL_CLEARING_LEDGER, DEPOSITS_IN_TRANSIT_LEDGER, isDrawRef, isDrawReturnRef, isTopUpRef, isOffbankDepositRef } from "../pettyCash";

type Props = Pick<SharedProps, "state" | "currentUser" | "t" | "triggerToast" | "refreshState" | "formatUSD">;

type Line = { id: string; bankAccountId: string; date: string; amount: number; type: string; description: string; noticeRef?: string; evidenceRef?: string };
type Overview = {
  openedOn: string;
  channels: { id: string; name: string; accountNo: string; currency: string; balance: number; ledgerCode: string }[];
  receipts: (Line & { scanMissing: boolean })[];
  waiting: (Line & { candidates: Line[] })[];
  awaitingVouchers: { balanceUSD: number; drawnUSD: number; receivedUSD: number; projects: { projectId: string; code: string; name: string; receivedUSD: number; documentedUSD: number; undocumented: boolean }[] };
};

const post = async (url: string, body: any, currentUser: any) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, user: currentUser }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The request was refused.");
  return data;
};

const label = "block text-[10px] font-bold text-slate-600 uppercase mb-1";
const field = "finance-input w-full text-xs min-h-[44px]";

/**
 * Money received or paid outside the bank (Policy 020 §4.4.4) and cash awaiting vouchers (§4.4.5).
 * Money received through a channel is recorded with its evidence; it is then paid in at the bank,
 * or drawn into cash in transit against approved requests (the panel above). Never paid out directly.
 */
export default function OffBankPanel({ state, currentUser, t, triggerToast, refreshState, formatUSD }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString("en-CA");
  const [rc, setRc] = useState({ accountId: "", date: today, amount: "", reference: "", purpose: "quotation", quotationId: "", projectId: "", note: "" });
  const [dep, setDep] = useState({ accountId: "", targetAccountId: "ba-blom-usd", date: today, amount: "" });
  const [pick, setPick] = useState<Record<string, string>>({});

  const mayRead = REPORT_READERS.includes(currentUser.role);
  const load = useCallback(async () => {
    const res = await fetch("/api/offbank/overview");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { if (mayRead) load(); }, [mayRead, load]);
  if (!mayRead || !data) return null;

  const isFinance = FINANCE.includes(currentUser.role);
  const channels = data.channels;
  const channelOf = (id: string) => channels.find(c => c.id === id);
  const bankName = (id: string) => (state.bankAccounts || []).find(b => b.id === id)?.name || id;
  const banks = (state.bankAccounts || []).filter(b => b.type === "Bank" && b.active);
  const rcChannel = channelOf(rc.accountId);
  const isCash = rcChannel?.accountNo === "Cash";
  const quotes = (state.quotations || []).filter((q: any) => q.status !== "Paid" && q.status !== "Rejected");
  const projects = state.projects || [];
  const chosenProject = projects.find((p: any) => p.id === rc.projectId) as any;
  const depChannel = channelOf(dep.accountId);
  const av = data.awaitingVouchers;

  const act = async (fn: () => Promise<any>, ok: string, reset: () => void) => {
    setBusy(true);
    try { await fn(); triggerToast(ok); reset(); await load(); refreshState(); }
    catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };
  const kindOf = (ref?: string, voucherNo?: string | null) => voucherNo && !ref ? `${t("Payment of")} ${voucherNo}` : isDrawRef(ref) ? t("Withdrawal for payment requests") : isDrawReturnRef(ref) ? t("Leftover redeposited")
    : isTopUpRef(ref) ? t("Top-up of the float") : isOffbankDepositRef(ref) ? t("Paid in from an off-bank channel") : "";

  const rcLabel = busy ? t("Recording…")
    : !rc.accountId ? t("Record — choose the channel")
    : !(Number(rc.amount) > 0) ? t("Record — enter the amount")
    : !rc.reference.trim() ? (isCash ? t("Record — enter the RC number of the signed receipt") : t("Record — enter the channel's reference"))
    : rc.purpose === "quotation" && !rc.quotationId ? t("Record — choose the quotation")
    : rc.purpose === "project" && !rc.projectId ? t("Record — choose the project")
    : chosenProject?.channelRule === "bank" ? t("Record — this project may use the bank only")
    : t("Record money received");

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
      <div>
        <h3 className="text-md font-bold text-slate-900">{t("Money outside the bank")}</h3>
        <p className="text-xs text-slate-500">{t("BOB Finance, OMT, Whish, cheques and cash — deposited at the bank or drawn for approved requests, never paid out directly.")} {t("Policy")} <span dir="ltr" className="whitespace-nowrap">020 §4.4.4</span></p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {channels.map(c => (
          <li key={c.id} className="flex items-baseline justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2 text-xs">
            <span className="text-slate-700"><bdi>{c.name}</bdi> · {t("ledger")} <span dir="ltr">{c.ledgerCode}</span></span>
            <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{formatUSD(c.balance)}</span>
          </li>
        ))}
      </ul>
      {!data.openedOn && <p className="text-[11px] text-slate-600">{t("Until the float's opening count, money received is recorded as cash awaiting vouchers, and the channel balances stay at zero.")}</p>}

      {isFinance && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">{t("Record money received")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ob-channel" className={label}>{t("Channel")}</label>
              <select id="ob-channel" value={rc.accountId} onChange={e => setRc({ ...rc, accountId: e.target.value })} className={field}>
                <option value="">{t("Choose")}</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ob-date" className={label}>{t("Received on")}</label>
              <input id="ob-date" type="date" max={today} value={rc.date} onChange={e => setRc({ ...rc, date: e.target.value })} className={`${field} font-mono`} />
            </div>
            <div>
              <label htmlFor="ob-amount" className={label}>{t("Amount")}{rcChannel ? <> (<span dir="ltr">{rcChannel.currency}</span>)</> : null}</label>
              <input id="ob-amount" type="number" min="0" step="0.01" inputMode="decimal" value={rc.amount} onChange={e => setRc({ ...rc, amount: e.target.value })} className={`${field} font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ob-ref" className={label}>{isCash ? t("RC number of the receipt signed by both sides") : t("Channel reference or cheque number")}</label>
              <input id="ob-ref" dir="ltr" value={rc.reference} onChange={e => setRc({ ...rc, reference: e.target.value })} className={`${field} font-mono text-start`} />
              {isCash && <p className="text-[11px] text-slate-600 mt-1">{t("Until the signed scan is filed, the receipt is listed as a missing document.")}</p>}
            </div>
            <div>
              <label htmlFor="ob-purpose" className={label}>{t("What it is for")}</label>
              <select id="ob-purpose" value={rc.purpose} onChange={e => setRc({ ...rc, purpose: e.target.value, quotationId: "", projectId: "" })} className={field}>
                <option value="quotation">{t("A client paying a quotation")}</option>
                <option value="project">{t("A donor tranche for a project")}</option>
                <option value="other">{t("Other income")}</option>
              </select>
            </div>
          </div>
          {rc.purpose === "quotation" && (
            <div>
              <label htmlFor="ob-quote" className={label}>{t("Quotation")}</label>
              <select id="ob-quote" value={rc.quotationId} onChange={e => setRc({ ...rc, quotationId: e.target.value })} className={field}>
                <option value="">{t("Choose")}</option>
                {quotes.map((q: any) => <option key={q.id} value={q.id}>{q.quoteNo} · {q.currency} {q.amount}</option>)}
              </select>
            </div>
          )}
          {rc.purpose === "project" && (
            <div>
              <label htmlFor="ob-project" className={label}>{t("Project")}</label>
              <select id="ob-project" value={rc.projectId} onChange={e => setRc({ ...rc, projectId: e.target.value })} className={field}>
                <option value="">{t("Choose")}</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.code}{p.channelRule === "bank" ? ` — ${t("bank only")}` : ""}</option>)}
              </select>
            </div>
          )}
          <input aria-label={t("Note")} placeholder={t("Note")} value={rc.note} onChange={e => setRc({ ...rc, note: e.target.value })} className={field} />
          <button type="button" disabled={busy || rcLabel !== t("Record money received")}
            onClick={() => act(() => post("/api/offbank/receive", rc, currentUser), t("Money received recorded."), () => setRc({ ...rc, amount: "", reference: "", note: "" }))}
            className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg px-4">{rcLabel}</button>
        </div>
      )}

      {isFinance && data.openedOn && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">{t("Pay in at the bank")}</h4>
          <p className="text-[11px] text-slate-600">{t("The money waits on ledger")} <span dir="ltr">{DEPOSITS_IN_TRANSIT_LEDGER}</span> {t("until the statement line is matched below.")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="ob-dep-from" className={label}>{t("Channel")}</label>
              <select id="ob-dep-from" value={dep.accountId} onChange={e => setDep({ ...dep, accountId: e.target.value })} className={field}>
                <option value="">{t("Choose")}</option>
                {channels.filter(c => c.balance > 0).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ob-dep-to" className={label}>{t("Into the bank account")}</label>
              <select id="ob-dep-to" value={dep.targetAccountId} onChange={e => setDep({ ...dep, targetAccountId: e.target.value })} className={field}>
                {banks.filter(b => !depChannel || b.currency === depChannel.currency).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ob-dep-date" className={label}>{t("Paid in on")}</label>
              <input id="ob-dep-date" type="date" max={today} value={dep.date} onChange={e => setDep({ ...dep, date: e.target.value })} className={`${field} font-mono`} />
            </div>
            <div>
              <label htmlFor="ob-dep-amount" className={label}>{t("Amount")}</label>
              <input id="ob-dep-amount" type="number" min="0" step="0.01" inputMode="decimal" value={dep.amount} onChange={e => setDep({ ...dep, amount: e.target.value })} className={`${field} font-mono`} />
            </div>
          </div>
          <button type="button" disabled={busy || !dep.accountId || !(Number(dep.amount) > 0)}
            onClick={() => act(() => post("/api/offbank/deposit", dep, currentUser), t("Deposit recorded — waiting for the statement."), () => setDep({ ...dep, amount: "" }))}
            className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg px-4">
            {busy ? t("Recording…") : !dep.accountId ? t("Record deposit — choose the channel") : !(Number(dep.amount) > 0) ? t("Record deposit — enter the amount") : t("Record deposit")}
          </button>
        </div>
      )}

      {data.waiting.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">{t("Waiting for the bank statement")}</h4>
          <ul className="divide-y divide-slate-100">
            {data.waiting.map(w => (
              <li key={w.id} className="py-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-700">{kindOf(w.noticeRef, (w as any).voucherNo)} · <bdi>{bankName(w.bankAccountId)}</bdi></span>
                  <span dir="ltr" className="font-mono text-slate-600 whitespace-nowrap">{w.date}</span>
                  <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{w.type === "Withdrawal" ? "−" : "+"}{formatUSD(w.amount)}</span>
                </div>
                {isFinance && (w.candidates.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select aria-label={t("Statement line")} value={pick[w.id] || ""} onChange={e => setPick(p => ({ ...p, [w.id]: e.target.value }))} className={`${field} sm:col-span-2`}>
                      <option value="">{t("Choose the statement line")}</option>
                      {w.candidates.map(c => <option key={c.id} value={c.id}>{c.date} · {c.amount.toFixed(2)} · {c.description.slice(0, 50)}</option>)}
                    </select>
                    <button type="button" disabled={busy || !pick[w.id]}
                      onClick={() => act(() => post("/api/bank/match-line", { pendingId: w.id, lineId: pick[w.id] }, currentUser), t("Statement line matched."), () => setPick({}))}
                      className="min-h-[44px] border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium rounded-lg px-3 disabled:opacity-50">{t("Match")}</button>
                  </div>
                ) : <p className="text-[11px] text-slate-600">{t("No statement line matches yet — import the next statement.")}</p>)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.receipts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">{t("Received outside the bank")}</h4>
          <ul className="divide-y divide-slate-100">
            {data.receipts.slice(0, 12).map(r => (
              <li key={r.id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                <span dir="ltr" className="font-mono text-slate-600 whitespace-nowrap">{r.date}</span>
                <span className="text-slate-700"><bdi>{channelOf(r.bankAccountId)?.name || bankName(r.bankAccountId)}</bdi> · <span dir="ltr" className="font-mono whitespace-nowrap">{r.evidenceRef}</span></span>
                <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{formatUSD(r.amount)}</span>
                {r.scanMissing && <span className="text-red-700 font-bold whitespace-nowrap">{t("Signed scan missing")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900">{t(CASH_AWAITING_VOUCHERS_NAME)}</h4>
            <p className="text-[11px] text-slate-600">{t("Cash drawn or received before the float opened with no voucher yet. Not cash in the box, and never counted as such. It falls as past vouchers are recorded.")} {t("ledger")} <span dir="ltr">{HISTORICAL_CLEARING_LEDGER}</span> · {t("Policy")} <span dir="ltr" className="whitespace-nowrap">020 §4.4.5</span></p>
          </div>
          <span dir="ltr" className="text-2xl font-bold font-mono text-slate-900 whitespace-nowrap">{formatUSD(av.balanceUSD)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="border border-slate-200 rounded-lg px-3 py-2 flex justify-between gap-3"><span>{t("Drawn from BLOM")}</span><span dir="ltr" className="font-mono font-bold">{formatUSD(av.drawnUSD)}</span></div>
          <div className="border border-slate-200 rounded-lg px-3 py-2 flex justify-between gap-3"><span>{t("Received outside the bank")}</span><span dir="ltr" className="font-mono font-bold">{formatUSD(av.receivedUSD)}</span></div>
        </div>
        <ul className="divide-y divide-slate-100 border-y border-slate-100">
          {av.projects.map(p => (
            <li key={p.projectId} className={`py-2 text-xs space-y-1 ${p.undocumented ? "bg-red-50/70 -mx-3 px-3 rounded" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span dir="ltr" className="font-mono font-bold whitespace-nowrap">{p.code}</span>
                {p.undocumented && <span className="text-red-700 font-bold">{t("Received cash not yet documented")}</span>}
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 text-slate-600">
                <span>{t("received")} <span dir="ltr" className="font-mono whitespace-nowrap">{formatUSD(p.receivedUSD)}</span></span>
                <span>{t("documented")} <span dir="ltr" className="font-mono whitespace-nowrap">{formatUSD(p.documentedUSD)}</span></span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
