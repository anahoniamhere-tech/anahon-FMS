/**
 * Petty cash — draft Policy 020 §4.4, decided by Saad on 14 Sep 2026.
 *
 * Before this there was no cash box in the system. Ledger 1120 "Petty Cash - USD" carried
 * USD 52,108.26 — not a float but a clearing account the ledger rebuild filled with three
 * different things: grant income received off-bank (57,723.90), cash drawn from BLOM
 * (82,764.77) and 174 cash-paid vouchers including salaries and freelancer fees (88,380.41).
 * The four BankAccount rows typed "Petty Cash" were the off-bank channels, all inactive at a
 * zero balance. Counts could only be recorded BY the custodian and compared against the 52k.
 *
 * Now: one box on its own ledger account (1125), held by the Finance Officer. 1120 is left
 * exactly as it was, renamed as historical clearing for the external consultant. The channels
 * carry their own type, so "Petty Cash" means the box and nothing else.
 *
 * Every figure below lives here and nowhere else. A policy number typed twice is two numbers
 * that eventually disagree — the compliance-audit prompt said "USD 300" for months after the
 * float went up.
 */

/** §4.4.1 — the float may not exceed this. A top-up that would take the box above it is refused. */
export const FLOAT_CEILING_USD = 1000;

/** §4.4.2 — a single cash payment above this needs the Executive Director's approval first. */
export const CASH_SINGLE_PAYMENT_USD = 150;

/** "USD 1,000" — as a person reads it, so every screen and message agrees. */
export const usdLabel = (n: number) => `USD ${n.toLocaleString("en-US")}`;
export const FLOAT_CEILING_LABEL = usdLabel(FLOAT_CEILING_USD);
export const CASH_SINGLE_PAYMENT_LABEL = usdLabel(CASH_SINGLE_PAYMENT_USD);

/** The box's own ledger account. */
export const FLOAT_LEDGER = "1125";
/** Where a count difference waits for the Executive Director's review (§4.4.3). Also the
 *  source of the opening float, which is the first count: expected 0, the cash found is the
 *  difference, and the consultant matches it against the historical 1120 clearing. */
export const COUNT_DIFFERENCES_LEDGER = "2920";
/** Historical off-bank clearing. Never moved by the box; reconciled by the consultant. */
export const HISTORICAL_CLEARING_LEDGER = "1120";

export const FLOAT_TYPE = "Petty Cash";
export const CHANNEL_TYPE = "Off-bank channel";

/** The Executive Director's seats. "Program Director" is a permission key and is never renamed. */
export const DIRECTOR_SEATS = ["Super Admin", "Program Director"];
/** Anyone but the custodian may count — the Executive Director or the Procurement and
 *  Logistics Officer (Saad, 14 Sep 2026). The seat is the first check; the person is the second. */
export const COUNTER_SEATS = [...DIRECTOR_SEATS, "Procurement and Logistics Officer"];

/** Marker on the two bank lines a top-up writes, so the ledger rebuild books them to the float
 *  instead of reading the withdrawal as one more "cash drawn to petty cash" into 1120. */
export const TOPUP_REF = (id: string) => `topup:${id}`;
export const isTopUpRef = (ref?: string | null) => String(ref || "").startsWith("topup:");

/** Half a cent: a float round-trip, not a difference anyone has to explain. */
const EPS = 0.005;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface AccountLike { id?: string; type: string; ledgerCode?: string | null; active?: boolean; custodianUserId?: string | null }

/** The box is the one account of the float type on the float ledger. A channel never is. */
export const isFloat = (a?: AccountLike | null) => !!a && a.type === FLOAT_TYPE && a.ledgerCode === FLOAT_LEDGER;
export const isChannel = (a?: AccountLike | null) => !!a && a.type === CHANNEL_TYPE;

/** Refuses anything that is not the float — the rule that a channel is never used as it. */
export function floatBlocker(a?: AccountLike | null): string {
  if (!a) return "That cash box does not exist.";
  if (isChannel(a)) return "Policy 020 §4.4.4: an off-bank channel records money received or paid through it — it is never the petty-cash float.";
  if (!isFloat(a)) return "Policy 020 §4.4.1: only the petty-cash float can be counted or topped up.";
  if (a.active === false) return "The petty-cash float is not active.";
  return "";
}

