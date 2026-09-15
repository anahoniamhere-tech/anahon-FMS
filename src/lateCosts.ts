/**
 * Costs recorded into a donor report's period after that report was submitted (15 Sep 2026).
 *
 * A submitted report is never recomputed: what went to the donor stays as it went. When a
 * voucher is later recorded with a true date inside the report's period, it is listed BESIDE
 * the submitted figure. v1 counts vouchers only (a co-funded voucher by its allocated share);
 * payroll, journal-only and bank-only costs are not yet included.
 *
 * "Recorded late" needs to know when a voucher was entered. Vouchers raised since 14 Sep 2026
 * carry transactionDate (the true date) and a real created_at (the moment of entry). Every older
 * voucher has transactionDate "" and a created_at that was set to its transaction date when it
 * was backfilled — its recording time is unknowable, so it is never called late; it is counted
 * as "cannot be judged" instead.
 */

export const SPENT_STATUSES = ["Approved", "Paid", "Posted"];
export const BASES = ["frozen", "entered from the filed report"] as const;

export type Voucher = {
  id: string; voucherNo: string; projectId: string; budgetLineId: string; status: string;
  convertedAmount: number; transactionDate?: string; created_at: string; allocationsJson?: string; allocations?: any[];
};
export type Submission = { id: string; projectId: string; periodStart: string; periodEnd: string; submittedOn: string; currency?: string; usdPerUnit?: number | null };

/** The currencies a donor report may be kept in (vouchers themselves carry USD equivalents). */
export const REPORT_CURRENCIES = ["USD", "EUR", "GBP", "LBP"] as const;

/**
 * A USD amount in the report's own currency, at the rate the REPORT states — never today's rate.
 * null when the report is not in USD and states no rate: nothing is converted, and the screen shows
 * both currencies side by side instead of inventing a figure.
 */
export function inReportCurrency(usd: number, s: { currency?: string; usdPerUnit?: number | null }): number | null {
  const cur = s.currency || "USD";
  if (cur === "USD") return r2(usd);
  return s.usdPerUnit && s.usdPerUnit > 0 ? r2(usd / s.usdPerUnit) : null;
}

/** The USD equivalent of a submitted figure: itself when USD, native × stated rate, else null. */
export function usdEquivalent(native: number, currency: string, usdPerUnit?: number | null): number | null {
  if (currency === "USD") return r2(native);
  return usdPerUnit && usdPerUnit > 0 ? r2(native * usdPerUnit) : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** This project's share of a voucher: its allocation when co-funded, else the whole voucher if it is the project's. */
export function shareFor(v: Voucher, projectId: string): number {
  const allocs = Array.isArray(v.allocations) ? v.allocations
    : (() => { try { return JSON.parse(v.allocationsJson || "[]"); } catch { return []; } })();
  if (allocs.length) return r2(allocs.filter((a: any) => a.projectId === projectId).reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0));
  return v.projectId === projectId ? r2(v.convertedAmount || 0) : 0;
}

/** The end of a Beirut calendar day, as an instant — "after the submission date" means after that day. */
export function endOfBeirutDay(day: string): number {
  // Beirut is UTC+3 (summer) / UTC+2 (winter); the later offset boundary is the safe one — a voucher
  // entered on the submission day itself is never called late.
  return Date.parse(`${day}T23:59:59.999+02:00`);
}

export type LateResult = {
  late: { id: string; voucherNo: string; transactionDate: string; recordedOn: string; usd: number }[];
  lateUSD: number;
  /** The same total in the report's currency at its stated rate; null when no rate is stated. */
  lateNative: number | null;
  /** Spent vouchers on this project with no true date: their recording time cannot be known. */
  unjudged: number;
};

export function lateCosts(s: Submission, vouchers: Voucher[]): LateResult {
  const cutoff = endOfBeirutDay(s.submittedOn);
  const late: LateResult["late"] = [];
  let unjudged = 0;
  for (const v of vouchers) {
    if (!SPENT_STATUSES.includes(v.status)) continue;
    const usd = shareFor(v, s.projectId);
    if (!usd) continue;
    if (!v.transactionDate) { unjudged++; continue; }
    if (v.transactionDate < s.periodStart || v.transactionDate > s.periodEnd) continue;
    const recorded = Date.parse(v.created_at);
    if (!(recorded > cutoff)) continue;
    late.push({ id: v.id, voucherNo: v.voucherNo, transactionDate: v.transactionDate, recordedOn: v.created_at.slice(0, 10), usd });
  }
  late.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.voucherNo.localeCompare(b.voucherNo));
  const lateUSD = r2(late.reduce((t, x) => t + x.usd, 0));
  return { late, lateUSD, lateNative: inReportCurrency(lateUSD, s), unjudged };
}

/** What a report submitted today contains: vouchers with a true date inside the period, by budget line. */
export function freezeSubmission(projectId: string, periodStart: string, periodEnd: string, vouchers: Voucher[]) {
  const byLine: Record<string, number> = {};
  const voucherIds: string[] = [];
  let total = 0;
  for (const v of vouchers) {
    if (!SPENT_STATUSES.includes(v.status) || !v.transactionDate) continue;
    if (v.transactionDate < periodStart || v.transactionDate > periodEnd) continue;
    const usd = shareFor(v, projectId);
    if (!usd) continue;
    byLine[v.budgetLineId] = r2((byLine[v.budgetLineId] || 0) + usd);
    voucherIds.push(v.id);
    total += usd;
  }
  return { asSubmittedUSD: r2(total), asSubmittedJson: { byLine, voucherIds } };
}

/** Why a submission cannot be recorded, or "" when it can. */
export function submissionBlocker(r: { periodStart: string; periodEnd: string; submittedOn: string; today: string; evidence: string; basis: string; currency?: string; asSubmittedNative?: number; usdPerUnit?: number | null }): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(r.periodStart) || !iso.test(r.periodEnd) || r.periodStart > r.periodEnd) return "Enter the report's period: a start date on or before its end date.";
  if (!iso.test(r.submittedOn) || r.submittedOn > r.today) return "Enter the day the report went to the donor — not a future date.";
  if (r.submittedOn < r.periodStart) return "A report cannot be submitted before its period begins.";
  if (!String(r.evidence || "").trim()) return "Name the evidence: the filed report's ANH-DOC number, or the email it was sent in.";
  if (!(BASES as readonly string[]).includes(r.basis)) return "Say whether the figure is frozen by the system or entered from the filed report.";
  const cur = r.currency || "USD";
  if (!(REPORT_CURRENCIES as readonly string[]).includes(cur)) return `Choose the currency the report was submitted in: ${REPORT_CURRENCIES.join(", ")}.`;
  if (r.usdPerUnit != null && !(Number(r.usdPerUnit) > 0)) return "A stated rate must be more than zero — or leave it blank if the report states none.";
  if (r.basis === "entered from the filed report" && !(Number(r.asSubmittedNative) >= 0 && Number.isFinite(Number(r.asSubmittedNative)))) return `Enter the total the filed report states, in ${cur}.`;
  // Vouchers are in USD: freezing a non-USD report needs the rate the report uses.
  if (r.basis === "frozen" && cur !== "USD" && !(Number(r.usdPerUnit) > 0)) return `To freeze a ${cur} report from the vouchers, enter the rate the report states (USD per 1 ${cur}).`;
  return "";
}
