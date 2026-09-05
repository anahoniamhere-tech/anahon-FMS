// The phone on a personnel file, and the nudge that uses it.
//
// 5 Sep 2026 (People). Two things can go quietly wrong here. The number is personal
// data on a personnel file, so it must reach exactly the people the papers in that file
// reach — and the file's rule already exists, so the failure mode is a *second* rule
// drifting away from it. And a number the save route accepts but waLink() refuses is a
// button that is permanently dead: the two rules about what a number looks like have to
// agree. Run: npx tsx scripts/check-employee-phone.ts
import { readFileSync } from "node:fs";
import { maySeePersonnelFile } from "../src/personnelDocs.js";
import { waLink, WA_TEMPLATES } from "../src/tabs/shared.js";
import { HR, TIMESHEET_FILERS, PAYROLL_VIEWERS, PERSONNEL_FILE } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const payroll = readFileSync(new URL("../src/tabs/PayrollTab.tsx", import.meta.url), "utf8");

const STAFF = [
  { id: "emp-1", userEmail: "saad@anahon.org" },
  { id: "emp-2", userEmail: "anahonleb@gmail.com" },
];
const who = (role: string, email = "someone@anahon.org") => ({ role, email });

console.log("\nA. who may see another person's number");
// The file's own rule, asked about someone else's record. PERSONNEL_FILE roles only.
ok("HR / Payroll", maySeePersonnelFile(who("HR / Payroll Officer"), STAFF, "emp-2"));
ok("the director's seat", maySeePersonnelFile(who("Program Director"), STAFF, "emp-2"));
ok("the master account", maySeePersonnelFile(who("Super Admin"), STAFF, "emp-2"));
ok("Finance may not — it pays salaries, it does not hold the file",
  !maySeePersonnelFile(who("Finance Officer"), STAFF, "emp-2"));
ok("a Project Lead may not", !maySeePersonnelFile(who("Project Lead"), STAFF, "emp-2"));
ok("the auditor may not", !maySeePersonnelFile(who("Auditor / Read-Only Reviewer"), STAFF, "emp-2"));
ok("a Project Officer may not", !maySeePersonnelFile(who("Project Officer"), STAFF, "emp-2"));
ok("but your own number is yours",
  maySeePersonnelFile(who("Employee (Self-Service)", "anahonleb@gmail.com"), STAFF, "emp-2"));
ok("and only yours — not the person on the next row",
  !maySeePersonnelFile(who("Employee (Self-Service)", "anahonleb@gmail.com"), STAFF, "emp-1"));

console.log("\nB. the number is blanked on the server, not merely hidden in the browser");
ok("loadState maps employees through the file's rule",
  /employees: employees\.map\(e => maySeePersonnelFile\(viewer, employees, e\.id\) \? e : \{ \.\.\.e, phone: "" \}\)/.test(server));
