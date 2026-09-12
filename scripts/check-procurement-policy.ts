// The procurement threshold, and the fact that it is one number.
//
// It was typed into six places — the route that refuses a voucher, the form that asks for the
// authority, the procurement screen's note, the missing-documents counter and two help
// answers. When Saad raised it from USD 300 to USD 1,000 on 12 Sep 2026 (Accounting Policy
// 020) five of those six would have kept saying 300, and the screens would have quietly
// disagreed with the server. This pins the figure to src/procurementPolicy.ts and refuses a
// call site that hardcodes it again.
//
// Two figures are deliberately NOT this one and must not be dragged along with it: the USD
// 300 petty-cash ceiling (4.4.1) and the USD 150 director's approval for cash (4.4.2). They
// are about how money leaves the building, not how a supplier was chosen.
import { readFileSync } from "node:fs";
import { QUOTES_REQUIRED_ABOVE, TWO_QUOTES_FROM, THRESHOLD_LABEL, needsProcurement, quotationsRequired } from "../src/procurementPolicy.js";
import { NO_SUPPLIER_CHOICE, noSupplierChoice } from "../src/spendKind.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const app = read("src/App.tsx");
const expenses = read("src/tabs/ExpensesTab.tsx");
const proc = read("src/tabs/ProcurementTab.tsx");
const help = read("src/help.ts");

console.log("\nA. the policy as Saad set it on 12 Sep 2026");
ok("three compared quotations above USD 1,000", QUOTES_REQUIRED_ABOVE === 1000 && quotationsRequired(1000.01) === 3);
ok("two from USD 150 up to it", TWO_QUOTES_FROM === 150 && quotationsRequired(150) === 2 && quotationsRequired(1000) === 2);
ok("none below USD 150", quotationsRequired(149.99) === 0 && quotationsRequired(0) === 0);
ok("the boundary is 'above', not 'at' — a purchase of exactly USD 1,000 is not over the threshold",
  !needsProcurement(1000) && needsProcurement(1000.01));
ok("a voucher needs an approved procurement on exactly the same test", needsProcurement(2000) && !needsProcurement(300));
ok("the figure is said to people one way", THRESHOLD_LABEL === "USD 1,000");

console.log("\nB. one number, read everywhere — never typed a second time");
ok("the route that refuses a voucher reads it", /if \(needsProcurement\(converted\)\)/.test(server));
ok("and says the figure and the quotation count from the same source",
  /\$\{THRESHOLD_LABEL\} threshold/.test(server) && /\$\{quotationsRequired\(converted\)\}-quotation comparison/.test(server));
ok("the missing-documents counter reads it", /needsProcurement\(e\.convertedAmount\) && !e\.procurementId/.test(app));
ok("so do its heading and its note", /Over \$\{THRESHOLD_LABEL\} with no procurement record/.test(app) && /waiver above \$\{THRESHOLD_LABEL\}/.test(app));
ok("the voucher form asks for the authority on the same test", /needsProcurement\(Number\(expenseAmount\)\)/.test(expenses));
ok("and labels it with the same figure", /required above \{THRESHOLD_LABEL\}/.test(expenses));
ok("the procurement screen's note reads both figures", /\{THRESHOLD_LABEL\}, two from USD \{TWO_QUOTES_FROM\}/.test(proc));
ok("the compliance auditor's prompt is given the same thresholds, not a remembered pair",
  /above USD \$\{QUOTES_REQUIRED_ABOVE\.toLocaleString\("en-US"\)\}/.test(server) && /from USD \$\{TWO_QUOTES_FROM\}/.test(server));

