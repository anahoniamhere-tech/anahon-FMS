// Three instruments, and which one a person is actually signing.
//
// 5 Sep 2026 (People). Saad set the model: staff hold a yearly framework contract that pays
// nothing, and every project that funds the role is contracted separately; service providers
// get one agreement and one payment. The failure mode is not a crash — it is a document that
// looks like the wrong instrument, or a subcontract that cites a framework contract nobody
// ever issued. So this renders the documents and reads them, rather than trusting the
// template. Run: npx tsx scripts/check-contracts.ts
import { readFileSync } from "node:fs";
import { contractHtml, referenceOfContractDoc } from "../docgen.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

const BASE = {
  party: { name: "Sally Kayyali", position: "Graphic Designer", paymentMethod: "Bank Transfer" },
  countersignatory: { name: "Saad Matar", role: "Executive Director" },
  startDate: "2026-02-01", endDate: "2026-06-30", monthlyFee: 0, contractTotal: 0,
  kind: "Employment", project: null, reference: "X",
};
const TRF = { code: "TRF-2026", name: "Trust Fund for Media" };
const doc = (o: any) => contractHtml({ ...BASE, ...o } as any);
const text = (o: any) => doc(o).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const h1 = (o: any) => (doc(o).match(/<h1>([^<]*)<\/h1>/) || [, "?"])[1];

const FRAMEWORK = { reference: "ANH-EC-SK-2026-01", startDate: "2026-01-01", endDate: "2026-12-31" };
const SUB = { reference: "TRF-2026-SC-SK-2026-02", project: TRF, monthlyFee: 800, contractTotal: 4000 };

console.log("\nA. each instrument says what it is");
// AnaHon has no employees (Saad, 12 Sep 2026): the annual contract must not call anyone one.
ok("the yearly contract is an ANNUAL SERVICE CONTRACT", h1(FRAMEWORK) === "ANNUAL SERVICE CONTRACT");
ok("and the word employee appears nowhere on it", !/employee/i.test(text(FRAMEWORK)));
ok("a project engagement is a SUBCONTRACT", h1({ ...SUB, parentReference: "ANH-EC-SK-2026-01" }) === "SUBCONTRACT");
ok("a provider still signs a SERVICE AGREEMENT", h1({ kind: "Service", contractTotal: 2000 }) === "SERVICE AGREEMENT");
// A service engagement on a project is still one agreement, never a subcontract.
ok("a service agreement on a project is NOT turned into a subcontract",
  h1({ kind: "Service", project: TRF, contractTotal: 2000 }) === "SERVICE AGREEMENT");
ok("the type row agrees with the title",
  text({ ...SUB, parentReference: "ANH-EC-SK-2026-01" }).includes("Contract TypeSubcontract — one project, under the annual contract"));
ok("nor on a subcontract", !/employee/i.test(text({ ...SUB, parentReference: "ANH-EC-SK-2026-01" })));
ok("the counterparty is named a service provider, not an employee",
  text(FRAMEWORK).includes("Service providerSally Kayyali"));

console.log("\nB. a subcontract names the contract it sits under");
const withParent = text({ ...SUB, parentReference: "ANH-EC-SK-2026-01" });
ok("the annual contract's reference is in the particulars", withParent.includes("Under annual contractANH-EC-SK-2026-01"));
ok("and in the engagement clause, as a sentence",
  withParent.includes("made under the annual contract ANH-EC-SK-2026-01 between AnaHon Media Platform and Sally Kayyali"));
ok("it says which document carries the money", withParent.includes("carries no payment of its own"));
ok("and that a subcontract BUYS a level of effort from it", withParent.includes("buys a level of effort from it for this project only"));
ok("and which one outlives the other", withParent.includes("the annual contract remains active"));

console.log("\nC. and says so plainly when there is none");
// Every current engagement is in this state: nobody holds a framework contract yet. A
// subcontract that quietly omitted the clause would read as if one existed.
const noParent = text({ ...SUB, parentReference: null });
ok("the particulars say none is on file", noParent.includes("Under annual contractNone on file"));
ok("the clause names the person it is missing for", noParent.includes("No annual contract is on file for Sally Kayyali"));
ok("and does not pretend the subcontract is incomplete", noParent.includes("this document stands alone"));
ok("no framework reference is invented", !noParent.includes("made under the annual contract"));

