// Money received or paid outside the bank, and cash awaiting vouchers — draft Policy 020 §4.4.4,
// §4.4.5, §6.6; Saad's decisions of 14 Sep 2026.
//
// Pins what would quietly break the books: a channel receipt after the float opened must never land
// in 1120; a project the donor restricted to the bank refuses money outside it; money from a channel
// is spent only through cash in transit; a past cash voucher lowers 1120; and a movement the system
// records on BLOM waits for its statement line instead of being counted twice.
//   npx tsx scripts/check-offbank.ts
import { readFileSync } from "node:fs";
import {
  HISTORICAL_CLEARING_LEDGER, CASH_CLEARING_LEDGER, CHANNEL_TYPE, CASH_AWAITING_VOUCHERS_NAME, DEPOSITS_IN_TRANSIT_LEDGER,
  isLiveChannel, channelLedgerFor, pastCashLedgerFor, cashLedgerFor, receiptBlocker, bankOnlyBlocker, depositBlocker,
  matchBlocker, isStatementMatchRef, payoutBlocker, DRAW_REF, DRAW_RETURN_REF, TOPUP_REF, OFFBANK_REF, OFFBANK_DEPOSIT_REF,
  isOffbankRef, offbankPurposeOf, awaitsMatch, CASH_AWAITING_VOUCHERS_NAME as CAV,
} from "../src/pettyCash.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const rebuild = read("prisma/rebuild-ledger.ts");
const migration = read("prisma/migrations/20260914220000_offbank_channels/migration.sql");
const dashboard = read("src/tabs/DashboardTab.tsx");

const OPENED = "2026-09-20";
const bob = { id: "ba-ch-bob-usd", name: "BOB Finance (USD)", type: CHANNEL_TYPE, ledgerCode: "1141", active: true };
const oldBob = { id: "ba-bwz-bob", type: CHANNEL_TYPE, ledgerCode: HISTORICAL_CLEARING_LEDGER, active: false };
const receipt = (over = {}) => ({ account: bob, date: "2026-10-01", today: "2026-10-02", amount: 500, reference: "BOB-778812", purpose: "other", ...over });

