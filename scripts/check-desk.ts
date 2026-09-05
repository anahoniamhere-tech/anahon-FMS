// Does the desk know every status the server can write, and is every seat owed only
// what it can see and act on?
//
// Phase 3 of the navigation decision (4 Sep 2026) derives My Desk from src/workflow.ts.
// The ways it could silently go wrong: a status the server writes with no rule, a rule
// that reads a field the trimmed payload does not carry, a seat owed a record on a door
// it cannot open, a label with no Arabic. Run: npx tsx scripts/check-desk.ts
import { readFileSync } from "node:fs";
import { RULES, STATUS_FIELD, TOOL_DESK, CONTACT_DESK, deskItems, Rule } from "../src/workflow.js";
import { ALL_ROLES, DIRECTORS, FINANCE, MANAGERS, SUPPLIER_EDITORS, CONTENT_EDITORS, PM_SLOT, PD_SLOT, MASTER } from "../src/roles.js";
import { CONTENT_STATUSES } from "../src/editorialGates.js";
import { visibleNav } from "../src/nav.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const server = read("../server.ts"), types = read("../src/types.ts"), ar = read("../src/i18n.ts"), desk = read("../src/tabs/MyDeskTab.tsx");
const today = "2026-09-04";

const IFACE: Record<string, string> = {
  expenses: "Expense", procurements: "Procurement", timesheets: "Timesheet", contentItems: "ContentItem",
  projectActivities: "ProjectActivity", projects: "Project", opportunities: "Opportunity", quotations: "Quotation",
  complianceTasks: "ComplianceTask", subscriptions: "Subscription", tools: "Tool", networkContacts: "NetworkContact",
};
/** Brace-balanced body of `export interface Name { … }` — some status fields sit after a nested `{…}[]`. */
const iface = (name: string) => {
  const i = types.indexOf(`export interface ${name} {`); if (i < 0) throw new Error(`no interface ${name}`);
  let d = 0; const j = types.indexOf("{", i);
  for (let k = j; k < types.length; k++) { if (types[k] === "{") d++; if (types[k] === "}" && --d === 0) return types.slice(j + 1, k); }
  throw new Error(name);
};
const hasField = (kind: string, f: string) => new RegExp(`^\\s*${f}\\??:`, "m").test(iface(IFACE[kind]));
const union = (kind: string) => {
  const m = iface(IFACE[kind]).match(new RegExp(`^\\s*${STATUS_FIELD[kind as keyof typeof STATUS_FIELD] || "status"}\\??: ([^;]+);`, "m"));
  if (!m) throw new Error(`no status on ${kind}`);
  return m[1].trim() === "string" ? null : [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
};
const arr = (name: string) => JSON.parse(server.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))![1]) as string[];
const live = (r: Rule) => !!(r.seat || r.person || r.standIns);
const hasAr = (key: string) => ar.includes(`"${key.replace(/"/g, '\\"')}":`);

