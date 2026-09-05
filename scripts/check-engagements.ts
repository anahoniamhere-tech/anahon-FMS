// Does the events register hold what it claims, and stay out of the way when it should?
//
// Added 5 Sep 2026. An event used to exist only as free text repeated on each contact —
// no dates, no cost, no record of what came of it, and training we delivered lived
// somewhere else entirely. Run: npx tsx scripts/check-engagements.ts
import { readFileSync } from "node:fs";
import { ENGAGEMENT_KINDS, ENGAGEMENT_PARTS, CONTACT_KINDS, STREAMS } from "../src/constants.js";
import { ROUTE_SEATS, mayCall } from "../src/gates.js";
import { CONTACT_EDITORS, CREW, AUDITOR, SELF } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const types = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");
const tab = readFileSync(new URL("../src/tabs/NetworkTab.tsx", import.meta.url), "utf8");
const model = schema.slice(schema.indexOf("model Engagement {"), schema.indexOf("}", schema.indexOf("model Engagement {")));

console.log("\nthe record holds what an event actually is");
for (const f of ["title", "kind", "ourPart", "org", "place", "startDate", "endDate", "stream", "projectId", "outcome", "notes"]) {
  ok(`Engagement.${f}`, new RegExp(`\\b${f}\\b`).test(model));
}
ok("a project is optional — most belong to none", /projectId\s+String\?/.test(model));
ok("and indexed both ways it will be read", /@@index\(\[startDate\]\)/.test(schema) && /@@index\(\[projectId\]\)/.test(schema));
ok("a contact can point at one", /engagementId String\?/.test(schema) && types.includes("engagementId?: string;"));
ok("the browser is told about the register", /engagements: Engagement\[\];/.test(types));

console.log("\none register, both directions");
ok("attended and delivered are the same shape", ENGAGEMENT_PARTS.includes("Attended") && ENGAGEMENT_PARTS.includes("Delivered"));
ok("co-hosted and sponsored too", ENGAGEMENT_PARTS.includes("Co-hosted") && ENGAGEMENT_PARTS.includes("Sponsored"));
ok("a coaching session is a kind", ENGAGEMENT_KINDS.includes("Coaching") && ENGAGEMENT_KINDS.includes("Training"));
ok("coaches and partners are people we can describe", CONTACT_KINDS.includes("Coach") && CONTACT_KINDS.includes("Partner"));
ok("trainers still are", CONTACT_KINDS.includes("Trainer"));

console.log("\nthe routes are honest about what they accept");
ok("a nameless engagement is refused", /The engagement needs a name\./.test(server));
ok("a kind or part nobody wrote down is refused", /Unknown kind: \$\{b\.kind\}/.test(server) && /Unknown part: \$\{b\.ourPart\}/.test(server));
ok("dates are checked, and so is their order", /Dates are YYYY-MM-DD\./.test(server) && /It cannot end before it starts\./.test(server));
ok("a project that does not exist is refused", /That project does not exist\./.test(server));
ok("removing an event keeps the people met there", /updateMany\(\{ where: \{ engagementId: eng\.id \}, data: \{ engagementId: null \} \}\)/.test(server));
ok("both writes are audited", /"Engagement Added"/.test(server) && /"Engagement Removed"/.test(server));

console.log("\nwho may touch it");
ok("the same seats that keep the contacts", ROUTE_SEATS["/api/engagements/save"] === CONTACT_EDITORS && ROUTE_SEATS["/api/engagements/delete"] === CONTACT_EDITORS);
ok("the crew may not", CREW.every(r => !mayCall("/api/engagements/save", r)));
ok("the auditor may not", !mayCall("/api/engagements/save", AUDITOR));
ok("a self-service account may not", !mayCall("/api/engagements/save", SELF));
ok("the operational seats are sent them", /networkContacts, engagements, tools,/.test(server));
ok("and so is the full view", /networkContacts,\n(\s*\/\/[^\n]*\n)*\s*engagements,/.test(server));
ok("they are read from the database at all", /prisma\.engagement\.findMany/.test(server));
ok("the seats that get no contacts get no events either", /networkContacts: \[\], engagements: \[\], tools: \[\]/.test(server));

console.log("\nwhat the screen does with it");
ok("the event is chosen, not retyped", /value=\{form\.engagementId\}/.test(tab));
ok("but a meeting with no record can still be labelled", /not from a recorded event/.test(tab) && /…or type where/.test(tab));
ok("a contact shows whichever name applies", /const whereMet = /.test(tab) && /\{whereMet\(c\) \|\| "—"\}/.test(tab));
ok("an event with no project says so plainly", /no project/.test(tab));
ok("and the people met there are one click away", /met here/.test(tab));
ok("the programmes come from the shared list", tab.includes("STREAMS.map") && STREAMS.length === 6);

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
