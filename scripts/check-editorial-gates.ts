// Editorial publish-gate self-check (Policies 002 & 005).
// Pure asserts on synthetic items — never opens any database.
// Run: npx tsx scripts/check-editorial-gates.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { CONTENT_CHECKS, CONTENT_STATUSES, publishBlockers, socialPostBlockers } from "../src/editorialGates";
import { RULES } from "../src/workflow";
import { editorialStations, PUBLISHABLE_STATUS, livePositions, stationStanding, MAP_KIND } from "../src/editorialMap";

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

/* ── The editorial map is DERIVED, never written out ──────────────────────────
 * Stage 1 of the visual builder draws a station per status. The whole point is that the
 * drawing cannot drift from behaviour, so these asserts fail the build if a station is ever
 * hardcoded, invented, or quietly dropped — and if a lock that policy fixes goes missing.
 */
const stations = editorialStations();
const contentRules = RULES.filter(r => r.kind === ("contentItems" as any));

// 1. The stations ARE the gate's statuses, in the gate's order. No more, no fewer.
assert.deepStrictEqual(stations.map(s => s.status), [...CONTENT_STATUSES],
  "the map must draw exactly the gate's statuses, in order");
assert.strictEqual(MAP_KIND, "contentItems");

// 2. Every station is backed by at least one real rule, and every content rule lands on one.
for (const st of stations) {
  assert.ok(st.rules.length > 0, `station ${st.status} has no rule in workflow.ts behind it`);
  assert.ok(st.rules.every(r => r.status === st.status), `station ${st.status} carries a foreign rule`);
}
assert.strictEqual(stations.reduce((n, s) => n + s.rules.length, 0), contentRules.length,
  "every content rule must appear on exactly one station — none dropped, none double-counted");
for (const r of contentRules) {
  assert.ok(CONTENT_STATUSES.includes(r.status as any),
    `workflow.ts has a content rule on "${r.status}", which the gate does not list — the map could not draw it`);
}

// 3. Seats and verbs come from the rules, not from the screen.
for (const st of stations) {
  const seats = new Set(st.rules.flatMap(r => [...(r.seat || [])]));
  assert.deepStrictEqual(new Set(st.seats), seats, `station ${st.status} shows seats the rules do not give it`);
  for (const v of st.verbs) assert.ok(st.rules.some(r => r.verb === v), `verb "${v}" is not in any rule`);
}

// 4. NOTHING may be hardcoded: no station name may appear as a literal in the map's source.
//    This is the assert that stops someone drawing a station behaviour does not have.
const mapSrc = readFileSync(new URL("../src/editorialMap.ts", import.meta.url), "utf8");
for (const status of CONTENT_STATUSES) {
  const literal = new RegExp(`["'\`]${status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`);
  const offending = mapSrc.split("\n").filter(l => literal.test(l) && !l.trim().startsWith("*") && !l.trim().startsWith("//"));
  assert.strictEqual(offending.length, 0,
    `src/editorialMap.ts names the station "${status}" as a literal — stations must be derived:\n    ${offending.join("\n    ")}`);
}

// 5. The two policy locks must exist and must name their policy. If a refactor loses one, the
//    map would quietly stop teaching a rule that the server still enforces.
const factCheck = stations.find(s => s.personField && !s.seats.length);
assert.ok(factCheck, "no station is held by a named individual — Policy 005's independent checker is missing");
assert.ok(factCheck!.locks.some(l => /005/.test(l.policy)), "the named-checker station must cite Policy 005");
const dual = stations.find(s => s.slots.length > 1);
assert.ok(dual, "no station has two approval slots — Policy 002's dual approval is missing");
assert.ok(dual!.locks.some(l => /002/.test(l.policy)), "the dual-approval station must cite Policy 002");
assert.ok(dual!.slots.every(sl => dual!.slots.some(o => o !== sl && sl.excludes.includes(o.emptyField))),
  "each approval slot must exclude the other — otherwise one person could hold both (Policy 002)");
assert.ok(dual!.slots.every(sl => sl.excludes.includes("assigneeUserId")),
  "an approval slot must exclude the author (§4.3)");

