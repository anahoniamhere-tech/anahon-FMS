// Does the help desk answer for the right person, and does it keep the records at home?
//
// 5 Sep 2026. The bot hands the model the whole corpus in one prompt, and with it the
// asker's own desk rows. The provider is the Gemini free tier, where Google trains on
// what is submitted — so the one thing that must never regress is the projection: a row
// goes out as kind/status/verb/door/date and nothing else. This check builds a prompt
// from a record stuffed with things that must not travel and greps for every one.
// Run: npx tsx scripts/check-helpbot.ts
import { readFileSync } from "node:fs";
import { isSupersededDoc } from "../src/helpBot.js";
import {
  corpus, helpPrompt, safeRows, parseReply, doorsFor, RULES_FOR_THE_BOT,
  isSupersededPointer, policyHeading,
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
// 6 Sep 2026: the policy text goes in whole, beside the system's own tables.
const withManual = helpPrompt("q", { role: "Program Director", ownRole: "Program Director",
  doors: doorsFor("Program Director"), rows: [], today: "2026-09-06" }, "### Finance and Controls Handbook\nthree quotations above USD 1,000");
ok("the manual reaches the prompt when there is one", withManual.includes("three quotations above USD 1,000")
  && /## The policies — AnaHon's live handbooks, in full/.test(withManual));
ok("and the prompt is unchanged when there is not", !/## The policies — AnaHon's live handbooks/.test(
  helpPrompt("q", { role: "Program Director", ownRole: "Program Director", doors: doorsFor("Program Director"), rows: [], today: "2026-09-06" })));
const srv = read("../server.ts");
ok("it is extracted whole — no chunking, no keyword pre-selection",
  /findMany\(\{ where: \{ category: "Handbook" \}/.test(srv) && !/chunk|embedding|similarity/i.test(srv.split("policyCorpus")[1]?.slice(0, 2000) || ""));
ok("extracted in process, never through the route", /await documentText\(r\.id\)/.test(srv)
  && !/fetch\([^)]*docx-text/.test(srv));
ok("cached on every Handbook row's own content hash, so re-filing or retiring any of them invalidates it",
  // policyCorpus keys on id:contentHash:base64 (a move to Superseded changes the pointer, not the bytes).
  /rows\.map\(r => `\$\{r\.id\}:\$\{r\.contentHash\}:\$\{r\.base64\}`\)/.test(srv));
ok("one unreadable document does not take the manual down", /could not read \$\{r\.filename\}/.test(srv));

console.log("\nE2. retired documents are excluded by their own pointer, not a filename guess");
// 12 Sep 2026, the second reorganisation of the day: the nineteen numbered policy files
// were retired for real, moved to vault/GENERAL/Handbooks/Superseded/, and the compiled
// handbooks became the only governing text. The first version of this fix read it
// backwards — it excluded ids under doc-hb-compiled-, which is now exactly wrong. Real
// pointers observed on the NAS after the move, both shapes.
const REAL_SUPERSEDED_POINTERS = [
  "file://GENERAL/Handbooks/Superseded/AnaHon_Accounting_Business_Policy_020.docx",
  "file://GENERAL/Handbooks/Superseded/AnaHon_InternalCodeOfConduct_001.docx",
  "file://GENERAL/Handbooks/Superseded/Anahon_Fact-Checking Policy_005.docx",
  "file://GENERAL/Handbooks/Superseded/Anahon_AI_Policy_022.docx",
  "file://GENERAL/Handbooks/Superseded/Anahon_AntiTerrorismFinancing_Sanctions_AntiCorruption_Policy_013.docx",
  "file://GENERAL/Handbooks/Superseded/Anahon_Sharing Repository Policy_018.docx.superseded-by-010",
];
const REAL_LIVE_POINTERS = [
  "file://GENERAL/Handbooks/AnaHon_Policies_Index.docx",
  "file://GENERAL/Handbooks/AnaHon_Editorial_Standards_Handbook.docx",
  "file://GENERAL/Handbooks/AnaHon_Team_Handbook.docx",
  "file://GENERAL/Handbooks/AnaHon_Finance_and_Controls_Handbook.docx",
  "file://GENERAL/Handbooks/AnaHon_Programmes_and_Funding_Handbook.docx",
  "file://GENERAL/Handbooks/AnaHon_Strategy_007.docx",
];
ok("every retired pointer observed on the NAS is caught",
  REAL_SUPERSEDED_POINTERS.every(isSupersededPointer), REAL_SUPERSEDED_POINTERS.filter(p => !isSupersededPointer(p)).join(", "));
ok("every live pointer observed on the NAS is spared — a folder named Superseded is the only signal, never a filename shape",
  REAL_LIVE_POINTERS.every(p => !isSupersededPointer(p)), REAL_LIVE_POINTERS.filter(isSupersededPointer).join(", "));
// Policy P11 stands alone, outside all five handbooks, and is not itself named "Superseded"
// anywhere in its own filename — the predicate must not be fooled by that.
ok("Policy P11, filed on its own, is not mistaken for something retired",
  !isSupersededPointer("file://GENERAL/Handbooks/AnaHon_Information_Data_and_Source_Privacy_Policy_010.docx"));
// A retired file that happens to sit in a project's own archive elsewhere must not read as
// current just because "Superseded" is not the last folder in the path.
ok("the folder can appear anywhere in the path, not only immediately before the filename",
  isSupersededPointer("file://GENERAL/Handbooks/Superseded/Old/Deep/Policy.docx"));
ok("a document's heading is still readable from its filename",
  policyHeading("AnaHon_Finance_and_Controls_Handbook.docx") === "AnaHon Finance and Controls Handbook");
ok("policyCorpus in server.ts filters by that same exported predicate, not a re-implementation",
  /const live = rows\.filter\(r => !isSupersededPointer\(r\.base64\)\)/.test(srv));

console.log("\nF. what an answer from the manual must do");
// Each of these is a failure seen for real, not a hypothetical.
ok("it must cite the policy by its number", /cite the policy by its number, as it is written in the chapter heading/.test(RULES_FOR_THE_BOT));
ok("the number is what survives even though it no longer names its own file",
  /the number no longer names its own file/.test(RULES_FOR_THE_BOT));
ok("the handbook name may be added, but only in addition to the number, never instead of it",
  /the number is the citation; the handbook name is only ever in addition to it/.test(RULES_FOR_THE_BOT));
// 12 Sep 2026, second time: the editor's note is now part of the live text itself, not a
// separate excerpt beside a numbered original — the instruction has to say that plainly,
// or a flagged conflict gets quoted as if it were the rule.
ok("the editor's note is described as part of the text now, not a separate warning",
  /This is part of the text now, not a separate warning/.test(RULES_FOR_THE_BOT));
ok("a flagged conflict gets the policy's rule first, the flag stated after, in the bot's own words",
  /give the policy's own rule first.*then say plainly, in your own words, that the note flags it as open/s.test(RULES_FOR_THE_BOT));
ok("it is told not to let the note override the rule, or raise one nobody asked about",
  /Do not present the note as if it overrode the rule, and do not raise a note the question did not touch/.test(RULES_FOR_THE_BOT));
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
// Since 16 Sep 2026 (Saad, D5) the help desk is on the paid key, Haiku 4.5 — the free tier's
// daily cap ran out at the desk. safeRows above still strips every record: Anthropic does not
// train on API input, but the projection costs nothing and a fallback to Gemini still happens
// when Claude fails. Per-route models are pinned in check-ai-models.ts.
ok("the help desk asks for Haiku by name", /REPLY_SCHEMA, undefined, "low", "haiku"/.test(server));
ok("asking for the free provider still skips Claude rather than falling through to it",
  /const key = prefer === "gemini" \? undefined : anthropicKey\(\)/.test(server));
const bot = read("../src/HelpDesk.tsx");
ok("the widget opens the door instead of describing it", /onOpenDoor\(turn\.reply!\.door!\)/.test(bot));
// Bare English between JSX tags never reaches t() — the same rule the desk is held to.
const bare = [...bot.matchAll(/(?<![=-])>\s*([^<>{}]*[A-Za-z]{2,}[^<>{}]*?)\s*</g)].map(m => m[1].trim())
  .filter(x => !/[;=()]/.test(x) && !/^[·.:,/\s-]*$/.test(x));
ok("no bare English text nodes in the widget", bare.length === 0, bare.slice(0, 6).join(" | "));

console.log("\nZ. a superseded file is recognised in the browser, where the pointer is blanked (16 Sep 2026)");
// /api/state ships base64 as "" — so isSupersededPointer on a state document is always false and
// every old edition looked live: the Policies door opened a 12 Sep file for P3, P4 and P10.
const serverSrc = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const strips = [...serverSrc.matchAll(/base64: d\.base64\.startsWith\("link:\/\/"\) \? d\.base64 : ""/g)];
const flagged = strips.filter(m => /superseded: isSupersededPointer\(d\.base64\)/.test(serverSrc.slice(m.index!, m.index! + 400)));
ok("every place app state blanks a pointer also sends the real superseded flag", strips.length > 0 && flagged.length === strips.length, `${flagged.length}/${strips.length}`);
ok("a state document flagged superseded is superseded, whatever its blank pointer says", isSupersededDoc({ base64: "", superseded: true }) === true);
ok("a state document flagged live is live", isSupersededDoc({ base64: "", superseded: false }) === false);
ok("a server row with a real pointer still answers from the pointer", isSupersededDoc({ base64: "file://GENERAL/Handbooks/Superseded/x.docx" }) === true && isSupersededDoc({ base64: "file://GENERAL/Handbooks/x.docx" }) === false);

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
