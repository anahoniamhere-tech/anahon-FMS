// Does the Policies & Handbooks door read the same facts the help bot reads, and does
// its enforcement map still point at doors that exist?
//
// 14 Sep 2026. The screen used to guess "in force" from a filename suffix and got it
// backwards once the reorg moved on; it now reuses isSupersededPointer, same as the
// bot. What is left to check offline is the two things the screen builds from plain
// text: the Index parser (against a frozen copy of the real document, so a rewording
// of the Index is caught) and the policy→door map (against nav.tsx's real door list).
// Run: npx tsx scripts/check-handbooks.ts
import { NAV_KEYS } from "../src/nav.js";
import {
  parseHandbooksIndex, findIndexFaults, checkPolicyDoors, chapterAnchors, missingChapterText,
  POLICY_DOORS,
} from "../src/handbooksIndex.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

// A frozen copy of the live Index's extracted text (fetched from the NAS 14 Sep 2026),
// so the parser is proven against real wording, not an invented fixture.
const REAL_INDEX = `
AnaHon Media Platform — Policies and Handbooks
Index · 12 September 2026. AnaHon's policies live in five documents, not nineteen. Each policy is a numbered chapter inside the handbook that carries it. The handbooks are the policy; the separate files that used to hold each one are kept in Superseded as history and no longer govern.
The numbers never change. The management system enforces some policies by number — the publication gate cites Policy 002, the independent fact-check cites Policy 005 — and the help desk answers from them.
1. Editorial Standards Handbook
•002 Editorial Policies and Guidelines
•005 Fact-Checking Policy
•022 Artificial Intelligence Policy — absorbs 021 AI Visuals Generation by its own terms
2. Team Handbook
•001 Internal Code of Conduct — amended 12 Sep 2026: equipment damage follows 017, and whistleblowing has a route outside the Executive Director
•004 Diversity and Inclusion · 006 HR Policy · 015 Compensation · 016 Wellbeing
Read with the declaration of 12 September 2026: AnaHon has no employees. Everyone on the team is a service provider on an annual contract stating total salary and terms of reference, with subcontracts per project, and no payment where there is no project.
3. Finance and Controls Handbook
•020 Accounting and Business Policy — three quotations above USD 1,000, two from USD 150 to 1,000, none below 150 (settled 12 Sep 2026)
•012 Due Diligence · 009 Risk Management
•017 Resources and Assets — written 12 Sep 2026; the file previously under that number was a duplicate of 016
•003 Business and Purchase Policy — absorbed 12 Sep 2026: it carried a second, conflicting procurement table. Its purchase process is kept, its Purchase Committee deleted, its income sources moved to handbook 4
•013 Anti-Terrorism Financing, Sanctions and Anti-Corruption — written 12 Sep 2026
4. Programmes and Funding Handbook
•018 Fundraising · 019 Proposal and Grants Management · 011 Community Needs Assessment · 008 Key Performance Indicators
•AnaHon's income sources, moved here from 003
5. Strategy
•007 Strategic Plan — a plan, not a rule, and the document the four handbooks serve
Standing on its own
•010 Information, Data and Source Privacy — written 12 Sep 2026, replacing the Centralized Knowledge Sharing Repository Policy. It cuts across all four handbooks and belongs to none.
Numbers not in use
014 was never issued. 021 is absorbed into 022, and its file was lost in August 2026. 003 and 018's second document are absorbed as described above.
Still to settle
•An independent whistleblowing recipient — named in 001 as [to be named]. Until someone outside management is named, the external route is the donors' own channels.
•Targets for the KPIs (008) — the measures exist, the numbers do not.
•A start year for the Strategy (007).
•An external audit — described in 009, 012 and 003, never carried out.
•Journalist safety and security — touched on in 002 and 001, never written as its own policy.
•The system still enforces USD 300 for procurement until Buying & paying updates it.
`;

console.log("\nA. the Index parses into the five handbooks, Policy 010, and nothing invented");
const parsed = parseHandbooksIndex(REAL_INDEX);
ok("five handbooks", parsed.handbooks.length === 5, String(parsed.handbooks.length));
ok("Editorial Standards carries 002, 005, 022",
  parsed.handbooks[0].chapters.map(c => c.no).join(",") === "002,005,022");
ok("Team carries 001, 004, 006, 015, 016",
  parsed.handbooks[1].chapters.map(c => c.no).join(",") === "001,004,006,015,016");
ok("Finance and Controls carries 020, 012, 009, 017, 003, 013",
  parsed.handbooks[2].chapters.map(c => c.no).join(",") === "020,012,009,017,003,013");
ok("Programmes and Funding carries 018, 019, 011, 008 — not the unnumbered income-sources line",
  parsed.handbooks[3].chapters.map(c => c.no).join(",") === "018,019,011,008");
ok("Strategy carries only 007", parsed.handbooks[4].chapters.map(c => c.no).join(",") === "007");
ok("Policy 010 stands alone, not folded into a handbook",
  parsed.standalone.length === 1 && parsed.standalone[0].no === "010");
ok("a trailing note survives the split, cleaned of its title", parsed.handbooks[0].chapters[2].note.startsWith("absorbs 021"));
ok("no fault on the real, correct Index", findIndexFaults(parsed).length === 0, findIndexFaults(parsed).join("; "));

console.log("\nB. a genuine duplicate is caught, not waved through");
const duped = parseHandbooksIndex(REAL_INDEX.replace("006 HR Policy", "002 HR Policy"));
const faults = findIndexFaults(duped);
ok("a number reused across handbooks is reported", faults.length === 1 && /002/.test(faults[0]), faults.join("; "));

console.log("\nC. a chapter the Index promises but the compiled text never wrote is caught");
// Policy 013 is a real, current example: the Finance and Controls Handbook's own text
// (fetched from the NAS 14 Sep 2026) has no "Part … (Policy 013)" heading — it is
// mentioned once in passing inside Part Five and never given its own section.
const FINANCE_HAS_NO_013 = `Part One — Accounting and Business Policy (Policy 020)\nPart Two — Due Diligence Policy (Policy 012)\nPart Three — Risk Management Policy (Policy 009)\nPart Four — Resources and Assets Policy (Policy 017)\nPart Five — Business and Purchase Policy (absorbed from Policy 003, 12 September 2026)\n`;
const financeAnchors = chapterAnchors(FINANCE_HAS_NO_013);
const missing = missingChapterText(parsed.handbooks[2].chapters, financeAnchors);
ok("013 is flagged as text-less in the handbook that is supposed to carry it",
  missing.length === 1 && missing[0].no === "013", missing.map(c => c.no).join(","));
ok("a single-chapter document (no Part heading at all) is never flagged this way",
  missingChapterText(parsed.handbooks[4].chapters, chapterAnchors("just prose, no heading")).length === 0);

console.log("\nD. the enforcement map names doors that still exist");
ok(`every door POLICY_DOORS names is a real navKey (checked against nav.tsx's ${NAV_KEYS.length})`,
  checkPolicyDoors(NAV_KEYS).length === 0, checkPolicyDoors(NAV_KEYS).join("; "));
// Proven to fail on purpose once, 14 Sep 2026: pointing "017" at "no-such-door" and
// re-running this script reported exactly that door and nothing else, then reverted.
ok("and a door that stopped existing is reported, not silently accepted",
  checkPolicyDoors(NAV_KEYS.filter(k => k !== "compliance")).some(m => m.includes('"compliance"')));
void POLICY_DOORS;

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
