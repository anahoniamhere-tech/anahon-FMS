// Pure asserts on the five-line surplus/deficit statement. Opens no DB — the datasource
// URL is hardcoded in schema.prisma, so purity beats copying the real books around.
//   npx tsx scripts/check-statement.ts
import { bucketFor, buildStatement, STATEMENT_LINES } from "../src/statement.js";

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

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nAll statement checks passed.\n");
process.exit(failed ? 1 : 0);
