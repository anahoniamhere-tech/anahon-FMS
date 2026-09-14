// Does the shadow office remind the right person, on Saad's rhythm, and never twice?
//
// 14 Sep 2026. The failures this guards against: buzzing a phone again every run, escalating a
// month-old item on the first day, telling the Executive Director about his own desk, and
// chasing work that has already been done. Pure asserts; no database, no network.
// Run: npx tsx scripts/check-stall-nudges.ts
import { readFileSync } from "node:fs";
import { planStallNudges, planIsQuiet, personMessage, escalationMessage, STALL_RHYTHM, StallRow } from "../src/stallNudges.js";
import type { DeskItem } from "../src/workflow.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const item = (over: Partial<DeskItem> = {}): DeskItem => ({
  id: "expenses:e-1", kind: "expenses" as any, recordId: "e-1", door: "expenses",
  title: "PV-2026-014 · Studio rent", verb: "Approve or return", status: "Submitted",
  when: "2026-09-01", urgency: "overdue", group: "mine", seats: [], record: {}, ...over,
});
const row = (over: Partial<StallRow> = {}): StallRow => ({ id: "s-1", itemId: "expenses:e-1", channel: "stall-1", state: "active", createdAt: "2026-09-10T09:00:00.000Z", ...over });
const TODAY = "2026-09-14";

console.log("\nthe rhythm Saad chose");
ok("the rhythm is two days, then two days", STALL_RHYTHM.secondAfterDays === 2 && STALL_RHYTHM.escalateAfterDays === 2);
let p = planStallNudges([item()], [], TODAY, { canEscalate: true });
ok("an overdue item nobody was reminded about gets its first reminder", p.first.length === 1 && !p.second.length && !p.escalate.length);
p = planStallNudges([item({ urgency: "week" })], [], TODAY, { canEscalate: true });
ok("an item that is not yet overdue is left alone", planIsQuiet(p));

console.log("\nsecond reminder, two days after the first");
p = planStallNudges([item()], [row({ createdAt: "2026-09-13T09:00:00.000Z" })], TODAY, { canEscalate: true });
ok("one day after the first reminder: nothing yet", planIsQuiet(p));
p = planStallNudges([item()], [row({ createdAt: "2026-09-12T09:00:00.000Z" })], TODAY, { canEscalate: true });
ok("two days after the first reminder: the second goes out", p.second.length === 1 && !p.first.length);

console.log("\nescalation, two days after the second");
const both = (secondAt: string) => [row(), row({ id: "s-2", channel: "stall-2", createdAt: secondAt })];
p = planStallNudges([item()], both("2026-09-13T09:00:00.000Z"), TODAY, { canEscalate: true });
ok("one day after the second reminder: no escalation yet", planIsQuiet(p));
p = planStallNudges([item()], both("2026-09-12T09:00:00.000Z"), TODAY, { canEscalate: true });
ok("two days after the second reminder: the Executive Director is told", p.escalate.length === 1);
p = planStallNudges([item()], both("2026-09-12T09:00:00.000Z"), TODAY, { canEscalate: false });
ok("nobody is escalated to about their own desk", !p.escalate.length && planIsQuiet(p));
p = planStallNudges([item()], [...both("2026-09-01T09:00:00.000Z"), row({ id: "s-3", channel: "escalate" })], TODAY, { canEscalate: true });
ok("after escalating once, the item goes quiet — no repeat", planIsQuiet(p));

console.log("\nnever twice, never early, and never after the work is done");
p = planStallNudges([item({ when: "2026-08-01" })], [], TODAY, { canEscalate: true });
ok("a month-old item on the first day gets a first reminder, not an escalation", p.first.length === 1 && !p.escalate.length);
p = planStallNudges([], [row(), row({ id: "s-2", channel: "stall-2" })], TODAY, { canEscalate: true });
ok("work that left the desk closes every open row, and sends nothing", p.close.length === 2 && !p.first.length && !p.second.length && !p.escalate.length);
p = planStallNudges([item({ urgency: "week" })], [row()], TODAY, { canEscalate: true });
ok("an item re-dated so it is no longer overdue closes its row", p.close.length === 1);
p = planStallNudges([item()], [row({ state: "cancelled" })], TODAY, { canEscalate: true });
ok("a closed row from an earlier cycle does not suppress a new one", p.first.length === 1);
p = planStallNudges([item()], [row({ channel: "push" }), row({ id: "c", channel: "calendar" })], TODAY, { canEscalate: true });
ok("rows from the push and calendar channels are ignored entirely", p.first.length === 1 && !p.close.length);

console.log("\nwhat the person and the Executive Director read");
const three = planStallNudges([item(), item({ id: "expenses:e-2", title: "Fuel" }), item({ id: "expenses:e-3", title: "Printing" })], [], TODAY, { canEscalate: true });
const msg = personMessage(three)!;
ok("several items become one notification, not several", /3 tasks now overdue/.test(msg.title) && /and 2 more/.test(msg.body));
ok("a quiet plan sends no message", personMessage(planStallNudges([], [], TODAY, { canEscalate: true })) === null);
const up = escalationMessage([{ personName: "Marwan El Cheikh", item: item() }])!;
ok("the escalation names the person and the task", /Marwan El Cheikh — Approve or return: PV-2026-014/.test(up.body));

console.log("\nthe server wiring holds the boundaries");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
// Code only: the section's comments deliberately say what it does NOT do ("no mail, no
// WhatsApp"), and a rule that reads its own disclaimers as violations is a false positive.
const block = server.slice(server.indexOf("The shadow office"), server.indexOf("The mail watcher — READ-ONLY"))
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok("it is off unless SHADOW_OFFICE=on", /SHADOW_OFFICE\s*===\s*"on"/.test(block));
ok("it only ever sends push notifications — no mail, no WhatsApp", !/sendMail|nodemailer|smtp|wa\.me|whatsapp/i.test(block) && /webpush\.sendNotification/.test(block));
ok("it never writes to a record — only its own ledger rows", !/prisma\.(expense|procurement|timesheet|contentItem|complianceTask|projectActivity)\.(update|create|delete)/.test(block));
ok("a ledger row is written only after a device received it", /if \(delivered\)/.test(block));
ok("the Executive Director is not reminded about his own desk", /isDirector\(person\.role\)\)\s*continue/.test(block));
ok("the preview route is for directors only", /\/api\/shadow\/plan[\s\S]{0,400}isDirector/.test(block));
ok("every reminder and escalation is written to the audit log", /Shadow Reminder Sent/.test(block) && /Shadow Escalation Sent/.test(block));

console.log(failed ? `\n${failed} FAILED\n` : "\nall green\n");
process.exit(failed ? 1 : 0);
