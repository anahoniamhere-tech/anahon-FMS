// Does every approval say who took it, and in which seat?
//
// Phase 7 (5 Sep 2026). A voucher used to carry the moment it was signed but not the
// signer: the name survived only in the audit log and in a comment's author, and a
// timesheet's approvedBy held a display name, a user id, or nothing, depending on the
// route. Run: npx tsx scripts/check-approver.ts
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const types = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
/** A model body, brace-balanced — ContentItem carries `@@index` blocks that a naive slice cuts short. */
const model = (n: string) => {
  const i = schema.indexOf(`model ${n} {`);
  let d = 0; const j = schema.indexOf("{", i);
  for (let k = j; k < schema.length; k++) {
    if (schema[k] === "{") d++;
    if (schema[k] === "}" && --d === 0) return schema.slice(j + 1, k);
  }
  throw new Error(n);
};

console.log("\nthe columns exist where a decision is taken");
for (const [m, cols] of [
  ["Expense", ["approvedById", "approvedAs", "paidById", "paidAs", "postedById", "postedAs"]],
  ["Procurement", ["approvedById", "approvedAs"]],
  ["Timesheet", ["approvedById", "approvedAs"]],
  ["ContentItem", ["pmApprovedAs", "pdApprovedAs"]],
] as [string, string[]][]) {
  const body = model(m);
  const missing = cols.filter(c => !new RegExp(`\\b${c}\\b`).test(body));
  ok(`${m}: ${cols.length} column(s)`, missing.length === 0, missing.join(","));
}
ok("the browser is told about them too", ["approvedById", "approvedAs", "paidById", "postedById", "pmApprovedAs", "pdApprovedAs"].every(c => types.includes(c)));

console.log("\nevery step signs itself");
ok("one helper writes the signature", /function actor\(user: any\) \{\s*\n\s*return \{ id: String\(user\?\.id \|\| ""\), as: stampActingAs\(\) \};/.test(server));
ok("approve", /signed = \{ \.\.\.signed, approvedById: me\.id, approvedAs: me\.as \}/.test(server));
ok("pay", /signed = \{ \.\.\.signed, paidById: me\.id, paidAs: me\.as \}/.test(server));
ok("post to the ledger", /signed = \{ \.\.\.signed, postedById: me\.id, postedAs: me\.as \}/.test(server));
ok("the signature reaches the row", /approved_at: approvedAt,\s*\n\s*paid_at: paidAt,\s*\n\s*\.\.\.signed,/.test(server));
ok("a direct petty-cash entry signs all three at once", /approvedById: actor\(user\)\.id[\s\S]{0,200}paidById: actor\(user\)\.id[\s\S]{0,200}postedById: actor\(user\)\.id/.test(server));
ok("procurement", /approvedBy: user\?\.name \|\| "", approvedById: actor\(user\)\.id, approvedAs: actor\(user\)\.as/.test(server));
ok("timesheet", /approvedById: actor\(user\)\.id,\s*\n\s*approvedAs: actor\(user\)\.as/.test(server));
ok("both content slots", /pmApprovedAs: actor\(user\)\.as/.test(server) && /pdApprovedAs: actor\(user\)\.as/.test(server));
ok("returning a piece clears the seats with the approvals", /pmApprovedAs: null[\s\S]{0,80}pdApprovedAs: null/.test(server));

console.log("\nthe seat is the one that was worn, not the person's own");
ok("it comes from the acting context", server.includes("as: stampActingAs()"));
ok("standing in is what stampActingAs records", readFileSync(new URL("../src/auditContext.ts", import.meta.url), "utf8").includes("export function stampActingAs"));

console.log("\na person can read it");
ok("the voucher drawer shows who took each step", /\{ts && <p className="mt-0\.5 text-\[9px\] leading-tight text-slate-500">\{who \|\| "not recorded"\}<\/p>\}/.test(app));
ok("a stand-in reads as one person in two hats", /return as \? `\$\{who\}, as \$\{as\}` : who;/.test(app));
ok("an unsigned older voucher says so rather than inventing a name", app.includes('"not recorded"'));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
