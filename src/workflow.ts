/**
 * The desk rules — "whose turn is it?" for every record that carries a status.
 *
 * One row per (kind, status), the status quoted exactly as server.ts writes it. Pure:
 * no I/O, no Date.now(); `today` comes from the caller. Imported by MyDeskTab.tsx now,
 * by scripts/check-desk.ts now, and by server.ts in phases 5/6/9 (calendar feeds and
 * the gates), so the browser, the reminders and the server can never disagree.
 *
 * Phase 3 of the 4 Sep 2026 navigation decision. No task table: a record leaves the
 * desk when someone acts on the record itself.
 */
import type { DatabaseState } from "./types";
import {
  DIRECTORS, FINANCE, MANAGERS, SUPPLIER_EDITORS, CONTENT_EDITORS, TOOL_EDITORS, CONTACT_EDITORS,
  PM_SLOT, PD_SLOT, PLO, MASTER, PERSONNEL_FILE,
} from "./roles";
import { missingPersonnelDocs } from "./personnelDocs";
import { missingSupplierDocs } from "./supplierDocs";
import { missingCoreDocs } from "./coreDocs";

type Kind = keyof DatabaseState;
type State = Partial<DatabaseState>;
export type Me = { id: string; email: string; role: string };

export type Rule = {
  kind: Kind;                      // the state collection
  status: string;                  // exact string the server writes (or the types.ts union value for never-written ones)
  seat: readonly string[] | null;  // roles.ts list owed the turn; null = nobody unless `person`/`standIns` resolve
  person?: string;                 // record field holding a User.id or Employee.id; wins over everything when non-empty
  standIns?: (r: any, s: State) => string[]; // user ids owed the turn when `person` is empty; wins over `seat`
  when?: string;                   // record date field: YYYY-MM-DD, ISO, or YYYY-MM
  datedOnly?: boolean;             // no item at all when `when` is empty
  horizon?: number;                // item exists only when `when` <= today + horizon (implies datedOnly)
  lapses?: boolean;                // once `when` has passed the item is gone: a closed call is the funnel's to mark, not the desk's to nag
  emptyField?: string;             // row applies only while record[emptyField] is "" (Editorial Review slots)
  exclude?: string[];              // record fields whose value must not be me (requester, assignee, other slot)
  parent?: { field: string; in: Kind; status?: string }; // record[field] must exist in state[in] (and carry that status, when given)
  door: string;                    // navKey the row opens (src/nav.tsx)
  verb: string;                    // what the actor does; an i18n key
};

// Declared BEFORE RULES — a `const` used inside the array literal below must already exist.
// PLO and Production Manager are in TOOL_EDITORS but have no Tools door (nav.tsx) and the
// server refuses them (/api/tools/* is in DIGITAL_ALLOWED_POSTS only).
export const TOOL_DESK = TOOL_EDITORS.filter(r => r !== PLO && r !== "Production Manager");
// Production Manager is in CONTACT_EDITORS but has no Contacts door and is refused server-side.
export const CONTACT_DESK = CONTACT_EDITORS.filter(r => r !== "Production Manager");

/** Active Project Officers whose scope covers the project — the same rule as scopedProjectIds in server.ts. */
export const officersFor = (projectId: string, s: State): string[] => {
  const p = (s.projects || []).find(x => x.id === projectId);
  return (s.users || [])
    .filter(u => u.active && u.role === "Project Officer" &&
      (JSON.parse(u.projectIdsJson || "[]").includes(projectId) || (!!p?.stream && u.streamScope === p.stream)))
    .map(u => u.id);
};
const activityStandIns = (r: any, s: State) => officersFor(r.projectId, s);

