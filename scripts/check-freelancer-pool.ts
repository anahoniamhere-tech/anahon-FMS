// The freelancer pool, split by field — who sees whose personal data and CVs.
//
// 14 Sep 2026 (People, on Saad's decisions relayed by the Front desk). Each field is assessed by
// the head whose TOR covers it: Editorial by the Chief Editor, Production by the Production
// Manager; a person may be in both; status and assessment live per field. What goes wrong here is
// privacy, and it goes wrong quietly: a head receiving the other field's people or its judgement,
// a CV reaching a seat by a path the state filter never sees, or the pool growing Buying & paying's
// flow. The cut and the CV rule are pure functions, so most of this is behaviour, not source-grep.
// Run: npx tsx scripts/check-freelancer-pool.ts
import { readFileSync } from "node:fs";
import {
  poolViewFor, cutPoolFor, mayEditPool, mayAssess, mayRemoveFromPool, poolFieldsWritableBy,
  maySeePersonnelFile, filterPersonnelDocs, POOL_FIELDS, POOL_SUMMARY_FIELDS, poolHeadSeat, poolAssessedAs,
} from "../src/personnelDocs.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const server = read("server.ts"), gates = read("src/gates.ts"), ui = read("src/tabs/FreelancerPool.tsx");

// ── fixtures ────────────────────────────────────────────────────────────────────────────────
const ROWS = [
  { id: "pool-ed", name: "Editor Only", skills: "Fact-checker", phone: "+9613000001", dayRate: 80, notes: "n1" },
  { id: "pool-pr", name: "Rasha Kayali", skills: "Producer, filmmaker", phone: "+971500000002", dayRate: 150, notes: "n2" },
  { id: "pool-both", name: "Both Fields", skills: "Writer, editor", phone: "+9613000003", dayRate: 100, notes: "n3" },
];
const ASSESS = [
  { candidateId: "pool-ed", field: "Editorial", status: "Worked with us", note: "sharp" },
  { candidateId: "pool-pr", field: "Production", status: "Prospect", note: "" },
  { candidateId: "pool-both", field: "Editorial", status: "Prospect", note: "EDITORIAL-JUDGEMENT" },
  { candidateId: "pool-both", field: "Production", status: "Not a fit", note: "PRODUCTION-JUDGEMENT" },
];
const ids = (xs: any[]) => xs.map(x => x.id).sort().join(",");
const fieldsOf = (id: string) => ASSESS.filter(a => a.candidateId === id).map(a => a.field);

console.log("\nA. the role keys, and what each seat's view is");
ok("the Editorial head is the role key \"Chief Editor\"", POOL_FIELDS.find(f => f.key === "Editorial")!.head === "Chief Editor");
ok("the Production head is the role key \"Production Manager\"", POOL_FIELDS.find(f => f.key === "Production")!.head === "Production Manager");
ok("the Chief Editor's view is Editorial only", JSON.stringify(poolViewFor("Chief Editor")) === JSON.stringify({ kind: "fields", fields: ["Editorial"] }));
ok("the Production Manager's view is Production only", JSON.stringify(poolViewFor("Production Manager")) === JSON.stringify({ kind: "fields", fields: ["Production"] }));
for (const r of ["Super Admin", "HR / Payroll Officer", "Program Director"]) ok(`${r} sees every field`, poolViewFor(r)?.kind === "all");
ok("the Finance Officer is a summary viewer", poolViewFor("Finance Officer")?.kind === "summary");
for (const r of ["Project Lead", "Auditor / Read-Only Reviewer", "Project Officer", "Procurement and Logistics Officer",
  "Digital Officer", "Employee (Self-Service)", "Reporter", "Content Creator", "Graphic Designer"]) {
  ok(`${r} sees nothing`, poolViewFor(r) === null);
}
// "Program Director" is the Executive Director's permission key and must never be renamed.
ok("the Executive Director is still the key \"Program Director\"", read("src/roles.ts").includes('"Program Director"'));

