// Does every route ask the same question the desk does — and does any route not ask at all?
//
// Phase 9 (5 Sep 2026). Before it, 81 of the 104 POST routes checked no role at all: the
// restricted seats were held back by their allowlists, but anyone on a full view could
// call almost anything, including approving a payment the interface never offers them.
// Run: npx tsx scripts/check-gates.ts
import { readFileSync } from "node:fs";
import { ROUTE_SEATS, ACTION_SEATS, mayCall, seatsFor, ANY } from "../src/gates.js";
import { RULES } from "../src/workflow.js";
import { ALL_ROLES, DIRECTORS, FINANCE, AUDITOR, SELF, PLO, DIGITAL, CREW, EDITORS } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const routes = [...new Set([...server.matchAll(/app\.post\("(\/api\/[^"]+)"/g)].map(m => m[1]))];

console.log("\nevery route is named, and nothing is named that does not exist");
const listed = Object.keys(ROUTE_SEATS);
ok(`${routes.length} routes, ${listed.length} entries`, routes.length === listed.length);
ok("no route without a seat", routes.every(r => listed.includes(r)), routes.filter(r => !listed.includes(r)).join(","));
ok("no seat for a route that is gone", listed.every(r => routes.includes(r)), listed.filter(r => !routes.includes(r)).join(","));
ok("an unlisted route is refused, not waved through", !mayCall("/api/not/a/route", "Super Admin"));

console.log("\nthe seats are real, and the master account is never locked out of its own system");
for (const [path, seats] of Object.entries(ROUTE_SEATS)) {
  const bad = seats === ANY ? [] : seats.filter(r => r !== "*any" && !ALL_ROLES.includes(r));
  ok(`${path}`, bad.length === 0, `unknown role(s): ${bad.join(",")}`);
}
const noMaster = Object.entries(ROUTE_SEATS).filter(([, s]) => s !== ANY && s[0] !== "*any" && !s.includes("Super Admin"));
ok("every route admits the master account", noMaster.length === 0, noMaster.map(([p]) => p).join(","));

console.log("\nthe gate is wired in, once, for the person and for the seat they wear");
ok("the middleware calls it", /if \(!mayCall\(req\.path, effectiveRole, step\)\)/.test(server));
ok("standing in is gated on the seat, not the person", /if \(!mayCall\(req\.path, wanted, step\)\)/.test(server));
ok("a refusal is written to the audit log", /"Action Refused"/.test(server));
ok("the step of a voucher's life is read from the body", /req\.body\?\.action === "string"/.test(server));

console.log("\nthe voucher's life: one step, one seat");
const money = ACTION_SEATS["/api/expense/action"];
ok("five steps, no more", Object.keys(money).length === 5, Object.keys(money).join(","));
ok("the director signs and returns", money["approve"] === DIRECTORS && money["return"] === DIRECTORS);
ok("finance parks, pays and posts", ["finance-review", "cashbook-pay", "general-ledger-post"].every(a => money[a] === FINANCE));
ok("the Finance Officer cannot approve", !mayCall("/api/expense/action", "Finance Officer", "approve"));
ok("the director cannot pay", !mayCall("/api/expense/action", "Program Director", "cashbook-pay"));
ok("a Project Lead can do neither", !mayCall("/api/expense/action", "Project Lead", "approve") && !mayCall("/api/expense/action", "Project Lead", "cashbook-pay"));
ok("HR can do neither", !mayCall("/api/expense/action", "HR / Payroll Officer", "approve") && !mayCall("/api/expense/action", "HR / Payroll Officer", "general-ledger-post"));
ok("an unknown step is refused", !mayCall("/api/expense/action", "Super Admin", "delete-it"));

console.log("\nthe gate agrees with the desk about who is owed the work");
// Every seat the desk names for a record must be able to reach the route that moves it on.
const DESK_ROUTES: Record<string, string> = {
  "expenses|Submitted": "/api/expense/action", "expenses|Under Finance Review": "/api/expense/action",
  "expenses|Approved": "/api/expense/action", "expenses|Paid": "/api/expense/action",
  "procurements|Under Evaluation": "/api/procurement/approve",
  "timesheets|Submitted": "/api/timesheets/approve",
  "contentItems|Editorial Review": "/api/content/approve", "contentItems|Approved": "/api/content/publish",
  "contentItems|Fact-Check": "/api/content/factcheck-pass",
  "complianceTasks|Pending": "/api/compliance/complete",
  "subscriptions|Active": "/api/subscriptions/roll",
  "tools|In use": "/api/tools/save", "networkContacts|New": "/api/contacts/save",
  "opportunities|Prospect": "/api/opportunities/save", "quotations|Sent": "/api/quotations/save",
  "projectActivities|Planned": "/api/activities/save",
};
const STEP: Record<string, string> = { "expenses|Submitted": "approve", "expenses|Under Finance Review": "approve", "expenses|Approved": "cashbook-pay", "expenses|Paid": "general-ledger-post" };
for (const rule of RULES) {
  const key = `${rule.kind}|${rule.status}`;
  const route = DESK_ROUTES[key];
  if (!route || !rule.seat) continue;
  const locked = rule.seat.filter(r => !mayCall(route, r, STEP[key]));
  ok(`${key} → ${route}${STEP[key] ? " (" + STEP[key] + ")" : ""}`, locked.length === 0, `owed but refused: ${locked.join(",")}`);
}

console.log("\nthe read-only and self-service seats stay that way");
const writes = Object.keys(ROUTE_SEATS).filter(p => !["*any"].includes(String(ROUTE_SEATS[p][0])));
ok("the auditor writes nothing but an equipment check", writes.filter(p => mayCall(p, AUDITOR)).join(",") === "/api/assets/verify",
  writes.filter(p => mayCall(p, AUDITOR)).join(","));
ok("a self-service account writes nothing beyond its own", writes.filter(p => mayCall(p, SELF)).length === 0, writes.filter(p => mayCall(p, SELF)).join(","));
ok("the procurement seat never approves, pays or posts",
  !["approve", "cashbook-pay", "general-ledger-post"].some(a => mayCall("/api/expense/action", PLO, a)) && !mayCall("/api/procurement/approve", PLO));
ok("the digital seat touches nothing financial",
  !mayCall("/api/expense/new", DIGITAL) && !mayCall("/api/bank/reconcile", DIGITAL) && !mayCall("/api/journal-entry/adjustment", DIGITAL));
ok("the crew touch nothing financial", CREW.every(r => !mayCall("/api/expense/new", r) && !mayCall("/api/expense/action", r, "approve")));
ok("editorial seats do not pay", EDITORS.every(r => !mayCall("/api/expense/action", r, "cashbook-pay")));

console.log("\nwhat the table cannot know, the route still checks");
ok("nobody approves the voucher they raised", /user\.id === expense\.requestorId|isMe\(|requestorId/.test(server) && /§4\.3|4\.3/.test(server));
ok("nobody approves their own timesheet", /Nobody approves their own timesheet/.test(server));
ok("a timesheet is not approved twice", /already approved/.test(server));
ok("a task is ticked by its holder", /mayTickTask/.test(server));
ok("a Project Officer deletes only their own programme's step", /That step belongs to another programme/.test(server));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