/** §4.4.1 — the ceiling. A top-up that would take the box above it is refused. */
export function ceilingBlocker(balanceUSD: number, amountUSD: number): string {
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) return "A top-up must be for more than zero.";
  const after = r2(balanceUSD + amountUSD);
  if (after > FLOAT_CEILING_USD + EPS) {
    return `Policy 020 §4.4.1: the float may not exceed ${FLOAT_CEILING_LABEL}. The box holds ${usdLabel(r2(balanceUSD))}, so this top-up of ${usdLabel(r2(amountUSD))} would take it to ${usdLabel(after)}.`;
  }
  return "";
}

/** §4.4.1 — the custodian raises a top-up. By person, so a Super Admin wearing the Finance
 *  Officer seat cannot raise one and then approve it in their own. */
export function raiseBlocker(userId: string, custodianUserId?: string | null): string {
  if (!custodianUserId) return "The petty-cash float has no custodian assigned.";
  if (userId !== custodianUserId) return "Policy 020 §4.4.1: a top-up is raised by the custodian of the float, against the receipts they paid out.";
  return "";
}

/** §4.4.1 — the Executive Director approves, and never their own top-up. */
export function approveBlocker(approver: { id: string; role: string }, raisedById: string): string {
  if (!DIRECTOR_SEATS.includes(approver.role)) return "Policy 020 §4.4.1: the Executive Director approves a top-up.";
  if (approver.id === raisedById) return "Policy 020 §4.4.1: a top-up cannot be approved by the person who raised it.";
  return "";
}

/** §4.4.1 / §4.4.3 — who may count, checked by person and seat. */
export function countBlocker(c: {
  counterId: string; counterRole: string; custodianUserId?: string | null;
  withoutNotice: boolean; custodianPresent: boolean;
}): string {
  if (!c.custodianUserId) return "The petty-cash float has no custodian assigned.";
  if (c.counterId === c.custodianUserId) return "Policy 020 §4.4.1: cash is counted by someone other than its custodian.";
  if (!COUNTER_SEATS.includes(c.counterRole)) return "Policy 020 §4.4.1: a count is made by the Executive Director or the Procurement and Logistics Officer.";
  if (c.withoutNotice && !DIRECTOR_SEATS.includes(c.counterRole)) return "Policy 020 §4.4.1: the count without notice is the Executive Director's.";
  if (!c.custodianPresent) return "Policy 020 §4.4.1: the custodian is present when the cash is counted.";
  return "";
}

/** §4.4.3 — the difference, and whether it needs its explanation recorded at once. */
export function countDifference(expectedUSD: number, countedUSD: number) {
  const difference = r2(countedUSD - expectedUSD);
  return { difference, needsExplanation: Math.abs(difference) >= EPS };
}

/** §4.4.1 — a top-up lists every payment since the last one, each with its receipt. */
export interface TopUpItem { txId: string; voucherNo: string; date: string; amountUSD: number; hasReceipt: boolean }
export function itemsBlocker(items: TopUpItem[]): string {
  const missing = items.filter(i => !i.hasReceipt).map(i => i.voucherNo || i.txId);
  if (missing.length) return `Policy 020 §4.4.1: the float is topped up only against receipts — ${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} none on file.`;
  return "";
}
export const itemsTotal = (items: TopUpItem[]) => r2(items.reduce((s, i) => s + i.amountUSD, 0));

/** Cash withdrawn from BLOM for approved payment requests — fees and larger costs that must
 *  NOT go into the float and must NOT accumulate in 1120 (Saad, 14 Sep 2026). Each withdrawal is
 *  linked to the requests it pays and cleared as they are paid. */
export const CASH_CLEARING_LEDGER = "1127";
export const TRANSIT_TYPE = "Cash in transit";
export const isTransit = (a?: AccountLike | null) => !!a && a.type === TRANSIT_TYPE && a.ledgerCode === CASH_CLEARING_LEDGER;
/** An open withdrawal still holding cash this many days after it was drawn is flagged. */
export const CLEARING_ALERT_DAYS = 7;

/**
 * The cutover for late records (Saad, 14 Sep 2026). Years of vouchers, receipts and contracts are
 * being backfilled, so a cash movement is placed by its TRUE date against one stored date — the
 * float's opening date, set by its first count — never by when it was typed in:
 *
 *   dated before the opening, or no opening yet  ->  1120, the historical clearing (it stays open)
 *   dated on or after it, out of or into the box ->  1125, the float
 *   dated on or after it, any other cash         ->  1127, cash in transit, cleared against the
 *                                                    payment requests it was drawn for
 *
 * Nothing after the opening lands in 1120. Cash in transit that no withdrawal record explains
 * (an ATM line nobody linked) still goes to 1127, where it shows as uncleared from day one.
 */
