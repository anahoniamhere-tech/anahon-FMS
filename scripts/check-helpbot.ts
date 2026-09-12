// Does the help desk answer for the right person, and does it keep the records at home?
//
// 5 Sep 2026. The bot hands the model the whole corpus in one prompt, and with it the
// asker's own desk rows. The provider is the Gemini free tier, where Google trains on
// what is submitted — so the one thing that must never regress is the projection: a row
// goes out as kind/status/verb/door/date and nothing else. This check builds a prompt
// from a record stuffed with things that must not travel and greps for every one.
// Run: npx tsx scripts/check-helpbot.ts
import { readFileSync } from "node:fs";
import {
  corpus, helpPrompt, safeRows, parseReply, doorsFor, RULES_FOR_THE_BOT,
  COMPILED_POLICY_PREFIX, POLICY_INDEX_ID, policyHeading, extractEditorsNote, assemblePolicyManual,
} from "../src/helpBot.js";
import { HELP } from "../src/help.js";
import { RULES } from "../src/workflow.js";
import { ROUTE_SEATS } from "../src/gates.js";
import { ALL_ROLES } from "../src/roles.js";
import type { DeskItem } from "../src/workflow.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

// A row carrying every kind of thing that must not leave the building.
const SECRETS = ["Beirut Print House", "4,750.00", "VCH-2026-0188", "marwan@example.com", "the mayor's brother"];
const loaded: DeskItem = {
  id: "expenses:e-1", kind: "expenses" as any, recordId: "e-1", door: "expenses",
  title: `VCH-2026-0188 — Beirut Print House`, verb: "Approve or return", status: "Submitted",
  when: "2026-09-02", urgency: "overdue", group: "mine",
  seats: [],
  record: { id: "e-1", voucherNo: "VCH-2026-0188", title: "Beirut Print House", amount: 4750,
            convertedAmount: 4750, currency: "USD", vendorEmail: "marwan@example.com",
            purpose: "the mayor's brother", comments: "4,750.00" },
};

console.log("\nA. the record never leaves the building");
const rows = safeRows([loaded]);
ok("the projection keeps exactly kind, status, verb, door, when",
  Object.keys(rows[0]).sort().join(",") === "door,kind,status,verb,when", Object.keys(rows[0]).join(","));
const prompt = helpPrompt("what is waiting on me?", {
  role: "Program Director", ownRole: "Program Director",
  doors: doorsFor("Program Director"), rows, today: "2026-09-05",
});
for (const secret of SECRETS) ok(`the prompt never carries ${JSON.stringify(secret)}`, !prompt.includes(secret));
ok("but it does carry the row's status, verb and door", ["Submitted", "Approve or return", "door expenses"].every(x => prompt.includes(x)));
ok("and the date", prompt.includes("2026-09-02"));
// The projection is the only thing standing between a voucher and Google's training set.
ok("safeRows reads no field but the five", !/\b(title|record|recordId|amount|seats)\b/.test(
  read("../src/helpBot.ts").split("export const safeRows")[1].split("\n\n")[0]));

console.log("\nB. the whole corpus is in the prompt, not a sample of it");
const c = corpus();
ok(`every one of the ${HELP.length} Q&A entries, English and Arabic`,
  HELP.every(h => c.includes(h.q.en) && c.includes(h.a.ar)), HELP.filter(h => !c.includes(h.q.en)).map(h => h.id).join(","));
ok(`every one of the ${RULES.length} desk rules`,
  RULES.every(r => c.includes(`${String(r.kind)} / "${r.status}"`)), "a rule is missing from the corpus");
ok(`every one of the ${Object.keys(ROUTE_SEATS).length} gated routes`,
  Object.keys(ROUTE_SEATS).every(p => c.includes(p + ":")), Object.keys(ROUTE_SEATS).filter(p => !c.includes(p + ":")).join(","));
ok("and the roles they are written in terms of", ALL_ROLES.every(r => c.includes(r)));
// If this ever needs splitting, it stops being "one prompt, no retrieval" — say so out loud.
ok(`the corpus still fits one prompt (${Math.round(c.length / 1000)}k chars)`, c.length < 200_000, `${c.length} chars`);

console.log("\nC. the answer is for the person asking");
const officer = doorsFor("Project Officer");
ok("a Project Officer is offered only doors they can open",
  !officer.includes("banking") && !officer.includes("ledger") && officer.includes("expenses"));
ok("a door the asker cannot open is dropped from the reply",
  parseReply({ answer: "x", door: "banking" }, officer).door === null);
