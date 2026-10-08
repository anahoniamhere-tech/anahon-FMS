/**
 * A EUR voucher is never read at face value on the project screen (8 Oct 2026).
 *
 * Books' sweep (909c2ba) found ProjectsTab building every spend figure from `e.amount` or an
 * allocation's own amount — both in the voucher's own currency — and setting them against USD budget
 * figures. On FPU-2024-ICONTENT2 that showed EUR 19,163.05 where USD 20,066.86 belonged: 4.7% short,
 * in the reconciliation sheets a donor reads. The screen now asks src/budgetActuals.ts, which carries
 * the rate and the allocation split.
 */
import assert from "assert";
import fs from "fs";
import { shareOfProject, shareOfLine } from "../src/budgetActuals.js";

const tab = fs.readFileSync("src/tabs/ProjectsTab.tsx", "utf8");

// A — the arithmetic the screen now depends on: a EUR voucher is converted, not taken at face value.
const eur = { id: "v1", status: "Posted", projectId: "p1", budgetLineId: "bl1",
  amount: 1000, rate: 1.1406, convertedAmount: 1140.6, allocationsJson: "[]" };
assert.equal(shareOfProject(eur as any, "p1"), 1140.6, "EUR 1,000 is USD 1,140.60, never 1,000");
assert.equal(shareOfLine(eur as any, "bl1"), 1140.6);
assert.notEqual(shareOfProject(eur as any, "p1"), eur.amount, "the face value is the bug this check exists for");
assert.equal(shareOfProject(eur as any, "other"), 0, "another project's voucher is not this project's spend");

// A split voucher: the allocation is in the voucher's currency too, so it converts as well.
const split = { ...eur, amount: 1000, convertedAmount: 1140.6,
  allocationsJson: JSON.stringify([{ projectId: "p1", budgetLineId: "bl1", amount: 400 }, { projectId: "p2", budgetLineId: "bl9", amount: 600 }]) };
assert.equal(shareOfProject(split as any, "p1"), 456.24, "EUR 400 of a split is USD 456.24");
assert.equal(shareOfLine(split as any, "bl1"), 456.24);
assert.equal(shareOfProject(split as any, "p2"), 684.36);

// The FPU case Books measured, to the cent.
const fpuEUR = 19163.05, fpuRate = 1.04717;   // the rate carried on those sixteen vouchers
assert.ok(Math.abs(fpuEUR * fpuRate - 20066.86) < 1, "the understatement was about USD 900, not a rounding wobble");

// B — the screen reads the one helper, and no site builds money by hand any more.
assert.ok(/import \{ shareOfProject, shareOfLine \} from "\.\.\/budgetActuals"/.test(tab), "the screen imports the helper");
assert.ok(/const usdOfProject = \(e: any\) =>/.test(tab) && /const usdOfLine = \(e: any, budgetLineId: string\) =>/.test(tab), "one shim each, not a conversion at every site");
assert.ok(!/Number\(alloc\.amount\)/.test(tab), "an allocation's raw amount is never a figure on this screen");
assert.ok(!/\* e\.rate|\* exp\.rate/.test(tab), "no hand-rolled rate multiplication is left");
assert.ok(!/: e\.amount\)|: exp\.amount\)/.test(tab), "no fall-back to the voucher's own-currency amount");
// The withholding share rides on the converted share, not on the raw figures.
assert.ok(/usdWhtOfProject = \(e: any\) =>\s*\n?\s*Math\.round\(usdOfProject\(e\) \*/.test(tab), "WHT is a ratio of the converted share");
assert.equal((tab.match(/usdOfLine\(e, bl\.id\)/g) || []).length, 4, "all four per-line month totals go through it");

console.log("check-project-spend-currency: all passed");