console.log("\nA. the table covers every status the server writes");
const written = [...new Set([...server.matchAll(/(?:status: |updatedStatus = |stage: )"([^"]+)"/g)].map(m => m[1]))];
const known = new Set(RULES.map(r => r.status));
ok(`every status written by server.ts has a rule (${written.length} distinct)`, written.every(s => known.has(s)), written.filter(s => !known.has(s)).join(","));
const lists: [string, string[]][] = [
  ["projectActivities", arr("ACTIVITY_STATUSES")], ["opportunities", arr("OPP_STAGES")], ["quotations", arr("QUOTE_STATUSES")],
  ["tools", arr("TOOL_STATUSES")], ["networkContacts", arr("CONTACT_STATUSES")], ["contentItems", [...CONTENT_STATUSES]],
];
for (const [kind, list] of lists) {
  const have = [...new Set(RULES.filter(r => r.kind === kind).map(r => r.status))].sort();
  ok(`${kind}: rules = the server's whitelist`, same(have, [...list].sort()), `rules ${have.join(",")} vs ${list.join(",")}`);
}
const keys = RULES.map(r => `${r.kind}|${r.status}|${r.emptyField || ""}`);
ok("no (kind, status, slot) listed twice", new Set(keys).size === keys.length);

console.log("\nB. right column, right kind");
const dbState = iface("DatabaseState");
for (const r of RULES) {
  const fields = [STATUS_FIELD[r.kind] || "status", "id", r.when, r.person, r.emptyField, ...(r.exclude || []), r.parent?.field].filter(Boolean) as string[];
  const u = union(r.kind);
  ok(`${r.kind}/${r.status}${r.emptyField ? ":" + r.emptyField : ""}`,
    new RegExp(`^\\s*${r.kind}:`, "m").test(dbState) && (u === null || u.includes(r.status)) && fields.every(f => hasField(r.kind, f)),
    `fields ${fields.filter(f => !hasField(r.kind, f)).join(",")}${u && !u.includes(r.status) ? " status not in the types.ts union" : ""}`);
}

console.log("\nC. nothing undeclared is read (recording proxy, every role)");
const viewer = (role: string) =>
  role === "Reporter" ? { id: "u-x", email: "x@x", role } :
  role === "Project Officer" ? { id: "u-po", email: "po@x", role } :
  role === "Super Admin" ? { id: "u-sa", email: "sa@x", role } : { id: `u-${role}`, email: `${role}@x`, role };
const baseState = (extraUsers: any[] = []): any => ({
  users: [
    { id: "u-sa", name: "SA", email: "sa@x", role: "Super Admin", active: true },
    { id: "u-x", name: "X", email: "x@x", role: "Reporter", active: true },
    { id: "u-po", name: "PO", email: "po@x", role: "Project Officer", active: true, streamScope: "S", projectIdsJson: "[]" },
    ...extraUsers,
  ],
  employees: [{ id: "emp-1", name: "Emp One", userEmail: "x@x" }],
  projects: [{ id: "p1", code: "P1", stream: "S", status: "Active" }],
});
const record = (r: Rule): any => {
  const base: any = {
    id: `${r.kind}-1`, title: "T", name: "N", voucherNo: "PV-1", quoteNo: "Q-1", month: "2026-08", employeeId: "emp-1", projectId: "p1",
    requestorId: "emp-1", assigneeUserId: "", factCheckerUserId: "u-x", pmApprovedBy: "", pdApprovedBy: "",
    dueDate: today, nextRenewal: today, reviewBy: today, followUpBy: today, deadline: today, validUntil: today, decisionDate: today, notes: "",
  };
  base[STATUS_FIELD[r.kind] || "status"] = r.status;
  return base;
};
const withRecord = (s: any, r: Rule, rec: any) => ({ ...s, [r.kind]: r.kind === "projects" ? [rec] : [rec] });
for (const r of RULES.filter(live)) {
  const seen = new Set<string>();
  const rec = new Proxy(record(r), { get(tgt, p) { if (typeof p === "string") seen.add(p); return (tgt as any)[p]; } });
  for (const role of ALL_ROLES) deskItems(viewer(role), withRecord(baseState(), r, rec), today);
  const bad = [...seen].filter(k => !hasField(r.kind, k));
  ok(`${r.kind}/${r.status}${r.emptyField ? ":" + r.emptyField : ""} reads only declared fields`, bad.length === 0, bad.join(","));
}

console.log("\nD. trimmed views cannot crash it; no dead rule");
const full = RULES.filter(live).reduce((s, r) => ({ ...s, [r.kind]: [...(s[r.kind] || []), record(r)] }), baseState());
for (const role of ALL_ROLES) {
  let empty: any = null, threw = "";
  try { empty = deskItems(viewer(role), {}, today); deskItems(viewer(role), full, today); } catch (e: any) { threw = e.message; }
  ok(`${role}: empty state → [] and full state does not throw`, !threw && Array.isArray(empty) && empty.length === 0, threw);
}
for (const r of RULES.filter(live)) {
  const id = `${r.kind}:${r.kind}-1${r.emptyField ? ":" + r.emptyField : ""}`;
  const owned = ALL_ROLES.some(role => deskItems(viewer(role), withRecord(baseState(), r, record(r)), today).some(i => i.id === id && i.group !== "week"));
  ok(`${r.kind}/${r.status}${r.emptyField ? ":" + r.emptyField : ""} is somebody's turn`, owned);
}

console.log("\nE. seats, doors, Arabic");
const SEATS: readonly string[][] = [DIRECTORS, FINANCE, MANAGERS, SUPPLIER_EDITORS, CONTENT_EDITORS, PM_SLOT, PD_SLOT, TOOL_DESK, CONTACT_DESK, MASTER];
ok("every seat is a roles.ts list by reference", RULES.every(r => !r.seat || SEATS.includes(r.seat as string[])), RULES.filter(r => r.seat && !SEATS.includes(r.seat as string[])).map(r => `${r.kind}/${r.status}`).join(","));
for (const r of RULES.filter(x => x.seat)) {
  const blind = r.seat!.filter(role => !visibleNav(role).some(s => s.items.some(i => i.navKey === r.door)));
  ok(`${r.kind}/${r.status}: every seat can open the ${r.door} door`, blind.length === 0, blind.join(","));
}
ok("My Desk is a door for every role", ALL_ROLES.every(role => visibleNav(role).some(s => s.items.some(i => i.navKey === "mydesk"))));
ok('"Program Director" appears verbatim in the seat lists', RULES.some(r => r.seat?.includes("Program Director")));
const arNeeded = new Set<string>();
for (const r of RULES.filter(live)) { arNeeded.add(r.verb); arNeeded.add(r.status); r.seat?.forEach(x => arNeeded.add(x)); }
for (const m of desk.matchAll(/\bt\("([^"]+)"\)/g)) arNeeded.add(m[1]);
const missingAr = [...arNeeded].filter(k => k && !hasAr(k));
ok(`every desk verb, status, seat and t("…") literal has Arabic (${arNeeded.size})`, missingAr.length === 0, missingAr.join(" | "));
// Bare English between JSX tags never reaches t(): anything with two letters in a text node fails.
// Generics like useState<string | null>(null) and arrows (=>) also sit between > and <; code has ; = ( ) and text nodes do not.
const bare = [...desk.matchAll(/(?<![=-])>\s*([^<>{}]*[A-Za-z]{2,}[^<>{}]*?)\s*</g)].map(m => m[1].trim()).filter(x => !/[;=()]/.test(x) && !/^[·.:,/\s-]*$/.test(x));
ok("no bare English text nodes in MyDeskTab", bare.length === 0, bare.slice(0, 8).join(" | "));
ok("MyDeskTab keeps only rows on doors the viewer can open", /filter\(i => doors\.has\(i\.door\)\)/.test(desk));
ok("MyDeskTab asks for the diary only as a director", desk.includes("if (isDirector) loadCalendar()") && desk.includes("{isDirector && <div"));
// Phase 4: a task is ticked by whoever holds it, or by a director when nobody does.
ok("the tick belongs to the task's holder, or the director when it has none",
  /isTask && \(i\.record\.assigneeUserId \? i\.record\.assigneeUserId === currentUser\?\.id \|\| isDirector : isDirector\)/.test(desk)
  && /x\.assigneeUserId \? x\.assigneeUserId === currentUser\?\.id \|\| isDirector : isDirector/.test(desk));
ok("only a director writes or removes a task", /isDirector && \(\n?\s*<div className="rounded-xl border border-slate-200 bg-white p-4">\n?\s*\{!taskForm/.test(desk) && /isTask && isDirector && \(/.test(desk));

console.log("\nF. behaviour fixtures");
const sa = viewer("Super Admin");
const fin = viewer("Finance Officer");
const dig = viewer("Digital Officer");
const exp = (over: any = {}) => ({ id: "e1", voucherNo: "PV-1", title: "Cable", status: "Submitted", requestorId: "u-4", ...over });
const st = (over: any) => ({ ...baseState(), ...over });
let r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], expenses: [exp()] }), today);
ok("Submitted voucher, director seat vacant → Super Admin covers Program Director", r1.length === 1 && r1[0].group === "cover" && same(r1[0].seats, ["Program Director"]), JSON.stringify(r1.map(i => [i.group, i.seats])));
r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }, { id: "u-pd", role: "Program Director", active: true }], expenses: [exp()] }), today);
ok("same voucher with a Program Director in seat → nothing for the Super Admin", r1.length === 0);
r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], expenses: [exp({ requestorId: "u-sa" })] }), today);
ok("a voucher I raised never asks me to approve it (§4.3)", r1.length === 0);
r1 = deskItems(viewer("Reporter"), st({ expenses: [exp({ status: "Returned for Correction", requestorId: "emp-1" })] }), today);
ok("Returned voucher with an Employee-id requester resolves through userEmail → mine", r1.length === 1 && r1[0].group === "mine");
const ci = (over: any) => ({ id: "c1", title: "Piece", status: "Editorial Review", assigneeUserId: "u-x", factCheckerUserId: "", pmApprovedBy: "", pdApprovedBy: "", dueDate: "", ...over });
r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], contentItems: [ci({ pdApprovedBy: "u-sa" })] }), today);
ok("Editorial Review: the one who filled the PD slot is not offered the PM slot", !r1.some(i => i.id.endsWith(":pmApprovedBy")));
r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], contentItems: [ci({ pmApprovedBy: "u-other" })] }), today);
ok("Editorial Review: PD slot empty, Program Director and Chief Editor vacant → cover", r1.length === 1 && r1[0].id.endsWith(":pdApprovedBy") && r1[0].group === "cover");
r1 = deskItems(viewer("Reporter"), st({ contentItems: [ci({ status: "Fact-Check", factCheckerUserId: "u-x", assigneeUserId: "u-y" })] }), today);
ok("Fact-Check waits on the named checker → mine", r1.length === 1 && r1[0].group === "mine");
const plus3 = "2026-09-07";
r1 = deskItems({ id: "u-y", email: "y@x", role: "Reporter" }, st({ contentItems: [ci({ status: "Fact-Check", factCheckerUserId: "u-x", assigneeUserId: "u-z", dueDate: plus3 })] }), today);
ok("a dated piece on someone else's desk shows under Due this week", r1.length === 1 && r1[0].group === "week" && r1[0].urgency === "week");
const act = (over: any = {}) => ({ id: "a1", title: "Step", status: "Planned", projectId: "p1", assigneeUserId: "", dueDate: today, ...over });
r1 = deskItems(viewer("Project Officer"), st({ projectActivities: [act()] }), today);
const r2 = deskItems(sa, st({ projectActivities: [act()] }), today);
ok("unassigned step → the scoped Project Officer's turn, not the Super Admin's cover", r1.length === 1 && r1[0].group === "mine" && !r2.some(i => i.group === "cover"));
r1 = deskItems(sa, st({ projects: [{ id: "p1", code: "P1", stream: "S", status: "Completed" }], projectActivities: [act()] }), today);
ok("a Planned step on a Completed project is nobody's turn and not due", r1.length === 0);
r1 = deskItems({ id: "u-y", email: "y@x", role: "Reporter" }, st({ contentItems: [ci({ status: "Fact-Check", factCheckerUserId: "u-x", assigneeUserId: "u-z", dueDate: "2026-08-01" })] }), today);
ok("someone else's item more than a week late is not on my desk", r1.length === 0);
r1 = deskItems({ id: "u-y", email: "y@x", role: "Reporter" }, st({ contentItems: [ci({ status: "Fact-Check", factCheckerUserId: "u-x", assigneeUserId: "u-z", dueDate: "2026-09-01" })] }), today);
ok("someone else's item three days late is still Due this week", r1.length === 1 && r1[0].group === "week" && r1[0].urgency === "overdue");
r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], projectActivities: [act()] }), today);
ok("unassigned step with no Project Officer → Super Admin covers Program Director", r1.length === 1 && r1[0].group === "cover" && same(r1[0].seats, ["Program Director"]));
r1 = deskItems(fin, st({ subscriptions: [{ id: "s1", name: "Zoom", status: "Active", nextRenewal: "2026-10-04" }] }), today);
const r3 = deskItems(fin, st({ subscriptions: [{ id: "s1", name: "Zoom", status: "Active", nextRenewal: "2026-09-09" }] }), today);
ok("subscription renewing in 30 days is absent; in 5 days it is Finance's turn this week", r1.length === 0 && r3.length === 1 && r3[0].group === "mine" && r3[0].urgency === "week");
r1 = deskItems(dig, st({ tools: [{ id: "t1", name: "Canva", status: "Trialling", reviewBy: "2026-09-05" }] }), today);
const r4 = deskItems(dig, st({ tools: [{ id: "t1", name: "Canva", status: "Trialling", reviewBy: today }] }), today);
ok("a tool review due tomorrow is absent; due today it is the Digital Officer's turn", r1.length === 0 && r4.length === 1 && r4[0].group === "mine");
r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], timesheets: [{ id: "ts1", employeeId: "emp-1", month: "2026-08", status: "Submitted" }] }), today);
ok("a Submitted timesheet for August is due 1 September and overdue on the 4th", r1.length === 1 && r1[0].when === "2026-09-01" && r1[0].urgency === "overdue" && r1[0].title === "Emp One · 2026-08");

