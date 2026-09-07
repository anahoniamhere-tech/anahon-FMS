// Which paper fills a project's four core slots.
//
// 7 Sep 2026. Saad found Ahmad's staff contract shown as Thomson Reuters' signed agreement.
// The rows below are the real ones from the live vault, because the bug was not in the idea
// of matching — it was in what the actual data looks like: six staff contracts filed as
// "Contract" whose names read "Service agreement", seven FPU attachments all filed as
// "Grant Agreement", and a budget filed as a Financial Report.
// Run: npx tsx scripts/check-core-docs.ts
import { pickCoreDoc, CORE_PATTERNS, CORE_CATEGORIES, NEVER_CORE, normCategory } from "../src/coreDocs.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const d = (refNo: string, category: string, filename: string, created_at: string) => ({ refNo, category, filename, created_at });
const pick = (key: string, docs: any[]) => pickCoreDoc(key, CORE_PATTERNS[key], docs);

console.log("\nA. Thomson Reuters — the reported bug");
const TRF = [
  d("ANH-DOC-00001", "Budget", "Budget_IMS Grantee_Anahon2.xlsx", "2026-07-13T06:30:33Z"),
  d("ANH-DOC-00002", "Financial Report", "Budget_IMS_Grantee_Anahon2_5months_UPDATED.xlsx", "2026-07-13T06:48:44Z"),
  d("ANH-DOC-00007", "Contract", "Adjusted_Ahmad_2_New.pdf", "2026-07-13T07:02:13Z"),
  d("ANH-DOC-00008", "Contract", "Adjusted_Saad_1_New.pdf", "2026-07-13T07:02:13Z"),
  d("ANH-DOC-00134", "Contract Addendum (Signed)", "Addendum1_Ahmad_Ayshan.docx.pdf", "2026-07-26T00:32:59Z"),
  d("ANH-DOC-00566", "Grant Agreement", "Sub Grant Amendment 001- Anahon TRF signed.pdf", "2026-08-14T15:51:04.352Z"),
  d("ANH-DOC-00568", "Grant Agreement", "updated Sub-Grant Template (SKF) Anahon.pdf", "2026-08-14T15:51:04.358Z"),
];
ok("Ahmad's staff contract no longer fills the agreement slot",
  pick("Agreement", TRF)?.refNo !== "ANH-DOC-00007", String(pick("Agreement", TRF)?.filename));
ok("a Grant Agreement does", normCategory(pick("Agreement", TRF)!.category) === "grant agreement");
ok("the newest of the two grant agreements wins, the other stays behind replace / add",
  pick("Agreement", TRF)?.refNo === "ANH-DOC-00568");
ok("the budget slot takes the paper filed AS a budget, not the one filed as a Financial Report",
  pick("Budget", TRF)?.refNo === "ANH-DOC-00001");
ok("a project with no proposal on file says so", pick("Proposal", TRF) === undefined);

console.log("\nB. a staff contract can never take the slot, however it is named or filed");
for (const category of ["Contract", "Contracts", "Contract Addendum (Signed)"]) {
  const only = [d("ANH-DOC-00100", category, "Service agreement Mohamad Kabbara.pdf", "2026-01-01T00:00:00Z")];
  ok(`"${category}" holding a file called "Service agreement …" leaves the slot empty`,
    pick("Agreement", only) === undefined);
}
ok("the word contract is gone from the agreement pattern", !/contract/.test(CORE_PATTERNS.Agreement.source));
ok("and from the agreement's category list", !CORE_CATEGORIES.Agreement.some(c => c.includes("contract")));

console.log("\nC. the near-duplicate categories, folded");
// Free text has drifted; these pairs are the same kind of paper and are treated as one.
ok("Agreement and Grant Agreement both fill the agreement slot",
  !!pick("Agreement", [d("A", "Agreement", "x.pdf", "1")]) && !!pick("Agreement", [d("B", "Grant Agreement", "x.pdf", "1")]));
ok("Proposal and Proposals are the same slot",
  !!pick("Proposal", [d("A", "Proposals", "x.pdf", "1")]));
ok("Contract and Contracts are both refused",
  ["contract", "contracts"].every(c => NEVER_CORE.some(n => normCategory(c).startsWith(n))));
ok("Invoice, Invoices and Invoice (Reference) are one category and all refused",
  ["Invoice", "Invoices", "Invoice (Reference)"].every(c => NEVER_CORE.some(n => normCategory(c).startsWith(n))));
ok("Timesheet Rev.2 (Signed) is still a timesheet",
  NEVER_CORE.some(n => normCategory("Timesheet Rev.2 (Signed)").startsWith(n)));
