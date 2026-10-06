/**
 * Solidarity actions are countable (6 Oct 2026, P3 §7.5, src/solidarity.ts): the six acts, the
 * rules that keep the two fields where they belong, the year's three numbers, and the press-freedom
 * contacts the ED alerts.
 */
import assert from "assert";
import fs from "fs";
import { SOLIDARITY_ACTIONS, SOLIDARITY_KIND, MENTORING_HOURS_TARGET, TOOLS_ORGS_TARGET, solidarityBlocker, solidarityYear, solidarityYears, orgKey } from "../src/solidarity.js";
import { ENGAGEMENT_KINDS, CONTACT_KINDS } from "../src/constants.js";
import { AR } from "../src/i18n.js";

// A — the vocabulary is the policy's, and nothing else.
assert.deepEqual([...SOLIDARITY_ACTIONS],
  ["Case raised", "Mentoring", "Tools or templates shared", "Desk and equipment", "Paid commission", "Republished with credit"]);
assert.ok(ENGAGEMENT_KINDS.includes(SOLIDARITY_KIND), "the register has a Solidarity kind");
assert.ok(CONTACT_KINDS.includes("Press-freedom"), "contacts have a Press-freedom kind");
assert.ok(CONTACT_KINDS.includes("Coach") && CONTACT_KINDS.includes("Partner"), "the kinds the screen already offered");
assert.equal(MENTORING_HOURS_TARGET, 20);
assert.equal(TOOLS_ORGS_TARGET, 2);

// B — the two fields stay where they belong.
assert.equal(solidarityBlocker({ kind: "Solidarity", solidarityAction: "Mentoring", hours: 4 }), null);
assert.ok(solidarityBlocker({ kind: "Solidarity" }), "a solidarity entry names its action");
assert.ok(solidarityBlocker({ kind: "Meeting", solidarityAction: "Mentoring" }), "only solidarity carries an action");
assert.ok(solidarityBlocker({ kind: "Solidarity", solidarityAction: "Advocacy" }), "no invented actions");
assert.ok(solidarityBlocker({ kind: "Meeting", hours: 3 }), "hours are counted on solidarity only");
assert.ok(solidarityBlocker({ kind: "Solidarity", solidarityAction: "Mentoring", hours: -1 }), "no negative hours");
assert.equal(solidarityBlocker({ kind: "Conference" }), null, "an ordinary engagement is untouched");

// C — the year's three numbers.
const rows = [
  { kind: "Solidarity", solidarityAction: "Case raised", startDate: "2026-02-03", org: "Megaphone" },
  { kind: "Solidarity", solidarityAction: "Case raised", startDate: "2026-12-30", org: "Daraj" },
  { kind: "Solidarity", solidarityAction: "Case raised", startDate: "2025-11-01", org: "Old" },
  { kind: "Solidarity", solidarityAction: "Mentoring", startDate: "2026-03-01", hours: 12, org: "Sawt" },
  { kind: "Solidarity", solidarityAction: "Mentoring", startDate: "2026-06-01", hours: 6.5, org: "Sawt" },
  { kind: "Solidarity", solidarityAction: "Tools or templates shared", startDate: "2026-04-01", org: "SKF" },
  { kind: "Solidarity", solidarityAction: "Tools or templates shared", startDate: "2026-05-01", org: " skf " },
  { kind: "Solidarity", solidarityAction: "Tools or templates shared", startDate: "2026-07-01", org: "Ward" },
  { kind: "Meeting", startDate: "2026-04-04", org: "Not solidarity" },
];
const t26 = solidarityYear(rows, "2026");
assert.equal(t26.casesRaised, 2, "the 2025 case belongs to 2025");
assert.equal(t26.mentoringHours, 18.5, "hours add up across sessions");
assert.equal(t26.toolsOrgs.length, 2, "SKF and ' skf ' are one organisation");
assert.deepEqual(t26.toolsOrgs, ["SKF", "Ward"]);
assert.equal(orgKey(" SKF  "), "skf");
assert.deepEqual(t26.byAction.map(a => [a.action, a.count]), [["Case raised", 2], ["Mentoring", 2], ["Tools or templates shared", 3]]);
assert.equal(solidarityYear(rows, "2025").casesRaised, 1);
assert.deepEqual(solidarityYears(rows), ["2026", "2025"], "newest first, solidarity rows only");
assert.equal(solidarityYear([], "2026").mentoringHours, 0);

// D — the server and the migration (read, not assumed).
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/const refusedSolidarity = solidarityBlocker\(/.test(server), "the server refuses what the form refuses");
assert.ok(/solidarityAction: String\(b\.solidarityAction \|\| ""\)\.trim\(\), hours: Number\(b\.hours\) \|\| 0/.test(server), "both fields are saved");
assert.ok(!/const CONTACT_KINDS = \[/.test(server), "the server reads the one list of contact kinds, not its own stale copy");
const mig = fs.readFileSync("prisma/migrations/20261006200000_solidarity/migration.sql", "utf8");
assert.ok(/ALTER TABLE "Engagement" ADD COLUMN "solidarityAction"/.test(mig) && /ADD COLUMN "hours"/.test(mig));
assert.ok(/INSERT OR IGNORE INTO "NetworkContact"/.test(mig), "seeding twice cannot duplicate the organisations");
for (const site of ["https://cpj.org", "https://rsf.org", "https://skeyesmedia.org"]) assert.ok(mig.includes(site), `${site} seeded`);
assert.ok(!/@|\+961|phone/i.test(mig.split("VALUES")[1] || ""), "the seeded rows carry no personal data");
assert.equal((mig.match(/'Press-freedom'/g) || []).length, 3, "three organisations, all on the alert filter");

// E — the Arabic the screen shows, and the brand written as one word.
for (const key of ["Solidarity action", "Case raised", "Mentoring hours", "Organisations given tools", "Press-freedom"]) {
  assert.ok(AR[key] && /[؀-ۿ]/.test(AR[key]), `Arabic missing for "${key}"`);
}
assert.ok(AR["Record what AnaHon did, not details of the person at risk."].includes("اناهون"), "اناهون is one word (Saad)");
const tab = fs.readFileSync("src/tabs/NetworkTab.tsx", "utf8");
assert.ok(/ms-auto/.test(tab) && !/\bml-auto\b/.test(tab), "logical classes only");
assert.ok(/Record what AnaHon did, not details of the person at risk\./.test(tab), "the hint is on the notes field");
assert.ok(/Outlet or journalist helped/.test(tab), "the org field is relabelled on a solidarity entry");

console.log("check-solidarity: all passed");