console.log("\nD. the rate lives on the framework, the share on the subcontract");
// Saad, 5 Sep 2026: the yearly contract sets the full salary; a subcontract covers a project's
// portion of it, which may be the whole thing or a level of effort. The framework must not read
// as an unconditional monthly wage, and the subcontract must not recompute the fee from the rate.
const rated = text({ reference: "ANH-EC-SK-2026-01", monthlyFee: 1560 });
ok("the annual contract states a total salary at 100% effort",
  rated.includes("states a total salary of $1,560.00 per month at a 100% level of effort"));
// Saad's own rule, in his words: no project, no payment; the contract stays active.
ok("and states the pay rule the way Saad stated it",
  rated.includes("with no project there is no payment, and this contract remains active regardless"));
ok("and says plainly that it does not itself oblige payment", rated.includes("It does not by itself oblige payment"));
ok("and that payment comes only through a subcontract", rated.includes("payment is made only through a subcontract by which a project buys a level of effort from this contract"));
ok("it does NOT carry the unconditional monthly-wage sentence",
  !rated.includes("independent of the number of days worked"));
// "Attendance" is employment language; a service provider delivers effort, not attendance.
ok("and the contract generator speaks of attendance nowhere",
  !/attend/i.test(readFileSync(new URL("../docgen.ts", import.meta.url), "utf8")
    .slice(0, readFileSync(new URL("../docgen.ts", import.meta.url), "utf8").indexOf("export function quotationHtml"))));
ok("its particulars label the figure a full salary, not a fee",
  rated.includes("Full monthly salary (100% level of effort)$1,560.00"));
ok("and it still has no fixed total", rated.includes("has no fixed value"));
const unrated = text({ reference: "ANH-EC-SK-2026-01" });
ok("with no rate on record the annual contract says so rather than implying zero",
  unrated.includes("No total salary is stated on it yet") && !unrated.includes("$0.00"));

const shared = { ...SUB, loePct: 20, monthlyFee: 312, parentReference: "ANH-EC-SK-2026-01" };
const withRate = text({ ...shared, fullSalary: 1560 });
ok("a subcontract quotes the annual contract's total salary as context",
  withRate.includes("total salary stated in the annual contract is $1,560.00 per month"));
ok("and names the level of effort this project buys", withRate.includes("this project buys the 20% level of effort stated above of it"));
ok("the fee it charges is the typed one, not one recomputed from the rate",
  withRate.includes("fixed monthly fee of $312.00"));
ok("the rate also appears in the particulars",
  withRate.includes("Full monthly salary under the annual contract$1,560.00"));
ok("with no rate on record the subcontract simply omits it, inventing nothing",
  !text({ ...shared, fullSalary: 0 }).includes("total salary stated in the annual contract"));
ok("a service agreement gains none of this", !text({ kind: "Service", contractTotal: 2000, loePct: 20 }).includes("framework"));

console.log("\nE. the reference says which instrument it is");
ok("the server prefixes a subcontract SC, a framework EC, an agreement SA",
  /kindVal === "Service" \? "SA" : isSub \? "SC" : "EC"/.test(server));
ok("and decides that from the project, not from a stored flag",
  /const isSub = kindVal === "Employment" && !!project;/.test(server));
ok("the parent is looked up as the person's own project-less contract",
  /category: "Contracts", partyId: partyKey, linkedRecordId: "GENERAL"/.test(server));
ok("the audit line distinguishes the three, and records a missing parent",
  /isSub \? "subcontract" : "yearly framework employment contract"/.test(server)
  && server.includes('under framework contract ${parentReference || "NONE ON FILE"}'));

console.log("\nF. the rate is typed once, on the instrument that states it");
// Saad, 6 Sep 2026: the yearly salary may change from year to year, and he does not want to
// maintain the number twice. So the yearly agreement writes it to the record — one figure,
// typed where it is already being typed. A subcontract buys a share of the rate and must
// never redefine it, or next year's agreement would be overwritten by a project.
ok("only a framework contract sets the rate",
  /const isFramework = kindVal === "Employment" && !project && !!employeeId;/.test(server)
  && /if \(isFramework && newRate > 0 && newRate !== \(party\.salary \|\| 0\)\)/.test(server));