console.log("\nB. the cut — what each seat is actually sent");
const ce = cutPoolFor("Chief Editor", ROWS, ASSESS);
const pm = cutPoolFor("Production Manager", ROWS, ASSESS);
ok("the Chief Editor receives Editorial people only", ids(ce) === "pool-both,pool-ed", ids(ce));
ok("the Production Manager receives Production people only", ids(pm) === "pool-both,pool-pr", ids(pm));
ok("a Production-only person is not in the Chief Editor's payload at all", !ce.some(c => c.id === "pool-pr"));
ok("an Editorial-only person is not in the Production Manager's payload at all", !pm.some(c => c.id === "pool-ed"));
// The part that is easy to get wrong: a dual-field person, sent to both, must carry only one judgement.
const ceBoth = ce.find(c => c.id === "pool-both"), pmBoth = pm.find(c => c.id === "pool-both");
ok("a dual-field person reaches the Chief Editor with ONLY the Editorial assessment",
  ceBoth.assessments.length === 1 && ceBoth.assessments[0].field === "Editorial");
ok("and reaches the Production Manager with ONLY the Production assessment",
  pmBoth.assessments.length === 1 && pmBoth.assessments[0].field === "Production");
ok("the other field's note never appears anywhere in a head's payload",
  !JSON.stringify(ce).includes("PRODUCTION-JUDGEMENT") && !JSON.stringify(pm).includes("EDITORIAL-JUDGEMENT"));
ok("a head receives the whole entry of their own people — contact, rate, notes",
  ce.find(c => c.id === "pool-ed").phone === "+9613000001" && ce.find(c => c.id === "pool-ed").dayRate === 80);
const all = cutPoolFor("HR / Payroll Officer", ROWS, ASSESS);
ok("HR receives everyone, with both fields' assessments", ids(all) === "pool-both,pool-ed,pool-pr"
  && all.find(c => c.id === "pool-both").assessments.length === 2);
const fin = cutPoolFor("Finance Officer", ROWS, ASSESS);
ok("Finance receives everyone as id, name and skills — nothing else",
  fin.length === 3 && fin.every(c => JSON.stringify(Object.keys(c).sort()) === JSON.stringify(["id", "name", "skills"])));
ok("Finance receives no status and no assessment (it does not assess freelancers)",
  !JSON.stringify(fin).match(/Prospect|Worked with us|Not a fit|assessments|JUDGEMENT/));
ok("the summary fields are exactly id, name, skills", JSON.stringify([...POOL_SUMMARY_FIELDS].sort()) === JSON.stringify(["id", "name", "skills"]));
ok("a reporter receives nothing", cutPoolFor("Reporter", ROWS, ASSESS).length === 0);

console.log("\nC. a CV reaches a head only for their own field — on every path");
const EMP = [{ id: "emp-1", userEmail: "saad@anahon.org" }];
const who = (role: string, email = "x@anahon.org") => ({ role, email });
const cvOf = (partyId: string) => [who("Chief Editor"), EMP, partyId, "CV", fieldsOf] as const;
ok("the Chief Editor opens an Editorial person's CV", maySeePersonnelFile(...cvOf("pool-ed")));
ok("the Chief Editor does NOT open a Production person's CV", !maySeePersonnelFile(...cvOf("pool-pr")));
ok("the Production Manager opens Rasha's CV", maySeePersonnelFile(who("Production Manager"), EMP, "pool-pr", "CV", fieldsOf));
ok("the Production Manager does NOT open an Editorial person's CV", !maySeePersonnelFile(who("Production Manager"), EMP, "pool-ed", "CV", fieldsOf));
ok("both heads open a dual-field person's CV — a CV is about the person, not the field",
  maySeePersonnelFile(who("Chief Editor"), EMP, "pool-both", "CV", fieldsOf) && maySeePersonnelFile(who("Production Manager"), EMP, "pool-both", "CV", fieldsOf));
// The third way in must not become a back door into anyone's real personnel file.
ok("a head cannot open an EMPLOYEE's papers through it", !maySeePersonnelFile(who("Chief Editor"), EMP, "emp-1", "Passport", fieldsOf)
  && !maySeePersonnelFile(who("Chief Editor"), EMP, "emp-1", "CV", fieldsOf));
ok("a head cannot open a non-CV personnel paper even for their own pool person",
  !maySeePersonnelFile(who("Chief Editor"), EMP, "pool-ed", "Passport", fieldsOf));
ok("without the pool answer the old two-way rule is unchanged — a head sees no CV",
  !maySeePersonnelFile(who("Chief Editor"), EMP, "pool-ed", "CV"));
