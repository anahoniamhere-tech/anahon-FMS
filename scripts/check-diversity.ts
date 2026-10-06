// The diversity tracker — Policy P3 §4.1 step 2, §2.5, §4.3 (handbook ed.7).
// Run: npx tsx scripts/check-diversity.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  MAIN_SUBJECTS, VULNERABLE_GROUPS, PRESENCE_FIELDS, PACKAGE_ANGLES, NO_GROUP,
  isPresenceValue, present, countOf, groupsOf, diversityBlockers, diversityComplete,
  trackerRequired, TRACKER_FROM, monthlySummary, monthsLogged,
} from "../src/diversity";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const full = {
  mainSubject: "woman", mentionedWomen: "3", mentionedMen: "none",
  expertWomen: "yes", expertMen: "none", groupsJson: JSON.stringify(["refugees"]),
};

/* ── the vocabulary is the sheet's, and nothing was added to it (advocacy scope) ───────── */
assert.deepStrictEqual(VULNERABLE_GROUPS.map(([k]) => k),
  ["women-girls", "refugees", "children", "disabilities", "domestic-workers", "displaced", "ethnic", "religious"],
  "exactly the eight groups the FPU sheet records");
assert.strictEqual(VULNERABLE_GROUPS.length, 8, "no ninth category may be added here");
assert.deepStrictEqual(MAIN_SUBJECTS.map(([k]) => k), ["woman", "man", "mixed", "not-person"]);
assert.deepStrictEqual(PRESENCE_FIELDS.map(([k]) => k), ["mentionedWomen", "mentionedMen", "expertWomen", "expertMen"]);
assert.deepStrictEqual(PACKAGE_ANGLES.map(([k]) => k), ["officials", "affected", "experts", "solutions"], "§4.3's own four angles");
for (const [, en, ar] of [...VULNERABLE_GROUPS, ...MAIN_SUBJECTS, ...PRESENCE_FIELDS, ...PACKAGE_ANGLES]) {
  assert.ok(en.trim() && ar.trim(), `${en} has both labels`);
  assert.ok(/[؀-ۿ]/.test(ar), `${en}'s Arabic is Arabic`);
}

/* ── a counted field: the sheet really holds all of these ──────────────────────────────── */
for (const v of ["none", "yes", "0", "3", "12", "YES", " none "]) assert.ok(isPresenceValue(v), `${v} is a value`);
for (const v of ["", "No", "Yes (Mainly)", "some", "-1", "3 men", null, undefined]) assert.ok(!isPresenceValue(v as any), `${JSON.stringify(v)} is not`);
assert.ok(present("yes") && present("3") && present("12"), "someone was there");
assert.ok(!present("none") && !present("0") && !present("") && !present(null), "nobody was, or nobody looked");
assert.strictEqual(countOf("5"), 5, "a number is kept as a number");
assert.strictEqual(countOf("yes"), null, "\"yes\" is a presence, never a count of one");
assert.strictEqual(countOf("none"), null);

/* ── the gate (P3 §4.1): it refuses SILENCE, never the content of a piece ──────────────── */
assert.deepStrictEqual(diversityBlockers(full), [], "a filled tracker passes");
assert.ok(diversityComplete(full));
assert.match(diversityBlockers(null)[0], /Policy P3 §4\.1/, "no tracker at all cites the section");
for (const [key, en] of PRESENCE_FIELDS) {
  const b = diversityBlockers({ ...full, [key]: "" });
  assert.strictEqual(b.length, 1, `${key} missing is one blocker`);
  assert.match(b[0], /Policy P3 §4\.1/);
  assert.match(b[0], new RegExp(en.toLowerCase().replace(/[()]/g, ".")), `the refusal names ${en}`);
}
assert.match(diversityBlockers({ ...full, mentionedWomen: "Yes (Mainly)" })[0], /not a value/, "the sheet's prose is not a stored value");
assert.match(diversityBlockers({ ...full, mainSubject: "" })[0], /who the piece is mainly about/);
assert.match(diversityBlockers({ ...full, mainSubject: "Female" })[0], /not one of the main-subject options/, "the sheet's old wording is refused, not silently kept");
assert.match(diversityBlockers({ ...full, groupsJson: "[]" })[0], /or tick "none"/, "an empty list is nobody looking");
assert.deepStrictEqual(diversityBlockers({ ...full, groupsJson: JSON.stringify([NO_GROUP]) }), [], "\"none\" is a recorded answer");
assert.match(diversityBlockers({ ...full, groupsJson: JSON.stringify([NO_GROUP, "refugees"]) })[0], /cannot be combined/);
assert.match(diversityBlockers({ ...full, groupsJson: JSON.stringify(["lgbtq"]) })[0], /not one of the vulnerable groups/, "no category outside the eight");
assert.deepStrictEqual(groupsOf({ groupsJson: "not json" }), [], "a broken field reads as empty, never throws");
// Every refusal is about the LOG, never about what the piece says.
for (const b of [...diversityBlockers(null), ...diversityBlockers({}), ...diversityBlockers({ ...full, expertWomen: "" })])
  assert.ok(/tracker|Policy P3/.test(b) && !/must (include|quote|have)/.test(b), `a refusal asks for the log, not for different content: ${b}`);

