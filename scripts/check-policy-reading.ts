// Do the policy reading view's presentation rules (src/policyReading.ts) still read the real
// handbooks the way they were reviewed? Icons per section title, warning lines, and the
// amount/deadline marks.
//
// 16 Sep 2026. The rules are keyword guesses, so the proof is a frozen copy of every numbered
// section title in the live handbooks (88) with the icon each was reviewed to get, plus real
// "At a glance" lines where the rule order decides the answer. A new rule that shifts any of
// these fails here before a reader sees a wrong icon.
// Run: npx tsx scripts/check-policy-reading.ts
import { topicOf, isWarningLine, markPieces, mentions, isFinding, splitExample, deadlineIn } from "../src/policyReading.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

const TITLES: [string, string][] = [
  ["Our commitments", "general"],
  ["Conflicts of interest", "integrity"],
  ["Gifts and hospitality", "gift"],
  ["Checks before money moves", "money"],
  ["Safeguarding and child protection", "safety"],
  ["Raising a concern", "concern"],
  ["How a concern is handled", "concern"],
  ["Suppliers, partners and grantees", "people"],
  ["Training and signing", "training"],
  ["Warning signs", "alert"],
  ["Records", "records"],
  ["Review", "review"],
  ["How AnaHon engages people", "people"],
  ["Recruitment and selection", "people"],
  ["Joining and the personnel file", "people"],
  ["Fees and payment", "money"],
  ["Working arrangements", "time"],
  ["Time off", "time"],
  ["Wellbeing and safety", "safety"],
  ["Diversity, inclusion and respect", "people"],
  ["Performance and development", "people"],
  ["Concerns and disagreements", "concern"],
  ["When work is not going well, and ending an engagement", "people"],
  ["Positive Journalism", "editorial"],
  ["Content standards", "editorial"],
  ["Content Types", "editorial"],
  ["From assignment to publication", "editorial"],
  ["Independence and conflicts of interest", "integrity"],
  ["Sources, contributors and people in our stories", "people"],
  ["Safety of journalists and contributors", "safety"],
  ["Corrections", "correction"],
  ["Artificial intelligence", "ai"],
  ["Training", "training"],
  ["Breaches and review", "alert"],
  ["Basis of Accounting", "money"],
  ["Chart of Accounts and Project Coding", "records"],
  ["Currency and Foreign Exchange", "money"],
  ["Cash and Bank Management", "money"],
  ["Expense Authorisation and Payment Workflow", "approval"],
  ["Supporting Documentation", "records"],
  ["Procurement and Contracting", "money"],
  ["Personnel and Service-Provider Costs", "people"],
  ["Fixed Assets", "equipment"],
  ["Travel and Per Diem", "travel"],
  ["Financial Reporting and Budget Monitoring", "reporting"],
  ["Audit and Compliance", "review"],
  ["Financial Records Retention", "records"],
  ["Anti-Fraud, Anti-Corruption and Conflict of Interest", "alert"],
  ["Data Protection, Confidentiality and Information Security", "privacy"],
  ["Due diligence: know who you deal with", "diligence"],
  ["Watching risk", "safety"],
  ["The register at 15 September 2026", "records"],
  ["What is recorded", "records"],
  ["Receiving and confirming", "equipment"],
  ["Custody and movement", "equipment"],
  ["Equipment held by freelancers and service providers", "equipment"],
  ["Maintenance and repair", "equipment"],
  ["Periodic verification", "equipment"],
  ["Loss, theft and damage", "alert"],
  ["Donor-funded assets", "equipment"],
  ["Depreciation", "money"],
  ["Disposal", "equipment"],
  ["Responsibilities", "people"],
  ["Why and how we raise money", "money"],
  ["Where income comes from", "money"],
  ["Money we do not take", "money"],
  ["Before we apply", "general"],
  ["Writing and submitting a proposal", "general"],
  ["When a grant is awarded", "money"],
  ["Donors and supporters", "people"],
  ["Reviewing how we raise money", "money"],
  ["Understanding community needs", "people"],
  ["Indicators", "reporting"],
  ["Collecting and reporting", "reporting"],
  ["Learning", "training"],
  ["Principles", "general"],
  ["What information we hold", "data"],
  ["Where information is kept", "data"],
  ["Access and accounts", "privacy"],
  ["Source material and unpublished work", "editorial"],
  ["Paying a protected source", "privacy"],
  ["Personal data", "data"],
  ["Sharing and sending", "data"],
  ["Outside services and artificial intelligence", "ai"],
  ["Devices", "privacy"],
  ["Keeping, backing up and destroying", "data"],
  ["Incidents", "alert"],
  ["Breaches", "alert"],
];
const wrongTitles = TITLES.filter(([t, want]) => topicOf(t) !== want);
ok(`all ${TITLES.length} real section titles keep their reviewed icon`, wrongTitles.length === 0,
  wrongTitles.map(([t, want]) => `${t}: ${topicOf(t)} ≠ ${want}`).join("; "));

