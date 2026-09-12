/**
 * Donor reporting deadlines.
 *
 * The rule this pins: a reporting date is either read from a document or it is UNKNOWN.
 * Nothing here may be derived from a project's own dates, because that is exactly what
 * the timeline generator did — end date plus a month, for every grant — and it is why
 * TRF read as reported and on time while its final financial report was ten weeks late.
 */
import assert from "assert";
import fs from "fs";
import { DONOR_OBLIGATIONS, DOCUMENTED_PROJECT_IDS, obligationId, overdueObligations, daysLate, UNKNOWN_DUE } from "../src/donorDeadlines.js";

// A — every obligation names its source, and either has a real date or says unknown.
for (const o of DONOR_OBLIGATIONS) {
  assert.ok(o.source && o.source.length > 8, `${o.key}: no source document named`);
  assert.ok(o.detail.length > 40, `${o.key}: detail must say what the document says`);
  if (o.unknown) assert.equal(o.due, "", `${o.key}: an unknown deadline carries no date`);
  else assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(o.due), `${o.key}: "${o.due}" is not a date`);
  // An unknown deadline must SAY so where a person reads it — never sit blank.
  if (o.unknown) assert.ok(/UNKNOWN/.test(o.title), `${o.key}: an unknown deadline must say so in the title`);
}
assert.equal(new Set(DONOR_OBLIGATIONS.map(obligationId)).size, DONOR_OBLIGATIONS.length, "obligation ids must be unique");

// B — the dates that were read out of the agreements, spelled out here so a silent edit fails.
const due = (k: string) => DONOR_OBLIGATIONS.find(o => o.key === k && o.projectId === P)!.due;
let P = "proj-asfari-ler";
assert.equal(due("final-report"), "2027-05-31", "Asfari Grant Offer: End of Year (Final) Progress Report by 31 May 2027");
P = "proj-trf";
assert.equal(due("interim-1"), "2026-03-15", "TRF Annex A as amended: first interim 15 Mar 2026");
assert.equal(due("final-report"), "2026-06-30", "TRF Annex A as amended: second and final 30 Jun 2026");
P = "proj-fpu-vu";
assert.equal(due("final-report"), "2026-03-18", "FPU subgrant: final reports 18 Mar 2026");
// The agreement prints 2026 where the sequence implies 2025. Recorded as printed, NOT corrected.
assert.equal(due("progress-report"), "2026-12-15", "FPU prints December 15, 2026 — do not silently fix the donor's typo");
assert.ok(DONOR_OBLIGATIONS.find(o => o.key === "progress-report")!.detail.includes("2026"), "the discrepancy must be stated on the record");

// C — the two grants with no agreement are unknown, not blank, and not guessed.
for (const pid of ["proj-skf-mediamig", "proj-1785584153305"]) {
  const o = DONOR_OBLIGATIONS.find(x => x.projectId === pid)!;
  assert.ok(o.unknown, `${pid}: no agreement means the deadline is unknown`);
  assert.ok(/agreement/i.test(o.detail), `${pid}: the record must say why it is unknown`);
}

// D — Asfari's spending condition is recorded with its evidence, not as folklore.
const yp = DONOR_OBLIGATIONS.find(o => o.key === "year-plan")!;
assert.ok(yp.done, "the Year Plan was approved 29 Jun 2026 — the grant is spendable");
assert.ok(/29 June 2026/.test(yp.detail), "the approval must carry its date");

// E — overdue arithmetic. TRF's final is the worst open obligation AnaHon has.
const rows = DONOR_OBLIGATIONS.map(o => ({ ...o, dueDate: o.due, status: o.done ? "Done" : "Planned" }));
const late = overdueObligations(rows as any, "2026-09-12");
assert.equal(late[0].projectId, "proj-trf", "TRF's final report is the most overdue obligation");
assert.equal(late[0].key, "final-report");
assert.equal(daysLate("2026-06-30", "2026-09-12"), 74);
assert.ok(!late.some(r => !r.dueDate), "an obligation with no date can never be 'overdue'");

// F — the generator must not write its guessed report row over a documented grant.
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/DOCUMENTED_PROJECT_IDS\.includes\(projectId\) \? \[\] : \[/.test(server),
  "the invented 'Final report' step must be skipped where the agreement has been read");
assert.equal(DOCUMENTED_PROJECT_IDS.length, 5);

// G — a register row whose file is gone cannot fill a core slot (MediaMig's agreement).
const core = fs.readFileSync("src/coreDocs.ts", "utf8");
assert.ok(/docs\.filter\(d => !d\.fileMissing\)/.test(core), "a document with no bytes is not a filed paper");
assert.ok(/fileMissing/.test(server), "state must say which register rows have lost their file");

// H — the screen shows the words, not a blank cell.
const tab = fs.readFileSync("src/tabs/ProjectsTab.tsx", "utf8");
assert.ok(tab.includes("o.dueDate || UNKNOWN_DUE"), "an unknown deadline must render as words");
assert.ok(tab.includes("a.lateReport"), "an overdue donor report must show on the project card");
assert.equal(UNKNOWN_DUE, "deadline unknown");

console.log(`✓ check-donor-deadlines: ${DONOR_OBLIGATIONS.length} obligations, each sourced; ${late.length} overdue, worst = TRF final (${daysLate("2026-06-30", "2026-09-12")} days)`);
