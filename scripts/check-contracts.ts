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
ok("the yearly contract is an EMPLOYMENT CONTRACT", h1(FRAMEWORK) === "EMPLOYMENT CONTRACT");
ok("a project engagement is a SUBCONTRACT", h1({ ...SUB, parentReference: "ANH-EC-SK-2026-01" }) === "SUBCONTRACT");
ok("a provider still signs a SERVICE AGREEMENT", h1({ kind: "Service", contractTotal: 2000 }) === "SERVICE AGREEMENT");
// A service engagement on a project is still one agreement, never a subcontract.
ok("a service agreement on a project is NOT turned into a subcontract",
  h1({ kind: "Service", project: TRF, contractTotal: 2000 }) === "SERVICE AGREEMENT");
ok("the type row agrees with the title",
  text({ ...SUB, parentReference: "ANH-EC-SK-2026-01" }).includes("Contract TypeSubcontract — employment, for one project"));

console.log("\nB. a subcontract names the contract it sits under");
const withParent = text({ ...SUB, parentReference: "ANH-EC-SK-2026-01" });
ok("the framework reference is in the particulars", withParent.includes("Under framework contractANH-EC-SK-2026-01"));
ok("and in the engagement clause, as a sentence",
  withParent.includes("made under the yearly framework contract ANH-EC-SK-2026-01 between AnaHon Media Platform and Sally Kayyali"));
ok("it says which document carries the money", withParent.includes("carries no remuneration of its own"));
ok("and which one outlives the other", withParent.includes("the framework contract continues"));

console.log("\nC. and says so plainly when there is none");
// Every current engagement is in this state: nobody holds a framework contract yet. A
// subcontract that quietly omitted the clause would read as if one existed.
const noParent = text({ ...SUB, parentReference: null });
ok("the particulars say none is on file", noParent.includes("Under framework contractNone on file"));
ok("the clause names the person it is missing for", noParent.includes("No yearly framework contract is on file for Sally Kayyali"));
ok("and does not pretend the subcontract is incomplete", noParent.includes("this document stands alone"));
ok("no framework reference is invented", !noParent.includes("made under the yearly framework contract"));

console.log("\nD. the rate lives on the framework, the share on the subcontract");
// Saad, 5 Sep 2026: the yearly contract sets the full salary; a subcontract covers a project's
// portion of it, which may be the whole thing or a level of effort. The framework must not read
// as an unconditional monthly wage, and the subcontract must not recompute the fee from the rate.
const rated = text({ reference: "ANH-EC-SK-2026-01", monthlyFee: 1560 });
ok("the framework states a full monthly salary at 100% effort",
  rated.includes("establishes a full monthly salary of $1,560.00 at a 100% level of effort"));
ok("and says plainly that it does not itself oblige payment", rated.includes("It does not by itself oblige payment"));
ok("and that salary is drawn only through a subcontract", rated.includes("drawn only through a subcontract under which a project funds this role"));
ok("it does NOT carry the unconditional monthly-wage sentence",
  !rated.includes("independent of the number of days attended"));
ok("its particulars label the figure a full salary, not a fee",
  rated.includes("Full monthly salary (100% level of effort)$1,560.00"));
ok("and it still has no fixed total", rated.includes("has no fixed value"));
const unrated = text({ reference: "ANH-EC-SK-2026-01" });
ok("with no rate on record the framework says so rather than implying zero",
  unrated.includes("No full salary rate is recorded on it yet") && !unrated.includes("$0.00"));

const shared = { ...SUB, loePct: 20, monthlyFee: 312, parentReference: "ANH-EC-SK-2026-01" };
const withRate = text({ ...shared, fullSalary: 1560 });
ok("a subcontract quotes the framework's full salary as context",
  withRate.includes("full monthly salary established by the framework contract is $1,560.00"));
ok("and names the level of effort this project funds", withRate.includes("this project funds the 20% level of effort stated above"));
ok("the fee it charges is the typed one, not one recomputed from the rate",
  withRate.includes("fixed monthly fee of $312.00"));
ok("the rate also appears in the particulars",
  withRate.includes("Full monthly salary under the framework contract$1,560.00"));
ok("with no rate on record the subcontract simply omits it, inventing nothing",
  !text({ ...shared, fullSalary: 0 }).includes("full monthly salary established by the framework"));
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

console.log("\nG. the reference is read back, never guessed at");
ok("it comes out of the id the route builds",
  referenceOfContractDoc("doc-contract-ANH-EC-SK-2026-01-emp-3", "emp-3") === "ANH-EC-SK-2026-01");
ok("a reference containing the party id still survives",
  referenceOfContractDoc("doc-contract-emp-3-EC-emp-3", "emp-3") === "emp-3-EC");
ok("another party's document is refused", referenceOfContractDoc("doc-contract-ANH-EC-SK-2026-01-emp-3", "emp-9") === null);
ok("a document that is not a contract is refused", referenceOfContractDoc("doc-1788451460939", "emp-3") === null);
ok("an empty reference is null, not an empty citation", referenceOfContractDoc("doc-contract--emp-3", "emp-3") === null);

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
