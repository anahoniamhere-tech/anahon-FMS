// The external consultant's reports and month pack — Policy 020 §4.3, §12.1, §12.4 (Books, 15 Sep 2026).
//
// Pins the three things that must never go wrong: an identity paper, a personnel paper or a source's file
// never reaches the consultant; only the Finance seats get the files, and only the Finance Officer — by
// person — prepares a reconciliation; a record added late shows in the next pack.
//   npx tsx scripts/check-consultant-pack.ts
import { readFileSync } from "node:fs";
import { packExcludes, reconcileMarkBlocker, lateRecords, monthBounds, openItems, trialBalance, legsOf, paymentDate, safeName, RECONCILER_SEAT } from "../src/consultantPack.js";
import { isSourceMaterial } from "../src/editorialGates.js";
import { pairFxLegs } from "../src/fxPairs.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const gates = read("src/gates.ts");
const route = (start: string) => { const a = server.indexOf(start); return a < 0 ? "" : server.slice(a, server.indexOf("\n});\n", a)); };

console.log("\n1. nothing identifying a person, and no source material, goes to the consultant");
const fixture = [
  { name: "an ID card", doc: { category: "National ID", linkedRecordType: "Expense" } },
  { name: "a passport", doc: { category: "Passport", linkedRecordType: "Employee" } },
  { name: "a source file", doc: { category: "Interview recording", linkedRecordType: "Content Reference" } },
  { name: "a CV", doc: { category: "CV", linkedRecordType: "Employee" } },
  { name: "a payslip", doc: { category: "Payslip", linkedRecordType: "Employee" } },
  { name: "reference material filed on a payment", doc: { category: "Reference Material", linkedRecordType: "Expense" } },
];
for (const f of fixture) ok(`${f.name} is withheld`, packExcludes(f.doc) !== "", f.doc.category);
for (const c of ["Invoice", "Receipts", "Contract", "Contracts", "Grant Agreement", "Missing-Receipt Declaration (signed)", "Digitized"]) ok(`a ${c} is sent`, packExcludes({ category: c, linkedRecordType: "Expense" }) === "");
ok("the personnel half is the vault's own rule, not a second copy", /isPersonnelDoc\(\{ category: doc\.category/.test(read("src/consultantPack.ts")) && !/"Passport"/.test(read("src/consultantPack.ts")));
ok("the source rule lives with Editorial, shared by the newsroom and the pack", isSourceMaterial({ linkedRecordType: "Meeting" }) && /export function isSourceMaterial/.test(read("src/editorialGates.ts")));
const pack = route('app.post("/api/consultant/pack"');
ok("every document is screened before it is copied into the zip", /const copyDoc = \(folder: string, d: any\) => \{\s*const why = packExcludes\(d\);\s*if \(why\) \{ excluded\.set/.test(pack));
const candidatesFn = server.slice(server.indexOf("async function packCandidates("), server.indexOf("function withheldOf("));
ok("documents enter only by whitelist: the month's payments, their declarations, the agreements relied on",
  /for \(const e of b\.paid\)/.test(candidatesFn) && (candidatesFn.match(/out\.push\(/g) || []).length === 4
  && /for \(const c of candidates\) copyDoc\(c\.folder, c\.doc\)/.test(pack) && (pack.match(/copyDoc\(/g) || []).length === 1);
ok("a file missing from the vault is listed, never silently dropped", /"missing from vault"/.test(pack) && /Missing from the vault \(listed in the manifest, not silently dropped\)/.test(pack));

{
  // Editorial's review, 15 Sep 2026: the source rule is broad on purpose, so Finance must see WHICH document a pack
  // held back and why — on the panel, for Finance seats, by reference and category, never by name, never in the zip.
  const overview = route('app.get("/api/consultant/overview"');
  ok("the panel is told what the pack withholds, from the same candidates the pack is built from",
    /const withheld = withheldOf\(\(await packCandidates\(b\)\)\.candidates\)/.test(overview) && /const \{ candidates, declarations \} = await packCandidates\(b\)/.test(pack) && /for \(const c of candidates\) copyDoc\(c\.folder, c\.doc\)/.test(pack));
  const withheldFn = server.slice(server.indexOf("function withheldOf("), server.indexOf("const CONSULTANT_REPORTS"));
  ok("…by reference, category and reason — never the filename", /refNo: doc\.refNo \|\| "", category: doc\.category, reason/.test(withheldFn) && !/filename/.test(withheldFn.replace(/\/\*\*[\s\S]*?\*\//, "")));
  ok("…and the zip still only counts them", /document\(s\) withheld: \$\{why\}/.test(pack) && !/withheldOf\(/.test(pack));
}

console.log("\n2. Finance seats only; the Finance Officer, by person, prepares a reconciliation (§4.3)");
ok("the Finance Officer may prepare one", reconcileMarkBlocker({ role: RECONCILER_SEAT }) === "");
ok("the Executive Director may not, and the refusal cites §4.3", /§4\.3/.test(reconcileMarkBlocker({ role: "Super Admin" })) && reconcileMarkBlocker({ role: "Program Director" }) !== "");
ok("…checked on the person's own seat, so standing in as the Finance Officer changes nothing", /const person = \(req as any\)\.dbUser;\s*const refused = reconcileMarkBlocker\(person\)/.test(route('app.post("/api/consultant/reconciliation/mark"')));
for (const r of ['app.get("/api/consultant/overview"', 'app.get("/api/consultant/report"']) ok(`${r.slice(9, -1)} refuses anyone outside the Finance seats`, /const reader = await financeReader\(req\);\s*if \(!reader\) return res\.status\(403\)/.test(route(r)));
ok("financeReader reads the person's seat from the database", /reader && reader\.active && FINANCE_SEATS\.includes\(reader\.role\)/.test(server));
ok("the pack and the review refuse a seat outside Finance", /if \(!FINANCE_SEATS\.includes\(user\?\.role\)\) return res\.status\(403\)/.test(pack) && /if \(!FINANCE_SEATS\.includes\(user\?\.role\)\) return res\.status\(403\)/.test(route('app.post("/api/consultant/reconciliation/review"')));
ok("the POST routes are Finance's in the gate table", ["/api/consultant/pack", "/api/consultant/reconciliation/mark", "/api/consultant/reconciliation/review"].every(p => new RegExp(`"${p.replace(/\//g, "\\/")}": BOOKS`).test(gates)));
ok("every export and the pack are audit-logged", /"Consultant Report Exported"/.test(server) && /"Consultant Month Pack Produced"/.test(server) && /"Reconciliation Prepared"/.test(server) && /"Consultant Review Filed"/.test(server));

console.log("\n3. a record added late appears in the next pack");
const packs = [{ month: "2026-08", producedAt: "2026-09-16T09:00:00.000Z" }];
const rows = [
  { kind: "Payment request", id: "PV-LATE", trueDate: "2026-08-20", recordedAt: "2026-09-20T08:00:00.000Z", label: "backfilled after the pack" },
  { kind: "Payment request", id: "PV-ONTIME", trueDate: "2026-08-20", recordedAt: "2026-09-01T08:00:00.000Z", label: "in before the pack" },
  { kind: "Payment request", id: "PV-SEPT", trueDate: "2026-09-10", recordedAt: "2026-09-20T08:00:00.000Z", label: "a month not yet packed" },
];
const late = lateRecords(packs, rows);
ok("a record dated into a packed month and recorded after the pack is listed", late.rows.some(r => r.id === "PV-LATE"));
ok("one recorded before the pack is not", !late.rows.some(r => r.id === "PV-ONTIME"));
ok("one dated into a month no pack covered is not late", !late.rows.some(r => r.id === "PV-SEPT"));
ok("with no pack yet, nothing is late", lateRecords([], rows).rows.length === 0);
ok("the pack reads recording time, never the true date, and stores what it produced", /recordedAt: e\.created_at/.test(server) && /prisma\.consultantPack\.create/.test(pack));

console.log("\n4. the figures");
ok("a month runs from its first to its last day", monthBounds("2026-02").end === "2026-02-28" && monthBounds("2026-08").start === "2026-08-01");
const entries = [
  { id: "a", date: "2026-08-02", journal: "Bank", referenceNo: "BT-x", description: "in", itemsJson: JSON.stringify([{ accountCode: "1100", debit: 100 }, { accountCode: "2900", credit: 100 }]) },
  { id: "b", date: "2026-08-20", journal: "Adjustment", referenceNo: "BT-x", description: "placed", itemsJson: JSON.stringify([{ accountCode: "2900", debit: 100 }, { accountCode: "6400", credit: 100 }]) },
  { id: "c", date: "2026-09-02", journal: "Bank", referenceNo: "BT-y", description: "later", itemsJson: JSON.stringify([{ accountCode: "1100", debit: 50 }, { accountCode: "2900", credit: 50 }]) },
];
const legs = legsOf(entries);
ok("a suspense line placed by a correcting entry is no longer open", openItems(legs, "2900", "2026-08-31", "Liability").length === 0);
ok("a line after the month end is not in that month's schedule", openItems(legs, "2900", "2026-09-30", "Liability").length === 1);
const tb = trialBalance(legs, [{ code: "1100", name: "Bank", type: "Asset" }, { code: "2900", name: "Suspense", type: "Liability" }, { code: "6400", name: "Software", type: "Expense" }], "2026-08-31", 1.14);
ok("the trial balance is as at the month end", tb.find(r => r.code === "1100")!.balanceUSD === 100 && tb.find(r => r.code === "6400")!.balanceUSD === -100);
ok("paid in the month = the payment line's date, else paid_at", paymentDate({ voucherNo: "PV-1", paid_at: "2026-09-02T00:00:00Z" }, new Map([["PV-1", "2026-08-30"]])) === "2026-08-30" && paymentDate({ voucherNo: "PV-2", paid_at: "2026-09-02T00:00:00Z" }, new Map()) === "2026-09-02");
ok("the 2910 schedule uses the rebuild's own pairing", /pairFxLegs\(fxLegsAll\)/.test(server) && /from "\.\.\/src\/fxPairs\.js"/.test(read("prisma/rebuild-ledger.ts"))
  && pairFxLegs([{ id: "e", date: "2026-09-08", eur: true, type: "Withdrawal", net: -342.18, reversal: false }]).unpaired.length === 1);
ok("file names in the zip cannot climb out of their folder", !safeName("../../etc/passwd").includes("/") && safeName("a/b") === "a-b");

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
