/**
 * Which expense account a cost belongs to — one map, read by the live posting and by the
 * ledger rebuild (12 Sep 2026).
 *
 * The posting route used to debit 6100 "Production Costs — Video Capturing" for every
 * voucher, whatever the cost was. It was never noticed because no journal entry in the live
 * books debits 6100 at all: all 192 Purchases entries were written by
 * prisma/rebuild-ledger.ts, which derives the account from the budget line's category. The
 * app's own posting had effectively never run on a real voucher, so the first rent or salary
 * through it would have landed in video production.
 *
 * Keeping "6100" as the fallback would have preserved that: every one of the 192 live
 * expenses has a budget line whose category is in this map, and none of them maps to 6100 —
 * 37 Local Office are rent, 46 Personnel/Human Resources are salaries, 22 are freelancers.
 * "Posts exactly as it would have" was the bug, not the safety net.
 *
 * Refusing to post without a named account was the other option and is worse: it punishes
 * the requester for a question the budget line they already chose can answer, and would make
 * all 192 existing rows unpostable.
 *
 * So: the voucher's own answer when it has one, this map when it does not, and the two paths
 * now agree by construction rather than by whoever last edited them.
 */

/** BudgetLine.category -> expense account. Was local to rebuild-ledger.ts. */
export const CATEGORY_ACCOUNT: Record<string, string> = {
  "Personnel": "5100", "Human Resources": "5100",
  "Contractors/Freelancers": "5120",
  "Travel": "6200",
  "Equipment & Supplies": "6300",
  "Local Office": "7100",
  "Catering & Hospitality": "6000",
  "Other Costs": "6000",
  "Software Subscriptions": "6400",
};

/**
 * Where a cost with no category of its own goes: 6000 "Direct Project Costs", the parent of
 * the 6xxx range and what the rebuild has always used. Not 6100 — video production is one
 * kind of direct cost, not the name for all of them.
 */
export const DEFAULT_COST_ACCOUNT = "6000";

/** The account a budget line's category belongs to. An unknown or missing category is a
 *  direct project cost, which is where the rebuild puts it too. */
export function costAccountFor(category?: string | null): string {
  return CATEGORY_ACCOUNT[String(category || "")] || DEFAULT_COST_ACCOUNT;
}
