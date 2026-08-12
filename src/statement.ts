// The five-line surplus-and-deficit statement.
//
// Deliberately NOT called a profit-and-loss account. AnaHon is a civil company
// delivering funded work, not a trading company, and a funder reads the wording:
// "surplus" and "deficit" say the money was stewarded; "profit" says it was earned
// for owners. Same arithmetic, different claim.
//
//   Income                     everything earned or received in the period
//   less  Direct costs         what it cost to deliver the work itself
//   =     Gross margin         what the work leaves behind before overheads
//   less  Operating costs      what it costs to keep the organisation running
//   =     Surplus or deficit   what is left at the end of the period
//
// Pure module: no DB, no network. Shared by the server report builder, the
// Reports tab, and scripts/check-statement.ts — so the three can never disagree.

export type StatementBucket = "income" | "direct" | "operating";

export interface StatementLineDef {
  key: "income" | "direct" | "grossMargin" | "operating" | "surplus";
  en: string;
  ar: string;
  note: string;
  noteAr: string;
  /** Rendered with a "less" prefix — it subtracts from the line above. */
  less?: boolean;
  /** A computed subtotal rather than a sum of postings. */
  computed?: boolean;
}

export const STATEMENT_LINES: StatementLineDef[] = [
  { key: "income", en: "Income", ar: "الإيرادات",
    note: "Everything earned or received in the period", noteAr: "كل ما تحقّق أو ورد خلال الفترة" },
  { key: "direct", en: "Direct costs", ar: "التكاليف المباشرة", less: true,
    note: "What it cost to deliver the work itself", noteAr: "ما كلّفه إنجاز العمل نفسه" },
  { key: "grossMargin", en: "Gross margin", ar: "الهامش الإجمالي", computed: true,
    note: "What the work leaves behind before overheads", noteAr: "ما يتركه العمل قبل النفقات العامة" },
  { key: "operating", en: "Operating costs", ar: "التكاليف التشغيلية", less: true,
    note: "What it costs to keep the organisation running", noteAr: "ما يكلّفه إبقاء المؤسسة قائمة" },
  { key: "surplus", en: "Surplus or deficit", ar: "الفائض أو العجز", computed: true,
    note: "What is left at the end of the period", noteAr: "ما تبقّى في نهاية الفترة" }
];

/**
 * Which statement line an account belongs to, from its code range.
 *
 * The chart of accounts already encodes this split and is the reliable signal —
 * `reportingGroup` is not: account 5000 carries "Operating Expenses" while its own
 * children carry "Personnel Costs", so grouping by it would scatter one cost across
 * two lines.
 *
 *   4xxx  Revenues                          -> income
 *   5xxx  Personnel Costs                   -> direct   (the people who make the work)
 *   6xxx  Direct Project Costs              -> direct
 *   7xxx  Admin and Overheads               -> operating
 *
 * Balance-sheet accounts (1xxx–3xxx) never appear in the statement: moving money
 * between our own balances is not income and not a cost.
 */
export function bucketFor(code: string, type: string): StatementBucket | null {
  if (type === "Revenue") return "income";
  if (type !== "Expense") return null;
  const head = String(code).charAt(0);
  if (head === "5" || head === "6") return "direct";
  if (head === "7") return "operating";
  return null;
}

export interface StatementAccount { code: string; name: string; type: string }
export interface StatementItem { accountCode: string; debit?: number; credit?: number }
export interface StatementEntry { date: string; isPosted?: boolean; items: StatementItem[] }

export interface StatementRow {
  code: string; name: string; bucket: StatementBucket; amount: number;
}