ok("a door they can open survives", parseReply({ answer: "x", door: "expenses" }, officer).door === "expenses");
ok("an invented navKey is dropped", parseReply({ answer: "x", door: "payments-v2" }, officer).door === null);
ok("an invented seat to ask is dropped", parseReply({ answer: "x", askSeat: "Chief Accountant" }, officer).askSeat === null);
ok("a real one survives", parseReply({ answer: "x", askSeat: "Finance Officer" }, officer).askSeat === "Finance Officer");
const worn = helpPrompt("can I approve this?", {
  role: "Digital Officer", ownRole: "Super Admin", doors: doorsFor("Digital Officer"), rows: [], today: "2026-09-05",
});
ok("standing in is stated as the seat, not the person", worn.includes("standing in for the Digital Officer seat"));

console.log("\nD. the instructions hold the two promises");
ok("it is told not to guess", /Do not guess/.test(RULES_FOR_THE_BOT));
ok("it is told to name a navKey only from the asker's own doors", /only a navKey from the list of doors they can open/.test(RULES_FOR_THE_BOT));
ok("it is told never to state a title, vendor or amount", /Never state or invent a record's title, vendor, amount/.test(RULES_FOR_THE_BOT));
ok("it is told to answer in the language it was asked in", /same language the question is written in/i.test(RULES_FOR_THE_BOT));
// 5 Sep 2026, from the first real use: asked about a "Submitted" row when the desk held
// none, it explained what Submitted would mean instead of saying nothing was there, and
// offered mydesk as the destination — a door the asker was already standing in.
ok("it is told to say when no such row is on the desk", /nothing on your desk is in that state right now/.test(RULES_FOR_THE_BOT));
ok("and not to explain the status as though the row were there", /Do not explain what the status would have meant as though the row were there/.test(RULES_FOR_THE_BOT));
ok("mydesk is not a destination for a question about one record", /"mydesk" is a destination only for a question about the desk as a whole/.test(RULES_FOR_THE_BOT));

console.log("\nE. the policies");
// 6 Sep 2026: the nineteen numbered policies go in whole, beside the system's own tables.
const withManual = helpPrompt("q", { role: "Program Director", ownRole: "Program Director",
  doors: doorsFor("Program Director"), rows: [], today: "2026-09-06" }, "### Accounting and Business Policy 020\nthree quotations above USD 1,000");
ok("the manual reaches the prompt when there is one", withManual.includes("three quotations above USD 1,000")
  && /## The policies — AnaHon's own numbered policies/.test(withManual));
ok("and the prompt is unchanged when there is not", !/## The policies — AnaHon's own numbered policies/.test(
  helpPrompt("q", { role: "Program Director", ownRole: "Program Director", doors: doorsFor("Program Director"), rows: [], today: "2026-09-06" })));
// The whole manual, not a chosen slice: the contradiction this feature found sits ACROSS
// two documents, so any retrieval that fetched "the relevant policy" would have hidden it.
const srv = read("../server.ts");
ok("it is extracted whole — no chunking, no keyword pre-selection",
  /findMany\(\{ where: \{ category: "Handbook" \}/.test(srv) && !/chunk|embedding|similarity/i.test(srv.split("policyCorpus")[1]?.slice(0, 2000) || ""));
ok("extracted in process, never through the route", /await documentText\(r\.id\)/.test(srv)
  && !/fetch\([^)]*docx-text/.test(srv));
ok("cached on every Handbook row's own content hash, so re-filing any of them invalidates it",
  /rows\.map\(r => `\$\{r\.id\}:\$\{r\.contentHash\}`\)/.test(srv));
ok("one unreadable document does not take the manual down", /could not read \$\{r\.filename\}/.test(srv));

console.log("\nE2. the 12 Sep 2026 compilations do not duplicate the policies");
// The same nineteen policies were compiled into six handbook documents, filed in the same
// category, carrying the SAME text — reading both would have doubled the corpus and had
// the bot quote a rule twice, or quote a compilation and call it the source.
const REAL_COMPILED_IDS = [
  "doc-hb-compiled-anahon-policies-index",
  "doc-hb-compiled-anahon-editorial-standards-handbook",
  "doc-hb-compiled-anahon-team-handbook",
  "doc-hb-compiled-anahon-finance-and-controls-handbook",
  "doc-hb-compiled-anahon-programmes-and-funding-handbook",
  "doc-hb-compiled-anahon-strategy-007",
];
const REAL_NUMBERED_IDS = [
  "doc-hb-anahon-accounting-business-policy-020",
  "doc-hb-anahon-internalcodeofconduct-001",
  "doc-hb-anahon-fact-checking-policy-005",
  "doc-aipolicy-022",
];
ok("every one of the six live compiled documents is caught by the marker",
  REAL_COMPILED_IDS.every(id => id.startsWith(COMPILED_POLICY_PREFIX)));
ok("no numbered policy is caught by it — the marker is on the compilations, not a guess from the filename",
  REAL_NUMBERED_IDS.every(id => !id.startsWith(COMPILED_POLICY_PREFIX)));
ok("the index is the one compiled document treated as navigation",
  POLICY_INDEX_ID === "doc-hb-compiled-anahon-policies-index" && POLICY_INDEX_ID.startsWith(COMPILED_POLICY_PREFIX));
ok("a policy's heading still carries its number, the way the numbered corpus always has",
  policyHeading("AnaHon_Accounting_Business_Policy_020.docx") === "AnaHon Accounting Business Policy 020");

console.log("\nE3. the editor's note is found by its real shape, not assumed");
// Real excerpts of the actual documents (12 Sep 2026), not synthetic examples — one that
// is bounded by "Part One" and one that is not, so both code paths run against text that
// was actually extracted from the live files rather than text this check imagines.
const REAL_EDITORIAL_NOTE_EXCERPT = "Editor's note — what does not match reality, as of 12 September 2026\n\t•\tThe two approvals cannot be given. Policy 002 requires approval by the Production Manager and the Programs Director. The Editorial Lead post is vacant, the Production Manager function is unassigned, and both approval seats resolve to one person, who also prepares the work. Until a second approver is appointed, no piece can pass this gate honestly. Recorded, not worked around.\n\t•\tBodies that do not exist. Policy 002 refers to a \"legal team\", a \"Management Directory\" and an \"editorial board\" (005). AnaHon has none of these. Read them as the Executive Director until they exist.\n\t•\tRoles described in the plural. Project Officers \"of each program\", reporters, content creators and podcasters are described as standing teams. Today most are single people or vacancies.\n\t•\tMeetings. The weekly editorial meeting and daily production meeting are stated as routine. They are not currently held at that frequency.\nThese are questions for the organisation, not for this handbook to answer.\nHow the system enforces this handbook\n\t•\tA piece is assigned to a named person; the fact-checker named on it must be someone other than the author.\n\t•\tThe fact-checker must record at least one source or verification step before the piece can pass.\n\t•\tTwo approvals are required, and the system refuses the same person taking both.\n\t•\tThe same gate applies to Facebook and Instagram posts as to the website: a post must belong to a cleared piece.\n\t•\tWhere AI assisted, the record carries that fact and the disclosure must be attested before publication.\n\t•\tCorrections and retractions stay on the record permanently.\n\nPart One — Editorial Policies and Guidelines (Policy 002)\nEditorial Polici";
const REAL_STRATEGY_NOTE_EXCERPT = "Editor's note\n\t•\tThe plan has no dates. It runs \"Year 1, Year 2, Year 3\" without saying when Year 1 began, so nothing in it can be called on time or late. Fixing that is a decision, not a drafting job: state the start year.\n\t•\tIt predates the five programmes. AnaHon now works through Platform, iContent Academy, Ahali Al Madina, Roots & Reach and Production. The plan's goals map onto them loosely but not by name.\n\t•\tIts targets are the only numbers AnaHon has written down — five partnerships, a 50% increase in trainees — while the KPI policy (008) has none. When targets are set for the KPIs, they should agree with these or replace them deliberately.\n\t•\tSustainability through paid services is a stated goal, and it is happening: the Production stream and its client quotations. Read it beside the Editorial Policies' rule that commercial relationships never influence what is published.\n\nAnahon Media Platform Strategic Plan/Strategy\nVision an";

const edNote = extractEditorsNote(REAL_EDITORIAL_NOTE_EXCERPT);
ok("editorial: the note stops before Part One", edNote.endsWith("Corrections and retractions stay on the record permanently."), edNote.slice(-60));
ok("editorial: the compiled policy text after the boundary is not pulled in",
  !edNote.includes("Part One") && !edNote.includes("Editorial Polici"));
const stratNote = extractEditorsNote(REAL_STRATEGY_NOTE_EXCERPT);
ok("strategy: bounded correctly even with no \"Part One\" marker to find",
  stratNote.endsWith("never influence what is published."), stratNote.slice(-60));
ok("strategy: the strategic plan's own text after the boundary is not pulled in",
  !stratNote.includes("Anahon Media Platform Strategic Plan") && !stratNote.includes("Vision"));
ok("both notes open with the heading a person would recognise", edNote.startsWith("Editor's note") && stratNote.startsWith("Editor's note"));
ok("a document with no note at all yields nothing to excerpt",
  extractEditorsNote("Part One — Fact-Checking Policy (Policy 005)\nPurpose\n...") === "");

console.log("\nE4. the three ingredients assemble into one block, correctly labelled");
const full = assemblePolicyManual(["### Policy 020\nthree quotations above USD 1,000"], "### AnaHon Policies Index\n001 is in the Team Handbook", ["### AnaHon Team Handbook\nEditor's note\n\t•\tan open point"]);
ok("the policy text is there, unlabelled as anything but itself", full.includes("three quotations above USD 1,000"));
ok("the index is marked navigation-only, and names where the rule really comes from",
  /Where each policy lives.*navigation only.*never the handbook/s.test(full));
ok("the notes section says the policy text above still governs", /Known conflicts and gaps.*policy text above is still what governs/s.test(full));
ok("an empty index produces no index section", !assemblePolicyManual(["x"], "", ["y"]).includes("Where each policy lives"));
ok("no notes produces no notes section", !assemblePolicyManual(["x"], "idx", []).includes("Known conflicts and gaps"));
ok("policyCorpus in server.ts is built from these same exported functions, not a re-implementation",
  /policyHeading\(r\.filename\)/.test(srv) && /extractEditorsNote\(await documentText/.test(srv) && /assemblePolicyManual\(policyParts, indexText, noteParts\)/.test(srv));

console.log("\nF. what an answer from the manual must do");
// Each of these is a failure seen for real, not a hypothetical.
ok("it must cite the policy number and section", /cite the policy: its number and the section/.test(RULES_FOR_THE_BOT));
ok("two policies that disagree are both quoted, never silently chosen between",
  /When two policies disagree, say so plainly\. Quote both, name both by number, and never silently choose between them/.test(RULES_FOR_THE_BOT));
ok("and where the system enforces one of them, it says which",
  /Where the system itself enforces one of the two, say which one it enforces/.test(RULES_FOR_THE_BOT));
// 12 Sep 2026: a handbook is never the source of a rule, and a flagged conflict is
// answered with the policy's own text first, not with the note standing in for it.
ok("the handbook is never cited as the source of a rule — only the policy is",
  /the source of the rule is always the policy and its number, never the handbook/.test(RULES_FOR_THE_BOT));
ok("a flagged conflict gets the policy's text first, then the flag — never the note alone",
  /give the policy's own text first.*then add plainly that it is flagged as unresolved/s.test(RULES_FOR_THE_BOT));
ok("it is told not to quote the note as if it were the policy",
  /Do not quote the note itself as if it were policy text/.test(RULES_FOR_THE_BOT));
// It must not settle the contradiction: that is Saad's and the accountant's, and open.
ok("but it does not rule on which policy governs", /You are not the one who settles which governs/.test(RULES_FOR_THE_BOT));
ok('"that is not in the policies" is a complete answer', /that is not in the policies. is a complete and correct answer/.test(RULES_FOR_THE_BOT));
ok("an Arabic question is still answered in Arabic, from English policy text",
  /same language the question is written in/i.test(RULES_FOR_THE_BOT));
// The record-level line does not move because the policies arrived.
ok("safeRows still sends kind/status/verb/door/when and nothing else",
  Object.keys(safeRows([loaded])[0]).sort().join(",") === "door,kind,status,verb,when");

console.log("\nG. the route");
const server = read("../server.ts");
ok("the route reads the role in force, not the account's own",
  /const role = String\(req\.body\?\.user\?\.role \|\| viewer\.role\)/.test(server));
ok("the desk is read as that role", /deskItems\(\{ id: viewer\.id, email: viewer\.email, role \}/.test(server));
ok("only safeRows reaches the prompt", /rows = safeRows\(deskItems\(/.test(server));
ok("the reply is validated against the asker's doors", /parseReply\(raw, doors\)/.test(server));
ok("it says so instead of failing when no key is set", /The help desk needs an AI key/.test(server));
ok("the route is gated", '/api/help/ask' in ROUTE_SEATS);
// Saad kept both keys on the NAS and chose the free tier for staff questions (5 Sep 2026).
// askJson is Claude-first, so without this argument the help desk would quietly bill per
// question — and the safeRows stripping above exists precisely because Gemini is the one
// that trains on what is sent. The two decisions have to move together.
ok("the help desk asks for the free provider by name", /REPLY_SCHEMA, undefined, "low", "gemini"/.test(server));
ok("and asking for it skips Claude rather than falling through to it",
  /const key = prefer === "gemini" \? undefined : anthropicKey\(\)/.test(server));
ok("every other caller is unchanged — the choice defaults to Claude",
  /prefer: "claude" \| "gemini" = "claude"/.test(server));
const bot = read("../src/HelpDesk.tsx");
ok("the widget opens the door instead of describing it", /onOpenDoor\(turn\.reply!\.door!\)/.test(bot));
// Bare English between JSX tags never reaches t() — the same rule the desk is held to.
const bare = [...bot.matchAll(/(?<![=-])>\s*([^<>{}]*[A-Za-z]{2,}[^<>{}]*?)\s*</g)].map(m => m[1].trim())
  .filter(x => !/[;=()]/.test(x) && !/^[·.:,/\s-]*$/.test(x));
ok("no bare English text nodes in the widget", bare.length === 0, bare.slice(0, 6).join(" | "));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