ok("drawing one with no rate leaves the existing rate alone rather than wiping it",
  server.includes("newRate > 0 &&"));
ok("the write is audit-logged with what it changed from",
  server.includes("Full Salary Set By Contract") && server.includes("changed from ${party.salary} to "));
ok("and the audit line says a rate is not an instruction to pay",
  server.includes("A rate, not an instruction to pay"));
ok("the subcontract reads the rate but never writes it",
  server.includes("fullSalary: isSub ? Number((party as any).salary || 0) : undefined")
  && !/isSub[\s\S]{0,120}prisma\.employee\.update/.test(server));

console.log("\nG. a new yearly agreement says what it replaces");
// Saad, 6 Sep 2026: at the SKF grant's start the previous contracts are cancelled and a new
// agreement runs to the year end; in January a fresh one is signed with the new positions. So
// two yearly agreements will sit in one person's file, and the newer must say it replaces the
// older rather than leaving the dates to be compared.
const replacing = text({ reference: "ANH-EC-SK-2027-01", monthlyFee: 1300, supersedesReference: "ANH-EC-SK-2026-09" });
ok("the clause names the agreement it replaces", replacing.includes("replaces the annual contract ANH-EC-SK-2026-09"));
ok("and says from when the old one stops", replacing.includes("ceases to have effect from the start date above"));
// Money has usually already moved on a subcontract; a new yearly agreement must not sweep it away.
ok("it explicitly does NOT cancel subcontracts already issued",
  replacing.includes("does not affect any subcontract already issued") && replacing.includes("runs to the end of its own period"));
ok("the particulars carry a Replaces row", replacing.includes("ReplacesANH-EC-SK-2026-09"));
ok("a first agreement claims to replace nothing",
  !text({ reference: "ANH-EC-SK-2026-09", monthlyFee: 1300 }).includes("replaces the annual contract"));
ok("a subcontract never gets the clause, even when one is passed",
  !text({ ...SUB, parentReference: "ANH-EC-SK-2027-01", supersedesReference: "ANH-EC-SK-2026-09" }).includes("replaces the annual contract"));
ok("the server reuses one lookup for parent and predecessor — they are the same fact",
  /if \(isSub \|\| isFramework\) \{/.test(server) && /if \(isSub\) \{ parentReference = supersedesReference;/.test(server));
ok("and refuses to let a reissued agreement supersede itself",
  /r !== reference/.test(server));
// Backfilling is ordinary here — the FPU-2025 engagements are being papered a year after they
// ended — and filing order is not chronology. The newest document on file may have started
// AFTER the engagement it would be cited on, which is false on the face of an instrument.
const pick = (server.match(/let parentReference: string \| null = null;[\s\S]*?\n    \}/) || [""])[0];
ok("it picks by the agreement's own start month, not by when the file was written",
  pick.includes('const startMonth = String(startDate).slice(0, 7);')
  && pick.includes("r.slice(-7) <= startMonth"));
ok("candidates are ordered by that month, so the latest one already in force wins",
  /\.sort\(\(a, b\) => b\.slice\(-7\)\.localeCompare\(a\.slice\(-7\)\)\)/.test(pick));
ok("nothing that began later can be cited — a 2025 subcontract cannot name a 2026 agreement",
  !/orderBy: \{ created_at: "desc" \}[\s\S]{0,80}linkedRecordId: "GENERAL"/.test(pick)
  && !pick.includes("findFirst"));
ok("the audit line records the replacement", server.includes('replacing ${supersedesReference}'));

console.log("\nH. who countersigns, and what the page calls them");
// Saad asked to be given the Program Director role so he countersigns. An account holds exactly
// one role, so that would have cost the master account its own — and "Super Admin" is a
// permission key that must never appear as a job title on something a person signs. Instead the
// master account stands in for the vacant seat, as it does everywhere else, and the page says so.
const fn = (server.match(/async function authorisedSignatory[\s\S]*?\n\}/) || [""])[0];
ok("one function answers it — a contract, a payslip and a provider invoice all ask the same question",
  !!fn && (server.match(/await authorisedSignatory\(\)/g) || []).length === 3);
ok("the Programme Director is preferred when the seat is filled",
  fn.indexOf('role: "Program Director"') < fn.indexOf('role: "Super Admin"'));
