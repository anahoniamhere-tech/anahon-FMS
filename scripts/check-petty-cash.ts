// The petty-cash float — draft Policy 020 §4.4, Saad's decisions of 14 Sep 2026.
//
// Pins the four rules a float lives or dies by: the ceiling, the custodian never counts their
// own cash, nobody approves their own top-up, and an off-bank channel is never the float. Plus
// the cutover for late records, because years of vouchers are about to be backfilled and a
// 2024 cash payment must never land on the float.
//
// Every rule is checked by PERSON as well as seat. A Super Admin holds both the Finance and the
// Director seats, so a check by role alone would let one person count their own box or approve
// their own top-up just by wearing the other hat.
//   npx tsx scripts/check-petty-cash.ts
import { readFileSync } from "node:fs";
import {
  FLOAT_CEILING_USD, CASH_SINGLE_PAYMENT_USD, FLOAT_CEILING_LABEL, FLOAT_LEDGER, HISTORICAL_CLEARING_LEDGER,
  COUNT_DIFFERENCES_LEDGER, FLOAT_TYPE, CHANNEL_TYPE, COUNTER_SEATS, DIRECTOR_SEATS,
  isFloat, isChannel, floatBlocker, ceilingBlocker, raiseBlocker, approveBlocker, countBlocker,
  countDifference, itemsBlocker, cashLedgerFor, openingBlocker, isTopUpRef, TOPUP_REF, payoutBlocker,
  CASH_CLEARING_LEDGER, TRANSIT_TYPE, CLEARING_ALERT_DAYS, isTransit, isDrawRef, DRAW_REF, isDrawReturnRef, DRAW_RETURN_REF,
  drawBlocker, drawPosition, drawOverdue, transitBlocker, leftoverBlocker,
} from "../src/pettyCash.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const gates = read("src/gates.ts");
const rebuild = read("prisma/rebuild-ledger.ts");
const migration = read("prisma/migrations/20260914120000_petty_cash_float/migration.sql");
const clearingMigration = read("prisma/migrations/20260914190000_cash_clearing/migration.sql");
const clearingPanel = read("src/tabs/CashClearingPanel.tsx");

const FO = { id: "u-7", role: "Finance Officer" };          // the custodian
const SAAD = { id: "u-1", role: "Super Admin" };            // Executive Director, and in the Finance seat too
const AHMAD = { id: "u-9", role: "Procurement and Logistics Officer" };
const box = { id: "ba-petty-float", type: FLOAT_TYPE, ledgerCode: FLOAT_LEDGER, active: true, custodianUserId: FO.id };