console.log("\n1. a channel receipt after the float opened never touches 1120");
ok("a live channel posts to its own ledger account on and after the opening", channelLedgerFor(bob, OPENED, OPENED) === "1141" && channelLedgerFor(bob, "2026-12-01", OPENED) === "1141");
ok("before the opening, or with no opening yet, it is cash awaiting vouchers", channelLedgerFor(bob, "2026-09-19", OPENED) === HISTORICAL_CLEARING_LEDGER && channelLedgerFor(bob, "2026-12-01", "") === HISTORICAL_CLEARING_LEDGER);
ok("the four historical per-counterparty accounts are not live channels", !isLiveChannel(oldBob) && isLiveChannel(bob));
ok("the receipt route posts to the ledger channelLedgerFor gives", /const code = channelLedgerFor\(account!, day, box\?\.openedOn\)/.test(server) && /\{ accountCode: code, debit: usd/.test(server));
ok("…and moves the channel's balance only when it is today's money", /if \(live\) await t\.bankAccount\.update\(\{ where: \{ id: account!\.id \}, data: \{ balance: \{ increment: amount \} \} \}\)/.test(server));
ok("the rebuild routes live channel lines through the same rule", /liveChannelById\.has\(txAccountId\) \? channelLedgerFor\(/.test(rebuild));
ok("evidence is required", receiptBlocker(receipt({ reference: " " })) !== "" && receiptBlocker(receipt()) === "");
ok("a historical account cannot take a new receipt", receiptBlocker(receipt({ account: oldBob })) !== "");
ok("the quotation and project must exist", receiptBlocker(receipt({ purpose: "quotation" })) !== "" && receiptBlocker(receipt({ purpose: "project", projectFound: false })) !== "");
ok("no future dates", receiptBlocker(receipt({ date: "2026-10-03" })) !== "");
ok("the settle-offbank alias is gone — the Clients & quotations form calls /api/offbank/receive", !/settle-offbank|OFFBANK_METHODS/.test(server) && !/settle-offbank/.test(read("src/gates.ts")));
ok("no route names a channel account by id — a currency is a data row", !/ba-ch-/.test(server) && (migration.match(/'Off-bank channel','USD'/g) || []).length === 5);

console.log("\n1b. a first donor tranche received outside the bank can found its project");
const projectsNew = server.slice(server.indexOf('app.post("/api/projects/new"'), server.indexOf("\n});\n", server.indexOf('app.post("/api/projects/new"')));
ok("only a live channel receipt recorded as other income, with evidence, is founding proof",
  /fromChannel && \(!isLiveChannel\(fundingAccountRow\) \|\| offbankPurposeOf\(fundingTx\.noticeRef\) !== "other" \|\| !fundingTx\.evidenceRef\)/.test(projectsNew));
ok("a line already carrying a project is still refused", /if \(fundingTx\.projectId\)/.test(projectsNew));
ok("adoption moves the income by a correcting entry Dr 4900 / Cr the project's income, on the receipt's true date",
  /id: correctionId, journal: "Adjustment", date: fundingTx\.date/.test(projectsNew)
  && /\{ accountCode: OTHER_INCOME_LEDGER, debit: usd, credit: 0 \},\s*\{ accountCode: income, debit: 0, credit: usd, projectId: pid, donorId \}/.test(projectsNew));
ok("…sized from what the original entry booked to 4900, which is never edited",
  /\.filter\(l => l\.accountCode === OTHER_INCOME_LEDGER\)\.reduce/.test(projectsNew) && !/journalEntry\.(update|delete)/.test(projectsNew));
ok("…and survives a rebuild: its id is a kept je-rc-* entry", /const correctionId = `je-rc-\$\{Date\.now\(\)\}`/.test(projectsNew) && /\/\^je-rc-\/\.test\(e\.id\)/.test(rebuild));

console.log("\n2. a bank-only project refuses money outside the bank (§4.4.4)");
const bankOnly = { code: "ASFARI-2026-LER", channelRule: "bank", channelRuleSource: "ANH-DOC-00412" };
ok("a receipt for a bank-only project is refused", receiptBlocker(receipt({ purpose: "project", projectFound: true, project: bankOnly })) !== "");
ok("…citing the policy and the agreement", /§4\.4\.4/.test(bankOnlyBlocker(bankOnly)) && /ANH-DOC-00412/.test(bankOnlyBlocker(bankOnly)));
ok("a project with no restriction may use any channel", receiptBlocker(receipt({ purpose: "project", projectFound: true, project: { code: "X", channelRule: "any" } })) === "");
ok("the receipt route passes the project to the rule", /receiptBlocker\(\{[\s\S]{0,200}project, projectFound: !!project/.test(server));
// Saad, 14 Sep 2026 (Q3): NARROW. "Bank only" refuses receiving that project's money outside the
// bank — nothing else. Spending for its requests in cash (1127, a channel draw, the float) stays allowed.
const drawRoute = server.slice(server.indexOf('app.post("/api/cash/draw"'), server.indexOf('app.post("/api/cash/draw/return"'));
const routeBody = (start: string) => { const a = server.indexOf(start); return a < 0 ? "" : server.slice(a, server.indexOf("\n});\n", a)); };
const spending = ['app.post("/api/cash/draw"', 'app.post("/api/cash/draw/return"', 'app.post("/api/cash/topup/raise"', 'app.post("/api/cash/topup/decide"', 'app.post("/api/expense/action"', 'app.post("/api/expense/direct-petty-cash"'].map(routeBody).join("\n");
const pettyCashSrc = read("src/pettyCash.ts");
ok("bank only reaches the receipt route and nowhere else — cash spending for the project stays allowed",
  spending.length > 5000 && !/channelRule|bankOnlyBlocker/.test(spending) && !/bankOnlyBlocker/.test(routeBody('app.post("/api/cash/draw"'))
  && (pettyCashSrc.match(/bankOnlyBlocker\(/g) || []).length === 2 && !/channelRule/.test(pettyCashSrc.slice(pettyCashSrc.indexOf("export function payoutBlocker"), pettyCashSrc.indexOf("export function payoutLedgerFor"))));
ok("the migration records the rule per project, defaulting to any", /"channelRule" TEXT NOT NULL DEFAULT 'any'/.test(migration) && /"channelRuleSource"/.test(migration));

console.log("\n3. money from a channel is spent only through cash in transit");
ok("paying directly from a channel is refused", payoutBlocker(bob, "6000", "2026-10-01") !== "");
ok("a withdrawal for approved requests may draw on a channel", /source\.type !== "Bank" && !isLiveChannel\(source\)/.test(server));
ok("…and credits the channel's own ledger", /const bankLedger = payoutLedgerFor\(source, day\)/.test(server));
ok("a top-up of the float never draws on a channel", /source\.type !== "Bank" && !fromLeftover/.test(server));
ok("paying in at the bank cannot take more than the channel holds", depositBlocker(bob, { type: "Bank", active: true }, 600, 500) !== "" && depositBlocker(bob, { type: "Bank", active: true }, 500, 500) === "");
ok("…and waits on 1150 until the statement shows it", DEPOSITS_IN_TRANSIT_LEDGER === "1150" && /accountCode: DEPOSITS_IN_TRANSIT_LEDGER, debit: usd/.test(server));

console.log("\n4. a backfilled voucher dated before the opening lowers 1120 (§4.4.5, §6.6)");
ok("a past cash payment before the opening belongs to 1120", pastCashLedgerFor("2024-03-01", OPENED) === HISTORICAL_CLEARING_LEDGER && pastCashLedgerFor("2026-12-01", "") === HISTORICAL_CLEARING_LEDGER);
ok("after the opening it is not 'past cash' — it came out of the float or cash in transit", pastCashLedgerFor("2026-10-01", OPENED) === "");
ok("the rebuild credits 1120 for a cash voucher dated before the opening", cashLedgerFor("2024-03-01", OPENED, false) === HISTORICAL_CLEARING_LEDGER && /\{ accountCode: cashFrom, credit: netUSD/.test(rebuild));
ok("after the opening, other cash is cash in transit, never 1120", cashLedgerFor("2026-10-01", OPENED, false) === CASH_CLEARING_LEDGER);

console.log("\n5. a movement recorded on BLOM waits for its statement line — never counted twice");
ok("withdrawals, redeposits, top-ups and channel deposits are all statement-matched", [DRAW_REF("a"), DRAW_RETURN_REF("a"), TOPUP_REF("a"), OFFBANK_DEPOSIT_REF("a")].every(isStatementMatchRef) && !isStatementMatchRef("202608280017165"));
ok("the draw and top-up write their BLOM line pending, and leave the statement balance alone",
  (server.match(/pending: awaitsStatement\(source\), reconciled: !awaitsStatement\(source\)/g) || []).length === 2 && (server.match(/if \(!awaitsStatement\(source\)\) await tx\.bankAccount\.update/g) || []).length === 2);
ok("a redeposit and a channel deposit arrive at BLOM pending", /bt-cdr-\$\{stamp\}-in`[\s\S]{0,120}pending: true/.test(server) && /bt-\$\{id\}-in`[\s\S]{0,160}pending: true/.test(server));
ok("funds are what the statement shows less what is already recorded as leaving", /async function availableIn/.test(server) && (server.match(/await availableIn\(source\)/g) || []).length === 2);
ok("the eBLOM import never clears a marked line", /if \(isStatementMatchRef\(p\.noticeRef\)/.test(server));
const pend = { bankAccountId: "ba-blom-usd", type: "Withdrawal", amount: 500, pending: true, noticeRef: DRAW_REF("cd-1") };
const stmt = { bankAccountId: "ba-blom-usd", type: "Withdrawal", amount: 500, pending: false, noticeRef: "ZBLMN435" };
ok("a matching statement line is accepted", matchBlocker(pend, stmt) === "");
ok("a different amount, account or direction is refused", matchBlocker(pend, { ...stmt, amount: 499 }) !== "" && matchBlocker(pend, { ...stmt, bankAccountId: "ba-blom-eur" }) !== "" && matchBlocker(pend, { ...stmt, type: "Deposit" }) !== "");
ok("a line already belonging to something else is refused", matchBlocker(pend, { ...stmt, voucherNo: "PV-1" }) !== "" && matchBlocker(pend, { ...stmt, noticeRef: TOPUP_REF("x") }) !== "");
ok("only a pending marked line can be matched", matchBlocker({ ...pend, pending: false }, stmt) !== "" && matchBlocker({ ...pend, noticeRef: "x" }, stmt) !== "");
// Buying & paying (item 3 of 46014f6): a voucher paid from a bank account is written pending with its
// voucherNo and no marker. It must be matchable, and the match must carry the voucher across —
// general-ledger-post and drawStanding find a payment by voucherNo.
const pvPend = { bankAccountId: "ba-blom-usd", type: "Withdrawal", amount: 250, pending: true, noticeRef: null, voucherNo: "PV-2026-150" };
ok("a pending voucher payment is matchable", awaitsMatch(pvPend) && matchBlocker(pvPend, { ...stmt, amount: 250, noticeRef: null }) === "");
ok("…a confirmed one, or a pending line with neither marker nor voucher, is not", !awaitsMatch({ ...pvPend, pending: false }) && !awaitsMatch({ ...pvPend, voucherNo: null }));
ok("…and never onto a statement line already carrying a voucher", matchBlocker(pvPend, { ...stmt, amount: 250, voucherNo: "PV-2026-149" }) !== "");
ok("the match carries the voucherNo onto the statement line", /voucherNo: pending!\.voucherNo \|\| line!\.voucherNo/.test(server));
ok("the eBLOM import never clears a pending voucher payment either", /if \(isStatementMatchRef\(p\.noticeRef\) \|\| p\.voucherNo\) continue;/.test(server));
ok("the rebuild accrues a bank-paid voucher to AP and settles it from its bank line",
  /e\.paymentMethod === "Card" \|\| paidFromBank\.has\(e\.voucherNo\)/.test(rebuild) && /accountCode: ACC\.AP, debit: amt, projectId: pv\?\.projectId/.test(rebuild) && /\(t\.type === "Withdrawal" && !!t\.voucherNo\)/.test(rebuild));
ok("a backfilled voucher paid from cash awaiting vouchers credits 1120 in the rebuild",
  CAV === "Cash awaiting vouchers" && /e\.paymentMethod === CASH_AWAITING_VOUCHERS_NAME \? pastCashLedgerFor\(date, openedOn\)/.test(rebuild));
ok("the rebuild reads marked pending lines and nothing else pending", /!t\.pending \|\| \(isStatementMatchRef\(t\.noticeRef\) && !isOffbankDepositRef\(t\.noticeRef\)\)/.test(rebuild));

console.log("\n6. cash awaiting vouchers, and what a rebuild keeps");
ok("1120 is renamed, never counted as box cash", CASH_AWAITING_VOUCHERS_NAME === "Cash awaiting vouchers" && /UPDATE "Account" SET "name" = 'Cash awaiting vouchers[^']*' WHERE "code" = '1120'/.test(migration));
ok("the migration touches no existing balance", !/UPDATE[^;]*"balance"/i.test(migration));
ok("the overview only reads 1120 — nothing is reclassified", /app\.get\("\/api\/offbank\/overview"[\s\S]{0,6000}Read-only/.test(server));
ok("the dashboard no longer subtracts a box count from 1120", !/petty - latestCashCount\.countedUSD/.test(dashboard) && /cash awaiting vouchers \(ledger 1120\)/.test(dashboard));
ok("a rebuild keeps manual adjustments and reclassifications", /\/\^je-rc-\/\.test\(e\.id\) \|\| \/\^je-\\d\+\$\/\.test\(e\.id\)/.test(rebuild) && /id: \{ notIn: kept\.map/.test(rebuild) && /\[\.\.\.entries, \.\.\.kept\]/.test(rebuild));
ok("the FX sweep and the EUR rounding are dated by the last BLOM statement line, never by a channel receipt",
  /const lastStatementDate = bankTx\.filter\(t => !t\.pending && bankAccountIds\.has\(t\.bankAccountId\)\)/.test(rebuild)
  && (rebuild.match(/post\(lastStatementDate, "Adjustment",/g) || []).length === 2 && !/bankTx\[bankTx\.length - 1\]\.date/.test(rebuild));
{
  // Saad, 15 Sep 2026: the EUR "Cash withdrawal [Cash Withdrawal]" of 24 Aug is cash drawn to spend (1120), its fee
  // is a bank charge. The rebuild's own patterns, run against the statement narratives.
  const re = (name: string) => new RegExp(rebuild.match(new RegExp(`const ${name} = /(.+)/i;`))![1], "i");
  const [atm, fee, spend] = [re("atmRe"), re("feeRe"), re("spendRe")];
  const cls = (d: string) => fee.test(d) ? "fee" : atm.test(d) ? "cash" : spend.test(d) ? "card" : "unclassified";
  ok("the 24 Aug EUR cash withdrawal is cash drawn, not suspense", cls("Cash withdrawal [Cash Withdrawal]") === "cash" && cls("Cash withdrawal [سحب نقدي]") === "cash");
  ok("…and its fee is a bank charge", cls("Cash withdrawal fee [Cash Withdrawal Fee]") === "fee" && cls("Cash withdrawal fee [عمولة سحب نقدي]") === "fee");
  ok("BLOM's 'other commissions' is a bank charge, hostinger a card spend", cls("Other commissions [عمولا ت أخر]") === "fee" && cls("hostinger.com USD13.99") === "card");
}
ok("the receipt markers carry their purpose to the rebuild", isOffbankRef(OFFBANK_REF("quotation", "q1")) && offbankPurposeOf(OFFBANK_REF("other", "x")) === "other" && /purpose === "other"\) contra = \{ accountCode: OTHER_INCOME_LEDGER \}/.test(rebuild));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
