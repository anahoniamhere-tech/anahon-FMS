// Can a quotation be settled by more than one deposit, and does the desk still know it?
//
// 6 Sep 2026. Production clients pay half up front and half on delivery. The risk in
// making the link a list is not the list — it is the status: `src/workflow.ts` puts a
// quotation on Finance's desk by its status alone, so a derivation that invents a status
// that file has no rule for silently drops the job off the desk. These checks pin the
// arithmetic, the derivation, and that everything it can produce is a status the desk
// already knows. Run: npx tsx scripts/check-quote-tranches.ts
import { readFileSync } from "fs";
import { paidOn, outstandingOn, tranchedStatus } from "../src/quoteTranches.js";
import { RULES } from "../src/workflow.js";
import { QUOTE_STATUSES } from "../src/constants.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

const txs = [
  { id: "btx-a", amount: 2000 },
  { id: "btx-b", amount: 1999.995 },
  { id: "btx-offbank", amount: 1500 },
];

console.log("\nA. what the deposits add up to");
ok("no tranches, nothing paid", paidOn([], txs) === 0);
ok("one tranche is its bank line", paidOn(["btx-a"], txs) === 2000);
ok("two tranches are added up", paidOn(["btx-a", "btx-offbank"], txs) === 3500);
ok("a deposit that is no longer on the statement counts as nothing, not as the quote",
  paidOn(["btx-a", "btx-gone"], txs) === 2000);
ok("the balance is what is left", outstandingOn(4000, paidOn(["btx-a"], txs)) === 2000);
ok("an overpayment is not a negative debt", outstandingOn(1000, 1500) === 0);
ok("cents do not drift: a cent short of the quote is a cent still owed",
  outstandingOn(4000, paidOn(["btx-a", "btx-c"], [...txs, { id: "btx-c", amount: 1999.99 }])) === 0.01);
ok("half a cent short is not a debt", outstandingOn(4000, paidOn(["btx-a", "btx-b"], txs)) === 0);

console.log("\nB. the status the money implies");
ok("half of it is still Invoiced — the money is owed and the job stays on the desk",
  tranchedStatus("Accepted", 4000, 2000) === "Invoiced");
ok("an accepted quote with nothing against it is left where a person put it",
  tranchedStatus("Accepted", 4000, 0) === "Accepted");
ok("covered is Paid", tranchedStatus("Invoiced", 4000, 4000) === "Paid");
ok("covered by two tranches is Paid", tranchedStatus("Invoiced", 4000, paidOn(["btx-a", "btx-a2"], [...txs, { id: "btx-a2", amount: 2000 }])) === "Paid");
ok("a rounding hair short still counts as covered", tranchedStatus("Invoiced", 2000, 1999.995) === "Paid");
ok("a real shortfall does not — a cent short is not settled", tranchedStatus("Invoiced", 2000, 1999.98) === "Invoiced");
ok("overpaid is Paid, not something new", tranchedStatus("Invoiced", 1000, 1500) === "Paid");
ok("unlinking the last deposit drops Paid back to Invoiced — without evidence it is a claim",
  tranchedStatus("Paid", 4000, 0) === "Invoiced");
ok("a deposit does not accept an offer on the client's behalf: Draft and Sent are untouched by nothing",
  tranchedStatus("Draft", 4000, 0) === "Draft" && tranchedStatus("Sent", 4000, 0) === "Sent");
ok("a rejected quote with no money against it is not resurrected", tranchedStatus("Rejected", 4000, 0) === "Rejected");

console.log("\nC. the desk still knows every status this can produce");
const produced = new Set<string>();
for (const current of QUOTE_STATUSES) for (const paid of [0, 1, 2000, 4000, 9000]) produced.add(tranchedStatus(current, 4000, paid));
const quoteRules = RULES.filter(r => r.kind === "quotations").map(r => r.status);
for (const st of produced) {
  ok(`"${st}" is a real quotation status`, QUOTE_STATUSES.includes(st as any));
  ok(`"${st}" has a desk rule in workflow.ts — nothing falls off the desk`, quoteRules.includes(st));
}
ok("the two statuses Finance is chased on are still the ones this writes",
  produced.has("Invoiced") && produced.has("Paid"));
