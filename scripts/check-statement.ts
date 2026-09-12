// Pure asserts on the five-line surplus/deficit statement. Opens no DB — the datasource
// URL is hardcoded in schema.prisma, so purity beats copying the real books around.
//   npx tsx scripts/check-statement.ts
import { bucketFor, buildStatement, buildBalanceSheet, STATEMENT_LINES } from "../src/statement.js";
import { reclassifyLegs, debitedExpenseAccounts, costPositions } from "../src/costAccount.js";

let failed = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}`); } else console.log(`  ok    ${label}`);
};

const ACCOUNTS = [
  { code: "1100", name: "Bank - USD", type: "Asset" },
  { code: "2400", name: "Deferred Grant Income", type: "Liability" },
  { code: "3500", name: "Retained Earnings", type: "Equity" },
  { code: "4100", name: "Restricted Grant Income", type: "Revenue" },
  { code: "4200", name: "Service Agreement Revenue", type: "Revenue" },
  { code: "5100", name: "Salaries and Compensation", type: "Expense" },
  { code: "6100", name: "Production Costs", type: "Expense" },
  { code: "7100", name: "Office Rent", type: "Expense" },
  { code: "7400", name: "Bank Charges", type: "Expense" }
];

const je = (date: string, items: any[], isPosted = true) => ({ date, isPosted, items });

console.log("\nbucketFor — the chart's code ranges");
ok("revenue 4100 -> income", bucketFor("4100", "Revenue") === "income");
ok("personnel 5100 -> direct", bucketFor("5100", "Expense") === "direct");
ok("project cost 6100 -> direct", bucketFor("6100", "Expense") === "direct");
ok("overhead 7100 -> operating", bucketFor("7100", "Expense") === "operating");
ok("bank account 1100 is not on the statement", bucketFor("1100", "Asset") === null);
ok("deferred income 2400 is not on the statement", bucketFor("2400", "Liability") === null);
ok("equity 3500 is not on the statement", bucketFor("3500", "Equity") === null);

console.log("\nthe five lines, in order");
ok("five lines exactly", STATEMENT_LINES.length === 5);
ok("order is income, direct, gross, operating, surplus",
  STATEMENT_LINES.map(l => l.key).join(",") === "income,direct,grossMargin,operating,surplus");
ok("gross margin and surplus are computed, not posted",
  STATEMENT_LINES.filter(l => l.computed).map(l => l.key).join(",") === "grossMargin,surplus");
ok("every line carries an Arabic label", STATEMENT_LINES.every(l => l.ar.trim().length > 0));
ok("no line says profit", !STATEMENT_LINES.some(l => /profit/i.test(l.en)));

console.log("\narithmetic");
const s = buildStatement([
  je("2026-03-01", [{ accountCode: "1100", debit: 10000 }, { accountCode: "4100", credit: 10000 }]),
  je("2026-03-05", [{ accountCode: "4200", credit: 2000 }, { accountCode: "1100", debit: 2000 }]),
  je("2026-03-10", [{ accountCode: "5100", debit: 4000 }, { accountCode: "1100", credit: 4000 }]),
  je("2026-03-11", [{ accountCode: "6100", debit: 1500 }, { accountCode: "1100", credit: 1500 }]),
  je("2026-03-20", [{ accountCode: "7100", debit: 1200 }, { accountCode: "1100", credit: 1200 }]),
  je("2026-03-21", [{ accountCode: "7400", debit: 300 }, { accountCode: "1100", credit: 300 }])
], ACCOUNTS, "2026-03-01", "2026-03-31");

ok("income 12,000", s.income === 12000);
ok("direct 5,500", s.direct === 5500);
ok("gross margin = income - direct = 6,500", s.grossMargin === 6500);
ok("operating 1,500", s.operating === 1500);
ok("surplus = gross - operating = 5,000", s.surplus === 5000);
ok("bank movements never reach the statement", !s.rows.some(r => r.code === "1100"));
ok("one row per posted account", s.rows.length === 6);

console.log("\na deficit is just a negative surplus");
const d = buildStatement([
  je("2026-04-02", [{ accountCode: "4100", credit: 1000 }]),
  je("2026-04-03", [{ accountCode: "5100", debit: 900 }]),
  je("2026-04-04", [{ accountCode: "7100", debit: 400 }])
], ACCOUNTS, "2026-04-01", "2026-04-30");
ok("gross margin 100", d.grossMargin === 100);
ok("surplus is -300 (a deficit)", d.surplus === -300);

console.log("\nwindow and posting state");
const w = buildStatement([
  je("2026-02-28", [{ accountCode: "4100", credit: 500 }]),          // before window
  je("2026-03-15", [{ accountCode: "4100", credit: 700 }]),          // inside
  je("2026-04-01", [{ accountCode: "4100", credit: 900 }]),          // after
  je("2026-03-16", [{ accountCode: "4100", credit: 999 }], false)    // inside but unposted
], ACCOUNTS, "2026-03-01", "2026-03-31");
ok("only the in-window posted entry counts", w.income === 700);

console.log("\nrefunds reduce their own line, they do not flip sides");
const rf = buildStatement([
  je("2026-05-01", [{ accountCode: "6100", debit: 1000 }]),
  je("2026-05-09", [{ accountCode: "6100", credit: 250 }])   // supplier refund
], ACCOUNTS, "2026-05-01", "2026-05-31");
ok("direct nets to 750", rf.direct === 750);
ok("a refund does not appear as income", rf.income === 0);

console.log("\nan unknown account is surfaced, never silently dropped");
const u = buildStatement(
  [je("2026-06-01", [{ accountCode: "9999", debit: 42 }])],
  ACCOUNTS, "2026-06-01", "2026-06-30"
);
ok("unclassified reports 9999", u.unclassified.length === 1 && u.unclassified[0].code === "9999");
ok("it does not silently land in a bucket", u.direct === 0 && u.operating === 0 && u.income === 0);

// The balance sheet, reproduced from the worked example in the training deck:
// an outlet that closed the year in surplus and still misses March payroll.
console.log("\nbalance sheet — the deck's worked example");
const BS_ACCOUNTS = [
  { code: "1100", name: "Bank - USD", type: "Asset" },
  { code: "1210", name: "Donor Receivable", type: "Asset" },
  { code: "1220", name: "Trade Receivable — invoices sent", type: "Asset" },
  { code: "1510", name: "Fixed Assets - Equipment", type: "Asset" },
  { code: "2300", name: "Payroll Payable", type: "Liability" },
  { code: "2500", name: "Loan from founder", type: "Liability" }
];
const bs = buildBalanceSheet([
  je("2026-12-31", [{ accountCode: "1100", debit: 22000 }]),
  je("2026-12-31", [{ accountCode: "1210", debit: 9000 }]),   // grant approved, not yet paid
  je("2026-12-31", [{ accountCode: "1220", debit: 6500 }]),   // invoice sent, not yet paid
  je("2026-12-31", [{ accountCode: "1510", debit: 5500 }]),   // equipment
  je("2026-12-31", [{ accountCode: "2300", credit: 9500 }]),  // unpaid salaries, 1 month
  je("2026-12-31", [{ accountCode: "2500", credit: 8000 }])   // founder loan
], BS_ACCOUNTS, "2026-12-31", 18000);                          // restricted grant not yet spent

ok("total assets 43,000", bs.totalOwn === 43000);
ok("total liabilities 35,500 (incl. unspent restricted)", bs.totalOwe === 35500);
ok("net reserves 7,500", bs.netReserves === 7500);
ok("cash in the bank 22,000", bs.cash === 22000);
ok("free cash only 4,000 — reserves say 7,500", bs.freeCash === 4000);
ok("15,500 owed to the outlet has not arrived", bs.receivable === 15500);
ok("unspent restricted appears on what-you-owe",
  bs.owe.some(r => /not yet spent/i.test(r.name) && r.amount === 18000));
ok("healthy reserves, and still cannot make payroll of 9,500", bs.netReserves > 0 && bs.freeCash < 9500);

console.log("\nbalance sheet — equipment is owned but cannot pay a salary");
ok("equipment is not counted as cash", bs.cash === 22000 && bs.totalOwn - bs.cash === 21000);

console.log("\nreclassifying a cost already in the books — never an edit of the original");
// The shape the live books actually hold: one expense debit carrying its project and donor,
// then the liability and withholding credits, which a reclassification must not touch.
const POSTED = [
  { accountCode: "6000", debit: 2930, credit: 0, projectId: "proj-skf-invj", donorId: "don-skf" },
  { accountCode: "2100", debit: 0, credit: 2930, projectId: "proj-skf-invj" }
];
const moveOne = reclassifyLegs(POSTED, "6000", "5120");
ok("it reads which expense account the postings actually debited",
  debitedExpenseAccounts(POSTED).join() === "6000");
ok("the liability leg is left alone — the cash left exactly as recorded",
  moveOne.every(l => l.accountCode === "5120" || l.accountCode === "6000"));
ok("one balanced pair: debit the right account, credit the wrong one",
  moveOne.length === 2
  && moveOne.find(l => l.accountCode === "5120")?.debit === 2930
  && moveOne.find(l => l.accountCode === "6000")?.credit === 2930);
ok("and it balances, so the correcting entry cannot post lopsided",
  Math.abs(moveOne.reduce((n, l) => n + Number(l.debit || 0), 0)
         - moveOne.reduce((n, l) => n + Number(l.credit || 0), 0)) < 0.005);
ok("the donor and project ride along — moving the account must not lose who it was spent on",
  moveOne.every(l => l.projectId === "proj-skf-invj" && l.donorId === "don-skf"));

// A voucher split across two projects has two debit legs. Collapsing them into one pair would
// move the money correctly and lose which donor each half belonged to (Policy 4.7).
const SPLIT = [
  { accountCode: "6000", debit: 600, credit: 0, projectId: "proj-a", donorId: "don-a" },
  { accountCode: "6000", debit: 400, credit: 0, projectId: "proj-b", donorId: "don-b" },
  { accountCode: "2100", debit: 0, credit: 1000, projectId: "proj-a" }
];
const moveSplit = reclassifyLegs(SPLIT, "6000", "6300");
ok("a shared cost moves leg by leg, one pair per project", moveSplit.length === 4);
ok("each half keeps its own donor", 
  moveSplit.filter(l => l.donorId === "don-a").length === 2 && moveSplit.filter(l => l.donorId === "don-b").length === 2);
ok("and the totals still match the money that was spent",
  moveSplit.filter(l => l.accountCode === "6300").reduce((n, l) => n + Number(l.debit || 0), 0) === 1000
  && moveSplit.filter(l => l.accountCode === "6000").reduce((n, l) => n + Number(l.credit || 0), 0) === 1000);
ok("a voucher already split across two accounts is refused, not guessed at",
  debitedExpenseAccounts([...POSTED, { accountCode: "7100", debit: 50, credit: 0 }]).length === 2);
ok("nothing posted yet means nothing to reclassify — that is the approver's field instead",
  debitedExpenseAccounts([{ accountCode: "2100", debit: 0, credit: 100 }]).length === 0);
// A correction lands in the statement on the same line as the cost it corrects, or moves it
// between lines when that is the point: 6000 and 5120 are both direct, 7100 is operating.
// A correction must itself be correctable. The original debit stays put and a credit lands
// beside it, so after one move the voucher HAS debit legs on both accounts; reading gross
// debits would call that "split across two accounts" and refuse — a correction you cannot
// correct. Netting says what a reader of the books would say.
const afterOne = [...POSTED, ...moveOne];
ok("after one correction the cost sits on exactly one account — the new one",
  debitedExpenseAccounts(afterOne).join() === "5120");
const moveTwice = reclassifyLegs(afterOne, "5120", "6300");
ok("so it can be corrected again", moveTwice.length === 2);
ok("and the second move carries the amount that is actually there, not the sum of every debit",
  moveTwice.find(l => l.accountCode === "6300")?.debit === 2930);
const afterTwo = [...afterOne, ...moveTwice];
ok("three postings later the cost is still 2,930 and on one account",
  debitedExpenseAccounts(afterTwo).join() === "6300"
  && costPositions(afterTwo).reduce((n, p) => n + p.amount, 0) === 2930);
ok("moved back to where it started, it is on one account again and still 2,930",
  (() => { const back = [...afterTwo, ...reclassifyLegs(afterTwo, "6300", "6000")];
    return debitedExpenseAccounts(back).join() === "6000"
      && costPositions(back).reduce((n, p) => n + p.amount, 0) === 2930; })());
ok("a genuinely split cost is still refused — two accounts at posting is not one correction",
  debitedExpenseAccounts([...POSTED, { accountCode: "7100", debit: 50, credit: 0 }]).length === 2);

ok("moving a cost between statement lines is exactly what a 6000 to 7100 correction does",
  bucketFor("6000", "Expense") === "direct" && bucketFor("7100", "Expense") === "operating");

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nAll statement checks passed.\n");
process.exit(failed ? 1 : 0);
