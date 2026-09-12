// Does the Virtual Office read the same engine My Desk does, once per person, and rank the
// people who are behind to the front?
//
// The office computes nothing new: officeDesks() runs deskItems() (src/workflow.ts) for
// each active user over the state the viewer already holds. The ways it could silently go
// wrong: an inactive person still drawn, a person's own turn missed, other people's
// "due this week" rows counted as theirs, the missing-paper backlog counted as active
// work, or the ranking not putting the most-overdue first. Run: npx tsx scripts/check-office.ts
import { officeDesks } from "../src/tabs/OfficeTab.js";
import { doorsFor } from "../src/helpBot.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

const today = "2026-09-10";
const day = (n: number) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// A Finance Officer (full state, sees the funnel/expenses) and a Program Director. Both are
// non-restricted so the office is theirs; a third person is deactivated and must not appear.
const users = [
  { id: "u-fin", name: "Marwan El Cheikh", email: "marwan@anahon.org", role: "Finance Officer", active: true, projectIdsJson: "[]", streamScope: "" },
  { id: "u-dir", name: "Saad Matar", email: "saad@anahon.org", role: "Program Director", active: true, projectIdsJson: "[]", streamScope: "" },
  { id: "u-off", name: "Gone Person", email: "gone@anahon.org", role: "Finance Officer", active: false, projectIdsJson: "[]", streamScope: "" },
];

const state: any = {
  users,
  // Finance owns "Approved" expenses (pay) — one already overdue, one due this week.
  expenses: [
    { id: "e1", voucherNo: "V-1", title: "Overdue payout", status: "Approved" },
    { id: "e2", voucherNo: "V-2", title: "Soon payout", status: "Approved" },
  ],
  // A funnel opportunity in Drafting is MANAGERS' turn (Finance is a manager) with a deadline this week.
  opportunities: [{ id: "o1", title: "Grant draft", stage: "Drafting", deadline: day(3) }],
  // Everything else empty so deskItems has nothing else to find.
  procurements: [], timesheets: [], contentItems: [], projectActivities: [], projects: [],
  quotations: [], complianceTasks: [], subscriptions: [], tools: [], networkContacts: [],
  vendors: [], employees: [], documents: [],
};

const desks = officeDesks(state, today);

console.log("\nthe roster");
ok("only active people are drawn", desks.length === 2 && !desks.some(d => d.u.id === "u-off"), `got ${desks.map(d => d.u.id).join(",")}`);

const fin = desks.find(d => d.u.id === "u-fin")!;
const dir = desks.find(d => d.u.id === "u-dir")!;

console.log("\neach desk is that person's own turn");
// Approved expenses carry no date → urgency "waiting", so they land in load but not overdue/week.
// The Drafting opportunity has a deadline 3 days out → "week".
ok("Finance sees their own work", fin.load >= 1, `load ${fin.load}`);
ok("the dated opportunity counts as this week", fin.week === 1, `week ${fin.week}`);
ok("undated approved expenses are waiting, not overdue", fin.overdue === 0, `overdue ${fin.overdue}`);
ok("every row Finance holds is on a door Finance can open",
  fin.items.every(i => new Set(doorsFor("Finance Officer")).has(i.door)),
  fin.items.filter(i => !new Set(doorsFor("Finance Officer")).has(i.door)).map(i => i.door).join(","));

console.log("\nFinance-only work is not counted against other seats");
// Paying an Approved expense is FINANCE (Super Admin + Finance Officer), and the Program
// Director is not in it — so no expense row reaches the director's desk. The Drafting
// opportunity is MANAGERS (both of them), so it legitimately sits on each; the office keeps
// mine+cover, so that is each person's own turn, not an echo of someone else's.
ok("the director never inherits a Finance-only expense", dir.items.every(i => i.kind !== "expenses"),
  dir.items.filter(i => i.kind === "expenses").map(i => i.recordId).join(","));
ok("Finance does hold the expenses", fin.items.some(i => i.kind === "expenses"));

console.log("\nthe backlog is not active work");
// Add a project with no core documents → a standing missing-paper item for MANAGERS. It must
// count as backlog ("to file"), never as load.
const withPaper: any = { ...state, projects: [{ id: "p1", code: "PRJ", name: "Project One", status: "Active" }] };
const fin2 = officeDesks(withPaper, today).find(d => d.u.id === "u-fin")!;
ok("a missing paper is backlog, not load", fin2.backlog >= 1 && fin2.active.every(i => !i.standing), `backlog ${fin2.backlog}`);

console.log("\nthe most-behind person is ranked first");
// Give the director an overdue project step (Planned, assigned to them, on an Active project,
// due five days ago) so they jump ahead of Finance, who has only week/waiting work.
const ranked: any = {
  ...state,
  projects: [{ id: "prj", code: "PRJ", name: "Project One", status: "Active" }],
  projectActivities: [{ id: "a1", projectId: "prj", title: "Late step", status: "Planned", assigneeUserId: "u-dir", dueDate: day(-5) }],
};
const rankedDesks = officeDesks(ranked, today);
const order = rankedDesks.map(d => d.u.id);
const dirRanked = rankedDesks.find(d => d.u.id === "u-dir")!;
ok("the director now has an overdue turn", dirRanked.overdue === 1, `overdue ${dirRanked.overdue}`);
ok("and is sorted to the front", order[0] === "u-dir", `order ${order.join(",")}`);

console.log(failed ? `\n${failed} FAILED\n` : "\nall green\n");
process.exit(failed ? 1 : 0);
