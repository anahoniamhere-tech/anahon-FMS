/**
 * The Projects screen dates a voucher by its true date (Books' voucher-date sweep, 80c06bf):
 * transactionDate first, then paid_at, then created_at. A backfilled voucher placed by the day
 * it was typed in lands in the wrong period. The late-cost rule (src/lateCosts.ts) deliberately
 * keeps created_at — recording time — and is not a date read.
 */
import assert from "assert";
import fs from "fs";
const file = process.argv[2] || "src/tabs/ProjectsTab.tsx";
const tab = fs.readFileSync(file, "utf8");
const bare = [...tab.matchAll(/(?<!transactionDate \|\| )\b(e|exp)\.paid_at(\?\.split\("T"\)\[0\])? \|\| \1\.created_at/g)].map(m => m[0]);
assert.deepEqual(bare, [], `a voucher date is read without transactionDate first: ${bare.join(" ; ")}`);
const good = (tab.match(/\b(e|exp)\.transactionDate \|\| \1\.paid_at/g) || []).length;
assert.ok(good >= 4, `expected the four date reads (actuals, spend over time, donor export, voucher table) to lead with transactionDate; found ${good}`);
console.log(`✓ check-projects-voucher-dates: ${good} voucher date reads lead with transactionDate`);
