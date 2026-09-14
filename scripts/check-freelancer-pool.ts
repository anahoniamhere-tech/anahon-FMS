// The freelancer pool — people AnaHon may engage but has no contract with yet.
//
// 14 Sep 2026 (People, on a Front desk request). What can go quietly wrong is privacy, not
// function: a CV or a stranger's phone number and day rate reaching a seat that should only
// know the person exists. So this pins the two tiers, that the server cuts the data rather
// than the browser hiding it, that a CV linked to a pool entry stays with the personnel-file
// holders on every path, and that the pool does not quietly grow Buying & paying's flow.
// Run: npx tsx scripts/check-freelancer-pool.ts
import { readFileSync } from "node:fs";
import { poolViewFor, POOL_SUMMARY_FIELDS, maySeePersonnelFile, filterPersonnelDocs } from "../src/personnelDocs.js";
import { PERSONNEL_FILE, MANAGERS } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const server = read("server.ts"), gates = read("src/gates.ts"), ui = read("src/tabs/FreelancerPool.tsx");
const schema = read("prisma/schema.prisma");

console.log("\nA. who sees what");
ok("HR / Payroll sees whole entries", poolViewFor("HR / Payroll Officer") === "full");
ok("the Programme Director seat sees whole entries", poolViewFor("Program Director") === "full");
ok("the master account sees whole entries", poolViewFor("Super Admin") === "full");
// The request: "Managers may see name and skills". Finance is a manager and not a file holder.
ok("the Finance Officer sees name and skills only", poolViewFor("Finance Officer") === "summary");
for (const r of ["Project Lead", "Auditor / Read-Only Reviewer", "Project Officer",
  "Procurement and Logistics Officer", "Digital Officer", "Employee (Self-Service)", "Reporter"]) {
  ok(`${r} sees nothing`, poolViewFor(r) === null);
}
ok("every personnel-file role is a full viewer", PERSONNEL_FILE.every(r => poolViewFor(r) === "full"));
ok("every manager can at least see who is in the pool", MANAGERS.every(r => poolViewFor(r) !== null));
ok("a summary is exactly id, name and skills — nothing else leaks with it",
  JSON.stringify([...POOL_SUMMARY_FIELDS].sort()) === JSON.stringify(["id", "name", "skills"]));

console.log("\nB. the server cuts the data; the browser does not hide it");
ok("loadState asks the one rule", /const tier = poolViewFor\(viewer\?\.role\);/.test(server));
ok("a summary viewer is sent only the summary fields",
  /tier === "summary"\) return poolRows\.map\(c => Object\.fromEntries\(POOL_SUMMARY_FIELDS/.test(server));
ok("anyone else in the full branch — a Project Lead, the auditor — is sent none", /return \[\];\s*\}\)\(\),/.test(server));
ok("every restricted branch sends an empty pool",
  (server.match(/poolCandidates: \[\]/g) || []).length >= 4, String((server.match(/poolCandidates: \[\]/g) || []).length));
// The Contacts door belongs to PLO and Digital; the pool must not ride along with it.
ok("the PLO/Digital branch, which gets contacts whole, still gets no pool",
  /networkContacts, engagements, tools,\s*\n\s*poolCandidates: \[\]/.test(server));
ok("poolRows leave the server in exactly one place", (server.match(/poolRows/g) || []).length === 3,
  String((server.match(/poolRows/g) || []).length));

console.log("\nC. a CV linked to a pool entry stays with the file holders — on every path");
const EMPLOYEES = [{ id: "emp-1", userEmail: "saad@anahon.org" }, { id: "emp-2", userEmail: "anahonleb@gmail.com" }];
const cv = { partyId: "pool-1", category: "CV" };
const who = (role: string, email = "x@anahon.org") => ({ role, email });
ok("HR opens it", maySeePersonnelFile(who("HR / Payroll Officer"), EMPLOYEES, cv.partyId, cv.category));
ok("the Programme Director opens it", maySeePersonnelFile(who("Program Director"), EMPLOYEES, cv.partyId, cv.category));
ok("Finance does not — a manager sees the name, never the CV",
  !maySeePersonnelFile(who("Finance Officer"), EMPLOYEES, cv.partyId, cv.category));