ok("Finance never opens a pool CV", !maySeePersonnelFile(who("Finance Officer"), EMP, "pool-pr", "CV", fieldsOf));
ok("a reporter never opens a pool CV", !maySeePersonnelFile(who("Reporter"), EMP, "pool-ed", "CV", fieldsOf));
ok("HR still opens every pool CV", ["pool-ed", "pool-pr", "pool-both"].every(p => maySeePersonnelFile(who("HR / Payroll Officer"), EMP, p, "CV", fieldsOf)));
const cvs = [{ partyId: "pool-ed", category: "CV" }, { partyId: "pool-pr", category: "CV" }, { partyId: "pool-both", category: "CV" }];
ok("the state filter gives the Chief Editor exactly their field's CVs",
  filterPersonnelDocs(cvs as any, who("Chief Editor"), EMP, fieldsOf).map(d => d.partyId).sort().join(",") === "pool-both,pool-ed");
ok("the byte route asks the same rule with the pool answer, so a guessed URL fails too",
  /async function personnelBlocked[\s\S]{0,700}maySeePersonnelFile\(viewer, employees, doc\.partyId, doc\.category, \(\) => fields\)/.test(server));
ok("the upload gate asks it too, with the category", /maySeePersonnelFile\(user, employees, partyId, category, \(\) => uploadPoolFields\)/.test(server));

