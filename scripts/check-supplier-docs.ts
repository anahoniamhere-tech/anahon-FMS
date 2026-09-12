// What the procurement policy demands of a supplier, and the checklist that reports it.
//
// 6 Sep 2026 (Buying & paying). The twin of the personnel checklist, and the failure
// modes are its failure modes. A category spelling the vault actually uses but the list
// does not accept reports a properly papered supplier as unpapered — that exact mistake
// once produced a report claiming six contracted engagements had never been contracted.
// And a row demanded of a party the policy never demanded it from turns the whole
// checklist into a colour people stop reading: a taxi has no service agreement, and it
// must not be asked for one. Run: npx tsx scripts/check-supplier-docs.ts
import { readFileSync } from "node:fs";
import { REQUIRED_SUPPLIER, missingSupplierDocs, PARTY_KINDS, partyKindLabel, isTeamMember } from "../src/supplierDocs.js";
import { REQUIRED_PERSONNEL, missingPersonnelDocs } from "../src/personnelDocs.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const vendorsTab = readFileSync(new URL("../src/tabs/VendorsTab.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const supplierDocsSrc = readFileSync(new URL("../src/supplierDocs.ts", import.meta.url), "utf8");

// A shop we buy from, a consultant we engage, and the same two with papers on file.
const SHOP = { id: "ven-shop", active: true, engageable: false };
const SHOP_OK = { id: "ven-shop2", active: true, engageable: false };
const CONSULTANT = { id: "ven-con", active: true, engageable: true };
const CONSULTANT_OK = { id: "ven-con2", active: true, engageable: true };
const CLOSED = { id: "ven-closed", active: false, engageable: true };
const BLOCKED = { id: "ven-blocked", active: true, blocked: true, engageable: true };

const DOCS = [
  { category: "Vendor Registration Form", partyId: "ven-shop2" },
  { category: "Vendor Registration", partyId: "ven-con2" },
  // The generator's spelling, not the imported one — both have to answer.
  { category: "Contracts", partyId: "ven-con2" },
  // Filed against a purchase, not against the party: it answers for nobody.
  { category: "Contract", partyId: null },
  // A donor's grant, linked to a project. It must never satisfy a supplier's agreement.
  { category: "Grant Agreement", partyId: null },
  { category: "Receipts", partyId: "ven-shop" },
  { category: "Invoice", partyId: "ven-con" },
];
const gaps = (v: any) => missingSupplierDocs(DOCS, v).map(g => g.key).sort().join(",");

console.log("\nA. what an active supplier is asked for");
ok("a shop with nothing on file owes a registration form", gaps(SHOP) === "registration");
ok("and is NOT asked for a service agreement — a purchase needs a voucher, not a contract",
  !gaps(SHOP).includes("agreement"));
ok("receipts and invoices do not answer for a registration form", gaps(SHOP) === "registration");
ok("a consultant owes both the form and a signed agreement", gaps(CONSULTANT) === "agreement,registration");
ok("a papered shop owes nothing", gaps(SHOP_OK) === "");
ok("a papered consultant owes nothing", gaps(CONSULTANT_OK) === "");

console.log("\nB. spellings, which is where the personnel twin was bitten");
ok("the generator's \"Contracts\" satisfies the agreement", !gaps(CONSULTANT_OK).includes("agreement"));
ok("so does the old drive's \"Contract\"",
  missingSupplierDocs([{ category: "Contract", partyId: "ven-con" }], CONSULTANT).every(g => g.key !== "agreement"));
ok("and a signed addendum",
  missingSupplierDocs([{ category: "Contract Addendum (Signed)", partyId: "ven-con" }], CONSULTANT).every(g => g.key !== "agreement"));
ok("a donor's Grant Agreement never answers for a supplier — it carries no partyId",
  gaps(CONSULTANT).includes("agreement"));
ok("one party's papers never answer for another",
  gaps({ id: "ven-404", active: true, engageable: true }) === "agreement,registration");

console.log("\nC. who is asked nothing");
ok("a deactivated party is chased for nothing", gaps(CLOSED) === "");
ok("nor is a blocked one", gaps(BLOCKED) === "");