const workflow = readFileSync("src/workflow.ts", "utf8");
ok("workflow.ts still reads the plain status field for quotations — this change did not need to touch it",
  /kind: "quotations", status: "Invoiced"/.test(workflow) && !/paymentTxIds/.test(workflow));

console.log("\nD. the migration carries the old settlements over");
const sql = readFileSync("prisma/migrations/20260906120000_quotation_tranches/migration.sql", "utf8");
ok("the list column is added", /ADD COLUMN "paymentTxIdsJson" TEXT NOT NULL DEFAULT '\[\]'/.test(sql));
ok("an existing single deposit becomes a one-tranche list", /UPDATE "Quotation" SET "paymentTxIdsJson" = '\["' \|\| "paymentTxId" \|\| '"\]' WHERE "paymentTxId" <> ''/.test(sql));
ok("the copy happens before the old column goes", sql.indexOf("UPDATE") < sql.indexOf("DROP COLUMN"));
ok("the old column is dropped, not left for someone to write to", /DROP COLUMN "paymentTxId"/.test(sql));
ok("the schema has no single-deposit column left",
  !/paymentTxId\s+String/.test(readFileSync("prisma/schema.prisma", "utf8")));

console.log("\nE. the routes derive the status, they do not assert it");
const server = readFileSync("server.ts", "utf8");
ok("no route writes a quotation Paid by hand any more", !/quotation\.update\([^)]*status: "Paid"/.test(server));
ok("both settlement paths go through the one place that re-reads the bank lines",
  (server.match(/settleQuotation\(/g) || []).length >= 4);
ok("the off-bank route no longer refuses a second payment",
  !/This quotation is already settled/.test(server));
ok("the same deposit cannot settle two quotations, list or no list",
  /paymentTxIdsJson: \{ contains: `"\$\{txId\}"` \}/.test(server));
ok("the same deposit cannot be counted twice on one quotation",
  /already one of this quotation's tranches/.test(server));
ok("a deposit in another currency is refused — tranches are added up",
  /priced in \$\{quote\.currency\}/.test(server));
ok("a pending eBLOM advice is still not proof", /pending lines are not proof/.test(server));
ok("unlinking a tranche still deletes the off-bank evidence line it was made of",
  /bankAccountId === "ba-prod-offbank"[\s\S]{0,200}bankTransaction\.delete/.test(server));
ok("the audit line says how much of the quote is settled, not just that something happened",
  /of \$\{quote\.amount\} settled, status/.test(server));

console.log("\nF. an advice is shown but never linkable");
// 6 Sep 2026: a client's 200 USD sat in the system as a pending eBLOM advice, invisible on
// the quotations screen, so the quote read as unpaid and the client was chased. The advice
// is now listed against the quote it matches — but listing it must never make it pressable,
// because the route refuses a pending line and would only produce an error nobody expects.
const tab = readFileSync("src/tabs/ProductionTab.tsx", "utf8");
const card = (tab.match(/const claimedTx[\s\S]*?<\/div>\s*\);\s*\}\)\(\)\}/) || [""])[0];
ok("the match list no longer skips pending lines", !/bt\.type === "Deposit" && !bt\.pending/.test(card));
ok("a pending line is offered no Confirm button", /\{tx\.pending \? \(/.test(card)
  && card.indexOf("tx.pending ?") < card.indexOf("Confirm settlement"));
ok("and it says what has to happen instead, on the row itself",
  /advice received, awaiting the statement/.test(card));
ok("it is still called an advice, not a deposit", /\{tx\.pending \? "advice" : "deposit"\}/.test(card));
ok("the server would refuse it anyway if the button were ever wired back",
  /That deposit is only an eBLOM advice, not yet on an imported statement/.test(server));
ok("only a real deposit reaches the link call",
  (card.match(/linkQuotePayment\(q, tx\.id\)/g) || []).length === 1);

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