console.log("\nD. loadState applies the one cut in every branch that can send it");
ok("the cut is the shared pure function", /const poolFor = \(v: any\) => cutPoolFor\(v\?\.role, poolRows, poolAssessments\);/.test(server));
ok("the full branch uses it", /poolCandidates: poolFor\(viewer\),\s+\/\/ all for the file holders/.test(server));
ok("the editors' branch uses it — and so field heads receive their pool", /tools: \[\], poolCandidates: poolFor\(viewer\),/.test(server));
ok("the editors' branch sends only pool CVs the rule allows, where it used to send no documents",
  /documents: poolCvsFor\(viewer\)/.test(server) && /documents\.filter\(d => d\.category === "CV" && d\.partyId && poolRows\.some/.test(server));
ok("every other restricted branch still sends an empty pool", (server.match(/poolCandidates: \[\]/g) || []).length >= 3,
  String((server.match(/poolCandidates: \[\]/g) || []).length));

console.log("\nE. who may write");
for (const r of ["Chief Editor", "Production Manager", "Program Director", "Super Admin"]) ok(`${r} may add and edit entries`, mayEditPool(r));
ok("HR may NOT edit — it sees everything and edits nothing (Saad, 14 Sep)", !mayEditPool("HR / Payroll Officer"));
ok("Finance may not edit", !mayEditPool("Finance Officer"));
ok("the Chief Editor assesses Editorial", mayAssess("Chief Editor", "Editorial"));
ok("the Chief Editor may NOT assess Production", !mayAssess("Chief Editor", "Production"));
ok("the Production Manager may NOT assess Editorial", !mayAssess("Production Manager", "Editorial"));
ok("the Executive Director assesses both", mayAssess("Program Director", "Editorial") && mayAssess("Program Director", "Production"));
ok("the master account, standing in for the vacant seat, assesses both", mayAssess("Super Admin", "Editorial") && mayAssess("Super Admin", "Production"));
ok("HR assesses neither", !mayAssess("HR / Payroll Officer", "Editorial") && !mayAssess("HR / Payroll Officer", "Production"));
ok("a head may place people only in their own field", JSON.stringify(poolFieldsWritableBy("Chief Editor")) === '["Editorial"]');
ok("removing a person — both fields — is the Executive Director's alone",
  mayRemoveFromPool("Program Director") && mayRemoveFromPool("Super Admin") && !mayRemoveFromPool("Chief Editor") && !mayRemoveFromPool("HR / Payroll Officer"));
ok("gates.ts matches: save/assess to the heads and the Executive Director, delete to the Executive Director",
  gates.includes('"/api/pool/assess": ["Super Admin", "Program Director", "Chief Editor", "Production Manager"]')
  && gates.includes('"/api/pool/delete": ["Super Admin", "Program Director"]'));
// Restricted seats have an allowlist too; without this a real Chief Editor could not save at all.
ok("the editors' POST allowlist admits the pool routes", /const EDITOR_ALLOWED_POSTS = new Set\(\[\n\s*"\/api\/pool\/save", "\/api\/pool\/assess"/.test(server));
ok("a head editing someone outside their field is refused", server.includes("That person is not in a field you head."));
ok("a head placing someone in the other field is refused", server.includes("that field has its own head."));
ok("the rating is a whole number 1–5 or blank", server.includes("A rating is a whole number from 1 to 5, or left blank."));
ok("the seat worn is written on the assessment, so a stand-in is on the record as one",
  server.includes("assessedAs: seat,") && poolAssessedAs({ role: "Chief Editor", actingAs: "Chief Editor" }, "Editorial", []) === "Chief Editor (acting)");
ok("the audit line carries field and status, never the note or rating",
  /Pool Assessment Set[\s\S]{0,200}in \$\{field\} — \$\{st\}/.test(server) && !/Pool Assessment Set[\s\S]{0,300}\$\{(r|trimmed|note|rating)\}/.test(server));

console.log("\nF. the pool does not grow Buying & paying's flow");
const poolRoutes = (server.match(/app\.post\("\/api\/pool\/[\s\S]*?\n\}\);/g) || []).join("\n");
ok("no pool route creates a supplier", !/prisma\.vendor\.(create|update|upsert)/.test(poolRoutes));
ok("no pool route drafts a contract", !/contractHtml|contracts\/generate/.test(poolRoutes));
ok("the screen offers no make-supplier or draw-agreement action", !/vendors\/new|contracts\/generate|engageable/i.test(ui));
ok("removal keeps CVs — unlinks, never deletes a document",
  /appDoc\.updateMany\(\{ where: \{ partyId: id \}, data: \{ partyId: null \} \}\)/.test(server) && !/\/api\/pool\/delete[\s\S]{0,1500}appDoc\.delete\(/.test(server));

console.log("\nG. the data model");
const mig = read("prisma/migrations/20260914200000_pool_fields/migration.sql");
ok("status and assessment live per (person, field)", /UNIQUE INDEX "PoolAssessment_candidateId_field_key"/.test(mig));
ok("the old single status column is dropped, index first", mig.indexOf('DROP INDEX "PoolCandidate_status_idx"') < mig.indexOf('DROP COLUMN "status"') && mig.includes('DROP COLUMN "status"'));
ok("the screen reads nothing that is no longer there", !/c\.status\b/.test(ui));

console.log("\nH. a vacant head seat is covered by the Executive Director — by vacancy, never by name");
const today = [{ id: "u-1", role: "Super Admin", active: true }, { id: "u-pm1", role: "Production Manager", active: false }];
const hired = [...today, { id: "u-new", role: "Chief Editor", active: true }];
ok("today the Chief Editor seat is vacant", poolHeadSeat("Editorial", today).vacant);
ok("an INACTIVE holder does not fill a seat (same rule as /api/roles/seats)", poolHeadSeat("Production", today).vacant);
ok("the Executive Director's Editorial assessment is recorded as covering the vacant seat",
  poolAssessedAs({ role: "Super Admin" }, "Editorial", today) === "Executive Director, covering the vacant Chief Editor seat");
ok("a Program Director account covers it the same way", poolAssessedAs({ role: "Program Director" }, "Editorial", today).includes("covering the vacant Chief Editor seat"));
ok("the day a Chief Editor is hired the seat is filled — no code change", !poolHeadSeat("Editorial", hired).vacant);
ok("and the Executive Director is then recorded as themselves, not as covering", poolAssessedAs({ role: "Super Admin" }, "Editorial", hired) === "Super Admin");
ok("the hired Chief Editor assesses Editorial with nothing else changed", mayAssess("Chief Editor", "Editorial") && poolAssessedAs({ role: "Chief Editor" }, "Editorial", hired) === "Chief Editor");
ok("a stand-in via Act as is still recorded as acting", poolAssessedAs({ role: "Chief Editor", actingAs: "Chief Editor" }, "Editorial", today) === "Chief Editor (acting)");
ok("no account id decides the cover", !/u-1|Saad/.test(readFileSync(new URL("../src/personnelDocs.ts", import.meta.url), "utf8").match(/export function poolHeadSeat[\s\S]*?\n}\n[\s\S]*?export function poolAssessedAs[\s\S]*?\n}/)![0]));
ok("the assess route reads vacancy from the live accounts", /const seat = poolAssessedAs\(user, field, await prisma\.user\.findMany/.test(server) && server.includes("assessedAs: seat,"));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