ok("the master account stands in before Finance is reached",
  fn.indexOf('role: "Super Admin"') < fn.indexOf('role: "Finance Officer"'));
ok("a real seat-holder is titled by the seat", fn.includes('title: "Programme Director"'));
ok("the master account is titled by the seat it stands in for, not by its permission key",
  fn.includes('title: "Signing for the Programme Director seat"'));
ok("and a Finance fallback admits the seat is vacant rather than implying authority",
  fn.includes("the Programme Director seat is vacant"));
// The payslip and the provider invoice printed `(${officer.role})`, which with the seat vacant
// put a permission key on the page. Nothing may print an account role as a title any more.
ok("no document prints an account role as a title",
  !/\$\{officer\.role\}/.test(server) && !/role: signatory\.role \}/.test(server));
ok("the payslip and the provider invoice use the seat title",
  (server.match(/\$\{officer\.name\} \(\$\{officer\.title\}\)/g) || []).length === 2);
ok("the signature block prints the name over that title",
  /countersignatory\?\.name \|\| "—"[\s\S]{0,60}countersignatory\?\.role/.test(
    readFileSync(new URL("../docgen.ts", import.meta.url), "utf8")));

console.log("\nI. the reference is read back, never guessed at");
ok("it comes out of the id the route builds",
  referenceOfContractDoc("doc-contract-ANH-EC-SK-2026-01-emp-3", "emp-3") === "ANH-EC-SK-2026-01");
ok("a reference containing the party id still survives",
  referenceOfContractDoc("doc-contract-emp-3-EC-emp-3", "emp-3") === "emp-3-EC");
ok("another party's document is refused", referenceOfContractDoc("doc-contract-ANH-EC-SK-2026-01-emp-3", "emp-9") === null);
ok("a document that is not a contract is refused", referenceOfContractDoc("doc-1788451460939", "emp-3") === null);
ok("an empty reference is null, not an empty citation", referenceOfContractDoc("doc-contract--emp-3", "emp-3") === null);

console.log("\nJ. AnaHon has no employees, and no document says otherwise");
// Saad's declaration, 12 Sep 2026: everyone on the team is a service provider on an annual
// contract stating total salary and terms of reference; projects buy a level of effort from it
// by subcontract; with no project there is no payment and the contract stays active. The role
// strings, the Employee table and userEmail are permission and schema keys and DO NOT move —
// this only guards what a person reads and signs.
const gen = readFileSync(new URL("../docgen.ts", import.meta.url), "utf8");
const fnSrc = (name: string) => {
  const from = gen.indexOf(`export function ${name}`);
  if (from < 0) return "";
  const next = gen.indexOf("\nexport ", from + 10);
  return gen.slice(from, next < 0 ? gen.length : next)
    // strip the source comments: they legitimately say "employee" to explain why nothing else does
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
};
const contractSrc = fnSrc("contractHtml");
const payslipSrc = fnSrc("payslipHtml");
ok("both generators were actually read, not truncated to their signatures",
  contractSrc.length > 3000 && payslipSrc.length > 2000, `${contractSrc.length}/${payslipSrc.length}`);
ok("the contract generator prints the word employee nowhere",
  !/employee/i.test(contractSrc), (contractSrc.match(/.{0,40}employee.{0,40}/i) || [""])[0]);
ok("the payslip prints it only to say a person is NOT one", (() => {
  const prose = (payslipSrc.match(/.{0,70}employee.{0,30}/gi) || [])
    .filter(h => !/employee:/.test(h));
  return prose.length === 1 && prose[0].includes("not as an employee");
})(), (payslipSrc.match(/.{0,70}employee.{0,30}/gi) || []).filter(h => !/employee:/.test(h)).join(" | "));
ok("the payslip names the counterparty a service provider",
  payslipSrc.includes("<caption>Service provider</caption>") && payslipSrc.includes("<div>Service provider — "));
ok("a term with legal meaning is NOT quietly reworded — withholding still keys on isService",
  /isService[\s\S]{0,400}7\.5% withholding tax/.test(gen));
ok("and the nil month states the rule, not an entitlement",
  payslipSrc.includes("with no project there is no payment") && payslipSrc.includes("the annual contract remains active"));
ok("the payslip says the tax and social-security treatment is unconfirmed, not settled",
  payslipSrc.includes("pending confirmation of the tax and social-security treatment"));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
