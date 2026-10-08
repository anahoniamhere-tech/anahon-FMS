/**
 * What a budget line has actually spent, and what it still has committed — Books, 6 Oct 2026.
 *
 * `BudgetLine.actualUSD` and `committedUSD` are stored running totals: the voucher steps add to them as they
 * go (approval commits, posting moves the commitment into actual). Nothing ever recomputes them, so they drift
 * — TRF-2026 carried actual 10,020.04 against 10,028.99 of posted vouchers, and 9,000 still "committed" with
 * every voucher posted. A donor report built from the budget screen was understating the line.
 *
 * The truth is the vouchers. A voucher counts on the line it names, unless it carries allocations, which split
 * one voucher across several lines (and projects) — then each slice counts on its own line.
 *   actual    = posted vouchers (the posting is what spends the money)
 *   committed = approved or paid, not yet posted (promised, not yet in the ledger)
 */
export const ACTUAL_STATUSES = ["Posted"];
export const COMMITTED_STATUSES = ["Approved", "Paid"];

export interface VoucherLike {
  id: string; status: string; budgetLineId?: string | null; convertedAmount: number; rate: number; allocationsJson?: string | null;
}
export interface LineTotals { actualUSD: number; committedUSD: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Per budget line id, what the vouchers say it has spent and committed. */
export function budgetTotals(vouchers: VoucherLike[]): Map<string, LineTotals> {
  const out = new Map<string, LineTotals>();
  const add = (lineId: string, usd: number, bucket: keyof LineTotals) => {
    if (!lineId) return;
    const row = out.get(lineId) || { actualUSD: 0, committedUSD: 0 };
    row[bucket] = r2(row[bucket] + usd);
    out.set(lineId, row);
  };
  for (const v of vouchers) {
    const bucket: keyof LineTotals | null = ACTUAL_STATUSES.includes(v.status) ? "actualUSD"
      : COMMITTED_STATUSES.includes(v.status) ? "committedUSD" : null;
    if (!bucket) continue; // draft, rejected, awaiting approval: neither spent nor committed
    let allocations: { budgetLineId?: string; amount?: number }[] = [];
    try { allocations = JSON.parse(v.allocationsJson || "[]"); } catch { }
    const split = allocations.filter(a => a.budgetLineId && a.amount != null);
    if (split.length) {
      // Allocations are in the voucher's own currency, like Expense.amount.
      for (const a of split) add(String(a.budgetLineId), r2(Number(a.amount) * (v.rate || 1)), bucket);
      continue;
    }
    add(String(v.budgetLineId || ""), r2(v.convertedAmount), bucket);
  }
  return out;
}

/** What a reconciliation would change on one line, or null when it already agrees. */
export function budgetDrift(line: { id: string; actualUSD: number; committedUSD: number }, totals: Map<string, LineTotals>) {
  const t = totals.get(line.id) || { actualUSD: 0, committedUSD: 0 };
  const actualDiff = r2(t.actualUSD - line.actualUSD), committedDiff = r2(t.committedUSD - line.committedUSD);
  if (Math.abs(actualDiff) < 0.005 && Math.abs(committedDiff) < 0.005) return null;
  return { ...t, actualDiff, committedDiff };
}

/**
 * What a voucher charges to one project, or to one budget line, in USD. A voucher may be split: the newsroom
 * VPS was paid in one debit of USD 222.23, of which only the 173 days inside the grant period — USD 52.59 —
 * belong to it. Read whole, that voucher would put 222.23 in a donor's report. Allocations decide when the
 * voucher carries them; otherwise the voucher charges where it says it does.
 */
export function shareOfProject(v: VoucherLike & { projectId?: string | null }, projectId: string): number {
  let allocations: { projectId?: string; amount?: number }[] = [];
  try { allocations = JSON.parse(v.allocationsJson || "[]"); } catch { }
  const split = allocations.filter(a => a.projectId && a.amount != null);
  if (split.length) return r2(split.filter(a => a.projectId === projectId).reduce((s, a) => s + Number(a.amount) * (v.rate || 1), 0));
  return v.projectId === projectId ? r2(v.convertedAmount) : 0;
}
export function shareOfLine(v: VoucherLike, budgetLineId: string): number {
  let allocations: { budgetLineId?: string; amount?: number }[] = [];
  try { allocations = JSON.parse(v.allocationsJson || "[]"); } catch { }
  const split = allocations.filter(a => a.budgetLineId && a.amount != null);
  if (split.length) return r2(split.filter(a => a.budgetLineId === budgetLineId).reduce((s, a) => s + Number(a.amount) * (v.rate || 1), 0));
  return v.budgetLineId === budgetLineId ? r2(v.convertedAmount) : 0;
}