export const RULES: Rule[] = [
  // Expense — Submitted, Under Finance Review, Approved, Returned for Correction, Paid, Posted.
  // §4.3: the requester never approves or flags their own voucher.
  { kind: "expenses", status: "Submitted",               seat: DIRECTORS, exclude: ["requestorId"], door: "expenses", verb: "Approve or return" },
  { kind: "expenses", status: "Under Finance Review",    seat: DIRECTORS, exclude: ["requestorId"], door: "expenses", verb: "Approve or return" },
  { kind: "expenses", status: "Returned for Correction", seat: null, person: "requestorId",         door: "expenses", verb: "Raise a new request" },
  { kind: "expenses", status: "Approved",                seat: FINANCE, door: "expenses", verb: "Pay" },
  { kind: "expenses", status: "Paid",                    seat: FINANCE, door: "expenses", verb: "Post to ledger" },
  { kind: "expenses", status: "Posted",                  seat: null,    door: "expenses", verb: "" },
  // Procurement — Under Evaluation, Approved. No date, no requester field.
  { kind: "procurements", status: "Under Evaluation", seat: DIRECTORS, door: "procurement", verb: "Authorise the purchase" },
  { kind: "procurements", status: "Approved",         seat: null,      door: "procurement", verb: "" },
  // Timesheet — Submitted, Approved. Due = month closes (YYYY-MM → 1st of next month).
  { kind: "timesheets", status: "Submitted", seat: DIRECTORS, when: "month", door: "payroll", verb: "Approve timesheet" },
  { kind: "timesheets", status: "Approved",  seat: null, door: "payroll", verb: "" },
  // ContentItem — the six pipeline statuses of src/editorialGates.ts.
  { kind: "contentItems", status: "Assigned",      seat: CONTENT_EDITORS, person: "assigneeUserId",    when: "dueDate", door: "editorial", verb: "Assign or start" },
  { kind: "contentItems", status: "In Production", seat: CONTENT_EDITORS, person: "assigneeUserId",    when: "dueDate", door: "editorial", verb: "Send to fact-check" },
  { kind: "contentItems", status: "Fact-Check",    seat: null,            person: "factCheckerUserId", when: "dueDate", door: "editorial", verb: "Pass or return the fact-check" },
  // Two slots on one status: never the assignee, never the same id in both slots.
  { kind: "contentItems", status: "Editorial Review", seat: PM_SLOT, emptyField: "pmApprovedBy", exclude: ["assigneeUserId", "pdApprovedBy"], when: "dueDate", door: "editorial", verb: "Approve — Production Manager slot" },
  { kind: "contentItems", status: "Editorial Review", seat: PD_SLOT, emptyField: "pdApprovedBy", exclude: ["assigneeUserId", "pmApprovedBy"], when: "dueDate", door: "editorial", verb: "Approve — Program Director slot" },
  { kind: "contentItems", status: "Approved",  seat: CONTENT_EDITORS, when: "dueDate", door: "editorial", verb: "Publish" }, // no author exclusion: /api/content/publish has none
  { kind: "contentItems", status: "Published", seat: null, door: "editorial", verb: "" },
  // ProjectActivity — Planned, In Progress, Done, Cancelled. Mostly unassigned → the scoped Project Officer, else the director seat.
  // Only steps of an Active project are anyone's turn: a Planned step left on a closed grant is history, not work.
  { kind: "projectActivities", status: "Planned",     seat: DIRECTORS, person: "assigneeUserId", standIns: activityStandIns, when: "dueDate", datedOnly: true, parent: { field: "projectId", in: "projects", status: "Active" }, door: "projects", verb: "Do the step" },
  { kind: "projectActivities", status: "In Progress", seat: DIRECTORS, person: "assigneeUserId", standIns: activityStandIns, when: "dueDate", datedOnly: true, parent: { field: "projectId", in: "projects", status: "Active" }, door: "projects", verb: "Finish the step" },
  { kind: "projectActivities", status: "Done",      seat: null, door: "projects", verb: "" },
  { kind: "projectActivities", status: "Cancelled", seat: null, door: "projects", verb: "" },
  // Project — the server writes only "Active"; "Completed" comes from the legacy backfill. Its steps carry the turn.
  { kind: "projects", status: "Active",    seat: null, door: "projects", verb: "" },
  { kind: "projects", status: "Completed", seat: null, door: "projects", verb: "" },
  // Opportunity — the status column is `stage` (see STATUS_FIELD). MANAGERS by convention (FunnelTab).
  { kind: "opportunities", status: "Prospect",  seat: MANAGERS, when: "deadline",     horizon: 14, lapses: true, door: "funnel", verb: "Decide whether to apply" },
  { kind: "opportunities", status: "Drafting",  seat: MANAGERS, when: "deadline",     datedOnly: true, lapses: true, door: "funnel", verb: "Finish the application" },
  { kind: "opportunities", status: "Submitted", seat: MANAGERS, when: "decisionDate", horizon: 0, door: "funnel", verb: "Chase the decision" },
  { kind: "opportunities", status: "Awarded",   seat: FINANCE,  door: "funnel", verb: "Register the project from the deposit" }, // only FINANCE sees the register form
  { kind: "opportunities", status: "Declined",  seat: null,     door: "funnel", verb: "" },
  // Quotation — Draft, Sent, Accepted, Rejected, Expired, Invoiced, Paid.
  { kind: "quotations", status: "Draft",    seat: null,     door: "production", verb: "" },
  { kind: "quotations", status: "Sent",     seat: MANAGERS, when: "validUntil", horizon: 7, door: "production", verb: "Chase the client" },
  { kind: "quotations", status: "Accepted", seat: FINANCE,  door: "production", verb: "Issue the receipt and link the deposit" },
  { kind: "quotations", status: "Invoiced", seat: FINANCE,  door: "production", verb: "Link the deposit" },
  { kind: "quotations", status: "Paid",     seat: null, door: "production", verb: "" },
  { kind: "quotations", status: "Rejected", seat: null, door: "production", verb: "" },
  { kind: "quotations", status: "Expired",  seat: null, door: "production", verb: "" },
  // ComplianceTask — Pending, Done. Given to someone, it is theirs; otherwise the master account's own list.
  { kind: "complianceTasks", status: "Pending", seat: MASTER, person: "assigneeUserId", when: "dueDate", door: "mydesk", verb: "Settle" },
  { kind: "complianceTasks", status: "Done",    seat: null, door: "mydesk", verb: "" },
  // Subscription — Active, Paused, Cancelled. Surfaces a week before renewal (the Suppliers sheet's own alert window).
  { kind: "subscriptions", status: "Active",    seat: SUPPLIER_EDITORS, when: "nextRenewal", horizon: 7, door: "vendors", verb: "Confirm paid and roll" },
  { kind: "subscriptions", status: "Paused",    seat: null, door: "vendors", verb: "" },
  { kind: "subscriptions", status: "Cancelled", seat: null, door: "vendors", verb: "" },
  // Tool — due when reviewBy has arrived.
  { kind: "tools", status: "Evaluating", seat: TOOL_DESK, when: "reviewBy", horizon: 0, door: "tools", verb: "Review the trial" },
  { kind: "tools", status: "Trialling",  seat: TOOL_DESK, when: "reviewBy", horizon: 0, door: "tools", verb: "Review the trial" },
  { kind: "tools", status: "In use",     seat: TOOL_DESK, when: "reviewBy", horizon: 0, door: "tools", verb: "Review the tool" },
  { kind: "tools", status: "Dropped",    seat: null, door: "tools", verb: "" },
  // NetworkContact — due when followUpBy has arrived.
  { kind: "networkContacts", status: "New",       seat: CONTACT_DESK, when: "followUpBy", horizon: 0, door: "network", verb: "Follow up" },
  { kind: "networkContacts", status: "Contacted", seat: CONTACT_DESK, when: "followUpBy", horizon: 0, door: "network", verb: "Follow up" },
  { kind: "networkContacts", status: "Warm",      seat: CONTACT_DESK, when: "followUpBy", horizon: 0, door: "network", verb: "Follow up" },
  { kind: "networkContacts", status: "Dormant",   seat: null, door: "network", verb: "" },
];

