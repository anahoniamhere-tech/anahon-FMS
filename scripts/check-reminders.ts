// Would the calendar end up saying what the desk says — and never twice?
//
// Phase 6 (5 Sep 2026). The failure this guards against is duplication: without a ledger
// a nightly push recreates the same event every night. Pure asserts on a synthetic desk;
// no database, no network. Run: npx tsx scripts/check-reminders.ts
import { readFileSync } from "node:fs";
import { planReminders, planIsEmpty, describePlan, reminderTitle, reminderBody, LedgerRow } from "../src/reminders.js";
import type { DeskItem } from "../src/workflow.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const URL_ = "http://anahon.local:3100";
const item = (over: Partial<DeskItem> = {}): DeskItem => ({
  id: "expenses:e-1", kind: "expenses" as any, recordId: "e-1", door: "expenses",
  title: "PV-2026-014 · Studio rent", verb: "Approve or return", status: "Submitted",
  when: "2026-09-10", urgency: "week", group: "mine", seats: [], record: {}, ...over,
});
const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  id: "r-1", userId: "u-1", itemId: "expenses:e-1", googleEventId: "g-1",
  title: reminderTitle(item()), whenDate: "2026-09-10", state: "active", ...over,
});

console.log("\nfrom an empty calendar");
{
  const p = planReminders([item()], [], URL_);
  ok("what is owed gets added", p.create.length === 1 && p.create[0].itemId === "expenses:e-1");
  ok("nothing to correct or remove yet", !p.update.length && !p.cancel.length);
  ok("the entry says the verb and the record", p.create[0].title === "Approve or return: PV-2026-014 · Studio rent");
  ok("and where to go to deal with it", p.create[0].description.includes(URL_));
}

console.log("\nrun it again, and again");
{
  const p = planReminders([item()], [row()], URL_);
  ok("the same item is not added twice", p.create.length === 0);
  ok("a night with no change is a quiet night", planIsEmpty(p));
  ok("and says so plainly", describePlan(p) === "Nothing to change — the calendar already matches the desk.");
}

console.log("\nwhen the work moves");
{
  const p = planReminders([item({ when: "2026-09-17" })], [row()], URL_);
  ok("a new date corrects the existing event", p.update.length === 1 && p.update[0].googleEventId === "g-1" && p.create.length === 0);
  ok("and says what moved", p.update[0].because === "moved from 2026-09-10 to 2026-09-17");
}
{
  const p = planReminders([item({ verb: "Pay", status: "Approved" })], [row()], URL_);
  ok("a changed step rewrites the wording", p.update.length === 1 && p.update[0].because === "the wording changed");
}
{
  const p = planReminders([item({ when: "2026-10-01", verb: "Pay" })], [row()], URL_);
  ok("both at once is one correction, not two", p.update.length === 1 && p.update[0].because === "the date and the wording changed");
}

console.log("\nwhen the work is done");
{
  const p = planReminders([], [row()], URL_);
  ok("the event is removed", p.cancel.length === 1 && p.cancel[0].googleEventId === "g-1");
  ok("and named, so the removal can be read", p.cancel[0].title === reminderTitle(item()));
}
{
  const p = planReminders([], [row({ state: "cancelled" })], URL_);
  ok("an already-cancelled row is left alone", planIsEmpty(p));
}
{
  const p = planReminders([item()], [row({ state: "cancelled" })], URL_);
  ok("work that comes back gets a fresh event", p.create.length === 1 && p.cancel.length === 0);
}

console.log("\nwhat a calendar cannot hold");
{
  const p = planReminders([item({ when: null })], [], URL_);
  ok("undated work is not invented a date", p.create.length === 0);
  ok("it is reported, not silently dropped", p.skipped.length === 1 && p.skipped[0].because === "no date on the record");
}

console.log("\nthe wording a person will actually see");
{
  const late = reminderBody(item({ urgency: "overdue" }), URL_);
  ok("a late item says so", late.includes("already late"));
  const covered = reminderBody(item({ group: "cover", seats: ["Program Director"] }), URL_);
  ok("a covered seat is named", covered.includes("owed to the Program Director seat"));
  ok("it points back at the record, not at itself", covered.includes("the calendar entry is only a copy"));
  ok("a mixed plan reads as a sentence", describePlan(planReminders([item(), item({ id: "x:2", when: null })], [row({ itemId: "gone:1" })], URL_))
    === "1 to add, 1 to remove, and 1 with no date that a calendar cannot hold.");
}

console.log("\nnothing is written before a person has seen it");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
ok("the plan route writes nothing", /app\.post\("\/api\/reminders\/plan"[\s\S]{0,900}?res\.json/.test(server)
  && !/app\.post\("\/api\/reminders\/plan"[\s\S]{0,900}?prisma\.reminder\.(create|update|delete)/.test(server));
ok("the push refuses until a calendar is actually connected", /reminders\/push[\s\S]{0,600}?not connected|GOOGLE_REFRESH_TOKEN/.test(server));
ok("one consent writes into one person's calendar only", /calendarConfiguredFor = \(viewer: any\) =>[\s\S]{0,200}canonEmail\(viewer\?\.email \|\| ""\) === calendarOwner\(\)/.test(server)
  && /if \(!calendarConfiguredFor\(viewer\)\) \{\s*\n\s*return res\.status\(403\)/.test(server));

console.log("\nthe nightly run");
ok("the button and the night use one function", /async function pushRemindersFor\(viewer: any, how: "by hand" \| "overnight"\)/.test(server)
  && /pushRemindersFor\(viewer, "by hand"\)/.test(server) && /pushRemindersFor\(owner, "overnight"\)/.test(server));
ok("it runs once a day, after the hour, in Beirut time", /timeZone: "Asia\/Beirut"/.test(server) && /if \(hour < REMINDERS_HOUR \|\| remindersLastRun === date\) return;/.test(server));
ok("a failed night is logged, not retried every ten minutes", /remindersLastRun = date;\s*\/\/ claim the day first/.test(server) && /"Reminders Failed"/.test(server));
ok("it writes only into the connected owner's calendar", /const owner = await findUserByEmail\(calendarOwner\(\)\);/.test(server));
ok("it can be switched off without a code change", /process\.env\.REMINDERS_NIGHTLY !== "off"/.test(server));
ok("the container keeps office time", readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8").includes("TZ: Asia/Beirut"));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