// Real "At a glance" lines where two rules both match and the order decides.
const GLANCE: [string, string][] = [
  ["We do not steal, lie in records, bribe, take kickbacks, or let money reach sanctioned or terrorist parties.", "integrity"],
  ["Every concern is recorded in a private register that nobody can edit or delete.", "concern"],
  ["People are chosen, paid and treated fairly, whoever they are.", "people"],
  ["Every piece is researched, fact-checked by someone other than its author (P4), and approved by two different people before it goes anywhere — website, Facebook, Instagram, WhatsApp or YouTube.", "editorial"],
  ["AI helps; it never publishes, never fact-checks alone, and never sees a confidential source.", "ai"],
  ["Figures come from records we can show — the management system, platform statistics, attendance sheets — never from memory.", "reporting"],
  ["Lost a phone, sent something to the wrong person, clicked a bad link? Report it at once. Nobody is punished for reporting their own mistake.", "alert"],
  ["Once a year we look at what worked, what did not, and change course.", "general"],
];
for (const [t, want] of GLANCE) ok(`"${t.slice(0, 40)}…" → ${want}`, topicOf(t) === want, `got ${topicOf(t)}`);

// Warning lines: only at the very start, never mid-sentence.
ok("\"Never paid from the float:\" is a warning", isWarningLine("Never paid from the float:"));
ok("\"Do not share passwords.\" is a warning", isWarningLine("Do not share passwords."));
ok("a mid-sentence \"must\" is not", !isWarningLine("Every person must sign the declaration."));
ok("\"Nevertheless …\" is not", !isWarningLine("Nevertheless, the register is kept."));

// Marks: the phrases found in the live text, nothing else, and the text survives intact.
const marked = (s: string) => markPieces(s).filter(p => p.mark).map(p => p.text);
const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
const cases: [string, string[]][] = [
  ["Purchases above USD 1,000 need three quotes; up to USD 150 is paid from the float.", ["USD 1,000", "USD 150"]],
  ["The supplier is paid within 5 working days, and the report is due within 30 to 60 days.", ["within 5 working days", "within 30 to 60 days"]],
  ["Receipts are handed in within seven days.", ["within seven days"]],
  ["Reconciled by the last working day of the month.", ["by the last working day of the month"]],
  ["Checked monthly and recorded the same day; kept for at least seven years.", []],
  ["Policy P5 §9 applies to items of 500 or more, in 2026.", []],
];
for (const [s, want] of cases) {
  const got = marked(s);
  ok(`marks in "${s.slice(0, 40)}…"`, same(got, want), JSON.stringify(got));
  ok(`  …and the pieces join back to the text`, markPieces(s).map(p => p.text).join("") === s);
}

// Search inside a policy: case-blind, every hit, a hit inside an amount splits it, the
// text survives, and regex characters typed by a reader are just characters.
const pieces = (s: string, q: string) => markPieces(s, q).map(p => `${p.mark || "-"}:${p.text}`);
ok("search marks every hit, case-blind",
  same(pieces("Cash is cash; CASH counts.", "cash"), ["find:Cash", "-: is ", "find:cash", "-:; ", "find:CASH", "-: counts."]),
  JSON.stringify(pieces("Cash is cash; CASH counts.", "cash")));
ok("a hit inside an amount splits the amount",
  same(pieces("up to USD 1,000 only", "1,000"), ["-:up to ", "fact:USD ", "find:1,000", "-: only"]),
  JSON.stringify(pieces("up to USD 1,000 only", "1,000")));
ok("regex characters are plain text", same(pieces("a (b) c.*", "(b)"), ["-:a ", "find:(b)", "-: c.*"]) && !mentions("abc", ".*"));
ok("one letter does not search", !isFinding(" a ") && isFinding("ab") && markPieces("banana", "a").every(p => p.mark !== "find"));
ok("search pieces join back to the text", markPieces("Every concern is recorded; concern again.", "concern").map(p => p.text).join("") === "Every concern is recorded; concern again.");

// Example strips: the real P1 §2.1 sentence splits at "Examples:"; a lower-case aside does not.
const P1_21 = "A conflict exists when a personal interest — family, friendship, money, a second job, a political or business tie — could affect, or look as if it affects, a decision you take for AnaHon. Examples: engaging a relative, buying from a company a friend owns, assessing a proposal from an organisation you are linked to.";
const ex = splitExample(P1_21);
ok("P1 §2.1 splits at \"Examples:\"", !!ex && ex.before.endsWith("for AnaHon.") && ex.example.startsWith("Examples: engaging"), JSON.stringify(ex));
ok("a line that IS an example is all example", splitExample("Example: a gift of flowers.")?.before === "");
ok("a lower-case \"for example\" mid-sentence stays put", splitExample("Costs, for example, travel, are coded.") === null);
ok("\"Counterexamples:\" is not a marker", splitExample("See the counterexamples: none.") === null);

// Step time chips, from the real P1 §7.2 steps.
ok("P1 §7.2 step 1 carries its deadline", deadlineIn("Acknowledge within 5 working days, where the person can be reached, and give them the reference number.") === "within 5 working days");
ok("P1 §7.2 step 3 carries its deadline", deadlineIn("Preliminary review within 15 working days: is there enough to look into?") === "within 15 working days");
ok("an amount is not a deadline", deadlineIn("A cash payment above USD 150 needs approval.") === null);
ok("a step with no time has no chip", deadlineIn("Decide and record the outcome in the register, with the reasons.") === null);

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nall policy reading rules hold");