ok("Financial Report (FPU Corrected) is still a financial report",
  NEVER_CORE.some(n => normCategory("Financial Report (FPU Corrected)").startsWith(n)));

console.log("\nD. FPU-2025 — seven papers under one category");
const FPU = [
  d("ANH-DOC-00152", "Contract", "FPU-Anahon Subgrant for countersignature.pdf", "2026-07-26T02:06:03Z"),
  d("ANH-DOC-00153", "Budget", "Attachment II Budget_Anahon.xlsx", "2026-07-26T02:06:03Z"),
  d("ANH-DOC-00236", "Grant Agreement", "Attachment I bis Concept and implementation design Anahon.docx", "2026-07-26T02:50:28Z"),
  d("ANH-DOC-00237", "Grant Agreement", "Attachment I Narrative proposal AnaHon.docx", "2026-07-26T02:50:28Z"),
  d("ANH-DOC-00239", "Grant Agreement", "Attachment III Activity timetable Anahon.xlsx", "2026-07-26T02:50:28Z"),
  d("ANH-DOC-00243", "Contract", "Copy of Contract_Contract_Ahmad Ayshan_Event_Logistics.docx", "2026-07-26T02:50:28Z"),
  d("ANH-DOC-00248", "Grant Agreement", "FPU-Anahon Subgrant for countersignature.pdf", "2026-07-26T02:50:28Z"),
];
ok("the sub-grant wins the agreement slot, not the copy filed as a Contract",
  pick("Agreement", FPU)?.refNo === "ANH-DOC-00248");
ok("the budget comes from the paper filed as a Budget", pick("Budget", FPU)?.refNo === "ANH-DOC-00153");
// Nothing on FPU is filed as "Proposal" or "Timetable", so these two ride the fallback —
// and the fallback is allowed to read a Grant Agreement, which is a core paper, unlike a
// timesheet or a voucher.
ok("the narrative proposal is still found by name when no category says Proposal",
  pick("Proposal", FPU)?.refNo === "ANH-DOC-00237");
ok("so is the activity timetable", pick("Timetable", FPU)?.refNo === "ANH-DOC-00239");

console.log("\nE. SKF-2025-INVJ — three papers under 'Agreement', only one is the agreement");
const SKF = [
  d("ANH-DOC-00312", "Agreement", "Grant Agreement_SKF-Anahon_MIIM Inv_June 2025-signed.pdf", "2026-07-31T16:47:48.119358Z"),
  d("ANH-DOC-00313", "Agreement", "Proposal_Anahon_2 (1).docx", "2026-07-31T16:47:48.119358Z"),
  d("ANH-DOC-00314", "Agreement", "SKF_Call for Proposals_Investigative Journalism Grant.pdf", "2026-07-31T16:47:48.119358Z"),
  d("ANH-DOC-00316", "Contracts", "Service_agreement_Saad Matar_AI.pdf", "2026-07-31T16:47:48.119358Z"),
];
// All four were filed in one import, so "newest" cannot separate them and the reference
// number would hand the slot to the call for proposals. The filename decides among equals.
ok("the signed grant agreement wins over the call for proposals filed beside it",
  pick("Agreement", SKF)?.refNo === "ANH-DOC-00312", String(pick("Agreement", SKF)?.filename));
ok("and over the staff contract, which is not in the running at all",
  pick("Agreement", SKF)?.refNo !== "ANH-DOC-00316");

console.log("\nF. newest first, and the tie");
const twoBudgets = [
  d("ANH-DOC-00297", "Budget", "AnaHon_Budget_SKF.xlsx", "2026-07-30T14:44:15.999Z"),
  d("ANH-DOC-00315", "Budget", "FinalEdits_Budget_SKF_InvestigativeReport.xlsx", "2026-07-31T16:47:48.119358Z"),
];
ok("the later filing wins", pick("Budget", twoBudgets)?.refNo === "ANH-DOC-00315");
ok("an exact tie falls back to the higher reference number", pick("Budget", [
  d("ANH-DOC-00010", "Budget", "budget a.xlsx", "2026-01-01T00:00:00Z"),
  d("ANH-DOC-00011", "Budget", "budget b.xlsx", "2026-01-01T00:00:00Z"),
])?.refNo === "ANH-DOC-00011");
ok("a document with no date is not mistaken for the newest", pick("Budget", [
  d("ANH-DOC-00020", "Budget", "budget old.xlsx", ""),
  d("ANH-DOC-00021", "Budget", "budget new.xlsx", "2026-05-01T00:00:00Z"),
])?.refNo === "ANH-DOC-00021");

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
