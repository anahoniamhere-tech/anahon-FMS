import React, { useMemo, useState } from "react";
import { SharedProps } from "./shared";
import { CashTopUp } from "../types";
import { REPORT_READERS } from "../roles";
import {
  FLOAT_CEILING_LABEL, FLOAT_CEILING_USD, FLOAT_TYPE, FLOAT_LEDGER, COUNTER_SEATS, DIRECTOR_SEATS,
  countDifference, type TopUpItem,
} from "../pettyCash";

type Props = Pick<SharedProps, "state" | "currentUser" | "t" | "triggerToast" | "refreshState" | "formatUSD">;

const post = async (url: string, body: any, currentUser: any) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, user: currentUser }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The request was refused.");
  return data;
};

/**
 * The count form, on its own so it can be mounted wherever a counter can reach it. The
 * Procurement and Logistics Officer is a counter but does not see the Books doors, and their
 * state carries no bank data — so the count is BLIND: the counter enters what is in the box and
 * the server supplies the expected figure. Nothing here needs to be loaded first.
 */
export function CashCountForm({ currentUser, t, triggerToast, refreshState, formatUSD, custodianUserId }: Omit<Props, "state"> & { custodianUserId?: string }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState(today);
  const [counted, setCounted] = useState("");
  const [present, setPresent] = useState(false);
  const [surprise, setSurprise] = useState(false);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsWhy, setNeedsWhy] = useState("");

  const isDirector = DIRECTOR_SEATS.includes(currentUser.role);
  if (custodianUserId && currentUser.id === custodianUserId) {
    return <p className="text-xs text-slate-600">{t("You hold the float, so someone else counts it — the Executive Director or the Procurement and Logistics Officer, with you present.")}</p>;
  }
  if (!COUNTER_SEATS.includes(currentUser.role)) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await post("/api/cash/count", { date, countedUSD: counted, custodianPresent: present, withoutNotice: surprise, explanation: why }, currentUser);
      triggerToast(Math.abs(d.difference) >= 0.005
        ? `${t("Count recorded")}: ${formatUSD(Number(counted))} ${t("against")} ${formatUSD(d.expectedUSD)} ${t("expected")} · ${t("difference")} ${formatUSD(d.difference)}`
        : `${t("Count recorded")}: ${formatUSD(Number(counted))} · ${t("no difference")}`);
      setCounted(""); setWhy(""); setPresent(false); setSurprise(false); setNeedsWhy("");
      refreshState();
    } catch (err: any) {
      // A difference needs its explanation; the server alone knows the expected figure, so the
      // field opens the first time it asks rather than revealing the balance in advance.
      if (/difference is recorded at once/.test(err.message)) setNeedsWhy(err.message);
      triggerToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const label = busy ? t("Recording…")
    : counted === "" ? t("Record count — enter the cash counted")
    : !present ? t("Record count — the custodian must be present")
    : needsWhy && why.trim().length < 5 ? t("Record count — explain the difference")
    : t("Record count");

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="pc-count-date" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Counted on")}</label>
          <input id="pc-count-date" type="date" max={today} value={date} onChange={e => setDate(e.target.value)} className="finance-input w-full font-mono text-xs min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pc-count-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Cash in the box (USD)")}</label>
          <input id="pc-count-amount" type="number" min="0" step="0.01" inputMode="decimal" value={counted} onChange={e => setCounted(e.target.value)} className="finance-input w-full font-mono text-xs min-h-[44px]" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-700 min-h-[44px] cursor-pointer">
        <input type="checkbox" checked={present} onChange={e => setPresent(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>{t("The custodian was present while the cash was counted")}</span>
      </label>
      <label className={`flex items-start gap-2 text-xs min-h-[44px] ${isDirector ? "text-slate-700 cursor-pointer" : "text-slate-400"}`}>
        <input type="checkbox" checked={surprise} disabled={!isDirector} onChange={e => setSurprise(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>{isDirector ? t("Counted without notice") : t("Counted without notice — only the Executive Director's count can be")}</span>
      </label>
      {needsWhy && (
        <div>
          <label htmlFor="pc-count-why" className="block text-[10px] font-bold text-red-700 uppercase mb-1">{t("Explanation of the difference")}</label>
          <textarea id="pc-count-why" rows={2} value={why} onChange={e => setWhy(e.target.value)} className="finance-input w-full text-xs" />
          <p className="text-[10px] text-red-700 mt-1">{needsWhy}</p>
        </div>
      )}
      <button type="submit" disabled={busy || counted === "" || !present || (!!needsWhy && why.trim().length < 5)}
        className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white font-medium text-xs rounded-lg px-4">
        {label}
      </button>
    </form>
  );
}

/** Bank & cash — the petty-cash float: its balance against the ceiling, top-ups and counts. */
export default function PettyCashPanel({ state, currentUser, t, triggerToast, refreshState, formatUSD }: Props) {
  const box = (state.bankAccounts || []).find(a => a.type === FLOAT_TYPE && a.ledgerCode === FLOAT_LEDGER);
  const [source, setSource] = useState("ba-blom-usd");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [picks, setPicks] = useState<Record<string, { decision?: string; note?: string }>>({});
  const [whole, setWhole] = useState<{ decision?: string; note?: string }>({});
  const [busy, setBusy] = useState(false);

  const topUps: CashTopUp[] = (state.cashTopUps || []).filter(x => x.bankAccountId === box?.id);
  const open = topUps.find(x => x.status === "Raised" || x.status === "Queried");

  // What the custodian would be topping up against — the same rule the server applies.
  const pending: TopUpItem[] = useMemo(() => {
    if (!box) return [];
    const covered = new Set(topUps.filter(x => x.status === "Approved").flatMap(x => (JSON.parse(x.itemsJson || "[]") as TopUpItem[]).map(i => i.txId)));
    return (state.bankTransactions || [])
      .filter((b: any) => b.bankAccountId === box.id && b.type === "Withdrawal" && !b.pending && !covered.has(b.id))
      .map((b: any) => ({ txId: b.id, voucherNo: b.voucherNo || "", date: b.date, amountUSD: b.amount, hasReceipt: true }));
  }, [box, topUps, state.bankTransactions]);

  if (!box) return null;
  const nameOf = (id: string) => (state.users || []).find((u: any) => u.id === id)?.name || "—";
  const isCustodian = currentUser.id === box.custodianUserId;
  const isDirector = DIRECTOR_SEATS.includes(currentUser.role);
  const banks = (state.bankAccounts || []).filter(a => a.type === "Bank" && a.active);
  const pct = Math.min(100, Math.round((box.balance / FLOAT_CEILING_USD) * 100));
  const counts = (state.cashCounts || []).filter(c => c.bankAccountId === box.id);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); triggerToast(ok); setPicks({}); setWhole({}); setAmount(""); setReason(""); refreshState(); }
    catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const downloadSheet = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/cash/count-sheet.pdf");
      if (!res.ok) throw new Error((await res.json()).error || "Rendering failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `ANAHON_PETTY-CASH-COUNT-SHEET_${new Date().toLocaleDateString("en-CA")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) { triggerToast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const openItems = open ? (JSON.parse(open.itemsJson || "[]") as (TopUpItem & { decision?: string; note?: string })[]) : [];
  const mayDecide = !!open && isDirector && currentUser.id !== open.raisedById;
  const allDecided = openItems.length ? openItems.every(i => ["ok", "query"].includes(String(picks[i.txId]?.decision))) : ["ok", "query"].includes(String(whole.decision));
  const decideLabel = busy ? t("Recording…")
    : !allDecided ? (openItems.length ? t("Decide — approve or query every item") : t("Decide — approve or query this top-up"))
    : (openItems.length ? openItems.some(i => picks[i.txId]?.decision === "query") : whole.decision === "query") ? t("Send the query back") : t("Approve and move the money to the box");

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-md font-bold text-slate-900">{t("Petty cash float")}</h3>
          <p className="text-xs text-slate-500">{t("Held by")} {nameOf(box.custodianUserId || "")} · {t("ledger")} <span dir="ltr">{FLOAT_LEDGER}</span> · {t("Policy")} <span dir="ltr" className="whitespace-nowrap">P5 §4.4</span></p>
        </div>
        {REPORT_READERS.includes(currentUser.role) && (
          <button type="button" onClick={downloadSheet} disabled={busy} className="min-h-[44px] shrink-0 text-xs font-medium border border-slate-300 rounded-lg px-4 bg-white hover:bg-slate-50 disabled:opacity-50">
            {t("Download the count sheet (PDF)")}
          </button>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold font-mono text-slate-900"><span dir="ltr">{formatUSD(box.balance)}</span></span>
          <span className="text-[11px] text-slate-500">{t("ceiling")} <span dir="ltr">{FLOAT_CEILING_LABEL}</span></span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1" role="meter" aria-valuemin={0} aria-valuemax={FLOAT_CEILING_USD} aria-valuenow={box.balance} aria-label={t("Float against its ceiling")}>
          <div className="h-full bg-slate-800" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* The open top-up: the Executive Director decides it item by item. */}
      {open && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <h4 className="text-sm font-bold text-slate-900">
              {open.kind === "replenish" ? t("Top-up against receipts") : t("Top-up establishing the float")} · <span dir="ltr">{formatUSD(open.amountUSD)}</span>
            </h4>
            <span className="text-[11px] text-slate-600">{open.status === "Queried" ? t("Queried") : t("Waiting for the Executive Director")} · {t("raised by")} {open.raisedByName}</span>
          </div>
          {open.reason && <p className="text-xs text-slate-700">{open.reason}</p>}
          {open.status === "Queried" && open.queryNote && <p className="text-xs text-red-800">{t("Query")}: {open.queryNote}</p>}

          {/* One stacked row per item rather than a table: on a phone a table put the decision
              column off-screen, and the decision is the one thing the Executive Director is there
              to make. Voucher, date and amount stay single tokens; the control sits under them. */}
          {openItems.length > 0 && (
            <ul className="divide-y divide-amber-100 border-y border-amber-100">
              {openItems.map(i => (
                <li key={i.txId} className="py-2 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="font-mono font-bold text-slate-900 whitespace-nowrap"><span dir="ltr">{i.voucherNo || i.txId}</span></span>
                    <span className="font-mono text-slate-600 whitespace-nowrap"><span dir="ltr">{i.date}</span></span>
                    <span className="font-mono font-bold text-slate-900 whitespace-nowrap"><span dir="ltr">{formatUSD(i.amountUSD)}</span></span>
                    <span className={`whitespace-nowrap ${i.hasReceipt ? "text-slate-600" : "text-red-700 font-bold"}`}>{t("Receipt")}: {i.hasReceipt ? t("on file") : t("missing")}</span>
                  </div>
                  {mayDecide && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select aria-label={`${t("Decision")} ${i.voucherNo}`} value={picks[i.txId]?.decision || ""}
                        onChange={e => setPicks(p => ({ ...p, [i.txId]: { ...p[i.txId], decision: e.target.value } }))}
                        className="finance-input text-xs min-h-[44px] w-full">
                        <option value="">{t("Choose")}</option><option value="ok">{t("Approve")}</option><option value="query">{t("Query")}</option>
                      </select>
                      {picks[i.txId]?.decision === "query" && (
                        <input aria-label={t("What is being queried")} placeholder={t("What is being queried")} value={picks[i.txId]?.note || ""}
                          onChange={e => setPicks(p => ({ ...p, [i.txId]: { ...p[i.txId], note: e.target.value } }))}
                          className="finance-input text-xs w-full min-h-[44px]" />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {mayDecide && openItems.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select aria-label={t("Decision")} value={whole.decision || ""} onChange={e => setWhole(w => ({ ...w, decision: e.target.value }))} className="finance-input text-xs min-h-[44px]">
                <option value="">{t("Choose")}</option><option value="ok">{t("Approve")}</option><option value="query">{t("Query")}</option>
              </select>
              {whole.decision === "query" && (
                <input aria-label={t("What is being queried")} placeholder={t("What is being queried")} value={whole.note || ""} onChange={e => setWhole(w => ({ ...w, note: e.target.value }))} className="finance-input text-xs min-h-[44px]" />
              )}
            </div>
          )}
          {mayDecide && (
            <button type="button" disabled={busy || !allDecided}
              onClick={() => act(() => post("/api/cash/topup/decide", { topUpId: open.id, itemDecisions: picks, decision: whole.decision, note: whole.note }, currentUser), t("Top-up decided."))}
              className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg px-4">
              {decideLabel}
            </button>
          )}
          {open && isDirector && currentUser.id === open.raisedById && (
            <p className="text-[11px] text-slate-600">{t("You raised this top-up, so another Executive Director seat has to decide it.")}</p>
          )}
        </div>
      )}

      {/* Raising a top-up is the custodian's. */}
      {!open && isCustodian && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">{t("Raise a top-up")}</h4>
          {pending.length > 0 ? (
            <p className="text-xs text-slate-600">
              {t("Against every payment from the float since the last top-up")}: {pending.length} · <span dir="ltr">{formatUSD(pending.reduce((s, i) => s + i.amountUSD, 0))}</span>
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-600">{t("Nothing has been paid from the float yet, so this top-up establishes it.")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pc-tu-amount" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Amount (USD)")}</label>
                  <input id="pc-tu-amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="finance-input w-full font-mono text-xs min-h-[44px]" />
                </div>
                <div>
                  <label htmlFor="pc-tu-reason" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Why")}</label>
                  <input id="pc-tu-reason" value={reason} onChange={e => setReason(e.target.value)} className="finance-input w-full text-xs min-h-[44px]" />
                </div>
              </div>
            </>
          )}
          <div>
            <label htmlFor="pc-tu-source" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("From the bank account")}</label>
            <select id="pc-tu-source" value={source} onChange={e => setSource(e.target.value)} className="finance-input w-full text-xs min-h-[44px]">
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button type="button"
            disabled={busy || (pending.length === 0 && (!(Number(amount) > 0) || reason.trim().length < 10))}
            onClick={() => act(() => post("/api/cash/topup/raise", { sourceAccountId: source, amountUSD: amount, reason }, currentUser), t("Top-up raised for the Executive Director."))}
            className="w-full sm:w-auto min-h-[44px] bg-slate-900 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg px-4">
            {busy ? t("Recording…")
              : pending.length === 0 && !(Number(amount) > 0) ? t("Raise top-up — enter the amount")
              : pending.length === 0 && reason.trim().length < 10 ? t("Raise top-up — say why")
              : t("Raise top-up")}
          </button>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-900">{t("Count the cash")}</h4>
        <CashCountForm currentUser={currentUser} t={t} triggerToast={triggerToast} refreshState={refreshState} formatUSD={formatUSD} custodianUserId={box.custodianUserId} />
      </div>

      {counts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-[10px] uppercase text-slate-500">
              <th className="py-1 pe-2 text-start">{t("Date")}</th><th className="py-1 pe-2 text-start">{t("Counted by")}</th>
              <th className="py-1 pe-2 text-end">{t("Expected")}</th><th className="py-1 pe-2 text-end">{t("Counted")}</th><th className="py-1 text-end">{t("Difference")}</th>
            </tr></thead>
            <tbody>
              {counts.slice(0, 6).map(c => {
                const { difference, needsExplanation } = countDifference(c.expectedUSD || 0, c.countedUSD);
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-1.5 pe-2 whitespace-nowrap"><span dir="ltr" className="font-mono">{c.date}</span>{c.withoutNotice ? <span className="text-slate-500"> · {t("without notice")}</span> : null}</td>
                    <td className="py-1.5 pe-2">{c.counterUserId ? nameOf(c.counterUserId) : c.countedBy}</td>
                    <td className="py-1.5 pe-2 text-end font-mono whitespace-nowrap"><span dir="ltr">{formatUSD(c.expectedUSD || 0)}</span></td>
                    <td className="py-1.5 pe-2 text-end font-mono whitespace-nowrap"><span dir="ltr">{formatUSD(c.countedUSD)}</span></td>
                    <td className={`py-1.5 text-end font-mono whitespace-nowrap ${needsExplanation ? "text-red-700 font-bold" : ""}`}><span dir="ltr">{formatUSD(difference)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