console.log("\nC. nobody hardcodes it again");
const codeSites = [["server.ts", server], ["App.tsx", app], ["ExpensesTab.tsx", expenses], ["ProcurementTab.tsx", proc]] as const;
for (const [name, body] of codeSites) {
  ok(`${name}: no bare "> 300" comparison left in the procurement path`, !/(convertedAmount|expenseAmount|converted)\s*>\s*300\b/.test(body));
  ok(`${name}: no bare "> 1000" either — the constant, or nothing`, !/(convertedAmount|expenseAmount|converted)\s*>\s*1000\b/.test(body));
}
ok("the help answers say the new figure, in English and in Arabic",
  /above USD 1,000 need three quotes/.test(help) && help.includes("تتجاوز 1,000 دولار تحتاج أولاً إلى مقارنة ثلاثة عروض")
  && /payment requests above USD 1,000 on that project/.test(help) && help.includes("تتجاوز 1,000 دولار على ذلك المشروع"));
ok("and they say what the old figure was, so an older voucher still makes sense",
  /The threshold was USD 300 until 12 September 2026/.test(help) && help.includes("كان الحدّ 300 دولار حتى 12 أيلول 2026"));

console.log("\nD. the figures that did NOT move");
ok("the petty-cash ceiling is still USD 300", /Petty cash ceiling: USD 300 total/.test(server));
ok("cash above USD 150 still needs the director, on the route and in the prompt",
  /disbursalUSD > 150 && !exp\.approved_at/.test(server) && /disbursalUSD > 150 && !isDirector/.test(server)
  && /Cash payments above USD 150 require Program Director approval/.test(server));
ok("and the cash help answer was left alone", help.includes("cash payments above USD 150 need the director"));

console.log("\nE. a comparison is compared against what the purchase is worth");
ok("the count comes from the dearest offer on the sheet, not the cheapest",
  /const worth = Math\.max\(0, \.\.\.quoteList\.map\(\(q: any\) => Number\(q\.amount\) \|\| 0\)\)/.test(server));
ok("never fewer than two — one offer is not a comparison", /Math\.max\(2, quotationsRequired\(worth\)\)/.test(server));
ok("the refusal names the number this purchase actually needs",
  /requires \$\{wanted\} compared quotations at this value/.test(server));
ok("a single-source waiver is still the only way to lodge fewer, and still needs a written reason",
  /if \(!singleSource\)/.test(server) && /at least 30 characters/.test(server));

console.log("\nF. an RFQ is a question about choosing a supplier — 12 Sep 2026");
ok("a salary, the rent, CNSS, utilities, bank charges and an FX loss had no supplier to choose",
  ["5100", "5110", "7100", "7200", "7400", "7700"].every(c => NO_SUPPLIER_CHOICE[c]));
ok("a consultant or a freelancer still does — that choice is competed",
  !NO_SUPPLIER_CHOICE["5120"] && !NO_SUPPLIER_CHOICE["5130"]);
ok("so do project costs and equipment", !NO_SUPPLIER_CHOICE["6000"] && !NO_SUPPLIER_CHOICE["6300"] && !NO_SUPPLIER_CHOICE["6400"]);
ok("a salary voucher is set aside, with the reason said", noSupplierChoice(["5100"]) === "a salary under an employment contract");
ok("rent and utilities together read as one sentence", /and/.test(noSupplierChoice(["7100", "7200"])));
ok("a MIXED voucher is not exempt — paying the rent and buying a lens still contains a purchase",
  noSupplierChoice(["7100", "6300"]) === "");
ok("an unposted voucher, with no account behind it yet, stays on the list — silence is not an exemption",
  noSupplierChoice([]) === "");
ok("the counter asks the books, not the wording of a voucher title",
  /state\.journalEntries\s*\n?\s*\.filter\(j => j\.referenceNo === voucherNo\)/.test(app)
  && /i\.debit > 0/.test(app) && /a\.type === "Expense"/.test(app));
ok("and only the ones with a real supplier choice are counted as a gap",
  /const noProcurement = overThreshold\.filter\(x => !x\.notASupplierChoice\)/.test(app));
ok("the set-aside ones are shown, with their reason — excluded, never hidden",
  /notProcurable\.length > 0 && \(/.test(app) && /no supplier to choose/.test(app));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
