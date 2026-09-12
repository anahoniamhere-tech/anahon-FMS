// Is the mail watcher still read-only, and still the minimum?
//
// The whole value of this feature is what it refuses to do. These checks exist so a later
// edit cannot quietly turn a watcher into a mail client: no send route, no body stored, no
// model ever handed a message, one mailbox, narrow by default, off until asked for.
// Run: npx tsx scripts/check-mail-watcher.ts
import { readFileSync } from "node:fs";
import { RULES, deskItems, type Rule } from "../src/workflow.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const consent = readFileSync(new URL("./google-consent.mjs", import.meta.url), "utf8");
const gates = readFileSync(new URL("../src/gates.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
// The watcher's own block, so a match elsewhere in a 9,000-line file cannot pass a check.
const watcher = server.slice(server.indexOf("// The mail watcher — READ-ONLY."), server.indexOf('app.post("/api/calendar/feed"'));
// The same block with every comment removed. Absence checks must be made against CODE:
// a comment that merely mentions `snippet` must not fail the "never read" check, and must
// not be able to satisfy one either.
const code = watcher.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

console.log("\nread-only, and provably so");
ok("consent asks for gmail.readonly", /auth\/gmail\.readonly/.test(consent));
ok("and for no other gmail scope", !/auth\/gmail\.(send|modify|compose|insert|labels|settings)/.test(consent));
ok("calendar.events is still asked for in the same consent", /auth\/calendar\.events/.test(consent));
ok("the watcher's only Gmail calls are GETs", (() => {
  const talksToGmail = /GMAIL_API\s*=\s*"https:\/\/gmail\.googleapis\.com/.test(code) && /fetch\(/.test(code);
  const anyWriteFetch = /fetch\([^;]*method:\s*["'](POST|PUT|PATCH|DELETE)["']/i.test(code);
  return talksToGmail && !anyWriteFetch;
})(), "a fetch in the watcher carries a write method");
ok("nothing anywhere in the server sends mail", (() => {
  // A real send needs a transport or Gmail's send/drafts endpoints. None may exist.
  const send = /nodemailer|createTransport|smtp\.|sendgrid|mailgun|postmark|ses\.sendEmail|messages\/send|\/drafts\b/i.test(server);
  return !send;
})(), "a send transport or Gmail send/draft endpoint appeared");
ok("no mail route can label, archive, trash or modify", !/(modify|trash|untrash|batchModify|labels)/i.test(code));

console.log("\nthe minimum, and no body");
ok("the fetch asks Google for metadata only", /format=metadata/.test(watcher));
ok("it names the three headers it wants", /metadataHeaders=From/.test(watcher) && /metadataHeaders=Subject/.test(watcher) && /metadataHeaders=Date/.test(watcher));
ok("the snippet Gmail returns is never read", !/\.snippet/.test(code));
ok("no body or attachment field is stored", !/payload\.body|attachmentId|parts\[/.test(code));
ok("the table itself has no body column", (() => {
  const model = schema.slice(schema.indexOf("model MailHit {"), schema.indexOf("}", schema.indexOf("model MailHit {")));
  return !/body|snippet|attachment|content/i.test(model);
})());
ok("it stores sender, subject, date and a link", ["sender:", "subject:", "receivedAt:", "link:"].every(f => watcher.includes(f)));

console.log("\nnothing becomes a record by itself");
ok("the watcher creates only MailHit rows", (() => {
  const creates = [...watcher.matchAll(/prisma\.(\w+)\.(create|upsert|createMany)/g)].map(m => m[1]);
  return creates.length > 0 && creates.every(m => m === "mailHit");
})(), "it writes to a table other than MailHit");
ok("settling a row only closes it", /status: "Done"/.test(watcher) && !/prisma\.(project|expense|donor|opportunity|networkContact|vendor)\./i.test(watcher));

console.log("\nno model ever sees the mail");
ok("the watcher calls no AI", !/gemini|anthropic|openai|generateContent|claude/i.test(code));

console.log("\nnarrow, and off until asked for");
ok("the query comes from configuration", /process\.env\.MAIL_WATCH_QUERY/.test(watcher));
ok("no query means no poll", /if \(!mailQuery\(\)\) return;/.test(watcher));
ok("the poll route refuses while unset", /No mail query is set/.test(watcher));
ok("one mailbox only — the connected account's own", /users\/me/.test(watcher) && !/users\/(?!me)[a-z]/.test(watcher));
ok("a schedule, not a new scheduler", /setInterval\(mailWatchTick/.test(watcher) && /MAIL_WATCH_EVERY_MIN/.test(watcher));

console.log("\nit never goes quiet");
ok("a failed poll writes a desk row", /mailWatchUnknown/.test(watcher) && /cannot see the mailbox/.test(watcher));
ok("one health row a day, not one per poll", /watcher-error-\$\{day\}|watcher-error-/.test(watcher) && /upsert/.test(watcher));
ok("seeing the mailbox again clears them", /kind: "watcher", status: "Pending" \}, data: \{ status: "Done" \}/.test(watcher));
ok("every poll is audited, success or failure", /"Mail Checked"/.test(watcher) && /"Mail Check Failed"/.test(watcher));

console.log("\ndedup and routing");
ok("Gmail's message id is the dedup key", /@unique/.test(schema.slice(schema.indexOf("model MailHit {"), schema.indexOf("}", schema.indexOf("model MailHit {")))) && /findUnique\(\{ where: \{ messageId/.test(watcher));
ok("a known message is skipped, not doubled", /if \(already\) \{ skipped\+\+; continue; \}/.test(watcher));
ok("it routes to a person, never an agent", /mailAssignee/.test(watcher) && /Super Admin/.test(watcher));

console.log("\nthe routes are gated");
ok("both mail routes are declared", /"\/api\/mail\/poll":/.test(gates) && /"\/api\/mail\/settle":/.test(gates));
ok("polling is a director's", /"\/api\/mail\/poll": DIRECTORS/.test(gates));

console.log("\nthe desk rule handed to Home & desk actually works");
{
  // The one line they add. Proved here against the real engine so the handoff is not a guess.
  const proposed: Rule = {
    kind: "mailHits" as any, status: "Pending", seat: ["Super Admin", "Program Director"],
    person: "assigneeUserId", when: "receivedAt", door: "mydesk", verb: "Look at this mail",
  };
  const before = deskItems({ id: "u-1", email: "a@b.c", role: "Super Admin" },
    { mailHits: [{ id: "mail-x", status: "Pending", assigneeUserId: "u-1", receivedAt: "2026-09-12", subject: "Test", sender: "x@y.z" }] } as any, "2026-09-12");
  ok("without the rule, a MailHit is on nobody's desk", before.length === 0);
  RULES.push(proposed);                                   // this process only; workflow.ts is untouched
  try {
    const rows = deskItems({ id: "u-1", email: "a@b.c", role: "Super Admin" },
      { mailHits: [{ id: "mail-x", status: "Pending", assigneeUserId: "u-1", receivedAt: "2026-09-12", subject: "Test", sender: "x@y.z" }] } as any, "2026-09-12");
    ok("with it, the row lands on the named person's desk", rows.length === 1 && rows[0].group === "mine", JSON.stringify(rows));
    ok("and it opens My Desk", rows[0]?.door === "mydesk");
    const other = deskItems({ id: "u-9", email: "z@z.z", role: "Finance Officer" },
      { mailHits: [{ id: "mail-x", status: "Pending", assigneeUserId: "u-1", receivedAt: "2026-09-12", subject: "Test", sender: "x@y.z" }] } as any, "2026-09-12");
    ok("and nobody else's", other.every(r => r.group !== "mine"));
  } finally { RULES.pop(); }
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
