// Does the private feed say what the desk says, and does it say it in valid iCalendar?
//
// Phase 5 (5 Sep 2026). Pure asserts on a synthetic desk — opens no database, makes no
// network call. Run: npx tsx scripts/check-desk-ics.ts
import { readFileSync } from "node:fs";
import { deskIcs } from "../src/deskIcs.js";
import type { DeskItem } from "../src/workflow.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const item = (over: Partial<DeskItem> = {}): DeskItem => ({
  id: "complianceTasks:k1", kind: "complianceTasks" as any, recordId: "k1", door: "mydesk",
  title: "File the annual return", verb: "Settle", status: "Pending",
  when: "2026-09-08", urgency: "week", group: "mine", seats: [], record: {}, ...over,
});
const STAMP = "20260905T090000Z";
const out = deskIcs("Saad Matar", [item()], STAMP);
const lines = out.split("\r\n");

console.log("\nthe envelope");
ok("CRLF line endings only", !/[^\r]\n/.test(out));
ok("opens and closes as one calendar", lines[0] === "BEGIN:VCALENDAR" && lines.filter(l => l === "END:VCALENDAR").length === 1);
ok("names the person, not the organisation", out.includes("X-WR-CALNAME:AnaHon — Saad Matar"));
ok("asks the reader to refresh hourly", out.includes("REFRESH-INTERVAL;VALUE=DURATION:PT1H"));
ok("every line is within the 75-octet limit", lines.every(l => Buffer.byteLength(l) <= 75), lines.filter(l => Buffer.byteLength(l) > 75)[0]);

console.log("\none event per dated item");
ok("all-day event on the due date", out.includes("DTSTART;VALUE=DATE:20260908") && out.includes("DTEND;VALUE=DATE:20260909"));
ok("the summary is the verb and the title", out.includes("SUMMARY:Settle: File the annual return"));
ok("the id is stable, so an edit updates in place", out.includes("UID:desk-complianceTasks:k1@anahon"));
ok("carries the stamp it was given", out.includes(`DTSTAMP:${STAMP}`));
ok("undated work is not a calendar entry", !deskIcs("X", [item({ when: null })], STAMP).includes("BEGIN:VEVENT"));
ok("a date the calendar cannot read is skipped", !deskIcs("X", [item({ when: "soon" as any })], STAMP).includes("BEGIN:VEVENT"));
ok("late work is flagged to the reader", deskIcs("X", [item({ urgency: "overdue" })], STAMP).includes("PRIORITY:1"));
ok("a covered seat is named in the description", deskIcs("X", [item({ group: "cover", seats: ["Program Director"] })], STAMP).includes("Seat: Program Director"));

console.log("\nnothing can break the file open");
const nasty = deskIcs("X", [item({ title: "Pay 5,000; then\nemail Nada \\ Luisa", verb: "Settle" })], STAMP);
ok("commas, semicolons, newlines and backslashes are escaped", nasty.includes("Pay 5\\,000\; then\\nemail Nada \\\\ Luisa"));
ok("a long summary folds instead of overflowing", (() => {
  const long = deskIcs("X", [item({ title: "x".repeat(300) })], STAMP);
  return long.split("\r\n").every(l => Buffer.byteLength(l) <= 75) && long.includes("\r\n ");
})());

console.log("\nthe route keeps the feed off the open internet");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
ok("refuses anything that is not the office network or Tailscale", /fromPrivateNetwork\(req\)\) return res\.status\(403\)/.test(server));
ok("the feed shows only my own turn, never other people's dates", /\.filter\(i => i\.group !== "week"\)/.test(server) && /deskItems\(\{ id: user\.id/.test(server));
ok("a token is minted only for the account asking", /const me = \(req as any\)\.dbUser;[\s\S]{0,400}prisma\.user\.update\(\{ where: \{ id: me\.id \}/.test(server));
ok("rotating is written to the audit log", server.includes('"Calendar Feed Rotated"'));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
