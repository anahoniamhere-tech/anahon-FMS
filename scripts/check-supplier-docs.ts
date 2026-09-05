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
import { REQUIRED_SUPPLIER, missingSupplierDocs } from "../src/supplierDocs.js";
import { REQUIRED_PERSONNEL, missingPersonnelDocs } from "../src/personnelDocs.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const vendorsTab = readFileSync(new URL("../src/tabs/VendorsTab.tsx", import.meta.url), "utf8");

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
// §7.3 asks for legal registration only "when necessary"; a foreign software vendor has
// no Lebanese MoF number, and the 7.5% withholding already enforces the consequence.
ok("no tax or legal registration certificate",
  !accepted.some(c => /tax|registr(y|ation) certificate|MoF/i.test(c)));
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

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