console.log("\n1. the ceiling (§4.4.1), one number");
ok("the float ceiling is USD 1,000", FLOAT_CEILING_USD === 1000 && FLOAT_CEILING_LABEL === "USD 1,000");
ok("the single-payment rule stays USD 150, and lives in the same place", CASH_SINGLE_PAYMENT_USD === 150);
ok("a top-up that would take the box above the ceiling is refused", ceilingBlocker(400, 700) !== "");
ok("and the refusal names the policy section", /Policy 020 §4\.4\.1/.test(ceilingBlocker(400, 700)));
ok("a top-up to exactly the ceiling is allowed", ceilingBlocker(400, 600) === "");
ok("a half-cent float round-trip is not a breach", ceilingBlocker(400.001, 600) === "");
ok("nothing, or less than nothing, is not a top-up", ceilingBlocker(0, 0) !== "" && ceilingBlocker(0, -5) !== "");
ok("the top-up route checks the ceiling when raised AND again when approved",
  (server.match(/ceilingBlocker\(box!\.balance/g) || []).length === 2);
ok("the compliance-audit prompt reads the constants — it said \"USD 300\" for months",
  /Petty cash float ceiling: \$\{FLOAT_CEILING_LABEL\}/.test(server) && !/Petty cash ceiling: USD 300/.test(server)
  && /Cash payments above \$\{CASH_SINGLE_PAYMENT_LABEL\}/.test(server));
// The number is typed once. Scanned over the petty-cash routes and the panel — the places that
// would be tempted to write 1000 again — rather than the whole file, where 1000 means other things.
const cashRoutes = server.slice(server.indexOf("// ---- The petty-cash float"), server.indexOf("// Monthly payslip / salary receipt"));
const panel = read("src/tabs/PettyCashPanel.tsx");
ok("no petty-cash route or screen types the ceiling — it is read from src/pettyCash.ts",
  cashRoutes.length > 1000 && !/\b1,?000\b/.test(cashRoutes) && !/\b1,?000\b/.test(panel));

console.log("\n2. the custodian never counts their own cash (§4.4.1)");
const count = (who: { id: string; role: string }, extra: Partial<{ withoutNotice: boolean; custodianPresent: boolean }> = {}) =>
  countBlocker({ counterId: who.id, counterRole: who.role, custodianUserId: box.custodianUserId, withoutNotice: false, custodianPresent: true, ...extra });
ok("the Finance Officer who holds the box is refused — here by seat, since Finance is not a counter seat", count(FO) !== "");
// The line that actually pins the PERSON rule. Sabotaged on 14 Sep 2026 (the id check removed),
// this was the ONLY assertion that failed: the plain case above is refused by seat first and so
// hides the id check. Do not simplify it away.
ok("refused by PERSON — the custodian wearing a Director seat is still refused", count({ id: FO.id, role: "Program Director" }) !== "");
ok("the Executive Director may count", count(SAAD) === "");
ok("the Procurement and Logistics Officer may count", count(AHMAD) === "");
ok("any other seat may not", count({ id: "u-3", role: "Project Officer" }) !== "");
ok("the custodian must be present", count(SAAD, { custodianPresent: false }) !== "");
ok("the count without notice is the Executive Director's", count(SAAD, { withoutNotice: true }) === "" && count(AHMAD, { withoutNotice: true }) !== "");
ok("the route refuses the custodian with 403, before touching money",
  /const refused = countBlocker\(\{\s*counterId: user\?\.id/.test(server) && /if \(refused\) return res\.status\(403\)/.test(server));
ok("the gate admits exactly the counters — not the Finance seat that holds the box",
  /"\/api\/cash\/count": \[\.\.\.DIRECTORS, PLO\]/.test(gates));
ok("the Procurement and Logistics Officer's allowlist includes the count, or they get a 403",
  /PLO_ALLOWED_POSTS = new Set\(\[[\s\S]{0,120}"\/api\/cash\/count"/.test(server));
ok("a count no longer compares against the 1120 clearing", !/code: "1120"[^\n]*\n[^\n]*cashCount/.test(server) && !/Ledger 1120 book balance at the time/.test(server));
ok("a difference needs its explanation (§4.4.3)", countDifference(500, 480).needsExplanation && !countDifference(500, 500.001).needsExplanation);
ok("and the route refuses to record one without it", /needsExplanation && why\.length < 5/.test(server));

console.log("\n3. nobody approves their own top-up (§4.4.1)");
ok("the custodian raises it", raiseBlocker(FO.id, box.custodianUserId) === "");
ok("nobody else can — a Super Admin in the Finance seat included", raiseBlocker(SAAD.id, box.custodianUserId) !== "");
ok("the Executive Director approves it", approveBlocker(SAAD, FO.id) === "");
ok("the raiser cannot approve it, whatever seat they wear", approveBlocker({ id: FO.id, role: "Super Admin" }, FO.id) !== "");
ok("a non-director cannot approve it", approveBlocker(AHMAD, FO.id) !== "");
ok("every item is decided one by one, and a query moves no money",
  /Decide every item/.test(server) && /status: "Queried"[\s\S]{0,400}No money moved/.test(server));
ok("an item needs its receipt", itemsBlocker([{ txId: "t", voucherNo: "PV-1", date: "2026-10-01", amountUSD: 20, hasReceipt: false }]) !== "");
ok("approval moves the money in one transaction", /Approval\. Everything re-checked[\s\S]{0,3500}prisma\.\$transaction/.test(server));
ok("the approve gate is the Director seat", /"\/api\/cash\/topup\/decide": DIRECTORS/.test(gates));

console.log("\n4. an off-bank channel is never the float (§4.4.4)");
const channel = { id: "ba-fpu-bob", type: CHANNEL_TYPE, ledgerCode: HISTORICAL_CLEARING_LEDGER, active: false };
ok("a channel is not the float", !isFloat(channel) && isChannel(channel));
ok("and is refused as one", /never the petty-cash float/.test(floatBlocker(channel)));
ok("the float needs its type AND its own ledger", isFloat(box) && !isFloat({ ...box, ledgerCode: HISTORICAL_CLEARING_LEDGER }) && !isFloat({ ...box, type: "Bank" }));
ok("the migration retypes the channels BEFORE it creates the box",
  migration.indexOf(`SET "type" = 'Off-bank channel'`) > 0 && migration.indexOf(`SET "type" = 'Off-bank channel'`) < migration.indexOf("'ba-petty-float'"));
ok("the migration touches no existing balance", !/UPDATE[^;]*"balance"/i.test(migration));
ok("a top-up draws only on an active bank account, or on a withdrawal's leftover", /!source \|\| !source\.active \|\| \(source\.type !== "Bank" && !fromLeftover\)/.test(server));
ok("the rebuild sends channels to 1120 and the float to 1125 — deciding by type alone swung 1120 by USD 58,103.90",
  /floatIds\.has\(txAccountId\) \? FLOAT_LEDGER/.test(rebuild) && /b\.type === "Off-bank channel"/.test(rebuild));
ok("a top-up's bank line is read before the ATM rule, or it grows 1120",
  rebuild.indexOf("isTopUpRef(bt.noticeRef)) {") > 0 && rebuild.indexOf("isTopUpRef(bt.noticeRef)) {") < rebuild.indexOf("atmRe.test(bt.description)) {"));
ok("the top-up marker round-trips", isTopUpRef(TOPUP_REF("tu-1")) && !isTopUpRef("202608280017165"));

console.log("\n5. late records — one stored cutover, never inferred (Saad, 14 Sep)");
ok("before the float opens, all cash is historical clearing", cashLedgerFor("2026-10-01", "", true) === HISTORICAL_CLEARING_LEDGER);
ok("cash dated before the opening goes to 1120 even from the box", cashLedgerFor("2025-03-01", "2026-09-20", true) === HISTORICAL_CLEARING_LEDGER);
ok("on or after the opening, the float's own movements go to 1125", cashLedgerFor("2026-09-20", "2026-09-20", true) === FLOAT_LEDGER);
ok("on or after it, other cash is cash in transit — never a quiet 1120", cashLedgerFor("2026-10-01", "2026-09-20", false) === CASH_CLEARING_LEDGER);
ok("the first count opens the float and stores the date", /if \(opening\) await tx\.bankAccount\.update\(\{ where: \{ id: box!\.id \}, data: \{ openedOn: day \} \}\)/.test(server));
ok("nothing can be topped up before the float opens", openingBlocker("") !== "" && /const notOpen = openingBlocker\(box!\.openedOn\)/.test(server));
ok("nothing about the float may be dated before it opened", openingBlocker("2026-09-20", "2026-09-19") !== "" && openingBlocker("2026-09-20", "2026-09-20") === "");
ok("every entry the float writes records when and by whom, beside its true date",
  (server.match(/recordedAt: new Date\(\)\.toISOString\(\), recordedById: user\?\.id/g) || []).length >= 1 && /\.\.\.recorded,/.test(server));
ok("the rebuild keeps that recorder when it regenerates them", /recordedAt: c\.created_at, recordedById: c\.counterUserId/.test(rebuild));
ok("the rebuild counts lines landing on 1127 with no recorded withdrawal instead of filing them silently", /if \(code === CASH_CLEARING_LEDGER\) unlinkedTransit\+\+/.test(rebuild));
ok("no period is locked — late records must still post", !/period.?lock|closePeriod|lockDate/i.test(server));

// A payment dated before the float opened cannot be taken out of the box: payoutLedgerFor would
// credit 1120 while the route took it off the box, and the box and 1125 would disagree.
const floatOpen = { ...box, openedOn: "2026-09-20" };
ok("a payment from the float dated before it opened is refused", payoutBlocker(floatOpen, "6000", "2026-09-19") !== "");
ok("…but on or after the opening it is paid", payoutBlocker(floatOpen, "6000", "2026-09-20") === "");
ok("and a fee is never paid from the float, whatever the date", payoutBlocker(floatOpen, "5120", "2026-10-01") !== "");
ok("the rebuild dates a voucher by its TRUE transaction date, not the day it was typed in",
  /const date = \(e\.transactionDate \|\| e\.created_at/.test(rebuild));

console.log("\n6. the rebuild no longer reverts a reclassification");
ok("the voucher's own cost account wins over the category guess", /e\.costAccountCode \|\| costAccountFor\(/.test(rebuild));

ok("count differences wait on their own account for review", COUNT_DIFFERENCES_LEDGER === "2920" && DIRECTOR_SEATS.every(r => COUNTER_SEATS.includes(r)));

console.log("\n7. cash withdrawn for approved payment requests — 1127, never the float, never 1120 (Saad, 14 Sep)");
const transit = { id: "ba-cash-transit", type: TRANSIT_TYPE, ledgerCode: CASH_CLEARING_LEDGER, active: true };
ok("cash in transit is its own account, not the float and not the historical clearing",
  CASH_CLEARING_LEDGER === "1127" && isTransit(transit) && !isFloat(transit) && !isTransit({ ...transit, ledgerCode: HISTORICAL_CLEARING_LEDGER }));
ok("the migration creates 1127 and its account at zero, and touches no existing balance",
  /'1127'/.test(clearingMigration) && /'ba-cash-transit'[\s\S]{0,200}0/.test(clearingMigration) && !/UPDATE[^;]*"balance"/i.test(clearingMigration));
const link = (over = {}) => ({ expenseId: "e1", voucherNo: "PV-1", netUSD: 400, status: "Approved", paid: false, alreadyDrawnIn: "", ...over });
const draw = (over = {}) => ({ openedOn: "2026-09-20", date: "2026-10-01", amountUSD: 500, links: [link()], ...over });
ok("a withdrawal for an approved, unpaid request is recorded", drawBlocker(draw()) === "");
ok("one withdrawal may pay several requests", drawBlocker(draw({ links: [link(), link({ expenseId: "e2", voucherNo: "PV-2", netUSD: 100 })] })) === "");
ok("a withdrawal linked to nothing is refused", drawBlocker(draw({ links: [] })) !== "");
ok("a request not yet approved is refused", drawBlocker(draw({ links: [link({ status: "Pending PD Approval" })] })) !== "");
ok("a request already paid is refused", drawBlocker(draw({ links: [link({ paid: true })] })) !== "");
ok("a request is paid from one withdrawal only", drawBlocker(draw({ links: [link({ alreadyDrawnIn: "cd-1" })] })) !== "");
ok("a withdrawal smaller than the requests it pays is refused", drawBlocker(draw({ amountUSD: 399 })) !== "");
ok("a withdrawal dated before the float opened is refused — it is historical, 1120", drawBlocker(draw({ date: "2026-09-19" })) !== "");
ok("a request is paid out of cash in transit only against its own withdrawal",
  transitBlocker(null) !== "" && transitBlocker({ linked: false, remainingUSD: 500, netUSD: 400 }) !== ""
  && transitBlocker({ linked: true, remainingUSD: 399, netUSD: 400 }) !== "" && transitBlocker({ linked: true, remainingUSD: 400, netUSD: 400 }) === "");
ok("and payoutBlocker routes cash in transit through that rule", payoutBlocker(transit, "5120", "2026-10-01") !== "" && payoutBlocker(transit, "5120", "2026-10-01", { linked: true, remainingUSD: 500, netUSD: 400 }) === "");
ok("what is left is derived: drawn − paid − redeposited − moved to the float",
  drawPosition(500, 400, 60, 40).remainingUSD === 0 && drawPosition(500, 400, 60, 40).cleared && !drawPosition(500, 400, 0, 0).cleared);
ok("a leftover moves only once every request is paid", leftoverBlocker(100, 50, 1) !== "" && leftoverBlocker(100, 50, 0) === "");
ok("and never more than is left", leftoverBlocker(100, 100.5, 0) !== "" && leftoverBlocker(100, 100, 0) === "");
ok(`the alert is after ${CLEARING_ALERT_DAYS} days with cash still out`, CLEARING_ALERT_DAYS === 7
  && !drawOverdue("2026-10-01", "2026-10-08", 50, "2026-09-20") && drawOverdue("2026-10-01", "2026-10-09", 50, "2026-09-20"));
ok("a cleared withdrawal is never flagged", !drawOverdue("2026-10-01", "2026-12-01", 0, "2026-09-20"));
ok("only items dated on or after the opening count toward the alert — backfilled history never floods it",
  !drawOverdue("2026-09-10", "2026-12-01", 50, "2026-09-20") && !drawOverdue("2026-10-01", "2026-12-01", 50, ""));
ok("the draw and redeposit routes are Finance's", /"\/api\/cash\/draw": BOOKS/.test(gates) && /"\/api\/cash\/draw\/return": BOOKS/.test(gates));
ok("recording a withdrawal runs the rule, then moves the money in one transaction",
  /app\.post\("\/api\/cash\/draw"[\s\S]{0,2500}drawBlocker\([\s\S]{0,2500}prisma\.\$transaction/.test(server));
ok("a leftover top-up is re-checked when it is approved, and credits 1127",
  /fromLeftover\) \{\s*\/\/ Re-read[\s\S]{0,500}leftoverBlocker/.test(server) && /bankLedger = fromLeftover \? CASH_CLEARING_LEDGER/.test(server));
ok("the markers round-trip and do not collide with a top-up",
  isDrawRef(DRAW_REF("cd-1")) && isDrawReturnRef(DRAW_RETURN_REF("cd-1")) && !isDrawRef(DRAW_RETURN_REF("cd-1")) && !isTopUpRef(DRAW_REF("cd-1")));
ok("the rebuild reads a withdrawal's bank line before the ATM rule, or it grows 1120",
  rebuild.indexOf("if (isDrawRef(bt.noticeRef)) {") > 0 && rebuild.indexOf("if (isDrawRef(bt.noticeRef)) {") < rebuild.indexOf("atmRe.test(bt.description)) {"));
ok("the rebuild posts only the bank's side of a two-line movement", /transitIds\.has\(bt\.bankAccountId\) && \(isDrawRef\(bt\.noticeRef\) \|\| isDrawReturnRef/.test(rebuild));
ok("a voucher paid out of a withdrawal credits 1127 in the rebuild", /paidFromTransit\.has\(e\.voucherNo\) \? CASH_CLEARING_LEDGER/.test(rebuild));
ok("the screen reads the seven days from the rule, not a typed number", !/\b7 days\b/.test(clearingPanel) && /CLEARING_ALERT_DAYS/.test(clearingPanel));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