console.log("\nD. what the list deliberately does not demand");
const accepted = REQUIRED_SUPPLIER.flatMap(r => r.accepts);
// (§7.3's "when necessary" registration WAS excluded here; Saad made it necessary for
// organisations on 12 Sep 2026 — see section Z, where the party kind that gates it is defined.)
// §7.5's procurement file belongs to a purchase, and the voucher screen already checks it.
ok("nothing that belongs to a single purchase — quotation, PO, GRN, invoice, receipt",
  !accepted.some(c => /quotation|purchase order|goods received|invoice|receipt|voucher/i.test(c)));
// §7.7 binds staff, and Vendor.declarationSigned already records the vendor's side.
ok("no conflict declaration — the record carries that flag itself",
  !accepted.some(c => /declaration|conflict/i.test(c)));

console.log("\nE. the same shape as the personnel twin, because one desk rule calls both");
ok("both export a {key, label, accepts} list",
  REQUIRED_SUPPLIER.every(r => typeof r.key === "string" && typeof r.label === "string" && Array.isArray(r.accepts))
  && REQUIRED_PERSONNEL.every(r => typeof r.key === "string" && typeof r.label === "string" && Array.isArray(r.accepts)));
ok("both return the same {key, label} rows",
  JSON.stringify(Object.keys(missingSupplierDocs([], SHOP)[0] || {}).sort())
  === JSON.stringify(Object.keys(missingPersonnelDocs([], "emp-x")[0] || {}).sort()));
ok("the personnel list was not moved or rewritten for the sake of symmetry",
  REQUIRED_PERSONNEL.map(r => r.key).join(",") === "identity,cv,contract");
ok("and it stays free of the supplier's conditional row",
  !REQUIRED_PERSONNEL.some((r: any) => r.onlyIf));

console.log("\nF. the supplier record shows it");
ok("the register renders the gaps against the row's own vendor object",
  vendorsTab.includes("missingSupplierDocs(state.documents || [], v)"));
