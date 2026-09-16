// Do the policy reading view's presentation rules (src/policyReading.ts) still read the real
// handbooks the way they were reviewed? Icons per section title, warning lines, and the
// amount/deadline marks.
//
// 16 Sep 2026. The rules are keyword guesses, so the proof is a frozen copy of every numbered
// section title in the live handbooks (88) with the icon each was reviewed to get, plus real
// "At a glance" lines where the rule order decides the answer. A new rule that shifts any of
// these fails here before a reader sees a wrong icon.
// Run: npx tsx scripts/check-policy-reading.ts
import { topicOf, isWarningLine, markPieces, mentions, isFinding, splitExample, deadlineIn, splitLabel, roleDefs, rolesIn, secId, keyFacts, isGlanceLabel, arabicChapters, governingLine } from "../src/policyReading.js";

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
const marked = (s: string) => markPieces(s).filter(p => p.mark === "fact").map(p => p.text);
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

// "Label: detail" bullets, from the real P5 §4.4 list.
ok("P5 §4.4 \"Custodian and float:\" splits", splitLabel("Custodian and float: the Finance Officer holds the float, in a locked box.")?.label === "Custodian and float");
ok("a list lead-in with nothing after is not a label", splitLabel("Never paid from the float:") === null);
ok("a long clause before a colon is not a label", splitLabel("Where the person who raised the concern asked to stay anonymous: nobody asks.") === null);
ok("a lower-case start is not a label", splitLabel("in cash: never.") === null);
ok("a sentence with a full stop before the colon is not a label", splitLabel("Pay by bank. Exceptions: none.") === null);

// Seats, read from the handbook's own definitions (real P5 §0.3 / P11 wording).
const DEFS = roleDefs('"Executive Director" (ED), "Finance Officer" (FO) and "Procurement and Logistics Officer" (PLO) mean the seats defined in P5 §0.3. "Digital Officer" (DO) is the seat in the systems policy.');
ok("the four defined seats are read", JSON.stringify(DEFS) === JSON.stringify({ ED: "Executive Director", FO: "Finance Officer", PLO: "Procurement and Logistics Officer", DO: "Digital Officer" }), JSON.stringify(DEFS));
const rp = (s: string) => markPieces(s, "", DEFS).filter(p => p.mark === "role").map(p => p.text);
ok("ED and FO become chips in the real P1 §2.2 line", same(rp("Declare the interest before the decision, in writing, to the ED; where it concerns the ED, to the FO, and the record is kept on the file."), ["ED", "ED", "FO"]));
ok("letters inside a word are not a seat (EDITOR, FOund, DOne)", rp("EDITOR FOund DOne").length === 0);
ok("a search hit wins over a chip", markPieces("the ED signs", "ed", DEFS).some(p => p.mark === "find" && p.text === "ED") && rp("the ED signs").length === 1);
ok("no definitions, no chips", markPieces("the ED signs").every(p => p.mark !== "role"));
ok("Who: full title or abbreviation both count", same(rolesIn("The Finance Officer checks; the ED approves.", DEFS), ["ED", "FO"]));

// Cross-references, in the written forms the real handbooks use.
const refs = (s: string) => markPieces(s).filter(p => p.mark === "ref").map(p => `${p.text}=${p.ref!.policy ?? "-"}:${p.ref!.sec ?? "-"}`);
ok("\"(the independent recipient in §6.3)\" → this policy, 6.3", same(refs("otherwise the independent recipient in §6.3), and the file says so."), ["§6.3=-:6.3"]));
ok("\"(P5 §0.3)\", \"Policy P6\", \"(P7)\" all resolve", same(refs("seats defined in P5 §0.3; see Policy P6 and (P7)."), ["P5 §0.3=P5:0.3", "Policy P6=P6:-", "P7=P7:-"]), JSON.stringify(refs("seats defined in P5 §0.3; see Policy P6 and (P7).")));
ok("\"Policy P5 §7.2\" keeps both parts", same(refs("as Policy P5 §7.2 says"), ["Policy P5 §7.2=P5:7.2"]));
ok("a closing full stop is not part of the section", same(refs("See §14."), ["§14=-:14"]));
ok("\"P10\" is one policy, not P1", same(refs("the Strategic Plan (P10)"), ["P10=P10:-"]));
ok("words that merely contain P and digits are not references (MP3, COP28, USD 150)", refs("an MP3 file at COP28 costs USD 150").length === 0);
ok("an amount keeps its highlight next to a reference", markPieces("USD 150 (P5 §4.4)").map(p => p.mark || "-").join(",") === "fact,-,ref,-");
ok("a quoted citation sample stays plain", refs('cite them as "Policy 4.4.2", "§7.2". Section numbers').length === 0);
ok("secId", secId("4.4.2") === "sec-4-4-2" && secId("14") === "sec-14");