/* ── pieces already in production are prompted, not blocked ────────────────────────────── */
assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(TRACKER_FROM), "the cutoff is an instant, not a date guess");
// Relative to the constant, never to a date typed here: the cutoff is set at deploy time, and a
// literal would quietly stop testing the boundary the moment it moved.
const before = new Date(Date.parse(TRACKER_FROM) - 1000).toISOString();
const after = new Date(Date.parse(TRACKER_FROM) + 1000).toISOString();
assert.ok(!trackerRequired(before), "a piece opened a second before the tracker went live is prompted");
assert.ok(trackerRequired(after), "a piece opened a second after it is bound by it");
assert.ok(trackerRequired(TRACKER_FROM), "the instant itself counts as covered");
assert.ok(!trackerRequired(""), "a record with no date is never retroactively blocked");

/* ── the monthly review (§4.3) ─────────────────────────────────────────────────────────── */
const rows = [
  { loggedOn: "2026-10-02", mainSubject: "woman", mentionedWomen: "2", expertWomen: "yes", expertMen: "none", groupsJson: JSON.stringify(["refugees"]) },
  { loggedOn: "2026-10-20", mainSubject: "man", mentionedWomen: "none", expertWomen: "none", expertMen: "2", groupsJson: JSON.stringify([NO_GROUP]) },
  { loggedOn: "2026-09-30", mainSubject: "woman", mentionedWomen: "yes", expertWomen: "yes", expertMen: "none", groupsJson: JSON.stringify(["children"]) },
];
const oct = monthlySummary(rows, "2026-10");
assert.strictEqual(oct.logged, 2, "only that month's pieces count");
assert.strictEqual(oct.womenSubjectShare, 50);
assert.strictEqual(oct.womenExperts, 1);
assert.strictEqual(oct.womenExpertsShare, 50, "the gap §4.3 names as its example is visible");
assert.strictEqual(oct.groups.find(g => g.key === "refugees")!.pieces, 1);
assert.strictEqual(oct.groups.find(g => g.key === "women-girls")!.pieces, 0);
assert.strictEqual(oct.groupsCovered, 1, "\"none\" is not a group that was covered");
const empty = monthlySummary(rows, "2026-12");
assert.ok(empty.noneLogged && empty.womenExpertsShare === 0, "a month with nothing logged divides by nothing and says so");
assert.deepStrictEqual(monthsLogged(rows), ["2026-10", "2026-09"], "newest first");
assert.deepStrictEqual(monthsLogged([{ loggedOn: "" }, { loggedOn: null }]), [], "undated rows offer no month");

/* ── the gate the server enforces is this one, not a second copy ───────────────────────── */
const srv = read("../server.ts");
assert.ok(/diversityBlockers/.test(srv), "the server asks this module");
const submit = srv.slice(srv.indexOf('app.post("/api/content/submit-factcheck"'), srv.indexOf('app.post("/api/content/factcheck-pass"'));
assert.ok(/diversityBlockers|trackerRequired/.test(submit), "the fact-check step is where §4.1 step 2 is enforced");
assert.ok(/trackerRequired/.test(submit), "…and pieces from before the cutoff are prompted, not blocked");
// The refusal SENTENCES must not be retyped in the route — a citation in a comment is fine, a
// second copy of the wording is how the screen and the server start saying different things.
const code = submit.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
for (const phrase of ["has not been filled in", "say who the piece is mainly about", "is not a value for", "tick \"none\""])
  assert.ok(!code.includes(phrase), `the route must not retype "${phrase}" — it comes from diversityBlockers`);

console.log("check-diversity: all asserts passed");