ok("and the save route asks the same rule, not a role list of its own",
  /app\.post\("\/api\/employees\/phone"[\s\S]{0,800}maySeePersonnelFile\(user, \[target\], employeeId\)/.test(server));
ok("the audit line records the change, never the digits",
  /Employee Phone (Set|Cleared)/.test(server) && !/WhatsApp number \$\{next\}/.test(server));

console.log("\nC. a number the route accepts is a number waLink can dial");
// Copied from the route on purpose, then pinned below: if one moves the other must.
const ACCEPTED = /^\+[1-9]\d{7,14}$/;
ok("the route still carries this exact rule", server.includes("/^\\+[1-9]\\d{7,14}$/"));
for (const n of ["+96176137217", "+9613123456", "+442071838750"]) {
  ok(`${n}: accepted, and waLink builds a link`, ACCEPTED.test(n) && waLink(n, "hi") !== null);
}
for (const n of ["03137217", "76137217", "+0961761", "+961", "not a number"]) {
  ok(`${n}: refused before it is ever stored`, !ACCEPTED.test(n.replace(/[\s()-]/g, "")));
}
ok("an empty number is allowed — that is how a wrong one is removed", "" === "".replace(/[\s()-]/g, ""));
ok("a stored-but-unusable number leaves no live button, it does not throw", waLink("", "hi") === null);

console.log("\nD. when the nudge shows");
// The card's condition, as the JSX states it: HR seats, never your own card, and only
// while the month's timesheet has not been handed in.
const shows = (role: string, isOwnCard: boolean, status?: string) =>
  HR.includes(role) && !isOwnCard && !(status !== undefined && ["Submitted", "Approved"].includes(status));
ok("HR, no timesheet at all", shows("HR / Payroll Officer", false, undefined));
ok("HR, a Submitted timesheet — nothing to chase", !shows("HR / Payroll Officer", false, "Submitted"));
ok("HR, an Approved timesheet — nothing to chase", !shows("HR / Payroll Officer", false, "Approved"));
ok("not on your own card", !shows("Super Admin", true, undefined));
ok("Finance does not nudge — it is not an HR seat", !shows("Finance Officer", false, undefined));
ok("nor a Project Officer, who is sent no employees at all", !shows("Project Officer", false, undefined));
ok("the card still states that condition", payroll.includes('!["Submitted", "Approved"].includes(activeTimesheet.status)'));
ok("the button is gated on HR and not on the payroll viewers", payroll.includes("HR.includes(currentUser.role) && !isOwnCard"));
ok("and the phone field asks the file's rule, not a second role list",
  payroll.includes("maySeePersonnelFile(currentUser, state.employees, emp.id)") && !payroll.includes("PERSONNEL_FILE.includes"));

console.log("\nE. the message says timesheet, and nothing about money");
const text = WA_TEMPLATES["freelancer-nudge"]((s: string) => s, { name: "Ahmad", what: "timesheet", period: "2026-05" });
ok("it names the person and the month", text.includes("Ahmad") && text.includes("2026-05"));
ok("it asks for the timesheet", text.includes("timesheet"));
// Every base salary is 0 until a project funds the role, so a message that quoted a
// figure would read "we owe you $0.00". This one names no amount at all.
ok("it quotes no figure, so a 0 salary base cannot leak into it", !/[$€]|\d+\.\d\d/.test(text));

console.log("\nF. who may file a timesheet for somebody else");
// The route used to keep this list to itself, and the button offered it to two of the four
// seats the route accepted. One list now, and it is deliberately not composed from the two
// it happens to equal today — see the comment on TIMESHEET_FILERS.
for (const r of ["Super Admin", "HR / Payroll Officer", "Program Director", "Finance Officer"]) {
  ok(`${r} may file for anyone`, TIMESHEET_FILERS.includes(r));
}
for (const r of ["Project Officer", "Project Lead", "Auditor / Read-Only Reviewer", "Employee (Self-Service)", "Reporter"]) {
  ok(`${r} files only their own card`, !TIMESHEET_FILERS.includes(r));
}
ok("the route asks the list and keeps no array of its own",
  /TIMESHEET_FILERS\.includes\(user\?\.role \|\| ""\)/.test(server) && !/const HR_ROLES = \[/.test(server));
ok("and the button asks the same list, so the two can no longer disagree",
  payroll.includes("TIMESHEET_FILERS.includes(currentUser.role) || isOwnCard"));
ok("the route stays ANY in gates.ts — filing your own card is the other way in",
  readFileSync(new URL("../src/gates.ts", import.meta.url), "utf8").includes('"/api/timesheets/submit": ANY'));
ok("it is wider than PAYROLL_VIEWERS and wider than PERSONNEL_FILE, which is why neither was reused",
  PAYROLL_VIEWERS.every(r => TIMESHEET_FILERS.includes(r)) && PERSONNEL_FILE.every(r => TIMESHEET_FILERS.includes(r))
  && TIMESHEET_FILERS.length > PAYROLL_VIEWERS.length && TIMESHEET_FILERS.length > PERSONNEL_FILE.length);

console.log("\nG. the employment start date");
// The framework contract's period used to be a guess: nothing on the record said when the
// employment began. HR keeps it; it is payroll data, not personnel-file data, so it reuses
// the HR list rather than the file's rule — two sensitivities, two lists already in roles.ts.
const gates = readFileSync(new URL("../src/gates.ts", import.meta.url), "utf8");
ok("the route is HR's, not the personnel file's", gates.includes('"/api/employees/start-date": HR'));
ok("and the route enforces that itself", /app\.post\("\/api\/employees\/start-date"[\s\S]{0,400}HR\.includes\(user\?\.role \|\| ""\)/.test(server));
ok("the card shows the field to HR and the date to everyone else",
  payroll.includes("HR.includes(currentUser.role) ? (") && payroll.includes("emp-start-"));
// A contract period is computed from this: a date-shaped string that is not a date would
// roll silently into the next month.
const REAL = (d: string) => {
  const t = new Date(d + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d);
};
ok("2026-02-10 is accepted", REAL("2026-02-10"));
ok("2026-02-31 is refused rather than rolled into March", !REAL("2026-02-31"));
ok("2026-13-01 is refused", !REAL("2026-13-01"));
ok("10/02/2026 is refused", !REAL("10/02/2026"));
ok("the route checks the calendar, not just the shape", server.includes('asDate.toISOString().startsWith(next)'));
// Date("2026-13-01") is an Invalid Date and toISOString() throws on one: unguarded, a plainly
// wrong month answers 500 instead of saying what is wrong. This check found that.
ok("and guards the throw, so a wrong month is a 400 and not a 500", server.includes("!Number.isNaN(asDate.getTime())"));
ok("clearing it is allowed, and audit-logged as such", /Employment Start Date (Set|Cleared)/.test(server));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
