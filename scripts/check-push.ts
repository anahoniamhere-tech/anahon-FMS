// Does the phone get told the one thing the calendar cannot carry?
//
// 5 Sep 2026. Web push exists for a single reason: an undated Submitted voucher is the
// message that matters most, and planReminders reports exactly that as `skipped` because
// a calendar has nowhere to put it. So the assertion that must never regress is that the
// push channel *carries* what the calendar *skips* — same planner, one option apart.
// The other two: a phone is never buzzed about someone else's week, and the service
// worker still caches nothing. Run: npx tsx scripts/check-push.ts
import { readFileSync } from "node:fs";
import { planReminders } from "../src/reminders.js";
import { ROUTE_SEATS } from "../src/gates.js";
import type { DeskItem } from "../src/workflow.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const item = (over: Partial<DeskItem>): DeskItem => ({
  id: "expenses:e-1", kind: "expenses" as any, recordId: "e-1", door: "expenses",
  title: "VCH-2026-0188", verb: "Approve or return", status: "Submitted",
  when: null, urgency: "waiting", group: "mine", seats: [], record: {}, ...over,
});
const URL_ = "https://anahon-1.tailbcb2b7.ts.net:8444";

console.log("\nA. the undated voucher — the case the calendar cannot hold");
const undated = [item({})];
const cal = planReminders(undated, [], URL_);
ok("the calendar still skips it, and says why", cal.create.length === 0 && cal.skipped.length === 1
  && cal.skipped[0].because === "no date on the record");
const push = planReminders(undated, [], URL_, { undated: "carry" });
ok("the phone is told about it", push.create.length === 1 && push.skipped.length === 0,
  `create=${push.create.length} skipped=${push.skipped.length}`);
ok("with an empty date rather than an invented one", push.create[0]?.whenDate === "", JSON.stringify(push.create[0]?.whenDate));
ok("and the wording the calendar would have used", push.create[0]?.title === "Approve or return: VCH-2026-0188");
// Without this the debounce would re-send the same notification after every single edit.
const ledger = [{ id: "r1", userId: "u-1", itemId: "expenses:e-1", googleEventId: null, title: "Approve or return: VCH-2026-0188", whenDate: "", state: "active" }];
ok("a second run says nothing — the ledger row stops it",
  planReminders(undated, ledger, URL_, { undated: "carry" }).create.length === 0);
ok("and when the work leaves the desk the row is closed, not resent",
  planReminders([], ledger, URL_, { undated: "carry" }).cancel.length === 1);

// A person turning notifications on today has a desk that is already full — 59 pending
// statutory tasks, in the live data. Sending all of them at once is how a feature gets
// switched off in its first minute.
ok("the first run for a person seeds the ledger and sends nothing", /const firstRun = ledger\.length === 0;/.test(read("../server.ts"))
  && /if \(firstRun\) \{/.test(read("../server.ts")));
ok("and it counts every state, so a cleared desk is not a second first run",
  /findMany\(\{ where: \{ userId: viewer\.id, channel: "push" \} \}\)/.test(read("../server.ts")));

console.log("\nB. a phone is never buzzed about someone else's week");
const server = read("../server.ts");
ok("the sender keeps only what is this person's turn",
  /i\.group === "mine" \|\| i\.group === "cover"/.test(server));
// group "week" is "due this week on someone else's desk" — information, not a summons.
const weekOnly = [item({ id: "expenses:e-9", recordId: "e-9", when: "2026-09-09", group: "week" })];
const kept = weekOnly.filter(i => i.group === "mine" || (i.group as string) === "cover");
ok("so a week row reaches the planner not at all", kept.length === 0);
// A notification about a door the person cannot open is worse than silence: the tap lands
// on it, the redirect finds the role cannot see it, and they are bounced to the landing page.
ok("only rows on doors this person can open are sent", /canOpen\.has\(i\.door\)/.test(server)
  && /doorsFor\(viewer\.role\)/.test(server));
ok("the ledger the phone reads is its own channel", /findMany\(\{ where: \{ userId: viewer\.id, channel: "push" \} \}\)/.test(server));
ok("and the calendar's is its own, or it would cancel work still owed",
  /findMany\(\{ where: \{ userId: viewer\.id, channel: "calendar" \} \}\)/.test(server));

// 5 Sep 2026, from the first reinstall: the badge lived inside My Desk, so once the doors
// screen became the landing page a person who never opened My Desk never had one set, and
// a stale one was never cleared. It belongs to the app, not to a screen.
const app = read("../src/App.tsx");
ok("the badge is set app-wide, not inside one tab", /nav\.setAppBadge/.test(app) && !/setAppBadge/.test(read("../src/tabs/MyDeskTab.tsx")));
ok("and it counts what is owed, not what is merely due this week", /i\.group !== "week"\)\.length/.test(app));
// A subscription can lapse without the person revoking anything; asking again is noise.
ok("a lapsed subscription is renewed silently when permission still stands",
  /Notification\.permission === "granted"/.test(read("../src/tabs/MyDeskTab.tsx")));

console.log("\nC. the worker still caches nothing");
const sw = read("../public/sw.js");
ok("exactly one file is ever cached", (sw.match(/c\.add\(|cache\.add|addAll/g) || []).length === 1 && sw.includes("c.add(PAGE)"));
ok("no response is written into the cache", !/cache\.put|caches\.open\([^)]*\)\.then\(\(c\) => c\.put/.test(sw));
ok("the notification renders from its payload, fetching nothing", /e\.data\.json\(\)/.test(sw) && !/fetch\(/.test(sw.split('addEventListener("push"')[1] || ""));
ok("a re-send replaces rather than stacks", /tag: d\.tag/.test(sw));
ok("the click opens the item's own door", /door=\$\{encodeURIComponent\(item\.door\)\}/.test(server) && /data: \{ url: d\.url \|\| "\/" \}/.test(sw));
// The deep link carries two things and App.tsx now reads them in two places, because they
// behave differently on a reload: the door seeds the open tab and stays in the address bar,
// the record is read once and never written back (6 Sep 2026 — see check-nav.ts).
const appSrc = read("../src/App.tsx");
ok("and App.tsx reads the door from that query", /new URLSearchParams\(window\.location\.search\)\.get\("door"\)/.test(appSrc));
ok("and the record too, once", /new URLSearchParams\(window\.location\.search\)\.get\("focus"\)/.test(appSrc) && /setFocusId\(focus\)/.test(appSrc));

console.log("\nD. the keys, the seats, and a dead device");
ok("missing keys shut the path, they do not stop the server",
  /const PUSH_READY = !!\(process\.env\.VAPID_PUBLIC_KEY/.test(server) && /notifications are off; everything else runs/.test(server));
ok("both routes are gated", ["/api/push/subscribe", "/api/push/unsubscribe"].every(r => r in ROUTE_SEATS));
ok("and every seat may manage its own device", /TASK_POSTS = \[[^\]]*"\/api\/push\/subscribe", "\/api\/push\/unsubscribe"\]/.test(server));
ok("unsubscribe is scoped to the caller", /deleteMany\(\{ where: \{ endpoint, userId: viewer\.id \} \}\)/.test(server));
ok("a gone device is dropped on 404 or 410", /err\?\.statusCode === 404 \|\| err\?\.statusCode === 410/.test(server));
ok("the ledger is written only if it actually reached a device", /if \(delivered\) \{/.test(server));
ok("nothing nightly — a change is the trigger", /res\.on\("finish", \(\) => \{ if \(res\.statusCode < 400\) schedulePush\(\); \}\)/.test(server)
  && !/nightlyPush|setInterval\([^)]*push/i.test(server));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
