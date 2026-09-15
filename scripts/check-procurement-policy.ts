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
import { NO_SUPPLIER_CHOICE, noSupplierChoice, costAccountChoices } from "../src/spendKind.js";
import { debitedExpenseAccounts } from "../src/costAccount.js";
import { CATEGORY_ACCOUNT, costAccountFor } from "../src/costAccount.js";
import { payoutBlocker, payoutLedgerFor, cashApprovalBlocker, pastCashLedgerFor, CASH_AWAITING_VOUCHERS_NAME } from "../src/pettyCash.js";

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
// Updated 14 Sep 2026 (Books): Saad moved the petty-cash float to USD 1,000 in draft Policy 020
// §4.4.1 — a separate decision from the procurement threshold, which is what this section guards.
// The figure now lives in src/pettyCash.ts and the prompt reads it; it must still never be the
// procurement number. Pinned in full by scripts/check-petty-cash.ts.
ok("the petty-cash ceiling is its own figure, read from src/pettyCash.ts — not the procurement threshold",
  /Petty cash float ceiling: \$\{FLOAT_CEILING_LABEL\}/.test(server) && !/Petty cash ceiling: USD 300/.test(server));
// 14 Sep 2026 (Books): the prompt half used to match a code COMMENT in the direct-petty-cash
// route once the compliance prompt stopped typing "USD 150" — it passed for the wrong reason.
// The prompt now reads CASH_SINGLE_PAYMENT_LABEL from src/pettyCash.ts, and since 14 Sep (Buying &
// paying) the two routes read CASH_SINGLE_PAYMENT_USD too — no typed 150 left on either.
ok("cash above USD 150 still needs the director, on the route and in the prompt",
  /cashApprovalBlocker\(account, disbursalUSD/.test(server) && /disbursalUSD > CASH_SINGLE_PAYMENT_USD && !isDirector/.test(server)
  && !/disbursalUSD > 150/.test(server)
  && /- Cash payments above \$\{CASH_SINGLE_PAYMENT_LABEL\} require Program Director approval/.test(server));
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
// Saad's ruling, 12 Sep 2026: a freelancer or consultant on a grant budget line is engaged
// under an agreement, not bought. The engagement contract is the paper that supports the fee.
ok("a freelancer's or a consultant's fee is an engagement, not a purchase",
  NO_SUPPLIER_CHOICE["5120"] === "a freelancer's fee under an agreement" && NO_SUPPLIER_CHOICE["5130"] === "a consultant's fee under an agreement");
ok("everything bought from a supplier still is a purchase — project costs, equipment, software, travel",
  !NO_SUPPLIER_CHOICE["6000"] && !NO_SUPPLIER_CHOICE["6300"] && !NO_SUPPLIER_CHOICE["6400"] && !NO_SUPPLIER_CHOICE["6200"]);
ok("the exempt list is personnel and premises and nothing else — every code is 5xxx or 7xxx",
  Object.keys(NO_SUPPLIER_CHOICE).every(c => /^[57]/.test(c)));
ok("a salary voucher is set aside, with the reason said", noSupplierChoice(["5100"]) === "a salary under an employment contract");
ok("rent and utilities together read as one sentence", /and/.test(noSupplierChoice(["7100", "7200"])));
ok("a MIXED voucher is not exempt — paying the rent and buying a lens still contains a purchase",
  noSupplierChoice(["7100", "6300"]) === "");
ok("an unposted voucher, with no account behind it yet, stays on the list — silence is not an exemption",
  noSupplierChoice([]) === "");
ok("the answer asks the books, not the wording of a voucher title",
  /for \(const j of journalEntries\)/.test(server) && /debitedExpenseAccounts\(/.test(server)
  && /a\.type === "Expense"/.test(server));
ok("and only the ones with a real supplier choice are counted as a gap",
  /const noProcurement = overThreshold\.filter\(x => !x\.notASupplierChoice\)/.test(app));
ok("the set-aside ones are shown, with their reason — excluded, never hidden",
  /notProcurable\.length > 0 && \(/.test(app) && /no supplier to choose/.test(app));

console.log("\nG. the answer exists when the request is RAISED, not only after posting — 12 Sep 2026");
ok("the voucher carries the expense account it belongs to",
  /costAccountCode String  @default\(""\)/.test(read("prisma/schema.prisma"))
  && /ALTER TABLE "Expense" ADD COLUMN "costAccountCode"/.test(read("prisma/migrations/20260912150000_expense_cost_account/migration.sql")));
ok("the route reads it off the request and stores it", /costAccountCode, transactionDate, user \} = req\.body/.test(server) && /costAccountCode: costAccount,/.test(server));
ok("it is checked against the chart of accounts, never taken as free text",
  /acc\.type !== "Expense"/.test(server) && /Choose what kind of cost this is from the chart of accounts/.test(server));
ok("required only above the threshold — the one place the answer changes what happens",
  /\} else if \(needsProcurement\(converted\)\) \{/.test(server) && /say what kind of cost this is/.test(server));
ok("and spend with no supplier to choose is out of the procurement rule's scope entirely",
  /if \(needsProcurement\(converted\) && !noChoice\)/.test(server));
ok("the form offers the books' own expense accounts, active ones only",
  costAccountChoices([{ code: "7100", name: "Rent", type: "Expense" }, { code: "1100", name: "Bank", type: "Asset" }, { code: "6300", name: "Kit", type: "Expense", active: false }]).map(a => a.code).join() === "7100");
ok("and asks for it on the voucher form, saying when no quotations are expected",
  /id="exp-cost-account"/.test(expenses) && /No quotations are expected — this is \{noSupplierChoice/.test(expenses));
ok("the procurement picker disappears for that spend rather than demanding an answer",
  /needsProcurement\(Number\(expenseAmount\)\) && !noSupplierChoice\(\[expenseCostAccount\]\)/.test(expenses));
ok("it still prefers the books, and falls back to the voucher only before they speak",
  /const codes = posted\.length\s*\n?\s*\? posted/.test(server)
  && /e\.costAccountCode && expenseAccountCodes\.has\(e\.costAccountCode\)/.test(server));

console.log("\nH. the ledger stops posting every cost as video production");
ok("posting debits the account the voucher named", /confirmedCostAccount\s*\n?\s*\|\| exp\.costAccountCode/.test(server)
  && /const expenseCostAccount = expense\.costAccountCode/.test(server));
// 6100 was the fallback for every cost. Keeping it would have been the bug, not the safety
// net: all 192 live expenses have a budget line category, and not one of them maps to 6100.
ok("6100 is no longer anybody's fallback", !/costAccountCode \|\| "6100"/.test(server)
  && !/const expenseCostAccount = "6100"/.test(server));
ok("an unnamed cost falls back to the budget line's category, not to a guess",
  /costAccountFor\(\(await prisma\.budgetLine\.findUnique/.test(server)
  && (server.match(/costAccountFor\(\(await prisma\.budgetLine\.findUnique/g) || []).length >= 2);
ok("the rebuild and the live posting read ONE map, so they cannot drift apart",
  /export const CATEGORY_ACCOUNT/.test(read("src/costAccount.ts"))
  && !/const CATEGORY_ACCOUNT/.test(read("prisma/rebuild-ledger.ts"))
  && /costAccountFor\(blById\.get\(e\.budgetLineId\)\?\.category\)/.test(read("prisma/rebuild-ledger.ts")));
ok("every category the live budget lines actually use has an account",
  ["Personnel", "Human Resources", "Contractors/Freelancers", "Travel", "Equipment & Supplies",
   "Local Office", "Catering & Hospitality", "Other Costs", "Software Subscriptions"]
    .every(c => CATEGORY_ACCOUNT[c]));
ok("and the default is 6000 direct project costs, never 6100 video production",
  costAccountFor("") === "6000" && costAccountFor("Nothing Like This") === "6000"
  && costAccountFor("Local Office") === "7100" && costAccountFor("Personnel") === "5100");

console.log("\nI. the approver confirms the cost, because their signature writes the journal");
ok("the signature carries a confirmed account", /costAccountCode, pastCash, user \} = req\.body/.test(server)
  && /handleExpenseAction\(exp\.id, "approve", \{/.test(expenses)
  && /costAccountCode: confirmCostAccount\[exp\.id\]/.test(expenses));
ok("the approver's pick is checked against the chart too, never free text",
  /Confirm what kind of cost this is from the chart of accounts/.test(server));
ok("what they confirmed is written to the voucher, not just used once",
  /\.\.\.\(confirmedCostAccount \? \{ costAccountCode: confirmedCostAccount \} : \{\}\)/.test(server));
ok("Policy 7.2 is re-read against the CONFIRMED account, not the requester's claim",
  /effectiveCostAccount = confirmedCostAccount \|\| exp\.costAccountCode/.test(server)
  && /needsProcurement\(exp\.convertedAmount\) && !noSupplierChoice\(\[effective\]\)/.test(server));
// A voucher raised before costAccountCode existed names no account. If the re-check only ran
// when one was named, saying nothing would skip it — the exemption by silence spendKind.ts
// explicitly refuses. So the account is derived first, then the rule reads it.
ok("a voucher that names no account cannot skip the rule by saying nothing",
  /effectiveCostAccount = confirmedCostAccount \|\| exp\.costAccountCode\s*\n?\s*\|\| costAccountFor\(/.test(server)
  && !/if \(effective && needsProcurement/.test(server));
ok("and the posting debits that same resolved account, asked for once",
  /const expenseCostAccount = effectiveCostAccount;/.test(server));
ok("so a voucher raised as exempt spend cannot be approved onto an account that needs quotations",
  /brings the rule back/.test(server));
// The rule's actual decision, on real figures from the live books rather than invented ones.
// Every category the live budget lines use is mapped, so each of these is a voucher that
// exists: PV-FPU-R005 is 3,458.09 USD on "Local Office" with no procurement behind it, and
// PV-SKFINV-016 is 2,930.00 USD on "Other Costs".
const wouldStop = (usd: number, account: string) => needsProcurement(usd) && !noSupplierChoice([account]);
ok("rent at 3,458.09 with no comparison behind it is let through — no supplier was ever chosen",
  !wouldStop(3458.09, costAccountFor("Local Office")) && costAccountFor("Local Office") === "7100");
ok("a freelancer's fee at 6,000 is let through too, per Saad's 12 Sep ruling — engaged, not bought",
  !wouldStop(6000, costAccountFor("Contractors/Freelancers")) && costAccountFor("Contractors/Freelancers") === "5120");
ok("the same rent voucher confirmed onto equipment instead IS stopped — a lens is bought",
  wouldStop(3458.09, "6300"));
ok("a legacy voucher naming nothing is judged on its derived account, not waved through",
  wouldStop(2930, costAccountFor("Other Costs")) && costAccountFor("Other Costs") === "6000");
ok("below the threshold nothing is demanded of either", !wouldStop(900, "6300") && !wouldStop(900, "7100"));
// The derivation and the exemption list must stay in step: if a category maps to an account
// nobody may post to, or the exempt list grows a 6xxx code, this fails rather than silently
// exempting purchases.
ok("every account the derivation can produce is a real postable expense code",
  [...new Set(Object.values(CATEGORY_ACCOUNT)), costAccountFor("")].every(c => /^[567]\d\d\d$/.test(c)));
ok("the screen shows the approver where the account came from before they sign",
  /not named on the voucher — from the budget line/.test(expenses)
  && /raised as \$\{exp\.costAccountCode\}/.test(expenses));

console.log("\nJ. a corrected cost reads as where it is now, not everywhere it has been");
// A ledger correction never edits the posted entry: it credits the wrong account and debits the
// right one beside it, so a corrected voucher carries debit legs on BOTH. Reading gross would put
// a cost properly moved onto rent back on the missing-documents list as an uncompeted purchase.
const posting = (code: string, amount: number) => ({ accountCode: code, debit: amount, credit: 0 });
const correction = (from: string, to: string, amount: number) => [
  { accountCode: from, debit: 0, credit: amount }, { accountCode: to, debit: amount, credit: 0 },
];
const movedToRent = [posting("6000", 5000), ...correction("6000", "7100", 5000)];
ok("a voucher posted to 6000 and corrected onto rent sits on 7100 alone", debitedExpenseAccounts(movedToRent).join() === "7100");
ok("and is therefore exempt, as rent is", noSupplierChoice(debitedExpenseAccounts(movedToRent)) === "rent under a signed lease");
const movedToKit = [posting("7100", 5000), ...correction("7100", "6300", 5000)];
ok("corrected the other way, onto equipment, it becomes a gap again", debitedExpenseAccounts(movedToKit).join() === "6300" && noSupplierChoice(debitedExpenseAccounts(movedToKit)) === "");
ok("corrected twice, it reads the last account only, not the sum of every debit it has held",
  debitedExpenseAccounts([posting("6000", 5000), ...correction("6000", "7100", 5000), ...correction("7100", "5100", 5000)]).join() === "5100");
ok("a genuinely split cost still reads as two — one correction cannot express that",
  debitedExpenseAccounts([posting("6000", 3000), posting("6300", 2000)]).sort().join() === "6000,6300");
ok("the bank, payable and withholding legs were never the cost and are ignored",
  debitedExpenseAccounts([posting("6000", 5000), { accountCode: "1120", debit: 0, credit: 5000 }, { accountCode: "2100", debit: 0, credit: 5000 }]).join() === "6000");
ok("the SERVER reads it netted, through the books' own module",
  /debitedExpenseAccounts\(legsByVoucher\.get\(e\.voucherNo\) \|\| \[\]\)\.filter\(c => expenseAccountCodes\.has\(c\)\)/.test(server));
ok("and keeps the chart as the filter, which is stricter than a code prefix",
  /accounts\.filter\(\(a: any\) => a\.type === "Expense"\)/.test(server));
ok("a fully reversed voucher falls through to the answer on the voucher itself",
  debitedExpenseAccounts([posting("6000", 5000), { accountCode: "6000", debit: 0, credit: 5000 }]).length === 0
  && /e\.costAccountCode && expenseAccountCodes\.has\(e\.costAccountCode\)/.test(server));

console.log("\nK. one number for every seat — 12 Sep 2026");
// Derived in the browser, this read 67 gaps to a director and 84 to the keeper holding the
// phone: operational seats never receive journal entries, so rent and salaries looked to him
// like purchases nobody got quotations for.
ok("the answer is computed once, in loadState, and shipped on the voucher",
  /noSupplierChoice: noSupplierChoice\(codes\)/.test(server));
ok("every seat that gets expenses gets it — it rides on formattedExpenses, not on a branch",
  /const formattedExpenses = expenses\.map\(e => \{/.test(server)
  && (server.match(/expenses: buys \? formattedExpenses : \[\]/g) || []).length >= 1);
ok("the browser reads the answer and no longer derives it",
  /notASupplierChoice: e\.noSupplierChoice \|\| ""/.test(app)
  && !/debitedExpenseAccounts/.test(app) && !/state\.journalEntries/.test(app));
ok("a missing answer is not an exemption — blank means the question still applies",
  noSupplierChoice([]) === "" && /e\.noSupplierChoice \|\| ""/.test(app));
ok("and the reason shipped is the reason, never the journal it came from",
  !/journalEntries: journalEntries/.test(server.slice(server.indexOf("const formattedExpenses"), server.indexOf("const formattedProcurements"))));

console.log("\nL. what may pay a voucher out, and which ledger it credits (Books' handover, cc5cb98)");
const bank = { type: "Bank", ledgerCode: "1100", currency: "USD", active: true };
const eur = { type: "Bank", ledgerCode: "1110", currency: "EUR", active: true };
const channel = { type: "Off-bank channel", ledgerCode: "1120", currency: "USD", active: false };
const float = (openedOn: string) => ({ type: "Petty Cash", ledgerCode: "1125", currency: "USD", active: true, openedOn });
ok("a bank account pays anything, fees included", payoutBlocker(bank, "5120") === "");
ok("a channel never pays, even if someone reactivates it", /never the petty-cash float/.test(payoutBlocker({ ...channel, active: true })));
ok("an inactive account never pays", /not active/.test(payoutBlocker(channel)));
ok("the float pays nothing before its opening count", /first count/.test(payoutBlocker(float(""), "6000")));
ok("the opened float pays a purchase", payoutBlocker(float("2026-09-14"), "6000") === "");
for (const fee of ["5100", "5120", "5130"]) ok(`the float never pays a fee (${fee})`, /never paid from the petty-cash float/.test(payoutBlocker(float("2026-09-14"), fee)));
ok("a payment out of the opened float credits 1125, not 1120", payoutLedgerFor(float("2026-09-14"), "2026-09-15") === "1125");
ok("an EUR bank payment credits 1110", payoutLedgerFor(eur, "2026-09-15") === "1110");
ok("a legacy channel line still credits the historical clearing", payoutLedgerFor(channel, "2025-01-01") === "1120");
ok("neither route maps cash by the account's type any more", !/type === "Petty Cash" \? "1120"/.test(server));
ok("both routes refuse through payoutBlocker", (server.match(/payoutBlocker\(account,/g) || []).length === 2);
ok("both payment lines carry who recorded them",
  (server.match(/type: "Withdrawal",\s+(?:reconciled: true|pending: awaitsStatement\(account\), reconciled: !awaitsStatement\(account\)),\s+voucherNo[^\n]*\n\s+recordedAt: new Date\(\)\.toISOString\(\), recordedById/g) || []).length === 2);
ok("a request keeps its true transaction date, never a future one",
  /transactionDate: txDate/.test(server) && /txDate > localDate\(\)/.test(server)
  && /ADD COLUMN "transactionDate"/.test(read("prisma/migrations/20260914150000_expense_transaction_date/migration.sql")));

console.log("\nM. cash in transit pays only the request it was drawn for (Books, b7b5ba2)");
const transit = { type: "Cash in transit", ledgerCode: "1127", currency: "USD", active: true };
ok("transit with no withdrawal behind the request is refused", /record the withdrawal against this request first/.test(payoutBlocker(transit, "5120", "2026-09-14", null)));
ok("transit pays a linked request, fees included", payoutBlocker(transit, "5120", "2026-09-14", { linked: true, remainingUSD: 300, netUSD: 300 }) === "");
ok("never more than the withdrawal still holds", /less than/.test(payoutBlocker(transit, "6000", "2026-09-14", { linked: true, remainingUSD: 100, netUSD: 150 })));
ok("transit credits 1127", payoutLedgerFor(transit, "2026-09-14") === "1127");
const pay = server.slice(server.indexOf('action === "cashbook-pay"'), server.indexOf('action === "general-ledger-post"'));
ok("the pay branch finds the withdrawal by this request and passes it", /l\.expenseId === exp\.id/.test(pay) && /payoutBlocker\(account, cost, localDate\(\), draw\)/.test(pay));
ok("the draw is checked against the net USD, before any balance moves",
  pay.indexOf("payoutBlocker(account, cost") > pay.indexOf("const disbursalUSD") && pay.indexOf("payoutBlocker(account, cost") < pay.indexOf("prisma.bankAccount.update"));
ok("a transit payment keeps paymentMethod Cash", /isTransit\(account\) \? "Cash"/.test(pay));
ok("direct-petty-cash never passes a draw, so it keeps refusing transit", /\?\.category\), localDate\(\)\);/.test(server.slice(server.indexOf('"/api/expense/direct-petty-cash"'))));

console.log("\nN. cash above USD 150 needs the Executive Director, now that Finance approves too (Saad, 14 Sep)");
const box = { type: "Petty Cash", ledgerCode: "1125", currency: "USD", active: true };
const transit2 = { type: "Cash in transit", ledgerCode: "1127", currency: "USD", active: true };
ok("a Finance Officer's approval does not pay cash above 150 from the box", /§4\.4\.2/.test(cashApprovalBlocker(box, 150.01, "Finance Officer")));
ok("nor from cash in transit", /§4\.4\.2/.test(cashApprovalBlocker(transit2, 400, "Finance Officer")));
ok("the Executive Director's approval pays it", cashApprovalBlocker(box, 400, "Program Director") === "" && cashApprovalBlocker(transit2, 400, "Super Admin") === "");
ok("an approval with no seat on record is refused, never assumed", /§4\.4\.2/.test(cashApprovalBlocker(box, 400, "")));
ok("150 itself and below needs no director", cashApprovalBlocker(box, 150, "Finance Officer") === "");
ok("a bank payment is not cash", cashApprovalBlocker(bank, 5000, "Finance Officer") === "");
const pay2 = server.slice(server.indexOf('action === "cashbook-pay"'), server.indexOf('action === "general-ledger-post"'));
ok("the pay step reads the approver's seat, not approved_at",
  /cashApprovalBlocker\(account, disbursalUSD, exp\.approvedAs \|\| approver\?\.role\)/.test(pay2) && !/!exp\.approved_at/.test(pay2));
ok("direct cash above 150 still requires a director", /disbursalUSD > CASH_SINGLE_PAYMENT_USD && !isDirector\(user\?\.role\)/.test(server));
ok("the screen hides cash rather than offering a payment that bounces", /cashApprovalBlocker\(b, netVal/.test(read("src/tabs/ExpensesTab.tsx")));

console.log("\nO. backfill: true dates, past cash from 1120, BLOM payments wait for the statement (Books, 46014f6)");
const act = server.slice(server.indexOf('app.post("/api/expense/action"'), server.indexOf('app.post("/api/expense/direct-petty-cash"'));
const pastPay = act.slice(act.indexOf('action === "cashbook-pay" && pastCash'), act.indexOf('} else if (action === "cashbook-pay") {'));
const post = act.slice(act.indexOf('action === "general-ledger-post"'));
ok("a 2025 cash voucher, before the float opens, credits 1120", pastCashLedgerFor("2025-03-10", "2026-09-20") === "1120" && pastCashLedgerFor("2025-03-10", "") === "1120");
ok("after the opening there is no past cash", pastCashLedgerFor("2026-09-21", "2026-09-20") === "");
ok("the past-cash pay step refuses without a true date, and after the opening", /!exp\.transactionDate/.test(pastPay) && /if \(!pastCashLedgerFor\(exp\.transactionDate, box\?\.openedOn\)\)/.test(pastPay));
ok("it keeps the true date and says who recorded it", /paidAt = `\$\{exp\.transactionDate\}T00:00:00\.000Z`/.test(pastPay) && /paidById: me\.id/.test(pastPay));
ok("it writes no payment line and moves no account balance", !/bankTransaction\.create|bankAccount\.update/.test(pastPay));
ok("it still needs a director for cash above 150", /cashApprovalBlocker\(\{ type: FLOAT_TYPE \}/.test(pastPay));
ok("posting credits the past-cash ledger, refusing before any budget moves",
  /bankAssetAccount = pastLedger/.test(post) && post.indexOf('if (pastLedger === "")') < post.indexOf("budgetLine.update"));
ok("posting marks it by one name", /paymentMethod === CASH_AWAITING_VOUCHERS_NAME/.test(post) && CASH_AWAITING_VOUCHERS_NAME === "Cash awaiting vouchers");
ok("the settlement is dated by the payment, else the voucher's true date — never simply today",
  /date: payTx\?\.date \|\| exp\.transactionDate \|\| localDate\(\)/.test(post));
const bankPay = act.slice(act.indexOf('} else if (action === "cashbook-pay") {'), act.indexOf('action === "general-ledger-post"'));
ok("a BLOM payment is written pending with its voucher, and leaves the balance to the statement",
  /pending: awaitsStatement\(account\), reconciled: !awaitsStatement\(account\)/.test(bankPay) && /if \(!awaitsStatement\(account\)\) \{\s+await prisma\.bankAccount\.update/.test(bankPay));
ok("a past cash payment without a receipt still counts as missing evidence (§6.6)",
  /const noEvidence = state\.expenses\s+\.filter\(e => COUNTED\.includes\(e\.status\) && !hasProof\(e\.id\)/.test(read("src/App.tsx")));
ok("the pay panel offers past cash only while the voucher predates the opening",
  /exp\.transactionDate < openedOn/.test(read("src/tabs/ExpensesTab.tsx")) && /pastCash: true/.test(read("src/tabs/ExpensesTab.tsx")));

console.log("\nP. whoever approves a request never pays it in cash; a bank payment is exempt (Saad, 15 Sep 2026, §4.3)");
// The rule is lifted from the route's own line, so the check runs what the route runs.
const rule = act.match(/const approverPaysCash = \(isCash: boolean\) => ([^;]+);/);
const approverPaysCash = rule ? new Function("isCash", "exp", "user", `return ${rule[1]};`) as (c: boolean, e: any, u: any) => boolean : () => false;
const ed = { id: "u-1" }, fo = { id: "u-7" }, byEd = { approvedById: "u-1" };
ok("the rule exists in the route", !!rule);
ok("an ED-approved bank payment recorded by the ED passes", approverPaysCash(false, byEd, ed) === false);
ok("the same payment in cash, by the ED, is refused", approverPaysCash(true, byEd, ed) === true);
ok("someone else pays it in cash", approverPaysCash(true, byEd, fo) === false);
ok("a legacy voucher with no approver on record is not blocked", approverPaysCash(true, { approvedById: null }, ed) === false);
const bankBranch = act.slice(act.indexOf('} else if (action === "cashbook-pay") {'), act.indexOf('action === "general-ledger-post"'));
ok("the bank branch asks by the account it pays from, once loaded",
  /if \(approverPaysCash\(account\.type !== "Bank"\)\) return res\.status\(403\)/.test(bankBranch));
ok("past cash is always cash", /if \(approverPaysCash\(true\)\) return res\.status\(403\)/.test(pastPay));
ok("the message names §4.3 and cash", /Policy 020 §4\.3: you approved \$\{exp\.voucherNo\} — a different officer must pay it in cash\./.test(act));
ok("the pay panel keeps the bank for the approver and hides cash",
  /!\(approvedByMe && b\.type !== "Bank"\)/.test(read("src/tabs/ExpensesTab.tsx")) && /pastCashOk = !approvedByMe/.test(read("src/tabs/ExpensesTab.tsx")));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
