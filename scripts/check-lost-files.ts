// Files lost from the vault (Books, 11 Oct 2026) — the list behind the Missing documents drawer.
// It must read the live per-document flag, group by project, name the posted vouchers, and never show a
// file that is back. Run:  npx tsx scripts/check-lost-files.ts
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lostFiles, lostBeyond } from "../src/lostFiles.js";
import LostFilesSection from "../src/LostFilesSection.js";
import { AR } from "../src/i18n.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const doc = (id: string, over: Record<string, any> = {}) =>
  ({ id, refNo: `ANH-DOC-${id}`, filename: `${id}.pdf`, category: "Invoice", linkedRecordType: "Project", linkedRecordId: "p-a", fileMissing: true, ...over });
const vouchers = [
  { id: "e1", voucherNo: "PV-2026-001", projectId: "p-a", status: "Posted" },
  { id: "e2", voucherNo: "PV-2026-002", projectId: "p-b", status: "Posted" },
  { id: "e3", voucherNo: "PV-2026-003", projectId: "p-b", status: "Draft" },
];
const projects = new Set(["p-a", "p-b"]);

console.log("\n1. only the live flag decides");
ok("a file that is back is not listed", lostFiles([doc("1", { fileMissing: false })], vouchers, projects).total === 0);
ok("a document with no flag at all is not listed", lostFiles([doc("1", { fileMissing: undefined })], vouchers, projects).total === 0);
ok("a note saying 'File missing' does not list a document whose flag is false",
  lostFiles([{ ...doc("1", { fileMissing: false }), note: "File missing — nothing in the vault at this record's path" } as any], vouchers, projects).total === 0);

console.log("\n2. grouped by project, with the voucher scans in their voucher's project");
const r = lostFiles([
  doc("1"), doc("2"), doc("3", { linkedRecordType: "Expense", linkedRecordId: "e1" }),
  doc("4", { linkedRecordType: "Expense", linkedRecordId: "e2" }), doc("5", { linkedRecordType: "Expense", linkedRecordId: "e3" }),
  doc("6", { linkedRecordType: "Content Reference", linkedRecordId: "-" }), doc("7", { linkedRecordType: "Meeting", linkedRecordId: "mtg-1" }),
], vouchers, projects);
const g = (id: string) => r.groups.find(x => x.projectId === id)?.rows.map(x => x.id).sort().join(",");
ok("a project's own papers and its voucher scans share one group", g("p-a") === "1,2,3");
ok("a voucher's scan goes to the voucher's project", g("p-b") === "4,5");
ok("editorial records with no project are listed, in a group of their own", g("") === "6,7");
ok("the no-project group comes last", r.groups[r.groups.length - 1].projectId === "");
ok("nothing is dropped: the groups add up to the total", r.total === 7 && r.groups.reduce((s, x) => s + x.rows.length, 0) === 7);
ok("a document linked to a project the viewer cannot see is not lost, it falls to no-project",
  lostFiles([doc("8", { linkedRecordId: "p-hidden" })], vouchers, projects).groups[0].projectId === "");

console.log("\n3. the posted vouchers are counted, by voucher");
ok("only Posted vouchers count, once each", r.vouchers === 2);
ok("two lost scans on one posted voucher count as one voucher",
  lostFiles([doc("1", { linkedRecordType: "Expense", linkedRecordId: "e1" }), doc("2", { linkedRecordType: "Expense", linkedRecordId: "e1" })], vouchers, projects).vouchers === 1);

console.log("\n4. each line opens its record");
const by = new Map(r.groups.flatMap(x => x.rows).map(x => [x.id, x]));
ok("a voucher scan opens the voucher", by.get("3")?.opens === "voucher" && by.get("3")?.recordId === "e1" && by.get("3")?.voucherNo === "PV-2026-001");
ok("a project paper opens the project", by.get("1")?.opens === "project" && by.get("1")?.recordId === "p-a");
ok("an editorial record opens the document itself", by.get("6")?.opens === "document" && by.get("6")?.recordId === "6");

console.log("\n5. the screen: read-only, bilingual, wired to the flag");
const app = read("src/App.tsx"), section = read("src/LostFilesSection.tsx");
ok("the section has no replace or upload control", !/type="file"|handleVoucherDocUpload|Replace|Re-attach</.test(section) && /data-lost-files/.test(section));
ok("the drawer mounts the section", /<LostFilesSection lost=\{lostVault\}/.test(app));
ok("it reads the per-document flag, not the nightly note", /lostFiles\(state\.documents/.test(app) && !/isMarked|MISSING_MARK/.test(app + section));
for (const k of ["Files lost from the vault", "of them are scans of posted vouchers", "Not tied to a project", "Missing documents",
  "The record is here, the scan is not.",
  "To re-attach, put the scan back at the record's own place — the Admin room can do it — and the line leaves this list by itself. A new upload makes a second record and leaves this one listed."])
  ok(`Arabic exists for «${k.slice(0, 40)}»`, !!AR[k] && /[؀-ۿ]/.test(AR[k]));
ok("the Arabic heading is the one Saad approved", AR["Files lost from the vault"] === "ملفات مفقودة من الأرشيف");
ok("the server sends the flag the list reads", /fileMissing: \(\(\) => \{ const f = vaultPathFromPointer\(d\.base64/.test(read("server.ts")));

console.log("\n6. the section on the page: a scratch lost document must appear, and a found one must not");
const T = (s: string) => s;
const show = (docsIn: any[]) => renderToStaticMarkup(React.createElement(LostFilesSection, {
  lost: lostFiles(docsIn, vouchers, projects), project: (id: string) => (id === "p-a" ? { code: "P-A", name: "Alpha" } : undefined), t: T, onOpen: () => {} }));
const lostHtml = show([doc("zz-scratch", { filename: "scratch-receipt.pdf", refNo: "ANH-DOC-99999" })]);
ok("a scratch document with fileMissing true appears, by reference, name and category",
  /ANH-DOC-99999/.test(lostHtml) && /scratch-receipt\.pdf/.test(lostHtml) && /Invoice/.test(lostHtml) && /Files lost from the vault/.test(lostHtml));
ok("the same document, file back, renders nothing at all", show([doc("zz-scratch", { fileMissing: false })]) === "");
ok("a voucher's scan shows its voucher number beside the reference", /PV-2026-001/.test(show([doc("zz-v", { linkedRecordType: "Expense", linkedRecordId: "e1" })])));
ok("the section says how to re-attach, and that a new upload leaves the old record listed", /A new upload makes a second record and leaves this one listed/.test(lostHtml));

console.log("\n7. the badge");
const two = lostFiles([doc("1"), doc("2", { linkedRecordType: "Expense", linkedRecordId: "e1" })], vouchers, projects);
ok("every lost file adds to the badge", lostBeyond(two, new Set()) === 2);
ok("a voucher the evidence register already counts is one item, not two", lostBeyond(two, new Set(["e1"])) === 1);
ok("the drawer's badge is the spend gaps plus the lost files", /const gapBadge = evidenceGaps\.total \+ lostBeyond\(lostVault,/.test(app) && /\{gapBadge > 0 && !gapsOpen/.test(app));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
