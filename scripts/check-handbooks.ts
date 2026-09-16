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
  POLICY_DOORS, FORMER, policyNo, historyChapterOf,
} from "../src/handbooksIndex.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

// A frozen copy of the live Index's extracted text (revised 16 Sep 2026, when the eleven policies were
// renumbered P1–P11), so the parser is proven against real wording, not an invented fixture.
const REAL_INDEX = `
AnaHon Media Platform — Policies and Handbooks
Index · revised 16 September 2026. AnaHon's eleven policies live in five handbooks and one standalone document. Each policy is a numbered chapter inside the document that carries it. The separate files that used to hold each one are kept in Superseded as history and no longer govern.
Policies are numbered P1 to P11, grouped by handbook in reading order. The publication gate cites P3 and the independent fact-check cites P4. Documents signed before 16 September 2026 may cite older numbers; the table at the end of this Index shows which policy each one is now.
1. Team Handbook
•P1 Code of Conduct and Integrity — Fraud, corruption, conflicts of interest, gifts, sanctions, safeguarding, and how concerns are raised and handled
•P2 People — How AnaHon engages service providers: fees and payment, rest, wellbeing, inclusion and performance
Written for the declaration of 12 September 2026: AnaHon has no employees. Everyone on the team is a service provider on an annual contract stating the total fee and terms of reference, with subcontracts per project, and no payment where there is no project.
2. Editorial Standards Handbook
•P3 Editorial Standards — Content standards and labels, the two approvals, independence, consent and safeguarding in stories, journalist safety, corrections and AI
•P4 Fact-Checking Policy — Every claim is checked against credible, cross-checked sources by someone other than the author before publication, and errors are corrected openly with a public record
3. Finance and Controls Handbook
•P5 Finance and Procurement Policy — Accounts, procurement, payments, petty cash, money received outside the bank, fixed assets and financial records
•P6 Risk and Due Diligence — Checking suppliers, partners, donors and people, the quarterly risk register, and legal checks before publication
•P7 Resources and Assets — How equipment is recorded, confirmed, held, moved, verified, repaired and disposed of
4. Programmes and Funding Handbook
•P8 Fundraising and Grants — Where income comes from, money AnaHon does not take, the go / no-go check, proposals, grants and reporting
•P9 Programme Quality — Community needs assessment, indicators with baselines and targets, reporting and learning
5. Strategy
•P10 Strategic Plan — A plan, not a rule, and the document the handbooks serve
Standing on its own
•P11 Information, Data and Source Privacy — Where information lives, access and two-step sign-in, source protection, confidential payments to protected sources, and incidents. It cuts across all the handbooks and belongs to none.
Still to settle
•An independent whistleblowing recipient — P1 §6.3 leaves the name open. Until someone outside AnaHon is named, concerns about the Executive Director go to the donors' own channels.
•Indicator baselines and targets (P9 §2.2) — the Executive Director and the Finance Officer set them by 31 October 2026, from figures in the management system.
•A start year for the Strategy (P10).
•An interim editorial approver — P3 §4.2 needs two different people to approve a piece. The Executive Director will name who holds the Production Manager approval until that seat is filled; until then no piece passes the approval step.
•An external audit — required by P5 §12.1. A financial consultant is being engaged through the SKF project to prepare it; none has yet been completed.
Old policy numbers (for documents signed before 16 September 2026)
001 → P1 · 006 → P2 · 002 → P3 · 005 → P4 · 020 → P5 · 012 → P6 · 017 → P7 · 018 → P8 · 011 → P9 · 007 → P10 · 010 → P11.
Merged into the policies above and no longer used: 003 → P5; 004, 015 and 016 → P2; 008 → P9; 009 → P6; 013 and the former anti-fraud annex of 020 → P1; 019 → P8; 021 and 022 → P3; the former data-protection annex of 020 → P11. Drafts 023 (Safeguarding) and 024 (Data Protection) were never adopted; their content is in P1, P3 and P11. 014 was never issued. A second document once numbered 018, the Centralized Knowledge Sharing Repository Policy, was replaced by P11.
`;