ok("ungated — a supplier file is not a personnel file",
  !/maySee\w+\([^)]*\) && \(\(\) => \{\s*const gaps = missingSupplierDocs/.test(vendorsTab));
ok("silent when there is nothing missing, on a table thirty rows deep",
  /const gaps = missingSupplierDocs\(state\.documents \|\| \[\], v\);\s*\n\s*if \(!gaps\.length\) return null;/.test(vendorsTab));

console.log("\nZ. a person or an organisation — the register's second axis (12 Sep 2026)");
const party = (over: Partial<Parameters<typeof missingSupplierDocs>[1]> = {}) =>
  ({ id: "ven-1", active: true, blocked: false, engageable: true, partyKind: "", userEmail: "", ...over }) as any;
ok("two kinds, and nothing else", PARTY_KINDS.map(k => k.key).join() === "individual,organisation");
ok("blank is its own answer, and it reads as one", partyKindLabel("") === "Not said yet" && partyKindLabel("individual") === "A person");
ok("an unknown word is not a kind", partyKindLabel("company") === "Not said yet");
ok("nothing is asked of a party whose kind nobody has said — the papers wait for the answer",
  !missingSupplierDocs([], party({ partyKind: "" })).some(g => ["identity", "cv"].includes(g.key)));
ok("a person we engage owes identity and a CV",
  missingSupplierDocs([], party({ partyKind: "individual" })).map(g => g.key).sort().join() === "agreement,cv,identity,registration");
ok("an organisation owes neither — they are papers about a human being",
  !missingSupplierDocs([], party({ partyKind: "organisation" })).some(g => ["identity", "cv"].includes(g.key)));
ok("nor does a party we only BUY from, whatever they are",
  !missingSupplierDocs([], party({ partyKind: "individual", engageable: false })).some(g => ["identity", "cv"].includes(g.key)));
ok("any of the three identity spellings the vault actually holds will answer",
  ["National ID", "Passport", "Residency / Work Permit"].every(c =>
    !missingSupplierDocs([{ category: c, partyId: "ven-1" }], party({ partyKind: "individual" })).some(g => g.key === "identity")));

// Saad overruled the old exclusion on 12 Sep 2026: an organisation owes its commercial record
// and its VAT details. It is asked of an organisation only — never of a person, and never of a
// party whose kind nobody has said — so it arrives as the register is classified, not all at once.
ok("an organisation owes its commercial record and its VAT registration",
  missingSupplierDocs([], party({ partyKind: "organisation" })).map(g => g.key).sort().join() === "agreement,commercial,registration,vat");
ok("a person owes neither — an ID and a CV answer the same question about a human being",
  !missingSupplierDocs([], party({ partyKind: "individual" })).some(g => ["commercial", "vat"].includes(g.key)));
ok("and a party whose kind nobody has said is asked for neither, yet",
  !missingSupplierDocs([], party({ partyKind: "" })).some(g => ["commercial", "vat"].includes(g.key)));
ok("asked of an organisation we only BUY from as well — who the counterparty legally is does not depend on that",
  missingSupplierDocs([], party({ partyKind: "organisation", engageable: false })).map(g => g.key).sort().join() === "commercial,registration,vat");
ok("the spelling the vault already holds will answer the tax line",
  !missingSupplierDocs([{ category: "Tax_Regularization", partyId: "ven-1" }], party({ partyKind: "organisation" })).some(g => g.key === "vat"));

console.log("\nZ2. a team member is the normal arrangement, not an anomaly");
// Saad, 12 Sep 2026: AnaHon has no employees — everyone is a service provider on an annual
// contract. So a row that is also a login is two views of one person, and their identity papers
// live in the personnel file; demanding a second copy here makes a second thing to disagree.
ok("the link is explicit, never a name that merely looks alike",
  isTeamMember(party({ userEmail: "omar@x" })) && !isTeamMember(party({ userEmail: "" })) && !isTeamMember(party({ userEmail: "   " })));
ok("a team member is not asked for identity or a CV again",
  !missingSupplierDocs([], party({ partyKind: "individual", userEmail: "omar@x" })).some(g => ["identity", "cv"].includes(g.key)));
ok("but still owes the papers that are about the ENGAGEMENT, not the person",
  missingSupplierDocs([], party({ partyKind: "individual", userEmail: "omar@x" })).map(g => g.key).sort().join() === "agreement,registration");
ok("the screen says what it is rather than flagging it unresolved",
  vendorsTab.includes('t("Team member, engaged as a service provider (annual contract)")')
  && !/classification unresolved/i.test(vendorsTab));
ok("and the suggestion is a question a person answers, not a match the system asserts",
  vendorsTab.includes('t("Same name as an account — is this a team member?")') && /window\.confirm\(/.test(vendorsTab));

console.log("\nZ3. nothing is inferred, and the withholding question is left open");
ok("the kind is never derived from the category string",
  !/partyKind = .*category|category.*=>.*partyKind/.test(server) && !/CATEGORY_TO_KIND|kindFromCategory/.test(supplierDocsSrc));
ok("the route accepts only the two kinds, or blank",
  /if \(next && !\(PARTY_KINDS as readonly \{ key: string \}\[\]\)\.some\(k => k\.key === next\)\)/.test(server));
ok("one login belongs to one row", /is already linked to that account — one person, one row/.test(server));
ok("a login that does not exist cannot be linked", /No account on this system uses that address/.test(server));
// Lebanese withholding lands differently on a service bought from a person, which is exactly
// why this axis matters to Finance — and exactly why nothing here touches it. Marwan's to answer.
ok("the party kind is never used to compute a withholding rate",
  !/partyKind[^\n]*wht|wht[^\n]*partyKind/i.test(server) && !/partyKind[^\n]*wht|wht[^\n]*partyKind/i.test(supplierDocsSrc));
ok("and no withholding rate appears in this module at all — the rate is Finance's, elsewhere",
  !/7\.5%|whtRate|withholdingRate/.test(supplierDocsSrc));
ok("the overruled exclusion is kept in the comment rather than deleted, with the consequence named",
  /Saad overruled that on 12 Sep 2026/.test(supplierDocsSrc) && /carry an open line until somebody files/.test(supplierDocsSrc));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
