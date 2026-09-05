// Telling a supplier their voucher was paid.
//
// 6 Sep 2026 (Buying & paying). Three things can go quietly wrong. A number the save
// route accepts but waLink() refuses is a button that is permanently dead, so the two
// rules about what a number looks like have to agree. The message quotes money, so it
// must quote what actually left the account — the gross overstates every payment that
// had withholding tax taken off it, and a supplier reading a figure larger than their
// bank shows will call about it. And the button must appear only once the money has
// gone: offering "we have paid you" on an unapproved request is a lie the system tells
// in AnaHon's name. Run: npx tsx scripts/check-supplier-whatsapp.ts
import { readFileSync } from "node:fs";
import { waLink, WA_TEMPLATES } from "../src/tabs/shared.js";
import { ROUTE_SEATS } from "../src/gates.js";
import { SUPPLIER_EDITORS } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const expenses = read("src/tabs/ExpensesTab.tsx");
const vendors = read("src/tabs/VendorsTab.tsx");
const t = (s: string) => s;

console.log("\nA. the save route and the link agree about what a number is");
// The route's own rule, lifted from the file so the two cannot drift apart silently.
const ROUTE_RULE = /const next = String\(phone \?\? ""\)\.replace\(\/\[\\s\(\)-\]\/g, ""\);\s*if \(next && !\/\^\\\+\[1-9\]\\d\{7,14\}\$\/\.test\(next\)\)/;
ok("the vendor route trims spaces and brackets, then demands +<country><digits>",
  ROUTE_RULE.test(server.slice(server.indexOf('app.post("/api/vendors/phone"'))));
for (const n of ["+9613137217", "+96171234567", "+12025550123", "+447700900123"]) {
  ok(`a number the route accepts can be dialled: ${n}`, waLink(n, "x") !== null);
}
ok("and one it refuses would not have dialled anyway: 03 137 217", waLink("03 137 217", "x") === null);
ok("empty is how a wrong number is removed, and removes the button with it", waLink("", "x") === null);

console.log("\nB. the message says what actually left the account");
const msg = WA_TEMPLATES["supplier-paid"](t, { name: "Leila", voucherNo: "PV-0042", amount: "925.00 USD", date: "2026-09-01" });
ok("it names the voucher, the sum and the date", msg.includes("PV-0042") && msg.includes("925.00 USD") && msg.includes("2026-09-01"));
ok("it signs itself so the reader knows who wrote it", msg.trim().endsWith("— AnaHon"));
ok("the caller sends the net, not the gross — WHT is withheld, not paid to the supplier",
  /const net = exp\.netAmount \|\| \(\(exp\.amount \|\| 0\) - \(exp\.whtAmount \|\| 0\)\)/.test(expenses));
ok("in the currency the voucher was paid in, not converted to USD",
  /amount: `\$\{net\.toLocaleString\([^`]*\)\} \$\{exp\.currency\}`/.test(expenses));
ok("dated from when it was paid", /date: exp\.paid_at \|\| exp\.created_at/.test(expenses));

console.log("\nC. when the button appears");
ok("only once the money has gone — Paid or Posted, never Draft/Submitted/Approved",
  /\["Paid", "Posted"\]\.includes\(exp\.status\) && vendor && \(\(\) => \{/.test(expenses));
ok("a direct reimbursement has no supplier row, so no button", expenses.includes('exp.status) && vendor &&'));
// People gated their nudge on HR; this one has no seat of its own on purpose, so the
// guard line must mention the status and the vendor and nothing about currentUser.
const guardLine = expenses.split("\n").find(l => l.includes('["Paid", "Posted"].includes(exp.status)')) || "";
ok("no role list of its own — the screen already decides who may see a paid voucher",
  guardLine !== "" && !guardLine.includes("currentUser.role"));

console.log("\nD. no number, and the reason is readable");
const disabled = expenses.slice(expenses.indexOf('💬 {t("Tell the supplier")} — {t("no WhatsApp number on file")}') - 400);
ok("the reason is the button's own label, not a tooltip nobody hovers on a phone",
  expenses.includes('💬 {t("Tell the supplier")} — {t("no WhatsApp number on file")}'));
ok("and it is a disabled button, not a link that goes nowhere",
  /disabled\s*\n\s*className="[^"]*cursor-not-allowed/.test(disabled));
ok("the live one is a real link a person presses Send inside",
  /href=\{link\}\s*\n\s*target="_blank"/.test(expenses));

console.log("\nE. who may set the number");
ok("the route is gated to whoever edits the supplier register",
  ROUTE_SEATS["/api/vendors/phone"] === SUPPLIER_EDITORS);
ok("the same seats as registering a supplier — not a fresh list",
  ROUTE_SEATS["/api/vendors/phone"] === ROUTE_SEATS["/api/vendors/new"]);
ok("the Procurement Officer's allowlist carries it, or their gate would pass and the seat refuse",
  /"\/api\/vendors\/new", "\/api\/vendors\/payment-doc", "\/api\/vendors\/phone",/.test(server));
ok("the field sits on the supplier record, under that same list",
  /SUPPLIER_EDITORS\.includes\(currentUser\.role\) \? \(/.test(vendors) && vendors.includes(`id={\`ven-phone-\${v.id}\`}`));
ok("everyone else who can read the row reads the number — a supplier is not a personnel file",
  /\) : v\.phone \? \(/.test(vendors));
ok("registration can record it at onboarding instead of a second visit",
  /phone: newVendorPhone,/.test(vendors));
ok("dir=\"ltr\" on the inputs, or a + lands on the wrong end in Arabic",
  (vendors.match(/dir="ltr"/g) || []).length >= 2);

console.log("\nF. the audit log records the change without collecting the digits");
const audit = server.slice(server.indexOf('app.post("/api/vendors/phone"'), server.indexOf('app.post("/api/vendors/phone"') + 2000);
ok("it says a number was recorded, changed or removed, and names the supplier",
  /"Vendor Phone Set" : "Vendor Phone Cleared"/.test(audit) && /supplier record of \$\{vendor\.name\}/.test(audit));
ok("but never prints the number itself", !/\$\{next\}/.test(audit));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
