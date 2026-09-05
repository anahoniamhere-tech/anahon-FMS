// Does the help desk answer for the right person, and does it keep the records at home?
//
// 5 Sep 2026. The bot hands the model the whole corpus in one prompt, and with it the
// asker's own desk rows. The provider is the Gemini free tier, where Google trains on
// what is submitted — so the one thing that must never regress is the projection: a row
// goes out as kind/status/verb/door/date and nothing else. This check builds a prompt
// from a record stuffed with things that must not travel and greps for every one.
// Run: npx tsx scripts/check-helpbot.ts
import { readFileSync } from "node:fs";
import { corpus, helpPrompt, safeRows, parseReply, doorsFor, RULES_FOR_THE_BOT } from "../src/helpBot.js";
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

console.log("\nE. the route");
const server = read("../server.ts");
ok("the route reads the role in force, not the account's own",
  /const role = String\(req\.body\?\.user\?\.role \|\| viewer\.role\)/.test(server));
ok("the desk is read as that role", /deskItems\(\{ id: viewer\.id, email: viewer\.email, role \}/.test(server));
ok("only safeRows reaches the prompt", /rows = safeRows\(deskItems\(/.test(server));
ok("the reply is validated against the asker's doors", /parseReply\(raw, doors\)/.test(server));
ok("it says so instead of failing when no key is set", /The help desk needs an AI key/.test(server));
ok("the route is gated", '/api/help/ask' in ROUTE_SEATS);
const bot = read("../src/HelpDesk.tsx");
ok("the widget opens the door instead of describing it", /onOpenDoor\(turn\.reply!\.door!\)/.test(bot));
// Bare English between JSX tags never reaches t() — the same rule the desk is held to.
const bare = [...bot.matchAll(/(?<![=-])>\s*([^<>{}]*[A-Za-z]{2,}[^<>{}]*?)\s*</g)].map(m => m[1].trim())
  .filter(x => !/[;=()]/.test(x) && !/^[·.:,/\s-]*$/.test(x));
ok("no bare English text nodes in the widget", bare.length === 0, bare.slice(0, 6).join(" | "));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