r1 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }], complianceTasks: [{ id: "k1", title: "File annual return", status: "Pending", dueDate: today, notes: "" }] }), today);
ok("a Pending statutory task is the master account's own (mine, not cover)", r1.length === 1 && r1[0].group === "mine" && r1[0].seats.length === 0);
r1 = deskItems(viewer("Reporter"), st({ complianceTasks: [{ id: "k2", title: "Send the receipts", status: "Pending", dueDate: today, notes: "", assigneeUserId: "u-x" }] }), today);
const r6 = deskItems(sa, st({ users: [{ id: "u-sa", role: "Super Admin", active: true }, { id: "u-x", role: "Reporter", active: true }], complianceTasks: [{ id: "k2", title: "Send the receipts", status: "Pending", dueDate: today, notes: "", assigneeUserId: "u-x" }] }), today);
ok("a task given to someone is theirs, and the director sees it only as due", r1.length === 1 && r1[0].group === "mine" && r6.length === 1 && r6[0].group === "week");
r1 = deskItems(viewer("Finance Officer"), st({ complianceTasks: [{ id: "k1", title: "File annual return", status: "Pending", dueDate: today, notes: "" }] }), today);
ok("the same task is Due this week for Finance, never theirs to tick", r1.length === 1 && r1[0].group === "week");
const rev = ci({ status: "Editorial Review", assigneeUserId: "u-z", dueDate: "2026-09-06" });
r1 = deskItems({ id: "u-y", email: "y@x", role: "Reporter" }, st({ users: [...baseState().users, { id: "u-pm", role: "Production Manager", active: true }, { id: "u-pd", role: "Program Director", active: true }], contentItems: [rev] }), today);
ok("an Editorial Review piece with two empty slots is listed once under Due this week", r1.length === 1 && r1[0].group === "week");
r1 = deskItems(viewer("Production Manager"), st({ contentItems: [rev] }), today);
ok("the Production Manager sees the piece once, as their slot, not again under Due this week", r1.length === 1 && r1[0].group === "mine" && r1[0].id.endsWith(":pmApprovedBy"));
r1 = deskItems(viewer("Project Officer"), st({ users: [...baseState().users, { id: "u-8", role: "Reporter", active: false }], projectActivities: [act({ assigneeUserId: "u-8" })] }), today);
ok("a step assigned to a deactivated login falls back to the scoped Project Officer", r1.length === 1 && r1[0].group === "mine");
r1 = deskItems(fin, st({ opportunities: [{ id: "o1", title: "Call", stage: "Prospect", deadline: "2026-09-03", decisionDate: "" }] }), today);
const r5 = deskItems(fin, st({ opportunities: [{ id: "o1", title: "Call", stage: "Prospect", deadline: "2026-09-10", decisionDate: "" }] }), today);
ok("a funding call whose deadline passed leaves the desk; one due next week stays", r1.length === 0 && r5.length === 1);

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
