// Three instruments, and which one a person is actually signing.
//
// 5 Sep 2026 (People). Saad set the model: staff hold a yearly framework contract that pays
// nothing, and every project that funds the role is contracted separately; service providers
// get one agreement and one payment. The failure mode is not a crash — it is a document that
// looks like the wrong instrument, or a subcontract that cites a framework contract nobody
// ever issued. So this renders the documents and reads them, rather than trusting the
// template. Run: npx tsx scripts/check-contracts.ts
import { WHT_RATE, WHT_LABEL, WHT_NET_FACTOR, whtLabelOf } from "../src/tax.js";
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
const dropAr = (h: string) => h
  .replace(/<span class="alt"[^>]*>[\s\S]*?<\/span>/g, "")
  .replace(/<section class="lang ar"[\s\S]*?<\/section>/g, "")
  .replace(/<p class="note ar"[\s\S]*?<\/p>/g, "");
const text = (o: any) => dropAr(doc(o)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
/** The Arabic section and Arabic notes only. */
const arText = (o: any) => {
  const h = doc(o);
  return [...h.matchAll(/<section class="lang ar"[\s\S]*?<\/section>|<span class="alt"[^>]*>[\s\S]*?<\/span>|<p class="note ar"[\s\S]*?<\/p>/g)]
    .map(m => m[0]).join(" ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
};
const h1 = (o: any) => (dropAr(doc(o)).match(/<h1>([\s\S]*?)<\/h1>/) || [, "?"])[1].replace(/<[^>]+>/g, "").trim();

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
// TRF-2026 ran Feb-Jun 2026 and the annual contracts start Aug 2026, so those subcontracts
// cite no parent — correctly, the chronology guard refuses a contract that did not yet exist.
// The rate must then be silent too: a page cannot say "no annual contract is on file" and in
// the next clause quote "the total salary stated in the annual contract".
const orphan = { ...SUB, loePct: 20, monthlyFee: 312, parentReference: null, fullSalary: 1560 };
ok("a subcontract with NO parent never quotes a total salary, even when one is passed",
  !text(orphan).includes("total salary stated in the annual contract")
  && !text(orphan).includes("Full monthly salary under the annual contract"));
ok("and the Arabic does not quote it either",
  !arText(orphan).includes("الراتب الإجمالي المنصوص عليه في العقد السنوي")
  && !arText(orphan).includes("الراتب الشهري الكامل بموجب العقد السنوي"));
ok("it still says plainly that none is on file", text(orphan).includes("No annual contract is on file for"));
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
ok("the form's Type options describe what comes out, and never say employment contract", (() => {
  const payroll = readFileSync(new URL("../src/tabs/PayrollTab.tsx", import.meta.url), "utf8");
  const opts = [...payroll.matchAll(/<option value="(Employment|Service)">([^<]*)</g)].map(m => m[2]);
  return opts.length === 2 && opts.every(o => !/employment/i.test(o))
    && opts[0].includes("Annual contract") && opts[1].includes("Service agreement");
})());
ok("the payslip names the counterparty a service provider",
  /cap\("Service provider", "مقدّم الخدمة"\)/.test(payslipSrc) && payslipSrc.includes("<div>Service provider — "));
// 7 Oct 2026: the rate moved to 8.5% (2024 Budget Law, adopted by Saad). It lives in src/tax.ts and
// nowhere else; the clause still keys on isService, and only a SERVICE agreement carries it.
ok("a term with legal meaning is NOT quietly reworded — withholding still keys on isService",
  /isService[\s\S]{0,400}\$\{WHT_LABEL\} withholding tax/.test(gen));
ok("the clause quotes today's rate, from the one constant", WHT_RATE === 0.085 && WHT_LABEL === "8.5%" && WHT_NET_FACTOR === 0.915);
ok("no rate is typed into a document — Arabic or English",
  !/7\.5\s*%|0\.075|0\.925/.test(gen) && (gen.match(/WHT_LABEL|WHT_RATE|WHT_NET_FACTOR/g) || []).length >= 6);
ok("the Arabic clause isolates the rate so the percent sign cannot jump", /بنسبة \$\{ltr\(WHT_LABEL\)\} من المنبع/.test(gen));
ok("the net factor is the complement of the rate, not a second typed number",
  /contractTotal \* WHT_RATE/.test(gen) && /contractTotal \* WHT_NET_FACTOR/.test(gen));
// A paid voucher keeps the rate it was paid at: its invoice reads the rate back from its own figures.
ok("a past payment's invoice says the rate it was actually withheld at", /Less withholding tax \(\$\{whtLabelOf\(wht, gross\)\}\)/.test(gen));
ok("and that read-back is honest about old and new", whtLabelOf(75, 1000) === "7.5%" && whtLabelOf(85, 1000) === "8.5%" && whtLabelOf(0, 1000) === WHT_LABEL);
ok("and the nil month states the rule, not an entitlement",
  payslipSrc.includes("with no project there is no payment") && payslipSrc.includes("the annual contract remains active"));
ok("the payslip says the tax and social-security treatment is unconfirmed, not settled",
  payslipSrc.includes("pending confirmation of the tax and social-security treatment"));

console.log("\nK. the Arabic text of the same instrument");
// The documents are bilingual: Arabic text first, then the English text of the same contract.
// Figures and dates are NOT repeated per language — they live once in the particulars — so the
// two readings cannot state different amounts, and nobody has to decide which copy governs.
const arFramework = arText(FRAMEWORK);
const arSub = arText({ ...SUB, loePct: 20, monthlyFee: 312, parentReference: "ANH-EC-SK-2026-01", fullSalary: 1560 });
ok("the annual contract carries an Arabic title", arFramework.includes("عقد خدمات سنوي"));
ok("a subcontract carries its own", arText(SUB).includes("عقد فرعي"));
ok("a service agreement carries its own", arText({ kind: "Service", contractTotal: 2000 }).includes("اتفاقية خدمات"));
ok("every particulars label has an Arabic twin",
  ["المرجع", "مقدّم الخدمة", "الشروط المرجعية", "نوع العقد", "المدة", "إجمالي قيمة العقد", "يُدفع من"]
    .every(l => arFramework.includes(l)));
ok("the four clauses are numbered in Arabic", ["١. الارتباط", "٣. الدفع", "٤. أحكام أخرى"].every(h => arFramework.includes(h)));
// Saad's rule has to survive translation, not just appear in it.
ok("the pay rule is stated in Arabic", arText({ reference: "ANH-EC-SK-2026-01", monthlyFee: 1560 })
  .includes("بلا مشروع لا يوجد دفع، ويبقى هذا العقد سارياً في كل الأحوال"));
ok("the Arabic says a subcontract BUYS a level of effort", arSub.includes("يشتري هذا العقد الفرعي نسبة جهد منه لهذا المشروع وحده"));
ok("and that the annual contract survives it", arSub.includes("ويبقى العقد السنوي سارياً"));
ok("a missing annual contract is stated in Arabic too",
  arText({ ...SUB, parentReference: null }).includes("لا يوجد عقد سنوي في ملف"));
ok("the Arabic replaces-clause names the contract it replaces",
  arText({ reference: "ANH-EC-SK-2027-01", monthlyFee: 1300, supersedesReference: "ANH-EC-SK-2026-09" })
    .includes("محلّ العقد السنوي"));
// A number or a Latin name inside RTL prose must be bidi-isolated or an adjacent comma jumps.
ok("figures and Latin names inside the Arabic prose are isolated", (() => {
  const raw = doc({ ...SUB, loePct: 20, monthlyFee: 312, parentReference: "ANH-EC-SK-2026-01", fullSalary: 1560 });
  const arSection = (raw.match(/<section class="lang ar"[\s\S]*?<\/section>/) || [""])[0];
  const bare = arSection.replace(/<span dir="ltr" class="num">[\s\S]*?<\/span>/g, "");
  // no unisolated $ amount, no unisolated reference, no unisolated Latin name
  return !/\$[\d,]/.test(bare) && !/ANH-EC-|TRF-2026/.test(bare) && !/Sally Kayyali/.test(bare);
})());
ok("Arabic dates use Arabic month names and Western digits",
  arFramework.includes("كانون الأول") && /\d{1,2} [\u0600-\u06FF ]+ \d{4}/.test(arFramework));
ok("and no date or amount smuggles in Arabic-Indic digits", (() => {
  const runs = [...doc({ ...SUB, loePct: 20, monthlyFee: 312, parentReference: "ANH-EC-SK-2026-01", fullSalary: 1560 })
    .matchAll(/<span dir="ltr" class="num">([\s\S]*?)<\/span>/g)].map(m => m[1]);
  return runs.length > 0 && runs.every(r => !/[٠-٩]/.test(r));
})());
ok("the document says it is bilingual, and why the figures appear once",
  arFramework.includes("هذا المستند ثنائي اللغة") && arFramework.includes("مرة واحدة فقط"));
ok("no Arabic string fell back to English inside the Arabic section", !/Remuneration|Engagement|Other terms/.test(arFramework));

console.log("\nL. which text governs");
// Saad's decision, 12 Sep 2026: the Arabic governs. It is an article of the contract, not a
// footnote about it — and the Arabic is printed first for the same reason.
const govEn = text(FRAMEWORK), govAr = arText(FRAMEWORK);
ok("the English text has a numbered Language clause", govEn.includes("5. Language"));
ok("and says the Arabic is binding", govEn.includes("the Arabic text is the binding text"));
ok("and which prevails on a difference of meaning", govEn.includes("the Arabic text prevails"));
ok("the Arabic text has the same clause, numbered ٥", govAr.includes("٥. اللغة"));
ok("and says the same thing", govAr.includes("النص العربي هو النص الملزم") && govAr.includes("يُعمل بالنص العربي"));
ok("a service agreement gets it too", text({ kind: "Service", contractTotal: 2000 }).includes("5. Language")
  && arText({ kind: "Service", contractTotal: 2000 }).includes("٥. اللغة"));
ok("a subcontract gets it too", text(SUB).includes("5. Language") && arText(SUB).includes("٥. اللغة"));
ok("the closing note points at the clause rather than restating a different rule",
  govEn.includes("the Arabic text governs") && govEn.includes("clause 5"));
// The Arabic text is binding, so it must be the text a reader meets first.
ok("the Arabic section is printed BEFORE the English one", (() => {
  const h = doc(FRAMEWORK);
  return h.indexOf('class="lang ar"') < h.indexOf('class="lang en"');
})());
const ps = fnSrc("payslipHtml");
ok("the payslip says it too, in both languages",
  ps.includes("the Arabic text governs") && ps.includes("والنص العربي هو الملزم"));

console.log("\nM. the initials in a reference");
// Every word's first letter, with an override where the person is known by something else.
// Abdul Rahman El Ibrahim signs as AR, not AREI (Saad, 12 Sep 2026).
const initSrc = (server.match(/const REFERENCE_INITIALS[\s\S]*?join\(""\)\.toUpperCase\(\);/) || [""])[0];
const initials = (id: string, name: string) => {
  const m = initSrc.match(new RegExp(`"${id}": "([A-Z]+)"`));
  return m ? m[1] : name.trim().split(/\s+/).map(n => n[0]).join("").toUpperCase();
};
ok("the override exists and is keyed by party id, not by name",
  /"emp-abdulrahman": "AR"/.test(initSrc) && !/Abdul Rahman/.test(initSrc));
ok("Abdul Rahman El Ibrahim is AR", initials("emp-abdulrahman", "Abdul Rahman El Ibrahim") === "AR");
// The others must be untouched: nobody asked for their references to move.
ok("Saad Matar is still SM", initials("emp-1", "Saad Matar") === "SM");
ok("Ahmad Ayshan is still AA", initials("emp-2", "Ahmad Ayshan") === "AA");
ok("Marwan El Cheikh is still MEC — no rule was applied behind his back",
  initials("emp-marwan", "Marwan El Cheikh") === "MEC");
ok("the route uses it", /\$\{initialsFor\(partyKey, party\.name\)\}/.test(server));
// Initials are cosmetic to the machinery, and this proves the claim rather than assuming it:
// the parent/supersede lookup compares the trailing YYYY-MM, never the initials.
ok("changing initials cannot disturb the parent lookup, which compares months",
  /r\.slice\(-7\) <= startMonth/.test(server) && !/slice\(0, *7\)[\s\S]{0,40}initials/i.test(server));

// Policy P5, approved 15 Sep 2026, replaced the Accounting Policies Manual; the payment clause cites it in both languages.
{ const d = doc({});
  ok("the payment clause cites Policy P5 in English and Arabic, and the retired manual nowhere",
    d.includes("AnaHon's Finance and Procurement Policy (Policy P5)") && d.includes("وفقاً لسياسة المالية والمشتريات لدى اناهون")
    && !/Accounting Policies Manual|السياسات المحاسبية/.test(d)); }
// The Arabic label (.alt) sits on its own line wherever it is used — a title, a table cell, a signature block —
// not only in a th. With the rule scoped to th, the payslip's and contract's Arabic ran straight into the English (15 Sep 2026).
{ const d = doc({});
  ok("the .alt label is a block in every context, not only inside a table header",
    /(^|[\n}])\.alt\{display:block;direction:rtl/.test(d) && /<div>[^<]*<br>[^<]*<span class="alt">/.test(d)); }
// The Arabic signature line governs: a role title the system translates prints in Arabic; free text keeps its English
// in its own isolated LTR span; nothing is translated by guess.
{ const known = doc({ party: { ...BASE.party, position: "Graphic Designer" } });
  const free = doc({ party: { ...BASE.party, position: "Production Team Leader & iContent Programme Manager" } });
  ok("a translated role title prints in Arabic on the Arabic signature line",
    known.includes('<span class="alt">مصمم غرافيك — التاريخ والتوقيع</span>'));
  ok("a free-text position keeps its English, isolated LTR, on the Arabic signature line",
    free.includes('<span class="alt"><span dir="ltr" class="num">Production Team Leader &amp; iContent Programme Manager</span> — التاريخ والتوقيع</span>'));
  ok("an English position word is never loose inside the Arabic signature line",
    !/<span class="alt">[A-Za-z][^<]*— التاريخ والتوقيع/.test(known + free)); }
console.log("\nL. what the papers say AnaHon is (Front desk / Saad, 18 Sep 2026)");
// AnaHon is a CIVIL company (general partnership), civil company no. 90/2023, First Instance Chamber
// North, Tripoli, 12/10/2023 — it is not on the commercial register, and generated documents said it was.
{
  const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  const docgen = readFileSync(new URL("../docgen.ts", import.meta.url), "utf8");
  const claim = /Commercial Regist(er|ry)/i;
  // The supplier document rule legitimately asks a COMPANY for its own commercial registration;
  // that is about counterparties, not about AnaHon, and lives in src/supplierDocs.ts.
  ok("no generated document calls AnaHon commercially registered", !claim.test(docgen));
  ok("nor does the proposal brain's grounding", !claim.test(server.slice(server.indexOf("ORGANIZATION: AnaHon"), server.indexOf("ORGANIZATION: AnaHon") + 600)));
  ok("the proposal footer names the civil company and the chamber that registered it",
    /civil company \(general partnership\), civil company no\. 90\/2023, First Instance Chamber North, Tripoli, 12\/10\/2023/.test(docgen));
  ok("the provider invoice bills from the civil company", /Billed to[\s\S]{0,120}civil company \(general partnership\), civil company no\. 90\/2023/.test(docgen));
  ok("the registration number and MoF number are unchanged", (docgen.match(/90\/2023/g) || []).length >= 2 && docgen.includes("3893185"));
}

// 8 Oct 2026 — three gaps found drawing the SKF FSTP (EUR) subcontracts: a grant in euros printed
// dollars; the withholding clause was welded to service agreements; and a donor's own terms had
// nowhere to go. Figures follow the project's currency, withholding is a per-contract choice, and
// a project carries its donor's clauses as clause 6.
{ const eur = doc({ monthlyFee: 200, contractTotal: 1200, project: { code: "ANH-2026-SKF-BM-01", name: "AnaHon Forward", currency: "EUR" }, currency: "EUR" });
  ok("a contract on a EUR grant prints euros, in both languages",
    eur.includes("€200.00") && eur.includes("€1,200.00") && !/\$\d/.test(eur));
  ok("a contract with no currency given still prints dollars, as every contract drawn before did",
    doc({ monthlyFee: 200, contractTotal: 1200 }).includes("$200.00"));

  const service = doc({ kind: "Service", contractTotal: 1000, party: { ...BASE.party, taxId: "" } });
  ok("an unregistered service provider still gets the withholding clause by default",
    service.includes(`${WHT_LABEL} withholding tax is deducted at source`) && service.includes("تُقتطع ضريبة استقطاع"));
  const team = doc({ project: TRF, monthlyFee: 200, contractTotal: 1200 });
  ok("a team subcontract gets NO withholding clause unless asked — the accountant has not answered yet",
    !team.includes("withholding tax is deducted at source") && !team.includes("تُقتطع ضريبة استقطاع"));
  const teamWht = doc({ project: TRF, monthlyFee: 200, contractTotal: 1200, withholding: true });
  ok("...and gets it, in both languages, the day the answer is yes",
    teamWht.includes(`${WHT_LABEL} withholding tax is deducted at source`) && teamWht.includes("تُقتطع ضريبة استقطاع"));
  ok("withholding can also be switched OFF for a service agreement that should not carry it",
    !doc({ kind: "Service", contractTotal: 1000, party: { ...BASE.party, taxId: "" }, withholding: false })
      .includes("withholding tax is deducted at source"));

  const donor = doc({ project: TRF, donorClauses: { en: "EN SANCTIONS CLAUSE", ar: "بند العقوبات" } });
  ok("a donor's clauses print as clause 6, after Language, in both languages",
    /6\. Donor requirements<\/strong><\/h2>\s*<p>EN SANCTIONS CLAUSE<\/p>/.test(donor)
    && donor.includes("٦. متطلبات الجهة المانحة") && donor.includes("بند العقوبات")
    && donor.indexOf("5. Language") < donor.indexOf("6. Donor requirements"));
  ok("a project whose grant imposes no terms gets no clause 6 at all",
    !doc({ project: TRF }).includes("Donor requirements") && !doc({ project: TRF }).includes("متطلبات الجهة المانحة"));
  ok("the clauses are stored per project, in both languages, and set by Finance or a director",
    /donorClausesEn\s+String @default\(""\)/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8"))
    && /app\.post\("\/api\/projects\/donor-clauses"/.test(server)
    && server.includes("Donor clauses are set in both Arabic and English, or in neither"));
  ok("the generator is given the project's currency and its donor clauses",
    /currency: project\?\.currency \|\| "USD",/.test(server) && /donorClauses: project\?\.donorClausesEn \|\| project\?\.donorClausesAr/.test(server));
  ok("the contract's audit line names the currency it was drawn in, not USD",
    !/total \$\{contractTotal\} USD/.test(server) && /total \$\{contractTotal\} \$\{contractCcy\}/.test(server)); }

// 8 Oct 2026, from the AnaHon Forward room: a subcontract on a EUR grant was printing the USD annual
// base in euros — the figure the whole level of effort is measured against, wrong on a signed page.
// And an annual contract whose term began before signature has to say so, because AnaHon's annual
// contracts run by calendar year and are signed when they are signed, never backdated.
{ const eurSub = doc({ kind: "Employment", project: { code: "ANH-2026-SKF-BM-01", name: "AnaHon Forward", currency: "EUR" },
    currency: "EUR", monthlyFee: 200, contractTotal: 1200, loePct: 20, parentReference: "ANH-EC-SM-2026-01", fullSalary: 2700 });
  ok("a subcontract states the annual base in the annual contract's own currency, not the grant's",
    eurSub.includes("$2,700.00") && !eurSub.includes("€2,700.00"));
  ok("...and still states its own fee and total in the grant's currency",
    eurSub.includes("€200.00") && eurSub.includes("€1,200.00"));
  ok("the rate the effort was priced at is stated when the currencies differ, in both languages",
    doc({ kind: "Employment", project: { code: "P", name: "P", currency: "EUR" }, currency: "EUR", monthlyFee: 200,
      contractTotal: 1200, loePct: 20, parentReference: "ANH-EC-SM-2026-01", fullSalary: 2700, fullSalaryRate: 0.925 })
      .includes("priced at 0.925 EUR per USD"));
  ok("no rate is invented when none is given", !eurSub.includes("priced at"));

  const past = doc({ startDate: "2026-01-01", endDate: "2026-12-31", monthlyFee: 2700 });
  ok("an annual contract whose term began before signature says so, in both languages",
    past.includes("takes effect from 1 January 2026, which precedes its signature")
    && past.includes("ويُوقَّع بالتاريخ المدوَّن إلى جانب التوقيعين أدناه") && past.includes("It is not backdated."));
  ok("a contract whose term starts today or later says nothing of the sort",
    !doc({ startDate: "2027-01-01", endDate: "2027-12-31", monthlyFee: 2700 }).includes("precedes its signature")); }

// 8 Oct 2026 — the donor's clauses are stored as plain text a person typed, not markup: paragraphs
// separated by blank lines. They were being inserted raw, so clause 6 ran on as one block, any "&"
// or "<" in a donor's wording would have become markup, and the Latin runs in the Arabic
// (SKF-AN-31/2026, Brave Media, OLAF) sat unisolated in RTL prose — section K's rule.
{ const AR = "يُموَّل هذا العقد الفرعي بموجب اتفاقية الدعم المالي لأطراف ثالثة رقم SKF-AN-31/2026 المبرمة مع مؤسسة سمير قصير، ضمن برنامج Brave Media.\n(ج) السجلات والتدقيق: مفتوحة للتدقيق من المكتب الأوروبي لمكافحة الاحتيال (OLAF).";
  const EN = "This subcontract is funded under agreement SKF-AN-31/2026 with SKF <the foundation> & the EU.\n(c) Records and audit. Open to audit by OLAF.";
  const d = doc({ project: TRF, donorClauses: { ar: AR, en: EN } });
  const arSec = (d.match(/<section class="lang ar"[\s\S]*?<\/section>/) || [""])[0];
  ok("each donor clause is its own paragraph — the stored wording separates them with SINGLE newlines",
    (d.match(/<p>This subcontract is funded under agreement/g) || []).length === 1
    && d.includes("<p>(c) Records and audit. Open to audit by OLAF.</p>")
    && (arSec.match(/<p>/g) || []).length >= 2);
  ok("donor text is escaped — a donor's own angle bracket or ampersand never becomes markup",
    d.includes("SKF &lt;the foundation&gt; &amp; the EU") && !d.includes("SKF <the foundation>"));
  ok("every Latin run inside the Arabic clause is bidi-isolated (section K's rule)", (() => {
    const clause = arSec.slice(arSec.indexOf("متطلبات الجهة المانحة"));
    const bare = clause.replace(/<span dir="ltr" class="num">[\s\S]*?<\/span>/g, "").replace(/<[^>]*>/g, "");
    return !/[A-Za-z]/.test(bare);
  })());
  // 8 Oct 2026: a run may only START with a letter, so "(OLAF)" matched from the O and swallowed the
  // closing bracket — the Arabic printed "((OLAF". Brackets and trailing punctuation stay in the Arabic.
  ok("a bracketed Latin name keeps its brackets in the Arabic, on the correct sides", (() => {
    const b = doc({ project: TRF, donorClauses: { en: "x", ar: "متاحة للتدقيق من المكتب الأوروبي لمكافحة الاحتيال (OLAF) وديوان المحاسبة." } });
    const sec = (b.match(/<section class="lang ar"[\s\S]*?<\/section>/) || [""])[0];
    const clause = sec.slice(sec.indexOf("متطلبات الجهة المانحة"));
    return clause.includes(`(${'<span dir="ltr" class="num">OLAF</span>'})`)
      && !clause.includes('class="num">OLAF)</span>') && !/[A-Za-z]/.test(clause.replace(/<span dir="ltr" class="num">[\s\S]*?<\/span>/g, "").replace(/<[^>]*>/g, ""));
  })());
  // The class still allows "." inside a run (sanctionsmap.eu), so a sentence-ending stop would be
  // swallowed the same way the bracket was. The run is trimmed back to its last letter or digit.
  ok("a full stop ending the Arabic sentence stays outside the isolated run", (() => {
    const b = doc({ project: TRF, donorClauses: { en: "x", ar: "ضمن برنامج Brave Media." } });
    return b.includes('<span dir="ltr" class="num">Brave Media</span>.') && !b.includes('Brave Media.</span>');
  })());
  ok("an escaped entity in the Arabic is never cut in half, and runs are escaped inside the span", (() => {
    const b = doc({ project: TRF, donorClauses: { en: "x", ar: "مؤسسة سمير قصير & الاتحاد الأوروبي، ومنها AnaHon's حقوق." } });
    const sec = (b.match(/<section class="lang ar"[\s\S]*?<\/section>/) || [""])[0];
    const clause = sec.slice(sec.indexOf("متطلبات الجهة المانحة"));
    return clause.includes("&amp;") && !clause.includes("&amp;amp;") && !clause.includes('class="num">amp;</span>')
      && clause.includes('<span dir="ltr" class="num">AnaHon&#39;s</span>');
  })());
  ok("the English clause is NOT wrapped in RTL isolation spans — it is already LTR prose",
    !/<p><span dir="ltr" class="num">This subcontract/.test(d));
  ok("the route lets the form decide withholding per contract, and the form defaults it on",
    /const \{ employeeId[^}]*withholding \} = req\.body;/.test(server)
    && /withholding: withholding === undefined \|\| withholding === null \|\| withholding === "" \? undefined : !!withholding,/.test(server)
    && readFileSync(new URL("../src/tabs/PayrollTab.tsx", import.meta.url), "utf8").includes("checked={contractForm.withholding !== false}")); }

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