console.log("\nA. the Index parses into the five handbooks, P11, and nothing invented");
const parsed = parseHandbooksIndex(REAL_INDEX);
const nos = (i: number) => parsed.handbooks[i].chapters.map(c => c.no).join(",");
ok("five handbooks, Team first", parsed.handbooks.length === 5 && parsed.handbooks[0].heading === "Team Handbook", parsed.handbooks.map(h => h.heading).join(" | "));
ok("Team carries P1 and P2", nos(0) === "P1,P2", nos(0));
ok("Editorial Standards carries P3 and P4", nos(1) === "P3,P4", nos(1));
ok("Finance and Controls carries P5, P6, P7", nos(2) === "P5,P6,P7", nos(2));
ok("Programmes and Funding carries P8 and P9", nos(3) === "P8,P9", nos(3));
ok("Strategy carries only P10", nos(4) === "P10", nos(4));
ok("P11 stands alone, not folded into a handbook", parsed.standalone.length === 1 && parsed.standalone[0].no === "P11");
ok("the eleven numbers run P1 to P11 with no gap",
  [...parsed.handbooks.flatMap(h => h.chapters), ...parsed.standalone].map(c => c.no).join(",") === "P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11");
ok("titles survive the split", parsed.handbooks[0].chapters[0].title === "Code of Conduct and Integrity" && parsed.handbooks[2].chapters[0].title === "Finance and Procurement Policy");
const allNotes = [...parsed.handbooks.flatMap(h => h.chapters), ...parsed.standalone];
ok("a card note is the one-line summary only — no old number, no history (Saad, 16 Sep 2026)",
  allNotes.every(c => c.note.length > 10 && !/formerly|merged|approved|absorb|light edit|(?<![\d/])0\d\d(?![\d/])/i.test(c.note)),
  allNotes.filter(c => /formerly|merged|approved|(?<![\d/])0\d\d(?![\d/])/i.test(c.note)).map(c => c.no).join(","));
ok("old numbers live in exactly one place: the table at the end", /001 → P1/.test(parsed.numbersNotInUse) && /013 and the former anti-fraud annex of 020 → P1/.test(parsed.numbersNotInUse)
  && REAL_INDEX.trim().split("\n").slice(-3)[0].startsWith("Old policy numbers"));
ok("and nowhere above that table", !/(?<![\d/])0\d\d(?![\d/])|formerly/i.test(REAL_INDEX.slice(0, REAL_INDEX.indexOf("Old policy numbers"))));
ok("no fault on the real, correct Index", findIndexFaults(parsed).length === 0, findIndexFaults(parsed).join("; "));
ok("an old number still finds its policy", policyNo("020") === "P5" && policyNo("010") === "P11" && policyNo("005") === "P4" && policyNo("013") === "P1" && policyNo("p7") === "P7");
ok("and every current P-number has a former number", ["P1","P2","P3","P4","P5","P6","P7","P8","P9","P10","P11"].every(p => Object.values(FORMER).includes(p)));

console.log("\nB. a genuine duplicate is caught, not waved through");
const duped = parseHandbooksIndex(REAL_INDEX.replace("•P2 People", "•P3 People"));
const faults = findIndexFaults(duped);
ok("a number reused across handbooks is reported", faults.length === 1 && /P3/.test(faults[0]), faults.join("; "));

console.log("\nC. a chapter the Index promises but the compiled text never wrote is caught");
// Built from the real Finance headings (edition 7, 16 Sep 2026) with Part Three dropped.
const FINANCE_WITHOUT_P7 = `Part One — Finance and Procurement Policy (Policy P5)\nPart Two — Risk and Due Diligence (Policy P6)\n`;
const missing = missingChapterText(parsed.handbooks[2].chapters, chapterAnchors(FINANCE_WITHOUT_P7));
ok("a chapter the Index lists but the text lacks is flagged",
  missing.length === 1 && missing[0].no === "P7", missing.map(c => c.no).join(","));
ok("and the real Finance headings flag nothing",
  missingChapterText(parsed.handbooks[2].chapters, chapterAnchors(FINANCE_WITHOUT_P7 + "Part Three — Resources and Assets Policy (Policy P7)\n")).length === 0);
ok("a single-chapter document (no Part heading at all) is never flagged this way",
  missingChapterText(parsed.handbooks[4].chapters, chapterAnchors("just prose, no heading")).length === 0);
ok("an old history note still lands on its new chapter",
  historyChapterOf({ filename: "x.docx", note: "Superseded on 15 Sep 2026: the 12 Sep 2026 draft of Policy 010, replaced…" }) === "P11");

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