ok("nor a Project Lead", !maySeePersonnelFile(who("Project Lead"), EMPLOYEES, cv.partyId, cv.category));
// The linking choice rests on this: no employee can ever own a pool id, so the "your own file"
// branch of the rule can never open a pool CV for somebody who merely shares an email.
ok("a pool id is never mistaken for someone's own file",
  !maySeePersonnelFile(who("Employee (Self-Service)", "saad@anahon.org"), EMPLOYEES, "pool-1", "CV"));
ok("the state filter drops it for Finance", filterPersonnelDocs([cv as any], who("Finance Officer"), EMPLOYEES).length === 0);
ok("and keeps it for HR", filterPersonnelDocs([cv as any], who("HR / Payroll Officer"), EMPLOYEES).length === 1);
ok("the byte route asks the same rule, so a guessed URL fails too",
  /async function personnelBlocked[\s\S]{0,400}maySeePersonnelFile\(viewer, employees, doc\.partyId, doc\.category\)/.test(server));
ok("uploading into a pool entry is gated by the same rule",
  /const personnel = isPersonnelDoc\(\{ category \}\);[\s\S]{0,300}maySeePersonnelFile\(user, employees, partyId\)/.test(server));
ok("a pool CV is filed under PERSONNEL/Freelancer Pool/<name>, beside the first ones",
  server.includes('path.join("PERSONNEL", "Freelancer Pool", pool.name'));

console.log("\nD. writing the pool");
ok("save and delete are gated to the personnel-file roles",
  gates.includes('"/api/pool/save": PERSONNEL_FILE') && gates.includes('"/api/pool/delete": PERSONNEL_FILE'));
ok("and the routes enforce it themselves",
  (server.match(/if \(poolViewFor\(user\?\.role\) !== "full"\)/g) || []).length === 2);
ok("status is one of the three the request named", server.includes('const POOL_STATUSES = ["Prospect", "Worked with us", "Not a fit"];'));
ok("a phone must be full international form", /\/api\/pool\/save[\s\S]{0,1200}\^\\\+\[1-9\]\\d\{7,14\}\$/.test(server));
// A blank rate stored as 0 would read as someone who works for free.
ok("a blank day rate is stored as null, never 0", server.includes('const rate = rateRaw === "" ? null : Number(rateRaw);')
  && /dayRate\s+Float\?/.test(schema));
ok("the audit line carries name and status, never contact or rate",
  /Freelancer pool: \$\{row\.name\} — \$\{row\.status\}/.test(server) && !/Freelancer pool:[^`]*\$\{row\.(phone|email|dayRate)\}/.test(server));
ok("removal needs a reason (personal data about someone never contracted)", server.includes("Say why the entry is being removed."));
ok("removal KEEPS the CVs — it unlinks them, it never deletes a document",
  /appDoc\.updateMany\(\{ where: \{ partyId: id \}, data: \{ partyId: null \} \}\)/.test(server)
  && !/\/api\/pool\/delete[\s\S]{0,1500}appDoc\.delete/.test(server));

console.log("\nE. the pool does not grow Buying & paying's flow");
const poolRoutes = (server.match(/app\.post\("\/api\/pool\/[\s\S]*?\n\}\);/g) || []).join("\n");
ok("no pool route creates a supplier", !/prisma\.vendor\.(create|update|upsert)/.test(poolRoutes));
ok("no pool route drafts a contract", !/contractHtml|contracts\/generate|archive\(/.test(poolRoutes));
ok("the screen offers no 'make supplier' or 'draw agreement' action",
  !/vendors\/new|contracts\/generate|engageable/i.test(ui));
ok("and it tells the reader where that happens instead", ui.includes("is done in Buying & paying, not here"));

console.log("\nF. why a table of its own");
// Recorded so the choice is not quietly reversed: both existing records were checked first.
ok("it is its own model, not NetworkContact or Vendor", /model PoolCandidate \{/.test(schema)
  && !/poolCandidate|freelancer/i.test((schema.match(/model NetworkContact \{[\s\S]*?\n\}/) || [""])[0])
  && !/poolCandidate|freelancer/i.test((schema.match(/model Vendor \{[\s\S]*?\n\}/) || [""])[0]));
ok("the migration says why neither existing record was used",
  read("prisma/migrations/20260914180000_freelancer_pool/migration.sql").includes("Not NetworkContact")
  && read("prisma/migrations/20260914180000_freelancer_pool/migration.sql").includes("Not Vendor"));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
