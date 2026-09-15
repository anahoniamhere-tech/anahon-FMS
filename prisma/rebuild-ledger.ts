// Full general-ledger rebuild from primary evidence. Idempotent: wipes and regenerates every
// journal entry, then recomputes all Account balances from the journal. Safe to re-run.
//   npx tsx prisma/rebuild-ledger.ts
//
// PRINCIPLES (the invariants the whole rebuild hangs on):
//  1. Bank accounts 1100/1110 are touched ONLY by statement lines, one JE per line, at line
//     amounts. That makes journal-derived bank balances tie to the statements BY CONSTRUCTION.
//  2. Vouchers never credit a bank account directly. They accrue: Dr expense / Cr 2100 (AP)
//     for card-paid, or Cr 1120 (petty cash) for cash-paid. Card statement lines then settle
//     the matched voucher's AP; the card FX markup goes to 7400 bank charges.
//  3. EUR lines convert at FxRates.EUR (today-rate convention, same as the rest of the app —
//     historical-rate FX remains a documented limitation). Because ALL EUR lines use one rate,
//     the EUR bank balance still ties exactly after dividing back.
//  4. Nothing is guessed. Unidentifiable money goes to 2900 Suspense and is REPORTED, not
//     classified. The huge petty-cash residual (bank cash withdrawn >> cash vouchers) is left
//     visible on 1120 — that gap is real missing documentation, not a rounding error.
import { PrismaClient } from "@prisma/client";

import { costAccountFor } from "../src/costAccount.js";
import { FLOAT_LEDGER, COUNT_DIFFERENCES_LEDGER, CASH_CLEARING_LEDGER, isFloat, isTransit, isTopUpRef, isDrawRef, isDrawReturnRef, countDifference, cashLedgerFor, channelLedgerFor, isLiveChannel, isStatementMatchRef, isOffbankDepositRef, offbankPurposeOf, DEPOSITS_IN_TRANSIT_LEDGER, OTHER_INCOME_LEDGER, CASH_AWAITING_VOUCHERS_NAME, pastCashLedgerFor } from "../src/pettyCash.js";

const prisma = new PrismaClient();

const ACC = {
  BANK_USD: "1100", BANK_EUR: "1110", PETTY: "1120", AP: "2100", WHT: "2315",
  SUSPENSE: "2900", FXCLEAR: "2910", REIMBURSE: "2930", GRANT: "4100", SERVICE: "4200",
  FXGAIN: "4500", STAFF: "5100", FREELANCE: "5120", DIRECT: "6000",
  TRAVEL: "6200", EQUIP: "6300", SOFTWARE: "6400", RENT: "7100", BANKFEES: "7400", FXLOSS: "7700",
};

// BudgetLine.category -> expense account now lives in src/costAccount.ts, because the live
// posting route needs the same answer — it used to hardcode 6100 for every voucher.