// Key-number tiles, from real P5 §4.4 lines.
const CASH = { id: "sec-4-4", title: "Cash" }, PAY = { id: "sec-4-4-2", title: "Cash payments" };
const tiles = keyFacts([
  { text: "Custodian and float: the Finance Officer holds the float, in a locked box. It may not exceed USD 1,000, and has its own account in the management system.", at: CASH },
  { text: "Paying from it: a single payment from the float may not exceed USD 150 (4.4.2). Each payment has a receipt and is recorded the same day.", at: CASH },
  { text: "A cash payment above USD 150, or its equivalent, requires the Executive Director's approval before the money is paid.", at: PAY },
  { text: "A small expense up to USD 150 may be paid directly from the float by the Finance Officer.", at: PAY },
  { text: "It is cleared against them within seven days, with the receipts or signed confirmations of the people paid.", at: PAY },
]).map(f => `${f.fact}|${f.caption}|${f.id}`);
ok("tiles take the line's own label, else the subsection title, and never repeat", same(tiles, [
  "USD 1,000|Custodian and float|sec-4-4", "USD 150|Paying from it|sec-4-4", "USD 150|Cash payments|sec-4-4-2", "within seven days|Cash payments|sec-4-4-2",
]), JSON.stringify(tiles));
ok("tiles stop at the limit", keyFacts([{ text: "USD 1 USD 2 USD 3", at: CASH }], 2).length === 2);
ok("a section with no amounts or deadlines has no tiles", keyFacts([{ text: "Records are kept monthly.", at: CASH }]).length === 0);

// ---- The Arabic twins (16 Sep 2026), real lines. ----
const factsOf = (s: string) => markPieces(s).filter(p => p.mark === "fact").map(p => p.text);
ok("AR amounts «1,000 دولار» / «150 دولار»", same(factsOf("لا يتجاوز الصندوق 1,000 دولار، ولا تتجاوز الدفعة الواحدة 150 دولار."), ["1,000 دولار", "150 دولار"]), JSON.stringify(factsOf("لا يتجاوز الصندوق 1,000 دولار، ولا تتجاوز الدفعة الواحدة 150 دولار.")));
ok("AR deadlines: digits, words, ranges, «يوم عمل»", same(factsOf("الإقرار بالبلاغ خلال 5 أيام عمل، ومراجعة أولية خلال 15 يوم عمل، وتسوية خلال سبعة أيام، والتقرير خلال 30 إلى 60 يوماً."),
  ["خلال 5 أيام عمل", "خلال 15 يوم عمل", "خلال سبعة أيام", "خلال 30 إلى 60 يوماً"]), JSON.stringify(factsOf("الإقرار بالبلاغ خلال 5 أيام عمل، ومراجعة أولية خلال 15 يوم عمل، وتسوية خلال سبعة أيام، والتقرير خلال 30 إلى 60 يوماً.")));
