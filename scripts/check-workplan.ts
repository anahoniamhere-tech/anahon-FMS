/**
 * The project workplan (18 Sep 2026, src/workplan.ts): grant months anchored on the start day,
 * activities and milestones read from the record, and the document that prints them.
 * Saad's rule: every project produces this same format.
 */
import assert from "assert";
import fs from "fs";
import { periodMonths, monthOf, runsIn, monthsLabel, workplanFromActivities, workplanBlocker } from "../src/workplan.js";
import { workplanHtml } from "../docgen.js";
import { SKF_FSTP_WORKPLAN as SKF } from "./seed-skf-fstp-workplan.js";

// A — the period. SKF's 10 Sep – 10 Mar is SIX months, not the seven calendar months it touches.
const m = periodMonths("2026-09-10", "2027-03-10");
assert.equal(m.length, 6, "10 Sep – 10 Mar is six grant months");
assert.equal(m[0].label, "M1 · Sep 2026");
assert.equal(m[5].label, "M6 · Feb 2027");
assert.equal(m[0].start, "2026-09-10");
assert.equal(m[5].end, "2027-03-10", "the last window closes on the end date");
assert.deepEqual(periodMonths("", ""), []);
assert.deepEqual(periodMonths("2026-09-10", "2026-09-10"), [], "a period must have length");
// A month-end start never skips a month: 31 Jan → 28 Feb → 31 Mar.
assert.deepEqual(periodMonths("2026-01-31", "2026-04-30").map(x => x.start), ["2026-01-31", "2026-02-28", "2026-03-31"]);

// B — where a date falls.
assert.equal(monthOf("2026-09-10", m), 1, "the first day is in M1");
assert.equal(monthOf("2026-10-09", m), 1, "the day before the anchor is still M1");
assert.equal(monthOf("2026-10-10", m), 2);
assert.equal(monthOf("2026-12-20", m), 4, "the interim report falls in M4");
assert.equal(monthOf("2027-03-31", m), 0, "the final report is after the period — outside, not month 6");
assert.equal(monthOf("", m), 0);

// C — the grid and its words.
assert.ok(runsIn({ code: "", title: "x" }, 3), "no months = throughout");
assert.ok(!runsIn({ code: "", title: "x", months: [1, 2] }, 3));
assert.equal(monthsLabel({ code: "", title: "x", months: [1, 2, 3] }, m), "months 1–3");
assert.equal(monthsLabel({ code: "", title: "x", months: [2, 4, 5] }, m), "month 2, months 4–5");
assert.equal(monthsLabel({ code: "", title: "x" }, m), "throughout");

// D — a project's own rows become the plan; nothing is typed twice.
const rows = [
  { title: "Market assessment", kind: "Activity", outlineNo: "A1", resultGroup: "A. Business development", startDate: "2026-09-10", dueDate: "2026-12-01" },
  { title: "Operations manual", kind: "Activity", outlineNo: "B1", resultGroup: "B. Management", startDate: "2026-09-10", dueDate: "2026-11-01" },
  { title: "Interim report", kind: "Report", dueDate: "2026-12-20" },
  { title: "First instalment", kind: "Payment", dueDate: "2026-09-10" },
  { title: "Undated idea", kind: "Milestone", dueDate: "" },
];
const plan = workplanFromActivities(rows, "2026-09-10", "2027-03-10", ["one result"]);
assert.deepEqual(plan.pillars.map(p => p.title), ["A. Business development", "B. Management"]);
assert.deepEqual(plan.pillars[0].activities[0].months, [1, 2, 3], "start and due dates become a span");
assert.deepEqual(plan.milestones.map(x => x.title), ["First instalment", "Interim report"], "milestones are dated and sorted; an undated row is not a milestone");
assert.deepEqual(plan.results, ["one result"]);

// E — what stops a workplan going out.
assert.equal(workplanBlocker(plan, "2026-09-10", "2027-03-10"), null);
assert.ok(workplanBlocker(plan, "", ""), "no dates, no timeline");
assert.ok(workplanBlocker({ pillars: [], milestones: [], results: [] }, "2026-09-10", "2027-03-10"), "no activities, no workplan");

// F — the document.
const html = workplanHtml({
  projectName: SKF.projectName, projectCode: SKF.projectCode, donorName: "Samir Kassir Foundation",
  agreementNo: SKF.agreementNo, currency: "EUR", amount: 12000,
  startDate: SKF.startDate, endDate: SKF.endDate, preparedBy: "Saad Matar — Executive Director",
  summary: SKF.summary, months: m, plan: SKF as any,
});
assert.ok(html.includes("PROJECT WORKPLAN") && html.includes("ANAHON MEDIA PLATFORM"), "AnaHon letterhead");
assert.ok(html.includes("civil company no. 90/2023"), "the company line Buying &amp; paying fixed on 17 Sep");
assert.ok(!/civic non-profit/i.test(html), "the proposal's wrong description is never repeated (Saad, 18 Sep)");
assert.equal((html.match(/<th class="m">/g) || []).length, 6, "one column per grant month");
assert.ok(html.includes("10 September 2026 &ndash; 10 March 2027 (6 months)"), "the period as the agreement states it");
for (const code of ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4"]) assert.ok(html.includes(`>${code}<`), `activity ${code} is on the page`);
assert.ok(html.includes("SKF-AN-31/2026"), "the agreement number");
assert.ok(html.includes("20 December 2026") && html.includes("31 March 2027"), "both reporting dates");
// A1 runs months 1–3: three bars, then three empty cells, in its own row.
const a1Row = html.slice(html.indexOf(">A1<"), html.indexOf(">A2<"));
assert.equal((a1Row.match(/span class="on"/g) || []).length, 3, "A1 is marked in three months");

// G — the record carries the plan, and the route reads it from there.
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/app\.post\("\/api\/projects\/workplan-doc"/.test(server), "the route exists");
assert.ok(/o\.stage !== "Awarded"/.test(server), "only an awarded opportunity prints one");
assert.ok(/workplanFromActivities\(rows, p\.startDate, p\.endDate/.test(server), "a registered project's plan is its activity rows");
assert.ok(/category: "Workplan"/.test(server), "filed in the project's own vault folder");
assert.ok(/"\/api\/projects\/workplan-doc": MANAGERS/.test(fs.readFileSync("src/gates.ts", "utf8")), "managers only");

console.log("check-workplan: all passed");