export function cashLedgerFor(date: string, openedOn: string | null | undefined, fromFloat: boolean): string {
  if (!openedOn || String(date) < openedOn) return HISTORICAL_CLEARING_LEDGER;
  return fromFloat ? FLOAT_LEDGER : CASH_CLEARING_LEDGER;
}

/** A float that has not had its opening count cannot be topped up, and nothing about it may be
 *  dated before it opened. */
export function openingBlocker(openedOn: string | null | undefined, date?: string): string {
  if (!openedOn) return "Policy 020 §4.4.1: the float opens with its first count — Saad and the Finance Officer count the box together, and whatever is there is the opening balance. Record that count first.";
  if (date && date < openedOn) return `The float opened on ${openedOn}; nothing about it can be dated before that. A payment from before then belongs to the historical clearing.`;
  return "";
}

/**
 * Paying a voucher out — Buying & paying, 14 Sep 2026, on Books' handover of cc5cb98.
 *
 * Both payment routes used to pick the credit side by `type === "Petty Cash" ? "1120"`, so after
 * the first top-up a payment out of the box would have credited the historical clearing, and
 * direct-petty-cash accepted any account at all — a channel was stopped only by its zero balance.
 */

/** §4.4.1 — fees to service providers, freelancers or consultants never come from the float.
 *  Everyone at AnaHon is engaged as a service provider, so 5100 is a fee too. */
export const FEES_NEVER_FROM_FLOAT = ["5100", "5120", "5130"];

export interface PayoutAccount extends AccountLike { name?: string; currency?: string; openedOn?: string | null }

/** What may pay a voucher out: an active bank account, or the opened float for anything but a fee. */
export function payoutBlocker(a: PayoutAccount | null | undefined, costAccount?: string | null, date?: string, draw?: DrawForPayout | null): string {
  if (!a) return "That account does not exist.";
  if (a.active === false) return `${a.name || "That account"} is not active — money cannot leave it.`;
  if (a.type === "Bank") return "";
  if (isTransit(a)) return transitBlocker(draw);
  if (isChannel(a)) return "Policy 020 §4.4.4: an off-bank channel records money received or paid through it — it is never the petty-cash float.";
  if (!isFloat(a)) return "Policy 020 §4.4.1: cash is paid out of the petty-cash float and nowhere else.";
  // With a date: a payment dated before the float opened never came out of the box. Allowing it
  // would take money off the box's balance while payoutLedgerFor credits 1120 — the box and 1125
  // would part company, and the next count would show a shortage that is not there. (Books.)
  const notOpen = openingBlocker(a.openedOn, date);
  if (notOpen) return notOpen;
  if (costAccount && FEES_NEVER_FROM_FLOAT.includes(costAccount)) {
    return "Policy 020 §4.4.1: fees to service providers, freelancers or consultants are never paid from the petty-cash float — pay them by bank transfer.";
  }
  return "";
}

/** The ledger account a payment out of `a` on `date` credits — the float by its true date,
 *  everything else by the account's own ledger code. */
export function payoutLedgerFor(a: PayoutAccount, date: string): string {
  if (isFloat(a)) return cashLedgerFor(date, a.openedOn, true);
  return a.ledgerCode || (a.currency === "EUR" ? "1110" : "1100");
}

/** §4.4.2 — cash above CASH_SINGLE_PAYMENT_USD needs the EXECUTIVE DIRECTOR's approval, not just an
 *  approval. Since 14 Sep 2026 the Finance Officer may approve payment requests too (Saad), so
 *  approved_at alone no longer proves the director signed. Cash is the box or cash in transit.
 *  `approverSeat` is the seat the approval was signed in; unknown is refused, never assumed. */
export function cashApprovalBlocker(a: AccountLike, amountUSD: number, approverSeat?: string | null): string {
  if (a.type !== FLOAT_TYPE && !isTransit(a)) return "";
  if (amountUSD <= CASH_SINGLE_PAYMENT_USD + EPS) return "";
  if (approverSeat && DIRECTOR_SEATS.includes(approverSeat)) return "";
  return `Policy 020 §4.4.2: a cash payment above ${CASH_SINGLE_PAYMENT_LABEL} needs the Executive Director's approval first — this request was approved by ${approverSeat || "an unrecorded seat"}.`;
}

