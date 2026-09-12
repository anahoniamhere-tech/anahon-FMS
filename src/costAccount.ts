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

export interface JournalLeg {
  accountCode: string;
  debit?: number;
  credit?: number;
  projectId?: string | null;
  donorId?: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const isExpense = (code: string) => /^[567]\d\d\d$/.test(code);
const groupKey = (l: JournalLeg) => `${l.accountCode}\u0000${l.projectId || ""}\u0000${l.donorId || ""}`;

/**
 * Where a voucher's cost is sitting RIGHT NOW, per account and per project/donor.
 *
 * Net, not gross, and that distinction is the whole of it. A correction leaves the original
 * debit in place and adds a credit beside it, so after one reclassification the voucher has
 * debit legs on BOTH accounts. Reading gross debits would say the cost is split across two
 * accounts and refuse to correct it again — a correction you cannot correct. Netting the
 * credits off says what a person reading the books would say: it is on the new account.
 */
export function costPositions(items: JournalLeg[]): { accountCode: string; projectId?: string | null; donorId?: string | null; amount: number }[] {
  const net = new Map<string, { accountCode: string; projectId?: string | null; donorId?: string | null; amount: number }>();
  for (const l of items) {
    if (!isExpense(l.accountCode)) continue;   // AP, bank and withholding were never wrong
    const k = groupKey(l);
    const cur = net.get(k) || { accountCode: l.accountCode, projectId: l.projectId, donorId: l.donorId, amount: 0 };
    cur.amount = r2(cur.amount + Number(l.debit || 0) - Number(l.credit || 0));
    net.set(k, cur);
  }
  return [...net.values()].filter(p => p.amount > 0.004);
}

/** The distinct expense accounts a voucher's cost currently sits on. More than one means it
 *  was genuinely split at posting, which a single reclassification cannot express. */
export function debitedExpenseAccounts(items: JournalLeg[]): string[] {
  return [...new Set(costPositions(items).map(p => p.accountCode))];
}

/**
 * The correction that moves a cost already in the books from one expense account to another.
 *
 * A posted entry is not edited. Saad moved five vouchers from 6000 to 5120 on 12 Sep 2026 by
 * script, rewriting the original entries in place, and the audit line was the only surviving
 * trace that the books had ever said something else. That is the thing to avoid: a correction
 * is a new two-sided entry — credit what was wrong, debit what is right — so the original
 * posting, the correction and the reason all survive, which is the point of a ledger.
 *
 * One balanced pair per position, carrying that position's OWN project and donor. A voucher
 * split across two projects has two, and collapsing them into one pair would move the money to
 * the right account while losing which donor each half was spent against (Policy 4.7).
 *
 * The amount moved is each position's NET, so a voucher corrected twice moves what is actually
 * there rather than the sum of every debit it has ever carried.
 */
export function reclassifyLegs(items: JournalLeg[], from: string, to: string): JournalLeg[] {
  return costPositions(items)
    .filter(p => p.accountCode === from)
    .flatMap(p => [
      { accountCode: to, debit: p.amount, credit: 0, projectId: p.projectId, donorId: p.donorId },
      { accountCode: from, debit: 0, credit: p.amount, projectId: p.projectId, donorId: p.donorId },
    ]);
}