export interface Statement {
  from: string; to: string;
  income: number; direct: number; grossMargin: number; operating: number; surplus: number;
  rows: StatementRow[];
  /** Postings the statement could not place — a non-empty list means the chart has drifted. */
  unclassified: { code: string; amount: number }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Grant income recognition ────────────────────────────────────────────────
// Three rules decide whether a set of accounts is readable or misleading:
//
//  1. Restricted grant income is recognised AGAINST SPEND, not on receipt.
//     Money sitting in the account for work not yet delivered is a liability.
//  2. A three-year grant received in year one is not year one income. It is
//     spread across the years it funds.
//  3. In-kind contributions are income and cost in the same period — donated
//     space, pro bono legal work, seconded staff — so the true cost of running
//     the outlet is visible.
//
// Booked on arrival, year one looks excellent and year two catastrophic. Neither
// is true, and a funder reading both years draws the wrong conclusion about
// management. So the statement says when its own inputs break these rules,
// rather than presenting a confident figure built on them.

export interface RecognitionFlag {
  rule: 1 | 2 | 3;
  en: string;
  ar: string;
}

/** Revenue accounts that carry restricted (donor) grant money. */
const RESTRICTED_REVENUE = /restricted|grant/i;
/** Liability account that holds grant money not yet earned. */
const DEFERRED_LIABILITY = /deferred/i;
/** In-kind: income and matching cost recognised in the same period. */
const IN_KIND = /in.?kind|donated|pro.?bono|عين/i;

export function recognitionFlags(
  entries: StatementEntry[],
  accounts: StatementAccount[]
): RecognitionFlag[] {
  const flags: RecognitionFlag[] = [];
  const byCode = new Map(accounts.map(a => [a.code, a]));

  const restricted = accounts.filter(a => a.type === "Revenue" && RESTRICTED_REVENUE.test(a.name));
  const deferred = accounts.filter(a => a.type === "Liability" && DEFERRED_LIABILITY.test(a.name));

  let restrictedCredits = 0;
  let deferredPostings = 0;
  for (const e of entries) {
    if (e.isPosted === false) continue;
    for (const it of e.items || []) {
      const acc = byCode.get(it.accountCode);
      if (!acc) continue;
      if (restricted.some(r => r.code === acc.code) && (Number(it.credit) || 0) > 0) restrictedCredits++;
      if (deferred.some(d => d.code === acc.code)) deferredPostings++;
    }
  }

  // Rule 1 (and by consequence rule 2): grant money is hitting revenue directly.
  if (restrictedCredits > 0 && deferredPostings === 0) {
    flags.push({
      rule: 1,
      en: `Restricted grant income is being recognised on receipt: ${restrictedCredits} posting(s) credit grant revenue directly and the deferred-income account was never used. Income should be booked as the matching cost is incurred; a multi-year grant recognised on arrival makes one year look excellent and the next catastrophic.`,
      ar: `إيرادات المنح المقيّدة تُسجَّل عند القبض: ${restrictedCredits} قيداً يُقيَّد مباشرة في إيرادات المنح، ولم يُستخدم حساب الإيرادات المؤجّلة إطلاقاً. يجب الاعتراف بالإيراد بمقدار الكلفة المقابلة عند تكبّدها؛ فالمنحة متعدّدة السنوات المسجَّلة عند وصولها تُظهر سنة ممتازة وأخرى كارثية.`
    });
  }

  // Rule 3: in-kind cannot be recorded if the chart has nowhere to put it.
  if (!accounts.some(a => IN_KIND.test(a.name))) {
    flags.push({
      rule: 3,
      en: "No in-kind account exists in the chart, so donated space, pro bono legal work and seconded staff cannot be recorded. Both sides belong in the same period — without them the statement understates the true cost of running the outlet.",
      ar: "لا يوجد حساب للمساهمات العينية في دليل الحسابات، فلا يمكن تسجيل المساحات الممنوحة أو العمل القانوني التطوّعي أو الموظفين المنتدبين. يُسجَّل الطرفان في الفترة نفسها؛ وبدونهما يقلّل البيان من الكلفة الحقيقية لتشغيل المؤسسة."
    });
  }

  return flags;
}

/**
 * Build the statement from POSTED journal entries between `from` and `to` (inclusive,
 * YYYY-MM-DD). Unposted drafts are excluded: a statement states what the ledger holds.
 *
 * Signs: revenue accounts carry a credit balance and expense accounts a debit balance.
 * Both are reported as positive figures, so a refund or a reversal correctly reduces
 * its own line rather than appearing as the opposite kind of money.
 */
export function buildStatement(
  entries: StatementEntry[],
  accounts: StatementAccount[],
  from: string,
  to: string
): Statement {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const rows = new Map<string, StatementRow>();
  const unclassified = new Map<string, number>();
  let income = 0, direct = 0, operating = 0;

  for (const e of entries) {
    if (e.isPosted === false) continue;
    const d = String(e.date || "").slice(0, 10);
    if (!d || d < from || d > to) continue;

    for (const it of e.items || []) {
      const debit = Number(it.debit) || 0;
      const credit = Number(it.credit) || 0;
      const acc = byCode.get(it.accountCode);
      if (!acc) {
        if (debit || credit) unclassified.set(it.accountCode, (unclassified.get(it.accountCode) || 0) + debit - credit);
        continue;
      }
      const bucket = bucketFor(acc.code, acc.type);
      if (!bucket) continue;

      const amount = bucket === "income" ? credit - debit : debit - credit;
      if (bucket === "income") income += amount;
      else if (bucket === "direct") direct += amount;
      else operating += amount;

      const row = rows.get(acc.code) || { code: acc.code, name: acc.name, bucket, amount: 0 };
      row.amount += amount;
      rows.set(acc.code, row);
    }
  }

  const grossMargin = income - direct;
  const surplus = grossMargin - operating;

  return {
    from, to,
    income: r2(income), direct: r2(direct), grossMargin: r2(grossMargin),
    operating: r2(operating), surplus: r2(surplus),
    rows: [...rows.values()]
      .map(r => ({ ...r, amount: r2(r.amount) }))
      .filter(r => r.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code)),
    unclassified: [...unclassified.entries()].map(([code, amount]) => ({ code, amount: r2(amount) }))
  };
}
