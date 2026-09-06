// Is every screen in the sidebar exactly once, and does every role still see what it did?
//
// Phase 1 of the navigation decision (4 Sep 2026) regrouped the sidebar into data.
// The two ways it could silently go wrong: a screen that exists in App.tsx but has no
// door, and a role that lost a door it used to have. Run: npx tsx scripts/check-nav.ts
import { readFileSync } from "node:fs";
import { NAV, NAV_KEYS, LANDING, visibleNav } from "../src/nav.js";
import { ALL_ROLES } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const keys = (role: string) => visibleNav(role).flatMap(s => s.items.map(i => i.navKey)).sort();
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

console.log("\nevery screen App.tsx can render has exactly one door");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const rendered = [...new Set([...app.matchAll(/activeTab === "([a-z-]+)" && </g)].map(m => m[1]))].sort();
const listed = [...NAV_KEYS].sort();
ok(`${rendered.length} screens rendered, ${listed.length} doors listed`, rendered.length === listed.length, `rendered=${rendered.join(",")} listed=${listed.join(",")}`);
ok("no screen without a door", rendered.every(k => listed.includes(k)), rendered.filter(k => !listed.includes(k)).join(","));
ok("no door without a screen", listed.every(k => rendered.includes(k)), listed.filter(k => !rendered.includes(k)).join(","));
ok("no screen listed twice", new Set(listed).size === listed.length);
ok("eight doors", NAV.length === 8, String(NAV.length));

console.log("\nwhat each role sees, against what it saw before the regroup");
// Before: the three hand-written branches in App.tsx. After: the same, plus Help and
// Policies for the people the policies bind — the one deliberate change of phase 1 —
// My Desk for everyone, the one deliberate change of phase 3, and the doors screen
// everyone now lands on (5 Sep 2026).
const before = {
  "Project Officer": ["dashboard", "editorial", "expenses", "help", "procurement", "projects"],
  "Reporter": ["editorial", "help"],
  "Content Creator": ["editorial", "help"],
  "Podcaster": ["editorial", "help"],
  "Employee (Self-Service)": ["payroll"],
};
const added = ["doors", "handbooks", "mydesk"];   // visible to the restricted roles now
const addedSelf = ["doors", "handbooks", "help", "mydesk"]; // self-service had none of them
// Seats placed in phase 2 (they had no login before, so there is no "before" to compare):
const placed: Record<string, string[]> = {
  "Procurement and Logistics Officer": ["doors", "mydesk", "help", "handbooks", "projects", "network", "procurement", "vendors", "subscriptions", "expenses", "assets", "payroll"],
  "Digital Officer": ["doors", "mydesk", "help", "handbooks", "social", "live", "archive", "tools", "network", "payroll"],
  "Chief Editor": ["doors", "mydesk", "help", "handbooks", "editorial", "social", "live", "archive", "payroll"],
  "Production Manager": ["doors", "mydesk", "help", "handbooks", "editorial", "social", "live", "archive", "payroll"],
  "Graphic Designer": ["editorial", "help", "handbooks", "mydesk", "doors"],
};
for (const [role, want] of Object.entries(placed)) ok(`${role}: ${want.length} doors`, same(keys(role), [...want].sort()), `got ${keys(role).join(",")}`);
for (const [role, had] of Object.entries(before)) {
  const expect = [...had, ...(role === "Employee (Self-Service)" ? addedSelf : added)].sort();
  ok(`${role}: ${expect.length} doors`, same(keys(role), expect), `got ${keys(role).join(",")}`);
}
const full = listed;
for (const role of ["Super Admin", "Finance Officer", "Program Director", "Project Lead", "HR / Payroll Officer", "Auditor / Read-Only Reviewer"]) {
  ok(`${role}: sees every door`, same(keys(role), full), `missing ${full.filter(k => !keys(role).includes(k)).join(",")}`);
}

console.log("\nthe redirect follows the data, and every landing door is visible");
ok("App.tsx has no hand-written allowlist left", !/\["dashboard", "projects", "expenses", "procurement", "editorial"\]\.includes\(activeTab\)/.test(app));
ok("App.tsx redirect reads visibleNav", /allowed = visibleNav\(role\)/.test(app));
for (const [role, land] of Object.entries(LANDING)) ok(`${role} lands on ${land}, which it can see`, keys(role).includes(land));
ok("everyone lands on the doors", ALL_ROLES.every(r => LANDING[r] === "doors" && keys(r).includes("doors")), ALL_ROLES.filter(r => LANDING[r] !== "doors").join(","));
const arSrc = readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8");
const labels = NAV.flatMap(s => [s.section, ...s.items.map(i => i.label)]);
ok("every door and section has an Arabic label", labels.every(l => arSrc.includes(`"${l.replace(/"/g, '\\"')}":`)), labels.filter(l => !arSrc.includes(`"${l}":`)).join(", "));

console.log("\nrestricted roles never see the books");
for (const role of ["Project Officer", "Reporter", "Employee (Self-Service)", "Procurement and Logistics Officer", "Digital Officer", "Chief Editor", "Production Manager", "Graphic Designer"]) {
  ok(`${role}: no ledger, bank, accounts, reports`, !keys(role).some(k => ["ledger", "banking", "accounts", "reports", "partners"].includes(k)));
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
