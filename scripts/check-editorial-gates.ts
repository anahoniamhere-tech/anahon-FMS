// Editorial publish-gate self-check (Policies 002 & 005).
// Pure asserts on synthetic items — never opens any database.
// Run: npx tsx scripts/check-editorial-gates.ts
import assert from "node:assert";
import { CONTENT_CHECKS, publishBlockers } from "../src/editorialGates";

const allChecks = Object.fromEntries(CONTENT_CHECKS.map(([k]) => [k, true]));
const good = {
  status: "Approved",
  factCheckPassedAt: "2026-08-05T10:00:00Z",
  pmApprovedBy: "u-pm",
  pdApprovedBy: "u-pd",
  legalFlag: false,
  legalReviewedBy: "",
  checksJson: JSON.stringify(allChecks)
};

// A fully satisfied item publishes.
assert.deepStrictEqual(publishBlockers(good), [], "fully satisfied item must have zero blockers");

// Each gate, removed on its own, must produce its named blocker.
const cases: [string, Partial<typeof good>, RegExp][] = [
  ["wrong status",          { status: "Editorial Review" },                 /only Approved/],
  ["no fact-check pass",    { factCheckPassedAt: "" },                      /Fact-check has not passed/],
  ["missing PM approval",   { pmApprovedBy: "" },                           /Production Manager approval missing/],
  ["missing PD approval",   { pdApprovedBy: "" },                           /Programs Director approval missing/],
  ["same user both slots",  { pmApprovedBy: "u-x", pdApprovedBy: "u-x" },   /same person/],
  ["legal flag unreviewed", { legalFlag: true, legalReviewedBy: "" },       /no legal review recorded/],
  ["corrupt checks json",   { checksJson: "not json" },                     /Standard unmet/]
];
for (const [name, patch, re] of cases) {
  const blockers = publishBlockers({ ...good, ...patch });
  assert(blockers.length > 0, `${name}: expected blockers`);
  assert(blockers.some(b => re.test(b)), `${name}: expected /${re.source}/ in: ${blockers.join(" | ")}`);
}

// Every one of the 7 standards blocks individually, by its label.
for (const [key, label] of CONTENT_CHECKS) {
  const blockers = publishBlockers({ ...good, checksJson: JSON.stringify({ ...allChecks, [key]: false }) });
  assert(blockers.length === 1 && blockers[0].includes(label),
    `unchecking "${key}" must yield exactly its own blocker, got: ${blockers.join(" | ")}`);
}

// Legal review satisfies the flag.
assert.deepStrictEqual(publishBlockers({ ...good, legalFlag: true, legalReviewedBy: "External counsel" }), [],
  "flagged + reviewed must publish");

// Golden transparency rule: AI-assisted content publishes only with its label.
const aiBlockers = publishBlockers({ ...good, aiAssisted: true, aiDisclosed: false });
assert(aiBlockers.length === 1 && /watermark\/disclaimer/.test(aiBlockers[0]),
  `AI without disclosure must block, got: ${aiBlockers.join(" | ")}`);
assert.deepStrictEqual(publishBlockers({ ...good, aiAssisted: true, aiDisclosed: true }), [],
  "AI + disclosed must publish");
assert.deepStrictEqual(publishBlockers({ ...good, aiAssisted: false, aiDisclosed: false }), [],
  "no AI → no disclosure needed");

console.log("check-editorial-gates: all assertions passed —",
  `${5 + cases.length + CONTENT_CHECKS.length} scenarios (Policies 002 & 005 + transparency rule).`);