const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const fx = (await prisma.fxRates.findFirst())?.EUR || 1.1406;
  const [accounts, bankAccounts, allBankTx, expenses, budgetLines, projects, cashCounts] = await Promise.all([
    prisma.account.findMany(),
    prisma.bankAccount.findMany(),
    prisma.bankTransaction.findMany({ orderBy: { date: "asc" } }),
    prisma.expense.findMany(),
    prisma.budgetLine.findMany(),
    prisma.project.findMany(),
    prisma.cashCount.findMany({ orderBy: { date: "asc" } }),
  ]);
  // Statement lines, plus the movements the system recorded on BLOM that wait for their statement
  // line (a withdrawal for requests, a redeposit, a top-up). Only one of the two carries the marker
  // at a time: matching moves it to the statement line and deletes the pending one. Other pending
  // lines (eBLOM advices) are not proof of anything and stay out.
  // A voucher paid from a bank account is written the same way (pending, with its voucherNo).
  const bankTx = allBankTx.filter(t => !t.pending || (isStatementMatchRef(t.noticeRef) && !isOffbankDepositRef(t.noticeRef))
    || (t.type === "Withdrawal" && !!t.voucherNo));
  const acctByCode = new Map(accounts.map(a => [a.code, a]));
  const blById = new Map(budgetLines.map(b => [b.id, b]));
  const projById = new Map(projects.map(p => [p.id, p]));
  const eurAccountIds = new Set(bankAccounts.filter(b => b.currency === "EUR").map(b => b.id));
  // Off-BLOM cash receipts (e.g. SKF cheques cashed at Byblos) live on Petty-Cash-type
  // accounts: their lines move 1120, never 1100/1110 — the statement-tie invariant holds.
  //
  // 14 Sep 2026 (Policy 020 §4.4): the petty-cash float is its own account on ledger 1125. The
  // four off-bank channels were retyped "Off-bank channel" and keep landing on 1120, so a
  // re-run reproduces 1120's historical balance exactly. Deciding by type alone would have sent
  // the channels to 1100 the moment they were retyped — and the box to 1120.
  const floatIds = new Set(bankAccounts.filter(b => isFloat(b)).map(b => b.id));
  const pettyAccountIds = new Set(bankAccounts
    .filter(b => !floatIds.has(b.id) && (b.type === "Petty Cash" || b.type === "Off-bank channel"))
    .map(b => b.id));

  // The two BLOM sub-accounts map to GL codes; the chart still said "Audi" — fix the names.
  await prisma.account.update({ where: { code: ACC.BANK_USD }, data: { name: "Bank - USD (BLOM Business Plus 004-02-…794-1-7)" } });
  await prisma.account.update({ where: { code: ACC.BANK_EUR }, data: { name: "Bank - EUR (BLOM Business Plus 004-04-…794-1-5)" } });
  for (const [code, name, type, group] of [
    [ACC.SUSPENSE, "Suspense — Unidentified Receipts", "Liability", "Suspense"],
    [ACC.FXCLEAR, "FX Conversion Clearing", "Liability", "Suspense"],
    [COUNT_DIFFERENCES_LEDGER, "Petty Cash Count Differences — pending Executive Director review", "Liability", "Suspense"],
    [ACC.REIMBURSE, "Reimbursements received — the costs they repay not yet recorded", "Liability", "Suspense"],
  ] as const) {
    if (!acctByCode.has(code)) {
      await prisma.account.create({ data: { code, name, type, currency: "USD", reportingGroup: group, balance: 0, active: true } });
    }
  }

  if (!acctByCode.has(FLOAT_LEDGER)) {
    await prisma.account.create({ data: { code: FLOAT_LEDGER, name: "Petty Cash Float (locked box)", type: "Asset", currency: "USD", parent: "1000", reportingGroup: "Cash & Cash Equivalents", balance: 0, active: true } });
  }

  // ---- wipe: full regeneration is the idempotency mechanism ----
  // Except what nothing here can regenerate: a manual adjustment (/api/journal-entry/adjustment,
  // id je-<timestamp>) and a reclassification (/api/ledger/reclassify, je-rc-*). Every other live
  // entry — a draw, a top-up, a count, an off-bank receipt, a voucher's payment — is rebuilt from
  // the rows that caused it, so keeping it too would post it twice.
  const kept = (await prisma.journalEntry.findMany({ where: { journal: "Adjustment" } }))
    .filter(e => /^je-rc-/.test(e.id) || /^je-\d+$/.test(e.id));
  const wiped = await prisma.journalEntry.deleteMany({ where: { id: { notIn: kept.map(e => e.id) } } });
  console.log(`wiped ${wiped.count} old journal entries; kept ${kept.length} manual adjustment / reclassification entr${kept.length === 1 ? "y" : "ies"}`);

  let seq = 0;
  const entries: any[] = [];
  const post = (date: string, journal: string, description: string, referenceNo: string,
    items: { accountCode: string; debit?: number; credit?: number; projectId?: string | null; donorId?: string | null }[], recorded: { recordedAt?: string; recordedById?: string } = {}) => {
    const clean = items.map(i => ({ accountCode: i.accountCode, debit: r2(i.debit || 0), credit: r2(i.credit || 0), projectId: i.projectId || undefined, donorId: i.donorId || undefined }))
      .filter(i => i.debit > 0.004 || i.credit > 0.004);
    const dr = r2(clean.reduce((s, i) => s + i.debit, 0)), cr = r2(clean.reduce((s, i) => s + i.credit, 0));
    if (Math.abs(dr - cr) > 0.011) throw new Error(`Unbalanced entry ${referenceNo}: Dr ${dr} Cr ${cr} — ${description}`);
    entries.push({ id: `je-rb-${String(++seq).padStart(4, "0")}`, journal, date, description, referenceNo, isPosted: true, itemsJson: JSON.stringify(clean), recordedAt: recorded.recordedAt || "", recordedById: recorded.recordedById || "" });
  };

  // ---- match card statement lines to card vouchers (so the same spend posts once) ----
  const cardVouchers = expenses.filter(e => e.paymentMethod === "Card");
  const spendRe = /APPLE|HOSTINGER|HIGGSFIELD|NOKNOK|FASTCOMET|GOOGLE|OPENAI|CANVA|ADOBE|META|MIDJOURNEY|ANTHROPIC|CLAUDE|SIMLY|UBER|MASSIVE|PHOTOROOM/i;
  const feeRe = /عمولة|عمولا ?ت|مصاريف|طوابع|فوائد|Statement fee|Commission|maintenance|Debit interest|Withdrawal Fee/i;
  // "Cash withdrawal [Cash Withdrawal]" (EUR, 24 Aug 2026) is cash Saad drew to spend, like the Arabic-labelled
  // one of 31 Aug — it belongs with cash awaiting vouchers, not suspense (Saad, 15 Sep 2026). Its fee is caught
  // by feeRe first.
  const atmRe = /ZBLMN|سحب|Cash Withdrawal\]?$/i;
  const fxRe = /FX conversion|ع\.قطع|الغاء|Reversal/i;

  const matchedLines = new Map<string, any>(); // bankTx.id -> voucher
  const usedVouchers = new Set<string>();
  for (const bt of bankTx.filter(t => t.type === "Withdrawal" && spendRe.test(t.description))) {
    const cand = cardVouchers
      .filter(v => !usedVouchers.has(v.id))
      .filter(v => Math.abs(v.amount - bt.amount) <= Math.max(0.06 * v.amount, 1.0))
      .filter(v => Math.abs(new Date(v.created_at).getTime() - new Date(bt.date).getTime()) <= 6 * 86400000)
      .sort((a, b) => Math.abs(a.amount - bt.amount) - Math.abs(b.amount - bt.amount))[0];
    if (cand) { matchedLines.set(bt.id, cand); usedVouchers.add(cand.id); }
  }
  console.log(`card matching: ${matchedLines.size}/${cardVouchers.length} card vouchers matched to statement lines`);

  // The voucher's own account first. Deriving from the category alone meant a re-run silently
  // reverted every reclassification the Ledger door had posted (12 Sep 2026: five vouchers
  // moved 6000 -> 5120 would have gone straight back).
  const expenseAccountFor = (e: any) => e.costAccountCode || costAccountFor(blById.get(e.budgetLineId)?.category);
  const usd = (amount: number, txAccountId: string) => eurAccountIds.has(txAccountId) ? r2(amount * fx) : amount;
  const transitIds = new Set(bankAccounts.filter(b => isTransit(b as any)).map(b => b.id));
  // The one stored cutover for late records: the float's opening date (its first count).
  const openedOn = bankAccounts.find(b => floatIds.has(b.id))?.openedOn || "";
  // A channel that takes money today posts to its own ledger account from the opening on; before
  // it, and on the four historical per-counterparty accounts always, it is cash awaiting vouchers.
  const liveChannelById = new Map(bankAccounts.filter(b => isLiveChannel(b as any)).map(b => [b.id, b]));
  const bankCode = (txAccountId: string, date: string) => floatIds.has(txAccountId) ? FLOAT_LEDGER : transitIds.has(txAccountId) ? CASH_CLEARING_LEDGER
    : liveChannelById.has(txAccountId) ? channelLedgerFor(liveChannelById.get(txAccountId) as any, date, openedOn)
    : pettyAccountIds.has(txAccountId) ? ACC.PETTY : eurAccountIds.has(txAccountId) ? ACC.BANK_EUR : ACC.BANK_USD;
  // Cash dated after the opening that is neither into nor out of the box sits on 1127, cash in
  // transit (Saad, 14 Sep 2026). A line that lands there without a recorded withdrawal is counted,
  // so an ATM draw nobody linked to its requests is reported rather than silently filed.
  let unlinkedTransit = 0;
  const cashCode = (date: string, fromFloat: boolean) => {
    const code = cashLedgerFor(date, openedOn, fromFloat);
    if (code === CASH_CLEARING_LEDGER) unlinkedTransit++;
    return code;
  };
  // A voucher paid out of the box: its cash settlement credits the float, not the old clearing.
  const paidFromFloat = new Set(bankTx.filter(t => t.type === "Withdrawal" && floatIds.has(t.bankAccountId) && t.voucherNo).map(t => t.voucherNo!));
  // ...and a voucher paid out of a withdrawal credits 1127 whatever its date says.
  const paidFromTransit = new Set(bankTx.filter(t => t.type === "Withdrawal" && transitIds.has(t.bankAccountId) && t.voucherNo).map(t => t.voucherNo!));
  // ...and a voucher paid by transfer from a bank account accrues to AP, which its bank line settles.
  const bankAccountIds = new Set(bankAccounts.filter(b => b.type === "Bank").map(b => b.id));
  const paidFromBank = new Map(bankTx.filter(t => t.type === "Withdrawal" && bankAccountIds.has(t.bankAccountId) && t.voucherNo).map(t => [t.voucherNo!, t]));
  const expenseByVoucher = new Map(expenses.map(e => [e.voucherNo, e]));
  const eurNote = (txAccountId: string) => eurAccountIds.has(txAccountId) ? ` [EUR @ ${fx}]` : "";

  // Every line posted to FX clearing, so the sweep can pair each conversion's two legs (below).
  const fxLegs: { id: string; date: string; eur: boolean; type: string; net: number; reversal: boolean }[] = [];

  // ---- 1. statement lines: the only source of bank movements ----
  for (const bt of bankTx) {
    const amt = usd(bt.amount, bt.bankAccountId);
    const bank = bankCode(bt.bankAccountId, bt.date);
    const note = eurNote(bt.bankAccountId);
    const ref = `BT-${bt.id}`;

    // A top-up writes two lines — out of the bank, into the box. The bank line carries the whole
    // entry (below), so the box line posts nothing, or 1125 would be debited twice.
    if (bt.type === "Deposit" && floatIds.has(bt.bankAccountId) && isTopUpRef(bt.noticeRef)) continue;
    // A payment out of the box is posted by its voucher (section 2), which credits the float.
    if (bt.type === "Withdrawal" && floatIds.has(bt.bankAccountId) && bt.voucherNo) continue;
    // A withdrawal for payment requests, and a redeposit of its leftover, also write two lines;
    // the bank's line carries the entry. A payment out of cash in transit is posted by its voucher.
    if (transitIds.has(bt.bankAccountId) && (isDrawRef(bt.noticeRef) || isDrawReturnRef(bt.noticeRef) || (bt.type === "Withdrawal" && bt.voucherNo))) continue;
    const recorded = { recordedAt: (bt as any).recordedAt, recordedById: (bt as any).recordedById };

    if (bt.type === "Deposit" && isOffbankDepositRef(bt.noticeRef)) {
      // Money from a channel arriving at BLOM, matched to its statement line: clears 1150.
      post(bt.date, "Bank", `Deposit from an off-bank channel arrived: ${bt.description}${note}`, ref, [
        { accountCode: bank, debit: amt }, { accountCode: DEPOSITS_IN_TRANSIT_LEDGER, credit: amt }], recorded);
      continue;
    }
    if (bt.type === "Withdrawal" && isOffbankDepositRef(bt.noticeRef)) {
      // Taken out of a channel to pay in at BLOM: on its way to the bank until the statement shows it.
      post(bt.date, "Bank", `Taken from an off-bank channel to pay in at the bank: ${bt.description}${note}`, ref, [
        { accountCode: DEPOSITS_IN_TRANSIT_LEDGER, debit: amt }, { accountCode: bank, credit: amt }], recorded);
      continue;
    }
    if (bt.type === "Deposit" && isDrawReturnRef(bt.noticeRef)) {
      post(bt.date, "Bank", `Leftover cash redeposited: ${bt.description}${note}`, ref, [
        { accountCode: bank, debit: amt }, { accountCode: CASH_CLEARING_LEDGER, credit: amt }], recorded);
      continue;
    }

    if (bt.type === "Deposit") {
      let contra: { accountCode: string; projectId?: string | null; donorId?: string | null } = { accountCode: ACC.SUSPENSE };
      const purpose = offbankPurposeOf(bt.noticeRef);
      if (purpose === "quotation") contra = { accountCode: ACC.SERVICE }; // a client paying a quotation outside the bank
      else if (purpose === "other") contra = { accountCode: OTHER_INCOME_LEDGER };
      else if (fxRe.test(bt.description)) { contra = { accountCode: ACC.FXCLEAR }; fxLegs.push({ id: bt.id, date: bt.date, eur: eurAccountIds.has(bt.bankAccountId), type: bt.type, net: amt, reversal: /الغاء|Reversal/i.test(bt.description) }); }
      // ICFJ's USD 200 of 28 Aug 2026 (Tipalti, "Invoice Aug 2026") repays transport and logistics for attending
      // its Training of Trainers — not income, no project (Saad, 13 Sep 2026). No voucher for those costs exists
      // yet, so it waits as a liability until they are recorded against it.
      else if (/Intl Ctr for Journalists \(ICFJ\)/.test(bt.description)) contra = { accountCode: ACC.REIMBURSE };
      else if (bt.projectId) {
        const p = projById.get(bt.projectId);
        contra = { accountCode: p?.fundingType === "Unrestricted Service" ? ACC.SERVICE : ACC.GRANT, projectId: bt.projectId, donorId: p?.donorId };
      }
      else if (bt.bankAccountId === "ba-prod-offbank") contra = { accountCode: ACC.SERVICE }; // production client payments (OMT/BOB/Whish/cash) — earned income
      else if (/REPUBLICAN|IRI\b/i.test(bt.description)) contra = { accountCode: ACC.GRANT, donorId: "don-iri" };
      else if (/FRONT LINE/i.test(bt.description)) contra = { accountCode: ACC.GRANT, donorId: "don-fld" };
      else if (/WE WORLD/i.test(bt.description)) contra = { accountCode: ACC.GRANT, donorId: "don-weworld" };
      else if (/SAMIR KASSIR/i.test(bt.description)) contra = { accountCode: ACC.SERVICE, donorId: "don-skf" }; // SKF service engagements outside a registered project
      else if (/FHI360/i.test(bt.description)) contra = { accountCode: ACC.AP, donorId: "don-fhi360" }; // pass-through: owed onward, not income
      post(bt.date, "Bank", `${bt.description}${note}`, ref, [
        { accountCode: bank, debit: amt },
        { ...contra, credit: amt },
      ]);
      continue;
    }

    // Withdrawals
    const v = matchedLines.get(bt.id);
    if (isDrawRef(bt.noticeRef)) {
      // Cash withdrawn for approved payment requests: it waits on 1127 until they are paid. Before
      // the ATM rule, for the same reason as a top-up.
      post(bt.date, "Bank", `Cash withdrawn for payment requests: ${bt.description}${note}`, ref, [
        { accountCode: CASH_CLEARING_LEDGER, debit: amt }, { accountCode: bank, credit: amt }], recorded);
    } else if (isTopUpRef(bt.noticeRef)) {
      // Cash drawn to top up the float (Policy 020 §4.4.1). Checked before the ATM rule, which
      // would otherwise read it as one more "cash drawn to petty cash" and grow the 1120 clearing.
      post(bt.date, "Bank", `Petty cash top-up to the float: ${bt.description}${note}`, ref, [
        { accountCode: FLOAT_LEDGER, debit: amt }, { accountCode: bank, credit: amt }],
        { recordedAt: (bt as any).recordedAt, recordedById: (bt as any).recordedById });
    } else if (bt.voucherNo && paidFromBank.get(bt.voucherNo) === bt) {
      // A payment request paid by transfer: settles the voucher's AP (section 2 accrued it).
      const pv = expenseByVoucher.get(bt.voucherNo);
      post(bt.date, "Bank", `${bt.description} — pays ${bt.voucherNo}${note}`, ref, [
        { accountCode: ACC.AP, debit: amt, projectId: pv?.projectId }, { accountCode: bank, credit: amt }], recorded);
    } else if (v) {
      // Settles the matched card voucher's AP; FX markup above the voucher net is a bank charge.
      const netUSD = r2((v.amount - v.whtAmount) * v.rate);
      post(bt.date, "Bank", `${bt.description} — settles ${v.voucherNo}${note}`, ref, [
        { accountCode: ACC.AP, debit: Math.min(netUSD, amt), projectId: v.projectId },
        { accountCode: ACC.BANKFEES, debit: r2(Math.max(0, amt - netUSD)), projectId: v.projectId },
        { accountCode: bank, credit: amt },
      ]);
    } else if (feeRe.test(bt.description)) {
      post(bt.date, "Bank", `${bt.description}${note}`, ref, [
        { accountCode: ACC.BANKFEES, debit: amt }, { accountCode: bank, credit: amt }]);
    } else if (fxRe.test(bt.description)) {
      fxLegs.push({ id: bt.id, date: bt.date, eur: eurAccountIds.has(bt.bankAccountId), type: bt.type, net: -amt, reversal: /الغاء|Reversal/i.test(bt.description) });
      post(bt.date, "Bank", `${bt.description}${note}`, ref, [
        { accountCode: ACC.FXCLEAR, debit: amt }, { accountCode: bank, credit: amt }]);
    } else if (atmRe.test(bt.description)) {
      post(bt.date, "Bank", `Cash drawn to petty cash: ${bt.description}${note}`, ref, [
        { accountCode: cashCode(bt.date, false), debit: amt }, { accountCode: bank, credit: amt }]);
    } else if (spendRe.test(bt.description)) {
      const code = /UBER/i.test(bt.description) ? ACC.TRAVEL : ACC.SOFTWARE;
      post(bt.date, "Bank", `${bt.description} (no voucher — direct card spend)${note}`, ref, [
        { accountCode: code, debit: amt }, { accountCode: bank, credit: amt }]);
    } else {
      post(bt.date, "Bank", `${bt.description} (unclassified)${note}`, ref, [
        { accountCode: ACC.SUSPENSE, debit: amt }, { accountCode: bank, credit: amt }]);
    }
  }

  // ---- 2. vouchers: accrual + (cash settlement | AP awaiting its statement line) ----
  for (const e of expenses) {
    // The TRUE transaction date first (Expense.transactionDate, Buying & paying 8510f09). Before it
    // existed a voucher's only date was created_at, so a voucher backfilled today posted on the
    // day it was typed in. Rows from before the field stay "" — not captured — and fall back.
    const date = (e.transactionDate || e.created_at || "").split("T")[0] || "2026-01-01";
    const gross = e.convertedAmount;
    const whtUSD = r2(e.whtAmount * e.rate);
    const netUSD = r2(gross - whtUSD);
    const expAcc = expenseAccountFor(e);
    const donorId = projById.get(e.projectId)?.donorId;

    // Partial project attribution (allocationsJson): only the allocated share carries the
    // project/donor tag — the remainder is organisational overhead and must not surface in
    // any donor report built from project-tagged journal lines.
    let allocs: { projectId?: string; amount?: number }[] = [];
    try { allocs = JSON.parse(e.allocationsJson || "[]"); } catch { }
    const debitLegs: { accountCode: string; debit: number; projectId?: string | null; donorId?: string | null }[] = [];
    if (allocs.length && allocs.every(a => a.projectId && a.amount != null)) {
      let tagged = 0;
      for (const a of allocs) {
        const amt = r2(Number(a.amount));
        tagged = r2(tagged + amt);
        debitLegs.push({ accountCode: expAcc, debit: amt, projectId: a.projectId, donorId: projById.get(a.projectId!)?.donorId });
      }
      const rest = r2(gross - tagged);
      if (rest > 0.004) debitLegs.push({ accountCode: expAcc, debit: rest }); // untagged = org overhead
    } else {
      debitLegs.push({ accountCode: expAcc, debit: gross, projectId: e.projectId, donorId });
    }

    if (e.paymentMethod === "Card" || paidFromBank.has(e.voucherNo)) {
      // Accrue only — the matched statement line settles AP (rule 2). Unmatched card vouchers
      // stay open on AP and are listed below for the user; the money isn't on any statement.
      post(date, "Purchases", `Accrued ${e.voucherNo}: ${e.title}`, e.voucherNo, [
        ...debitLegs,
        { accountCode: ACC.AP, credit: netUSD, projectId: e.projectId },
        { accountCode: ACC.WHT, credit: whtUSD, projectId: e.projectId },
      ]);
    } else {
      // Cash (and legacy unknown-method) vouchers: paid from petty cash drawn at the ATM — or,
      // since 14 Sep 2026, from the float, whose payments credit 1125 instead of the old clearing.
      // Placed by its true date against the stored opening, never by when it was typed in.
      // A backfilled cash payment nobody vouchered at the time (§6.6) credits cash awaiting vouchers.
      const pastCash = e.paymentMethod === CASH_AWAITING_VOUCHERS_NAME ? pastCashLedgerFor(date, openedOn) : "";
      const cashFrom = paidFromTransit.has(e.voucherNo) ? CASH_CLEARING_LEDGER : pastCash || cashCode(date, paidFromFloat.has(e.voucherNo));
      post(date, "Purchases", `${e.voucherNo}: ${e.title} (cash)`, e.voucherNo, [
        ...debitLegs,
        { accountCode: cashFrom, credit: netUSD, projectId: e.projectId },
        { accountCode: ACC.WHT, credit: whtUSD, projectId: e.projectId },
      ]);
    }
  }

  // ---- 2b. petty-cash count differences (Policy 020 §4.4.3) ----
  // A count moves the float to what was physically there; the difference waits on 2920 for the
  // Executive Director. The opening float is the first count, expected 0. Reproduced from the
  // counts so a re-run keeps them — the wipe above removes every entry it cannot rebuild.
  for (const c of cashCounts) {
    if (!floatIds.has(c.bankAccountId)) continue;
    const { difference, needsExplanation } = countDifference(c.expectedUSD, c.countedUSD);
    if (!needsExplanation) continue;
    const up = difference > 0, amt = Math.abs(difference);
    post(c.date, "Adjustment", `Petty cash count ${c.date}: counted ${c.countedUSD.toFixed(2)} against ${c.expectedUSD.toFixed(2)} expected — ${c.explanation}`, c.id, [
      { accountCode: up ? FLOAT_LEDGER : COUNT_DIFFERENCES_LEDGER, debit: amt },
      { accountCode: up ? COUNT_DIFFERENCES_LEDGER : FLOAT_LEDGER, credit: amt },
    ], { recordedAt: c.created_at, recordedById: c.counterUserId });
  }

  // The two period-end adjustments below are dated by the last line on a BLOM statement — the
  // statements are what they true up to. Dating them by the last line posted at all let a cash receipt
  // on an off-bank channel (10 Sep 2026) drag July's FX loss into September.
  const lastStatementDate = bankTx.filter(t => !t.pending && bankAccountIds.has(t.bankAccountId))
    .reduce((m, t) => t.date > m ? t.date : m, "");

  // ---- 3. sweep FX clearing to gain/loss ----
  // Only a conversion whose two legs are both on statements is swept: EUR out with USD in (or back), within five
  // days. A leg whose partner has not arrived is money in transit between our own accounts, not a loss — it stays
  // on 2910 until the other statement shows it (8 Sep 2026: EUR 300 converted, the USD leg not yet posted).
  // A reversal (الغاء) is BLOM undoing a line on the same account — e.g. EUR 13 of 2 Jan 2025 — never half of a
  // conversion, so it is always swept; only conversion legs wait for their partner.
  const pairedIds = new Set<string>(fxLegs.filter(l => l.reversal).map(l => l.id));
  const dayGap = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
  for (const e of fxLegs.filter(l => l.eur && !l.reversal)) {
    const partner = fxLegs.filter(u => !u.eur && !u.reversal && !pairedIds.has(u.id) && u.type !== e.type && dayGap(u.date, e.date) <= 5)
      .sort((a, b) => dayGap(a.date, e.date) - dayGap(b.date, e.date))[0];
    if (partner) { pairedIds.add(e.id); pairedIds.add(partner.id); }
  }
  const unpaired = fxLegs.filter(l => !pairedIds.has(l.id));
  let fxNet = r2(fxLegs.filter(l => pairedIds.has(l.id)).reduce((sum, l) => sum + l.net, 0)); // credit balance = gain
  console.log(`FX legs: ${fxLegs.length}, paired ${pairedIds.size}, held on 2910 until their partner posts: ${unpaired.map(l => `${l.date} ${l.eur ? "EUR" : "USD"} ${l.type} ${Math.abs(l.net)}`).join("; ") || "none"}`);
  if (Math.abs(fxNet) > 0.01) {
    post(lastStatementDate, "Adjustment",
      `FX conversion translation difference swept to ${fxNet > 0 ? "gain" : "loss"} (today-rate convention @ ${fx})`, "ADJ-FX-SWEEP",
      fxNet > 0
        ? [{ accountCode: ACC.FXCLEAR, debit: fxNet }, { accountCode: ACC.FXGAIN, credit: fxNet }]
        : [{ accountCode: ACC.FXLOSS, debit: -fxNet }, { accountCode: ACC.FXCLEAR, credit: -fxNet }]);
  }

  // ---- 3b. EUR rounding true-up: per-line 2dp rounding drifts a few cents off the native
  // EUR closing. Post the difference explicitly to FX loss/gain — never a silent fudge —
  // so journal-derived 1110 ÷ rate equals the statement closing to the cent.
  const eurClosingNative = r2(bankTx.filter(t => eurAccountIds.has(t.bankAccountId))
    .reduce((s, t) => s + (t.type === "Deposit" ? t.amount : -t.amount), 0));
  let eurJournalUSD = 0;
  for (const en of entries) for (const it of JSON.parse(en.itemsJson)) {
    if (it.accountCode === ACC.BANK_EUR) eurJournalUSD += (it.debit || 0) - (it.credit || 0);
  }
  const roundDiff = r2(eurJournalUSD - r2(eurClosingNative * fx));
  if (Math.abs(roundDiff) > 0.004) {
    post(lastStatementDate, "Adjustment",
      `EUR per-line rounding true-up so 1110 ties to the statement closing (${eurClosingNative} EUR @ ${fx})`, "ADJ-FX-ROUNDING",
      roundDiff > 0
        ? [{ accountCode: ACC.FXLOSS, debit: roundDiff }, { accountCode: ACC.BANK_EUR, credit: roundDiff }]
        : [{ accountCode: ACC.BANK_EUR, debit: -roundDiff }, { accountCode: ACC.FXGAIN, credit: -roundDiff }]);
    console.log(`EUR rounding true-up: ${roundDiff} USD posted to FX ${roundDiff > 0 ? "loss" : "gain"}`);
  }

  await prisma.journalEntry.createMany({ data: entries });
  console.log(`posted ${entries.length} journal entries`);

  // ---- 4. recompute every Account.balance from the journal ----
  const bal = new Map<string, { dr: number; cr: number }>();
  for (const en of [...entries, ...kept]) for (const it of JSON.parse(en.itemsJson)) {
    const b = bal.get(it.accountCode) || { dr: 0, cr: 0 };
    b.dr += it.debit || 0; b.cr += it.credit || 0;
    bal.set(it.accountCode, b);
  }
  const known = new Set(accounts.map(a => a.code));
  for (const a of accounts.concat((await prisma.account.findMany({ where: { code: { in: [ACC.SUSPENSE, ACC.FXCLEAR, ACC.REIMBURSE, FLOAT_LEDGER, COUNT_DIFFERENCES_LEDGER] } } })).filter(a => !known.has(a.code)))) {
    const b = bal.get(a.code) || { dr: 0, cr: 0 };
    const natural = ["Asset", "Expense"].includes(a.type) ? b.dr - b.cr : b.cr - b.dr;
    // 1110 is displayed in EUR — divide the USD journal figure back by the same single rate.
    const value = a.code === ACC.BANK_EUR ? r2(natural / fx) : r2(natural);
    await prisma.account.update({ where: { code: a.code }, data: { balance: value } });
  }

  // ---- 5. verification ----
  let dr = 0, cr = 0;
  for (const en of [...entries, ...kept]) for (const it of JSON.parse(en.itemsJson)) { dr += it.debit || 0; cr += it.credit || 0; }
  const b1100 = (await prisma.account.findUnique({ where: { code: ACC.BANK_USD } }))!.balance;
  const b1110 = (await prisma.account.findUnique({ where: { code: ACC.BANK_EUR } }))!.balance;
  const b1120 = (await prisma.account.findUnique({ where: { code: ACC.PETTY } }))!.balance;
  const b2100 = (await prisma.account.findUnique({ where: { code: ACC.AP } }))!.balance;
  const b2900 = (await prisma.account.findUnique({ where: { code: ACC.SUSPENSE } }))!.balance;
  console.log(`journal totals: Dr ${r2(dr).toLocaleString()}  Cr ${r2(cr).toLocaleString()}  balanced=${Math.abs(dr - cr) < 0.05}`);
  console.log(`1100 Bank USD:  ${b1100}  (statement closing 1402.80 → tie=${Math.abs(b1100 - 1402.80) < 0.02})`);
  console.log(`1110 Bank EUR:  ${b1110}  (statement closing 2421.58 → tie=${Math.abs(b1110 - 2421.58) < 0.02})`);
  console.log(`1120 Cash awaiting vouchers: ${b1120.toLocaleString()}  <-- cash drawn or received before the float opened, minus vouchers recorded; falls as past vouchers are recorded (§4.4.5)`);
  const b1125 = (await prisma.account.findUnique({ where: { code: FLOAT_LEDGER } }))?.balance ?? 0;
  const b2920 = (await prisma.account.findUnique({ where: { code: COUNT_DIFFERENCES_LEDGER } }))?.balance ?? 0;
  console.log(`1125 Petty cash float: ${b1125.toLocaleString()}   2920 count differences pending review: ${b2920.toLocaleString()}`);
  const b1127 = (await prisma.account.findUnique({ where: { code: CASH_CLEARING_LEDGER } }))?.balance ?? 0;
  console.log(`float opened on: ${openedOn || "(not yet — all cash is cash awaiting vouchers)"}   1127 cash in transit: ${b1127.toLocaleString()}   lines on 1127 with no recorded withdrawal: ${unlinkedTransit}${unlinkedTransit ? "  <-- link them to their requests" : ""}`);
  console.log(`2100 AP open: ${b2100.toLocaleString()}  (incl. FHI360 pass-through + unmatched card vouchers)`);
  console.log(`2900 Suspense: ${b2900.toLocaleString()}  (unidentified: 'Trf From 068…' ${""}+ cash deposit 50 + unclassified)`);

  await prisma.auditLog.create({
    data: {
      id: `aud-ledger-rebuild-${Date.now()}`, userId: "u-1", userName: "Saad Matar",
      action: "General Ledger Rebuilt",
      details: `Rebuilt journal from primary evidence: ${entries.length} entries (${bankTx.length} statement lines + ${expenses.length} vouchers + FX sweep). ` +
        `Bank balances tie to statements by construction. EUR at today-rate ${fx} (documented limitation). ` +
        `Petty cash residual ${b1120} USD = cash withdrawn at bank never covered by vouchers — REAL documentation gap, left visible, not reclassified. ` +
        `Suspense ${b2900} USD holds unidentified receipts pending user decision.`,
      timestamp: new Date().toISOString(),
    }
  });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
