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

// A frozen copy of the live Index's extracted text (revised 15 Sep 2026, when 003 merged into 020, 013 into 001, 020's Annex B into 010, 004/015/016 into 006, 009 into 012, 021/022 into 002, 019 into 018, and 008 into 011),
// so the parser is proven against real wording, not an invented fixture.
const REAL_INDEX = `
AnaHon Media Platform — Policies and Handbooks
Index · 12 September 2026, revised 15 September 2026. AnaHon's policies live in five documents, not nineteen. Each policy is a numbered chapter inside the handbook that carries it. The handbooks are the policy; the separate files that used to hold each one are kept in Superseded as history and no longer govern.
The numbers never change. The management system enforces some policies by number — the publication gate cites Policy 002, the independent fact-check cites Policy 005 — and the help desk answers from them.
1. Editorial Standards Handbook
•002 Editorial Standards — merged with 022 (and 021) and approved 15 Sep 2026: content standards and labels, the two approvals, independence, consent and safeguarding in stories, journalist safety, corrections, AI
•005 Fact-Checking Policy
2. Team Handbook
•001 Code of Conduct and Integrity — merged with 013 and 020's anti-fraud annex and approved 15 Sep 2026: fraud, corruption, conflicts of interest, sanctions, safeguarding, and how concerns are raised
•006 People — merged with 004, 015 and 016 and approved 15 Sep 2026: engaging service providers, fees and payment, rest, wellbeing, inclusion and performance
Written for the declaration of 12 September 2026: AnaHon has no employees. Everyone on the team is a service provider on an annual contract stating the total fee and terms of reference, with subcontracts per project, and no payment where there is no project.
3. Finance and Controls Handbook
•020 Finance and Procurement Policy — merged with 003 and approved 15 Sep 2026: accounts, procurement, payments, petty cash, money received outside the bank, and financial records
•012 Risk and Due Diligence — merged with 009 and approved 15 Sep 2026: checking suppliers, partners, donors and people; the quarterly risk register; legal checks before publication
•017 Resources and Assets — written 12 Sep 2026; the file previously under that number was a duplicate of 016
4. Programmes and Funding Handbook
•018 Fundraising and Grants — merged with 019 and approved 15 Sep 2026: where income comes from, money AnaHon does not take, the go / no-go check, proposals, grant management, reporting and closure
•011 Programme Quality — merged with 008 and approved 15 Sep 2026: community needs assessment, indicators with baselines and targets, reporting and learning
5. Strategy
•007 Strategic Plan — a plan, not a rule, and the document the four handbooks serve
Standing on its own
•010 Information, Data and Source Privacy — merged with 020's data-protection annex and approved 15 Sep 2026: where information lives, access and two-step sign-in, source protection, confidential payments to protected sources, incidents. It cuts across all four handbooks and belongs to none.
Numbers not in use
014 was never issued. 021's file was lost in August 2026. On 15 September 2026, 003 was merged into 020, 013 into 001, 004, 015 and 016 into 006, 009 into 012, 021 and 022 into 002, 019 into 018, and 008 into 011. The second document numbered 018, the Centralized Knowledge Sharing Repository Policy, is replaced by 010.
Still to settle
•An independent whistleblowing recipient — 001 §6.3 leaves the name open. Until someone outside AnaHon is named, concerns about the Executive Director go to the donors' own channels.
•Indicator baselines and targets (011 §2.2) — the Executive Director and the Finance Officer set them by 31 October 2026, from figures in the management system.
•A start year for the Strategy (007).
•An interim editorial approver — 002 §4.2 needs two different people to approve a piece. The Executive Director will name who holds the Production Manager approval until that seat is filled; until then no piece passes the approval step.
•An external audit — required by 020 §12.1. A financial consultant is being engaged through the SKF project to prepare it; none has yet been completed.
`;

console.log("\nA. the Index parses into the five handbooks, Policy 010, and nothing invented");
const parsed = parseHandbooksIndex(REAL_INDEX);
ok("five handbooks", parsed.handbooks.length === 5, String(parsed.handbooks.length));
ok("Editorial Standards carries 002 and 005 — 022 (with 021) is merged into 002",
  parsed.handbooks[0].chapters.map(c => c.no).join(",") === "002,005");
ok("002 is Editorial Standards", parsed.handbooks[0].chapters[0].title === "Editorial Standards");
ok("Team carries 001 and 006 — 004, 015 and 016 are merged into 006",
  parsed.handbooks[1].chapters.map(c => c.no).join(",") === "001,006");
ok("006 is the People policy", parsed.handbooks[1].chapters[1].title === "People");
ok("Finance and Controls carries 020, 012, 017 — 003 merged into 020, 013 into 001, 009 into 012",
  parsed.handbooks[2].chapters.map(c => c.no).join(",") === "020,012,017");
ok("012 is Risk and Due Diligence", parsed.handbooks[2].chapters[1].title === "Risk and Due Diligence");
ok("020 is the Finance and Procurement Policy", parsed.handbooks[2].chapters[0].title === "Finance and Procurement Policy");
ok("Programmes and Funding carries 018 and 011 — 019 merged into 018, 008 into 011",
  parsed.handbooks[3].chapters.map(c => c.no).join(",") === "018,011");
ok("011 is Programme Quality", parsed.handbooks[3].chapters[1].title === "Programme Quality");
ok("Strategy carries only 007", parsed.handbooks[4].chapters.map(c => c.no).join(",") === "007");
ok("Policy 010 stands alone, not folded into a handbook",
  parsed.standalone.length === 1 && parsed.standalone[0].no === "010");
ok("a trailing note survives the split, cleaned of its title", parsed.handbooks[0].chapters[0].note.startsWith("merged with 022"));
ok("no fault on the real, correct Index", findIndexFaults(parsed).length === 0, findIndexFaults(parsed).join("; "));

console.log("\nB. a genuine duplicate is caught, not waved through");
const duped = parseHandbooksIndex(REAL_INDEX.replace("•006 People", "•002 People"));
const faults = findIndexFaults(duped);
ok("a number reused across handbooks is reported", faults.length === 1 && /002/.test(faults[0]), faults.join("; "));

console.log("\nC. a chapter the Index promises but the compiled text never wrote is caught");
// Until 15 Sep 2026 this was Policy 013, listed under Finance with no compiled text. 013 is now
// merged into 001, so the case is rebuilt from the real Finance headings with Part Four dropped:
// the Index still promises 017, and the text no longer carries it.
const FINANCE_WITHOUT_017 = `Part One — Finance and Procurement Policy (Policy 020)\nPart Two — Risk and Due Diligence (Policy 012)\n`;
const missing = missingChapterText(parsed.handbooks[2].chapters, chapterAnchors(FINANCE_WITHOUT_017));
ok("a chapter the Index lists but the text lacks is flagged",
  missing.length === 1 && missing[0].no === "017", missing.map(c => c.no).join(","));
ok("and the real Finance headings flag nothing",
  missingChapterText(parsed.handbooks[2].chapters, chapterAnchors(FINANCE_WITHOUT_017 + "Part Three — Resources and Assets Policy (Policy 017)\n")).length === 0);
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