ok("AR «في آخر يوم عمل من الشهر»", same(factsOf("1. تُقدَّم جداول ساعات العمل في آخر يوم عمل من الشهر."), ["في آخر يوم عمل من الشهر"]));
ok("AR «خلال» that is not a time limit stays plain", factsOf("من خلال الشراكات مع الصحفيين، خلال الاثني عشر شهراً الماضية، خلال سنة.").length === 0);
ok("AR «مدخلال» is not «خلال»", factsOf("مدخلال 5 أيام").length === 0);
ok("AR step chip", deadlineIn("الإقرار بالبلاغ خلال 5 أيام عمل، حيثما أمكن التواصل مع الشخص.") === "خلال 5 أيام عمل");
const arRefs = (s: string) => markPieces(s).filter(p => p.mark === "ref").map(p => `${p.text}=${p.ref!.policy ?? "-"}:${p.ref!.sec ?? "-"}`);
ok("AR refs «السياسة P5، البند 4.3», «(P5، البند 6.8)», «البند 6», «(السياسة P11)»",
  same(arRefs("كما في السياسة P5، البند 4.3 و(P5، البند 6.8) ثم البند 6 (السياسة P11)."),
    ["السياسة P5، البند 4.3=P5:4.3", "P5، البند 6.8=P5:6.8", "البند 6=-:6", "السياسة P11=P11:-"]),
  JSON.stringify(arRefs("كما في السياسة P5، البند 4.3 و(P5، البند 6.8) ثم البند 6 (السياسة P11).")));
ok("AR «البنود» / «والبند» are not a bare «البند»", arRefs("البنود 4 و5، والبند 6").length === 0);
ok("AR example strip at «أمثلة:»", splitExample("… في قرار تتّخذه باسم «أنا هون». أمثلة: التعاقد مع قريب.")?.example === "أمثلة: التعاقد مع قريب.");
ok("AR «— أمثلة:» mid-bullet stays put (as the English does)", splitExample("المعلومات الشخصية — أمثلة: بطاقات الهوية") === null);
ok("AR label «أمين الصندوق: …»", splitLabel("أمين الصندوق والنقد: يحتفظ المسؤول المالي بالصندوق.")?.label === "أمين الصندوق والنقد");
ok("AR list lead-in with nothing after is not a label", splitLabel("ما لا يُدفع من الصندوق أبداً:") === null);
ok("AR «لمحة سريعة» is At a glance", isGlanceLabel("لمحة سريعة") && isGlanceLabel("At a glance") && !isGlanceLabel("ملاحظة المحرّر"));
ok("AR search ignores short vowels", mentions("يُقيَّد كل بلاغ في سجلّ خاص", "يقيد") && mentions("سجلّ", "سجل"));
const hits = markPieces("يُقيَّد كل بلاغ", "يقيد").filter(p => p.mark === "find").map(p => p.text);
ok("AR hit keeps its vowels, text survives", same(hits, ["يُقيَّد"]) && markPieces("يُقيَّد كل بلاغ", "يقيد").map(p => p.text).join("") === "يُقيَّد كل بلاغ", JSON.stringify(hits));
const ch = arabicChapters("منصة «أنا هون» الإعلامية — دليل الفريق\nالجزء الأول — مدوّنة السلوك والنزاهة (السياسة P1)\nنص\n(السياسة P11) في السطر\nالجزء الثاني — سياسة شؤون الأفراد (السياسة P2)");
ok("AR chapter headings, and a body «(السياسة P11)» is not one", JSON.stringify(ch.anchors) === '{"P1":1,"P2":4}' && ch.titles.P1 === "مدوّنة السلوك والنزاهة", JSON.stringify(ch));
const GOV_EN = "ترجمة رسمية للنص الإنكليزي. عند أي اختلاف في المعنى بين النصين، يُعمل بالنص الإنكليزي ويُرجع إلى المدير التنفيذي لتصويب الترجمة.";
ok("governing line: English governs today", governingLine(`عنوان\n${GOV_EN}\nالإصدار 7`)?.governs === "en");
ok("governing line: the approved clause makes Arabic govern", governingLine("عنوان\nاللغة. صدرت هذه السياسة بالعربية والإنكليزية، والنص العربي هو النص الملزم. وعند أي اختلاف في المعنى بين النصين، يُعمل بالنص العربي.")?.governs === "ar");
ok("no status line, no badge", governingLine("Title\nEdition 7") === null);

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nall policy reading rules hold");