// 6. The publishable status is asked of the gate, and it is the last non-terminal station.
assert.strictEqual(PUBLISHABLE_STATUS, stations.filter(s => !s.terminal).at(-1)!.status,
  "the status the gate will publish must be the last station a piece can act at");
assert.strictEqual(stations.find(s => s.status === PUBLISHABLE_STATUS)!.outstanding.length, 0,
  "nothing structural may still block publication at the publishable status");
assert.ok(stations.at(-1)!.terminal, "the chain must end in a terminal station");

// 7. The live layer places a piece at its own status and invents nothing.
const desk = [{ kind: "contentItems", recordId: "c1", group: "mine", urgency: "overdue", when: "2026-01-01",
                id: "contentItems:c1:pmApprovedBy" } as any];
const pos = livePositions(
  [{ id: "c1", title: "A", status: CONTENT_STATUSES[3] }, { id: "c2", title: "B", status: "Not A Status" }], desk);
assert.deepStrictEqual(Object.keys(pos), [...CONTENT_STATUSES], "positions are keyed by the gate's statuses");
assert.strictEqual(pos[CONTENT_STATUSES[3]].length, 1, "a piece stands at its own status");
assert.strictEqual(pos[CONTENT_STATUSES[3]][0].turn, "mine", "the desk's reading of whose turn it is carries through");
assert.deepStrictEqual(pos[CONTENT_STATUSES[3]][0].openSlots, ["pmApprovedBy"], "the open slot is named");
assert.strictEqual(Object.values(pos).flat().length, 1, "a piece with a status the gate does not know is not placed");

// 8. Staffing is read from the live accounts: an inactive holder does not hold a seat.
const twoSlot = dual!;
assert.strictEqual(stationStanding(twoSlot, [{ id: "u1", name: "X", role: twoSlot.seats[0], active: false }]).vacant, true,
  "an inactive account must not count as holding a seat");
assert.strictEqual(stationStanding(twoSlot, [{ id: "u1", name: "X", role: twoSlot.seats[0], active: true }]).understaffed, true,
  "one person cannot fill two slots that must be two different people");

/* ── Policy 002 covers the social channels too ────────────────────────────────
 * Until 9 Sep 2026 a social post could name no piece, and went out immediately: no fact-check,
 * no dual approval, no standards, no legal review, no AI disclosure. Policy 002 names
 * "WhatsApp, Facebook, Instagram, YouTube, WEBSITE" as AnaHon's own channels and requires ALL
 * content to be reviewed and approved before publication, so that path was a policy bypass.
 */
assert.strictEqual(socialPostBlockers(null).length, 1, "a post with no piece behind it must be refused");
assert.match(socialPostBlockers(null)[0], /Policy 002/, "and the refusal must say which policy");
assert.deepStrictEqual(socialPostBlockers({ status: "Published", retractedAt: "" }), [],
  "a published piece may be promoted");
assert.strictEqual(socialPostBlockers({ status: "Fact-Check", retractedAt: "" }).length, 0,
  "a piece still in the pipeline is NOT refused — it yields a Draft that the gate releases");
assert.strictEqual(socialPostBlockers({ status: "Published", retractedAt: "2026-09-03T18:28:56Z" }).length, 1,
  "a retracted piece may not be promoted again");
// The rule must never be satisfiable by an empty-ish item: these are the shapes a caller controls.
for (const bad of [null, undefined as any]) assert.ok(socialPostBlockers(bad).length, "no falsy item may pass");
// Both doors into the queue enforce it: creating a post and retrying one.
const serverSrc = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const guarded = serverSrc.split("\n").filter(l => l.includes("socialPostBlockers("));
assert.ok(guarded.length >= 2,
  `both /api/social/queue and /api/social/queue/retry must call socialPostBlockers — found ${guarded.length}`);
assert.ok(/const gate = socialPostBlockers\(item\);[\s\S]{0,200}?res\.status\(403\)/.test(serverSrc),
  "the guard must refuse with 403, not merely compute a list");

console.log("check-editorial-gates: all assertions passed —",
  `${5 + cases.length + CONTENT_CHECKS.length} gate scenarios (Policies 002 & 005 + transparency rule)`,
  `+ ${stations.length} derived map stations, none hardcoded.`);
