// Policy P11 §6 — payments to protected sources (15 Sep 2026).
//   npx tsx scripts/check-sources.ts
import { readFileSync } from "node:fs";
import { nextSourceCode, maySealedRead, confidentialRaiseBlocker, reviewDue, quarterStart, hasSealedReceipt, CONFIDENTIAL_PURPOSE } from "../src/sources.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const between = (from: string, to: string) => { const i = server.indexOf(from); return i < 0 ? "" : server.slice(i, server.indexOf(to, i + from.length)); };

console.log("\nA. the code name, and who opens the sealed file");
ok("code names count up within the year", nextSourceCode("2026", []) === "Source S-2026-01" && nextSourceCode("2026", ["Source S-2026-01", "Source S-2026-09", "Source S-2025-12"]) === "Source S-2026-10");
ok("a new year starts at 01", nextSourceCode("2027", ["Source S-2026-14"]) === "Source S-2027-01");
ok("the ED opens it", maySealedRead({ role: "Super Admin" }, ""));
ok("the Finance Officer opens it", maySealedRead({ role: "Finance Officer" }, ""));
ok("not the ED standing in another seat", !maySealedRead({ role: "Super Admin" }, "Finance Officer"));
ok("not the Program Director seat, the auditor, the logistics officer", ["Program Director", "Auditor / Read-Only Reviewer", "Procurement and Logistics Officer"].every(r => !maySealedRead({ role: r }, "")));
ok("not a deactivated account", !maySealedRead({ role: "Finance Officer", active: false }, ""));
ok("a confidential request names no supplier", /names no supplier/.test(confidentialRaiseBlocker({ vendorId: "ven-1" })) && confidentialRaiseBlocker({ vendorId: "" }) === "");
ok("the review falls due each quarter, only when there is something to review",
  quarterStart("2026-09-15") === "2026-07-01" && reviewDue("2026-06-30", "2026-09-15", true) && !reviewDue("2026-07-02", "2026-09-15", true) && !reviewDue("", "2026-09-15", false));
ok("the receipt signed in the real name proves only its own payment",
  hasSealedReceipt([{ kind: "signed-receipt", expenseId: "e1" } as any], "e1") && !hasSealedReceipt([{ kind: "signed-receipt", expenseId: "e1" } as any], "e2") && !hasSealedReceipt([{ kind: "identity", expenseId: "e1" } as any], "e1"));

console.log("\nB. the identity never leaves the sealed file");
const raise = between('app.post("/api/expense/new"', "// Lock committed budget");
const conf = raise.slice(raise.indexOf("if (confidential === true)"), raise.indexOf("const count = await prisma.expense.count()"));
ok("the raise route is read (not a truncated slice)", raise.length > 4000 && conf.length > 500);
ok("the voucher's title becomes the code name and its purpose a fixed sentence", /title = file!\.codeName;/.test(conf) && /purpose = CONFIDENTIAL_PURPOSE;/.test(conf) && CONFIDENTIAL_PURPOSE === "Confidential payment — Policy P11 §6");
const load = between("async function loadState", "\n}\n");
ok("loadState is read", load.length > 20000);
ok("loadState reads the sealed files only for the receipt yes/no — never a name, contact or identity",
  /prisma\.sourceFile\.findMany\(\{ select: \{ id: true, docsJson: true \} \}\)/.test(load) && !/realName|idDocument|sanctionsResult/.test(load));
ok("the review sent to the ED and FO is code names and totals", /confidentialReview: viewer && \["Super Admin", "Finance Officer"\]\.includes\(viewer\.role\) \? confidentialReview : null/.test(server));
const sealed = between("/* ── Policy P11 §6: sealed source files", "/** The ED, as themselves.");
ok("the sealed routes are read", sealed.length > 3000);
ok("every sealed route asks sealedReader (or the ED-only review) before anything else",
  (sealed.match(/const me = sealedReader\(req\);/g) || []).length === 4 && /me\.role !== "Super Admin" \|\| String\(req\.get\("X-Acting-As"\)/.test(sealed));
ok("every opening and refusal of a sealed file is in the read log",
  /\[\/\^\\\/api\\\/sources\\\/\[\^\/\]\+\$\/, "Sealed source file"\]/.test(server) && /\/\^\\\/api\\\/sources\\\/\[\^\/\]\+\\\/document\\\/\[\^\/\]\+\$\/, "Sealed source file, a paper"/.test(server));
ok("sealed papers are files on the sealed file, never AppDoc rows", !/appDoc/.test(sealed) && /path\.join\("SEALED", f\.id/.test(sealed));
ok("the vault file is named by id, never by the person", /`\$\{id\}\$\{ext\}`/.test(sealed));
ok("audit lines name the code name and the fields, never the values",
  !(sealed.match(/createAuditLog\([^;]*;/g) || []).some(c => /\$\{[^}]*(realName|contact|idDocument|sanctionsNote|filename)/.test(c)));
ok("nothing ordinary can be filed on a confidential payment", /if \(target\?\.confidential\) return res\.status\(403\)/.test(between('app.post("/api/document/upload"', "const signedReceipt")));
ok("the consultant pack and the document routes never touch a sealed file",
  !/sourceFile|SEALED/.test(read("src/consultantPack.ts")) && !/sourceFile|SEALED/.test(between('app.get("/api/document/:id/pdf"', 'app.post("/api/document/upload"')));

console.log("\nC. confidential is never a way round a finance rule (Policy P11 §6)");
const idx = (re: RegExp) => { const m = raise.search(re); return m < 0 ? Infinity : m; };
const at = idx(/if \(confidential === true\)/);
ok("the flag is decided only after the project, closed-grant, budget-line, cost-account, date and procurement checks",
  [/scopedProjectIds/, /is closed — its budget is settled/, /Policy 2\.4 violation/, /Choose what kind of cost this is/, /The transaction date must be a real date/, /Policy 7\.2: this request/].every(r => idx(r) < at));
ok("the flag's own block creates no voucher and answers nothing — the one create below runs for everyone", !/expense\.create|res\.json/.test(conf));
const action = between('app.post("/api/expense/action"', 'app.post("/api/expense/direct-petty-cash"');
ok("approval, the approver-never-pays-cash rule, cash limits and posting never ask whether a payment is confidential",
  action.length > 10000 && !/confidential|sourceId/.test(action));
ok("direct cash payments cannot be confidential at all", !/confidential|sourceId/.test(between('app.post("/api/expense/direct-petty-cash"', 'app.post("/api/procurement/new"')));
ok("the gate for raising is the same seat list as ever", !/confidential/.test(read("src/gates.ts").split("\n").filter(l => l.includes('"/api/expense/new"')).join("")));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
