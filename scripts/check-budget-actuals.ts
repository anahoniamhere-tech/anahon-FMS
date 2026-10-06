// What a budget line has spent and committed (Books, 6 Oct 2026) — the rule the budget screen and every donor
// figure built from it depend on. The stored totals are running sums nothing recomputes, so the only guard is
// that the reconciliation reads the vouchers correctly.
//   npx tsx scripts/check-budget-actuals.ts
import { readFileSync } from "node:fs";
import { budgetTotals, budgetDrift, ACTUAL_STATUSES, COMMITTED_STATUSES } from "../src/budgetActuals.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
// A missing line reads as zero, so a broken rule FAILS with its name instead of killing the run.
const at = (m: Map<string, { actualUSD: number; committedUSD: number }>, id: string) => m.get(id) || { actualUSD: 0, committedUSD: 0 };
const v = (over: Partial<Parameters<typeof budgetTotals>[0][number]> = {}) =>
  ({ id: "e1", status: "Posted", budgetLineId: "bl-1", convertedAmount: 100, rate: 1, allocationsJson: "[]", ...over });

console.log("\n1. the vouchers decide, by their step");
ok("a posted voucher is spent", at(budgetTotals([v()]), "bl-1").actualUSD === 100);
ok("an approved or paid voucher is committed, not spent",
  at(budgetTotals([v({ status: "Approved" })]), "bl-1").committedUSD === 100 && at(budgetTotals([v({ status: "Paid" })]), "bl-1").actualUSD === 0);
ok("a draft or rejected voucher counts for neither", !budgetTotals([v({ status: "Draft" }), v({ status: "Rejected" })]).size);
ok("the two lists stay apart", !ACTUAL_STATUSES.some(s => COMMITTED_STATUSES.includes(s)) && ACTUAL_STATUSES.join() === "Posted");

console.log("\n2. an allocated voucher is split across its own lines, in USD");
const split = budgetTotals([v({ convertedAmount: 300, rate: 1.5, allocationsJson: JSON.stringify([{ projectId: "p1", budgetLineId: "bl-a", amount: 100 }, { projectId: "p2", budgetLineId: "bl-b", amount: 100 }]) })]);
ok("each slice lands on its own line", at(split, "bl-a").actualUSD === 150 && at(split, "bl-b").actualUSD === 150);
ok("…and the voucher's own line is not charged as well", !split.has("bl-1"));
ok("a voucher with no allocations charges the line it names", at(budgetTotals([v({ allocationsJson: "" })]), "bl-1").actualUSD === 100);
ok("a malformed allocations field falls back to the named line, it does not throw", at(budgetTotals([v({ allocationsJson: "{oops" })]), "bl-1").actualUSD === 100);

console.log("\n3. drift is reported only where the stored totals disagree");
const totals = budgetTotals([v({ convertedAmount: 368.95 })]);
ok("a line that agrees is left alone", budgetDrift({ id: "bl-1", actualUSD: 368.95, committedUSD: 0 }, totals) === null);
ok("a line that is short is reported with its difference", budgetDrift({ id: "bl-1", actualUSD: 360, committedUSD: 0 }, totals)?.actualDiff === 8.95);
ok("a commitment that was never cleared is reported too", budgetDrift({ id: "bl-1", actualUSD: 368.95, committedUSD: 9000 }, totals)?.committedDiff === -9000);
ok("a line with no vouchers at all reconciles to zero", budgetDrift({ id: "bl-none", actualUSD: 500, committedUSD: 0 }, totals)?.actualUSD === 0);

console.log("\n4. the script only touches the two stored totals");
const script = read("scripts/reconcile-budget-actuals.ts");
ok("it writes actualUSD and committedUSD and nothing else", /data: \{ actualUSD: drift\.actualUSD, committedUSD: drift\.committedUSD \}/.test(script)
  && !/expense\.update|journalEntry|bankAccount\.update|bankTransaction/.test(script));
ok("it is a dry run unless told otherwise, and audit-logs what it changed", /const APPLY = process\.argv\.includes\("--apply"\)/.test(script) && /"Budget Actuals Reconciled"/.test(script));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
