// How a payment is recorded to have left (10 Oct 2026). FSTP fees are paid by a BLOM payment order
// on the EUR account — a BANK payment — and the pay panel used to stamp every payment, bank
// payments included, "Petty cash envelope".
//   npx tsx scripts/check-payment-methods.ts
import { readFileSync } from "node:fs";
import { PAYMENT_METHODS, methodsFor, defaultMethodFor, refLabelFor, methodBlocker } from "../src/paymentMethods.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const tab = read("src/tabs/ExpensesTab.tsx");
const i18n = read("src/i18n.ts");
const pay = server.slice(server.indexOf('} else if (action === "cashbook-pay") {'), server.indexOf('action === "general-ledger-post"'));

console.log("\nA. the methods, and which account each belongs to");
ok("the pay step is read (not a truncated slice)", pay.length > 3000);
ok("the four methods are the list, in one place",
  PAYMENT_METHODS.map(m => m.key).join(" | ") === "Bank transfer | Bank payment order (cash collected at the bank) | Petty cash envelope | Card");
ok("a bank account offers the transfer, the payment order and the card — never an envelope",
  methodsFor("Bank").join() === "Bank transfer,Bank payment order (cash collected at the bank),Card");
ok("the float offers the envelope and nothing else", methodsFor("Petty Cash").join() === "Petty cash envelope");
ok("a bank payment opens on the transfer, the float on the envelope",
  defaultMethodFor("Bank") === "Bank transfer" && defaultMethodFor("Petty Cash") === "Petty cash envelope");
ok("the reference asks for what that method actually carries",
  refLabelFor("Bank payment order (cash collected at the bank)") === "Payment order / debit advice number" && refLabelFor("") === "Reference");

console.log("\nB. the route refuses a method that does not suit the account");
ok("a payment order from the bank passes", methodBlocker("Bank payment order (cash collected at the bank)", "Bank") === "");
ok("an envelope from a BANK account is refused", /is not how money leaves a bank account/.test(methodBlocker("Petty cash envelope", "Bank")));
ok("a transfer from the float is refused", /is not how money leaves/.test(methodBlocker("Bank transfer", "Petty Cash")));
ok("a method nobody wrote down is refused", /not a payment method the system records/.test(methodBlocker("Suitcase", "Bank")));
ok("silence is still allowed — older vouchers and the default path", methodBlocker("", "Bank") === "");
ok("the route asks, before any balance moves",
  /const wrongMethod = isTransit\(account\) \? "" : methodBlocker\(String\(paymentMethod \|\| ""\), account\.type\);/.test(pay)
  && pay.indexOf("methodBlocker") < pay.indexOf("prisma.bankAccount.update"));
ok("and records what the payer chose, defaulting by the account's own type",
  /updatedPaymentMethod = isTransit\(account\) \? "Cash" : \(paymentMethod \|\| defaultMethodFor\(account\.type\)\)/.test(server));

console.log("\nC. the pay panel");
ok("no payment is stamped 'Petty cash envelope' on its way out any more", !/paymentMethod: "Petty cash envelope"/.test(tab));
ok("the panel offers the methods of the chosen account", /methodsFor\(acct\.type\)/.test(tab) && /defaultMethodFor\(acct\.type\)/.test(tab));
ok("the bank's own reference is sent when given, the voucher number only as a fallback",
  /paymentRef: chosen\.ref\.trim\(\) \|\| `VOU-\$\{exp\.voucherNo\}`/.test(tab));
ok("the button says what it does, with an icon and no emoji",
  /\{ic\(Banknote\)\} \{t\("Record the payment"\)\}/.test(tab) && !/💸/.test(tab));
ok("every new word on the screen has Arabic",
  ["Paid from", "How it was paid", "Record the payment", "Bank transfer", "Bank payment order (cash collected at the bank)", "Petty cash envelope", "Payment order / debit advice number"]
    .every(k => i18n.includes(`"${k}":`)));

console.log("\nD. nothing about the rules moved");
ok("where a payment posts is still the account's, not the method's", !/paymentMethod/.test(server.slice(server.indexOf("export function payoutLedgerFor"), server.indexOf("export function payoutLedgerFor") + 400)));
ok("the approver-never-pays-cash rule is untouched", /if \(approverPaysCash\(account\.type !== "Bank"\)\) return res\.status\(403\)/.test(pay));
ok("the USD 150 director rule still keys on the ACCOUNT, never on the method word",
  /cashApprovalBlocker\(account, disbursalUSD/.test(pay) && !/cashApprovalBlocker\([^)]*paymentMethod/.test(pay));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
