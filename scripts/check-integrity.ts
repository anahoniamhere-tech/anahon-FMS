// Is the integrity register still private, still append-only, still anonymous?
//
// Policy P1 §7 is a promise to whoever raises a concern. These checks exist so a later
// edit cannot quietly break it: no update or delete route may ever appear, the register
// must never enter loadState, only the ED may read it (and not while standing in as
// another seat), and the §7.5 summary must never be able to carry a name.
// Run: npx tsx scripts/check-integrity.ts
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const gates  = readFileSync(new URL("../src/gates.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
// Absence checks must read CODE, never prose: a comment mentioning "delete" must not fail
// the no-delete check, and must not be able to satisfy one either.
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const code = strip(server);

console.log("\nappend-only — §7.1 'cannot be edited or deleted by anyone, including the ED'");
ok("no route can update or delete an entry", !/app\.(post|put|patch|delete)\(\s*["'][^"']*integrity[^"']*(update|edit|delete|remove|amend)/i.test(code));
ok("no update/upsert/delete is ever issued against the register", (() => {
  const writes = [...code.matchAll(/prisma\.integrity(Entry|Line)\.(\w+)/g)].map(m => m[2]);
  return writes.length > 0 && writes.every(w => ["create", "findMany", "findUnique", "findFirst", "count"].includes(w));
})(), "a mutating call appeared");
ok("the entry carries no status column to edit — it is derived from the lines", (() => {
  const model = schema.slice(schema.indexOf("model IntegrityEntry {"), schema.indexOf("}", schema.indexOf("model IntegrityEntry {")));
  return !/\bstatus\b|\bclosedAt\b/.test(model) && /integrityStatus/.test(code);
})());
ok("closing is a line, not a field", /kind === "closed"/.test(code));

console.log("\nprivate — §7.1 'only the ED can open it, and each opening is logged'");
ok("a reader must be Super Admin", /me\.role !== "Super Admin"/.test(code));
ok("and NOT standing in as another seat", /X-Acting-As[\s\S]{0,80}return null/.test(code));
ok("every read route asks integrityReader first", (() => {
  const routes = [...code.matchAll(/app\.get\("\/api\/integrity\/(list|entry\/:id)"[\s\S]{0,220}/g)].map(m => m[0]);
  return routes.length === 2 && routes.every(r => r.includes("integrityReader"));
})());
ok("the register never enters loadState", !/mailHits[\s\S]{0,0}/.test("") && !/integrityEntry\.findMany\(\)[^;]*\n[\s\S]{0,200}return \{/.test(code) && !/\bintegrityEntries:/.test(code));
ok("opening the register is audited", /Integrity register \(list\)/.test(server) && /Integrity register entry/.test(server));
ok("the audit line names the reference, never the concern", (() => {
  const m = code.match(/createAuditLog\([^)]*"Integrity Concern Recorded"[^;]*/);
  return !!m && !/summary/.test(m[0]);
})());
ok("the two write routes are Super-Admin-gated", /"\/api\/integrity\/record": MASTER_ONLY/.test(gates) && /"\/api\/integrity\/line": MASTER_ONLY/.test(gates));

console.log("\nanonymous by default — §6.5");
ok("reporterName defaults to blank", /reporterName\s+String\s+@default\(""\)/.test(schema));
ok("nothing derives a reporter name the person did not give", /reporterName: String\(reporterName \|\| ""\)/.test(code));

console.log("\nthe ED steps back when it touches them — §7.2");
ok("only referred-outside and note remain", /INTEGRITY_KINDS_WHEN_IT_TOUCHES_ED = \["referred-outside", "note"\]/.test(code));
ok("any other kind is refused", /entry\.touchesED && !INTEGRITY_KINDS_WHEN_IT_TOUCHES_ED\.includes/.test(code));
ok("the entry says the next step is to refer it outside", /Refer outside within 5 working days/.test(server));

console.log("\nthe summary cannot carry a name — §7.5");
ok("it selects only category and dates", /integrityEntry\.findMany\(\{ select: \{ id: true, category: true, dateReceived: true \} \}\)/.test(code));
ok("it returns counts and durations only", (() => {
  const m = code.match(/res\.json\(\{\s*\n?\s*total: entries\.length[\s\S]{0,400}?\}\);/);
  // field names, not words: the route's own note legitimately says "summary".
  return !!m && !/\b(summary|peopleConcerned|reporterName|ref)\s*:/.test(m[0]);
})());
ok("finance and the auditor may read it; it is still logged", /INTEGRITY_SUMMARY_READERS/.test(code) && /Integrity summary \(anonymised\)/.test(server));

console.log("\nevidence is as private as the entry");
ok("integrity documents are blocked for everyone but the ED", /async function integrityBlocked/.test(code) && /linkedRecordType \|\| ""\) !== "Integrity"/.test(code));
ok("every document byte route asks it", (() => (code.match(/integrityBlocked\(/g) || []).length >= 4)());
ok("they are kept out of other people's state", /!== "Integrity" \|\| \(viewer && viewer\.role === "Super Admin"\)/.test(code));
ok("only the ED may attach to the register", /linkedRecordType \|\| ""\) === "Integrity" && !integrityReader\(req\)/.test(code));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