/* ---- Cash clearing: withdrawals for approved payment requests (Saad, 14 Sep 2026) ----------
 * Money drawn in cash from BLOM to pay fees or larger costs sits on 1127 until the requests it
 * was drawn for are paid out of it. One withdrawal may pay several requests; each request is paid
 * from one withdrawal only. A leftover is redeposited, or moved into the float through an ordinary
 * top-up (which the Executive Director approves and the ceiling still bounds). A withdrawal still
 * holding cash seven days after it was drawn is flagged to the Executive Director and Finance —
 * counting only withdrawals dated on or after the float's opening.
 */

export const DRAW_REF = (id: string) => `draw:${id}`;
export const isDrawRef = (ref?: string | null) => String(ref || "").startsWith("draw:");
export const DRAW_RETURN_REF = (id: string) => `draw-return:${id}`;
export const isDrawReturnRef = (ref?: string | null) => String(ref || "").startsWith("draw-return:");

export interface DrawLink { expenseId: string; voucherNo: string; netUSD: number }

/** Where a withdrawal stands: what it drew, what has left it, what is still in hand. */
export function drawPosition(amountUSD: number, paidUSD: number, redepositedUSD: number, toFloatUSD: number) {
  const remainingUSD = r2(amountUSD - paidUSD - redepositedUSD - toFloatUSD);
  return { remainingUSD, cleared: Math.abs(remainingUSD) < EPS };
}

/** Days between two YYYY-MM-DD dates. */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** The seven-day flag — only for withdrawals dated on or after the float's opening. */
export function drawOverdue(drawDate: string, today: string, remainingUSD: number, openedOn: string | null | undefined): boolean {
  if (!openedOn || drawDate < openedOn) return false;
  if (remainingUSD < EPS) return false;
  return daysBetween(drawDate, today) > CLEARING_ALERT_DAYS;
}

/** Recording a withdrawal against approved requests. */
export function drawBlocker(d: {
  openedOn: string | null | undefined; date: string; amountUSD: number;
  links: (DrawLink & { status: string; alreadyDrawnIn?: string | null; paid?: boolean })[];
}): string {
  const notOpen = openingBlocker(d.openedOn, d.date);
  if (notOpen) return notOpen;
  if (!Number.isFinite(d.amountUSD) || d.amountUSD <= 0) return "A withdrawal must be for more than zero.";
  if (!d.links.length) return "A withdrawal is linked to the approved payment requests it pays — choose at least one.";
  const bad = d.links.filter(l => l.status !== "Approved" || l.paid);
  if (bad.length) return `Policy 020 §4.4.2: cash is drawn only for approved requests not yet paid — ${bad.map(l => l.voucherNo).join(", ")} ${bad.length === 1 ? "is" : "are"} not.`;
  const twice = d.links.filter(l => l.alreadyDrawnIn);
  if (twice.length) return `Each request is paid from one withdrawal only — ${twice.map(l => `${l.voucherNo} (in ${l.alreadyDrawnIn})`).join(", ")}.`;
  const needed = r2(d.links.reduce((s, l) => s + l.netUSD, 0));
  if (d.amountUSD + EPS < needed) return `The withdrawal of ${usdLabel(r2(d.amountUSD))} does not cover the ${usdLabel(needed)} these requests pay.`;
  return "";
}

/** For paying a request out of cash in transit: only against the withdrawal it was drawn for. */
export interface DrawForPayout { linked: boolean; remainingUSD: number; netUSD: number; drawId?: string }
export function transitBlocker(draw?: DrawForPayout | null): string {
  if (!draw || !draw.linked) return "Cash in transit pays only the request it was drawn for — record the withdrawal against this request first.";
  if (draw.netUSD > draw.remainingUSD + EPS) return `The withdrawal holds ${usdLabel(r2(draw.remainingUSD))}, less than the ${usdLabel(r2(draw.netUSD))} this payment needs.`;
  return "";
}

/** Moving a leftover into the float, or back to the bank: never more than is still in hand. */
export function leftoverBlocker(remainingUSD: number, amountUSD: number, unpaidLinks: number): string {
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) return "Enter an amount of more than zero.";
  if (unpaidLinks > 0) return "The requests this withdrawal was drawn for are not all paid yet — the cash is still spoken for.";
  if (amountUSD > remainingUSD + EPS) return `Only ${usdLabel(r2(remainingUSD))} of this withdrawal is left.`;
  return "";
}