/** The status column per kind — everything is `status` except the funnel. */
export const STATUS_FIELD: Partial<Record<Kind, string>> = { opportunities: "stage" };

/** How a row is named on the desk. One line per kind. */
export const TITLES: Partial<Record<Kind, (r: any, s: State) => string>> = {
  expenses:          r => `${r.voucherNo} · ${r.title}`,
  procurements:      r => r.title,
  timesheets:        (r, s) => `${(s.employees || []).find(e => e.id === r.employeeId)?.name || r.employeeId} · ${r.month}`,
  contentItems:      r => r.title,
  projectActivities: (r, s) => `${(s.projects || []).find(p => p.id === r.projectId)?.code || ""} · ${r.title}`,
  opportunities:     r => r.title,
  quotations:        r => `${r.quoteNo} · ${r.title}`,
  complianceTasks:   r => r.title,
  subscriptions:     r => r.name,
  tools:             r => r.name,
  networkContacts:   r => r.name,
};

export type Urgency = "overdue" | "week" | "waiting";
export type DeskItem = {
  id: string;                        // `${kind}:${record.id}` (+ `:${emptyField}` for slot rows)
  kind: Kind; recordId: string; door: string;
  title: string; verb: string; status: string;
  when: string | null;               // YYYY-MM-DD
  urgency: Urgency;
  group: "mine" | "cover" | "week";
  /** A standing gap, not a turn that just arrived: owed since before anyone looked, and
   *  cleared by filing a paper rather than by acting on a record. Push skips these — see
   *  pushTurnsFor in server.ts — because a backlog does not buzz a phone. */
  standing?: true;
  seats: string[];                   // vacant seats covered (group "cover"), else []
  record: any;                       // the record itself (compliance tick + note, activity projectId)
};

/** Today in the office's local date — the same reading as the server's localDate(). */
export const localToday = () => new Date().toLocaleDateString("en-CA");
export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};

/** YYYY-MM-DD from any of the three date shapes the records use; null when empty. */
export function dueOf(rule: Rule, r: any): string | null {
  const v = rule.when ? String(r[rule.when] || "") : "";
  if (!v) return null;
  if (/^\d{4}-\d{2}$/.test(v)) { const [y, m] = v.split("-").map(Number); return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`; }
  return v.slice(0, 10);
}
export const urgencyOf = (when: string | null, today: string): Urgency =>
  !when ? "waiting" : when < today ? "overdue" : when <= addDays(today, 7) ? "week" : "waiting";

/** Same person, whether the record names a User id or an Employee id. */
const isMe = (id: string, me: Me, s: State) =>
  !!id && (id === me.id || (s.employees || []).some(e => e.id === id &&
    (e.userEmail || "").trim().toLowerCase() === (me.email || "").trim().toLowerCase()));

/** Whose turn this row is for `me`: "mine", "cover" (a vacant seat the Super Admin stands in), or null. */
export function isTurn(rule: Rule, r: any, me: Me, s: State): "mine" | "cover" | null {
  if (rule.emptyField && r[rule.emptyField]) return null;
  if (rule.exclude?.some(f => isMe(String(r[f] || ""), me, s))) return null;
  const named = rule.person ? String(r[rule.person] || "") : "";
  // A name that belongs to a deactivated login releases the record to the stand-ins or the seat.
  const person = (s.users || []).some(u => u.id === named && !u.active) ? "" : named;
  if (person) return isMe(person, me, s) ? "mine" : null;            // a named person owns it outright
  const standIns = rule.standIns?.(r, s) || [];
  if (standIns.length) return standIns.includes(me.id) ? "mine" : null;
  if (!rule.seat) return null;
  if (me.role !== "Super Admin") return rule.seat.includes(me.role) ? "mine" : null;
  const others = rule.seat.filter(x => x !== "Super Admin");
  if (!others.length) return "mine";                                   // a seat that names only the master account is its own work
  const held = others.some(role => (s.users || []).some(u => u.active && u.role === role && u.id !== me.id));
  return held ? null : "cover";                                        // same vacancy rule as /api/roles/seats
}

/* ── Papers the file is missing ──────────────────────────────────────────────
 * Three checklists already exist and already agree on a shape — missingPersonnelDocs,
 * missingSupplierDocs, missingCoreDocs, each `(docs, subject) => {key,label}[]`, each
 * empty when nothing is owed. This is the one place that turns any of them into desk
 * items: one item per missing paper, naming the party or the project and the paper.
 *
 * Derived, never stored. There is no row to tick and nothing to keep in step: file the
 * paper and the item is gone for everyone on the next read, which is the same discipline
 * the rule table above uses for records with a status. It is also why nothing here needs
 * a migration — the desk is a reading of the data, not a copy of it.
 *
 * These carry no date, so they never read as overdue and never reach a calendar. They are
 * marked `standing` so push skips them: a backlog that has always been incomplete is not
 * news, and 57 notifications on the day it ships would be the end of notifications.
 */
type PaperSource = {
  seat: readonly string[];
  door: string;
  kind: Kind;
  /** Subjects to check, and what to call each one on the desk. */
  subjects: (s: State) => { id: string; name: string; record: any }[];
  /** State is passed too: a slot can be excused by something that is not on the record. */
  missing: (docs: any[], subject: any, s: State) => { key: string; label: string }[];
};

/**
 * Which supplier papers are live on the desk.
 *
 * `registration` is deliberately NOT here yet. Every one of the 30 active suppliers is
 * missing its registration form — the paper has never been collected, so switching it on
 * puts 30 identical rows on the buying desk on day one, and a desk nobody can clear is a
 * desk people stop reading. §7.3 asks for the form "for new vendors", and vendor rows
 * carry no creation date to separate those (31 of 34 ids are seeded `ven-1`…), so this is
 * a decision for Saad rather than a heuristic. Add "registration" to switch it on.
 */
export const LIVE_SUPPLIER_PAPERS = ["agreement"];

const PAPER_SOURCES: PaperSource[] = [
  {
    seat: MANAGERS, door: "projects", kind: "projects",
    subjects: s => (s.projects || []).filter((p: any) => p.status !== "Closed")
      .map((p: any) => ({ id: p.id, name: p.name || p.code || p.id, record: p })),
    // A timetable that arrived as imported activity rows excuses the document slot. The
    // signal is the activity rows, never a field on the project: `timetableImported` was
    // written here on 7 Sep and exists in neither schema.prisma nor types.ts, so it read
    // undefined every time and the desk asked for a timetable that was already imported.
    // This is the same `source === "imported"` test the Projects screen has always used.
    missing: (docs, p, s) => missingCoreDocs(docs, p.id,
      (((s as any).projectActivities as any[]) || []).some(a => a.projectId === p.id && a.source === "imported")),
  },
  {
    seat: SUPPLIER_EDITORS, door: "vendors", kind: "vendors",
    subjects: s => (s.vendors || []).map((v: any) => ({ id: v.id, name: v.name || v.id, record: v })),
    missing: (docs, v) => missingSupplierDocs(docs, v.record).filter(m => LIVE_SUPPLIER_PAPERS.includes(m.key)),
  },
  {
    seat: PERSONNEL_FILE, door: "payroll", kind: "employees",
    subjects: s => (s.employees || []).filter((e: any) => e.active !== false)
      .map((e: any) => ({ id: e.id, name: e.name || e.id, record: e })),
    missing: (docs, e) => missingPersonnelDocs(docs, e.id),
  },
];

/** One desk item per missing paper, for the seats that hold the file. */
export function missingPaperItems(me: Me, s: State): DeskItem[] {
  const docs = (s.documents as any[]) || [];
  const out: DeskItem[] = [];
  for (const src of PAPER_SOURCES) {
    // Only the seats that can actually file it, and only on a door they can open. A row
    // owed to a seat the viewer does not hold is not shown at all: unlike a record with a
    // date, a standing gap has no "due this week" that would justify it on a third desk.
    if (!src.seat.includes(me.role)) continue;
    for (const subject of src.subjects(s)) {
      for (const paper of src.missing(docs, subject, s)) {
        out.push({
          id: `missing:${src.kind}:${subject.id}:${paper.key}`,
          kind: src.kind, recordId: subject.id, door: src.door,
          title: `${subject.name} — ${paper.label}`,
          verb: "File", status: "Missing", when: null, urgency: "waiting",
          group: "mine", standing: true, seats: [], record: subject.record,
        });
      }
    }
  }
  return out;
}

export function deskItems(me: Me, s: State, today = localToday()): DeskItem[] {
  const out: DeskItem[] = [];
  for (const rule of RULES) {
    if (!rule.seat && !rule.person && !rule.standIns) continue;         // terminal rows never produce an item
    for (const r of (((s as any)[rule.kind] as any[]) || [])) {         // a trimmed branch ships [] → nothing
      if (r[STATUS_FIELD[rule.kind] || "status"] !== rule.status) continue;
      if (rule.parent && !(((s as any)[rule.parent.in] as any[]) || []).some(p => p.id === r[rule.parent!.field] && (!rule.parent!.status || p.status === rule.parent!.status))) continue;
      const when = dueOf(rule, r);
      if ((rule.datedOnly || rule.horizon !== undefined) && !when) continue;
      if (rule.horizon !== undefined && when! > addDays(today, rule.horizon)) continue;
      if (rule.lapses && when && when < today) continue;
      const turn = isTurn(rule, r, me, s);
      const urgency = urgencyOf(when, today);
      // Someone else's item earns a place only while it is near: due within the week, or late
      // by at most a week. Older overdue items sit on their owner's desk under "mine".
      if (!turn && (urgency === "waiting" || when! < addDays(today, -7))) continue;
      out.push({
        id: `${rule.kind}:${r.id}${rule.emptyField ? ":" + rule.emptyField : ""}`,
        kind: rule.kind, recordId: r.id, door: rule.door, status: rule.status, verb: rule.verb,
        title: (TITLES[rule.kind] || ((x: any) => x.title || x.name || x.id))(r, s),
        when, urgency, group: turn ?? "week",
        seats: turn === "cover" ? rule.seat!.filter(x => x !== "Super Admin") : [],
        record: r,
      });
    }
  }
  // A record I own is never also "due this week", and a record on someone else's desk shows
  // once even when several rules (the two Editorial Review slots) reach it.
  const owned = new Set(out.filter(i => i.group !== "week").map(i => `${i.kind}:${i.recordId}`));
  const seen = new Set<string>();
  const kept = out.filter(i => {
    if (i.group !== "week") return true;
    const k = `${i.kind}:${i.recordId}`;
    if (owned.has(k) || seen.has(k)) return false;
    seen.add(k); return true;
  });
  // The papers no record carries a status for. Appended rather than run through RULES
  // because the table above keys on (kind, status) and a missing paper has neither — it is
  // an absence, and there is no row to match.
  kept.push(...missingPaperItems(me, s));
  const rank = { overdue: 0, week: 1, waiting: 2 };
  return kept.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.when || "9999").localeCompare(b.when || "9999") || a.title.localeCompare(b.title));
}
