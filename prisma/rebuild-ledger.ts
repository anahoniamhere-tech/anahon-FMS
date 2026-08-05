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

const prisma = new PrismaClient();

const ACC = {
  BANK_USD: "1100", BANK_EUR: "1110", PETTY: "1120", AP: "2100", WHT: "2315",
  SUSPENSE: "2900", FXCLEAR: "2910", GRANT: "4100", SERVICE: "4200",
  FXGAIN: "4500", STAFF: "5100", FREELANCE: "5120", DIRECT: "6000",
  TRAVEL: "6200", EQUIP: "6300", SOFTWARE: "6400", RENT: "7100", BANKFEES: "7400", FXLOSS: "7700",
};

// BudgetLine.category -> expense account. Deterministic, documented in HANDOFF.
const CATEGORY_ACCOUNT: Record<string, string> = {
  "Personnel": ACC.STAFF, "Human Resources": ACC.STAFF,
  "Contractors/Freelancers": ACC.FREELANCE,
  "Travel": ACC.TRAVEL,
  "Equipment & Supplies": ACC.EQUIP,
  "Local Office": ACC.RENT,
  "Catering & Hospitality": ACC.DIRECT,
  "Other Costs": ACC.DIRECT,
  "Software Subscriptions": ACC.SOFTWARE,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const fx = (await prisma.fxRates.findFirst())?.EUR || 1.1406;
  const [accounts, bankAccounts, bankTx, expenses, budgetLines, projects] = await Promise.all([
    prisma.account.findMany(),
    prisma.bankAccount.findMany(),
    prisma.bankTransaction.findMany({ where: { pending: false }, orderBy: { date: "asc" } }),
    prisma.expense.findMany(),
    prisma.budgetLine.findMany(),
    prisma.project.findMany(),
  ]);
  const acctByCode = new Map(accounts.map(a => [a.code, a]));
  const blById = new Map(budgetLines.map(b => [b.id, b]));
  const projById = new Map(projects.map(p => [p.id, p]));
  const eurAccountIds = new Set(bankAccounts.filter(b => b.currency === "EUR").map(b => b.id));
  // Off-BLOM cash receipts (e.g. SKF cheques cashed at Byblos) live on Petty-Cash-type
  // accounts: their lines move 1120, never 1100/1110 — the statement-tie invariant holds.
  const pettyAccountIds = new Set(bankAccounts.filter(b => b.type === "Petty Cash").map(b => b.id));

  // The two BLOM sub-accounts map to GL codes; the chart still said "Audi" — fix the names.
  await prisma.account.update({ where: { code: ACC.BANK_USD }, data: { name: "Bank - USD (BLOM Business Plus 004-02-…794-1-7)" } });
  await prisma.account.update({ where: { code: ACC.BANK_EUR }, data: { name: "Bank - EUR (BLOM Business Plus 004-04-…794-1-5)" } });
  for (const [code, name, type, group] of [
    [ACC.SUSPENSE, "Suspense — Unidentified Receipts", "Liability", "Suspense"],
    [ACC.FXCLEAR, "FX Conversion Clearing", "Liability", "Suspense"],
  ] as const) {
    if (!acctByCode.has(code)) {
      await prisma.account.create({ data: { code, name, type, currency: "USD", reportingGroup: group, balance: 0, active: true } });
    }
  }

  // ---- wipe: full regeneration is the idempotency mechanism ----
  const wiped = await prisma.journalEntry.deleteMany({});
  console.log(`wiped ${wiped.count} old journal entries (incl. 3 empty shells + inconsistent seeds)`);

  let seq = 0;
  const entries: any[] = [];
  const post = (date: string, journal: string, description: string, referenceNo: string,
    items: { accountCode: string; debit?: number; credit?: number; projectId?: string | null; donorId?: string | null }[]) => {
    const clean = items.map(i => ({ accountCode: i.accountCode, debit: r2(i.debit || 0), credit: r2(i.credit || 0), projectId: i.projectId || undefined, donorId: i.donorId || undefined }))
      .filter(i => i.debit > 0.004 || i.credit > 0.004);
    const dr = r2(clean.reduce((s, i) => s + i.debit, 0)), cr = r2(clean.reduce((s, i) => s + i.credit, 0));
    if (Math.abs(dr - cr) > 0.011) throw new Error(`Unbalanced entry ${referenceNo}: Dr ${dr} Cr ${cr} — ${description}`);
    entries.push({ id: `je-rb-${String(++seq).padStart(4, "0")}`, journal, date, description, referenceNo, isPosted: true, itemsJson: JSON.stringify(clean) });
  };

  // ---- match card statement lines to card vouchers (so the same spend posts once) ----
  const cardVouchers = expenses.filter(e => e.paymentMethod === "Card");
  const spendRe = /APPLE|HIGGSFIELD|NOKNOK|FASTCOMET|GOOGLE|OPENAI|CANVA|ADOBE|META|MIDJOURNEY|ANTHROPIC|CLAUDE|SIMLY|UBER|MASSIVE|PHOTOROOM/i;
  const feeRe = /عمولة|مصاريف|طوابع|فوائد|Statement fee|Commission|maintenance|Debit interest|Withdrawal Fee/i;
  const atmRe = /ZBLMN|سحب|Cash Withdrawal$/i;
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

  const expenseAccountFor = (e: any) => CATEGORY_ACCOUNT[blById.get(e.budgetLineId)?.category || ""] || ACC.DIRECT;
  const usd = (amount: number, txAccountId: string) => eurAccountIds.has(txAccountId) ? r2(amount * fx) : amount;
  const bankCode = (txAccountId: string) => pettyAccountIds.has(txAccountId) ? ACC.PETTY : eurAccountIds.has(txAccountId) ? ACC.BANK_EUR : ACC.BANK_USD;
  const eurNote = (txAccountId: string) => eurAccountIds.has(txAccountId) ? ` [EUR @ ${fx}]` : "";

  // ---- 1. statement lines: the only source of bank movements ----
  for (const bt of bankTx) {
    const amt = usd(bt.amount, bt.bankAccountId);
    const bank = bankCode(bt.bankAccountId);
    const note = eurNote(bt.bankAccountId);
    const ref = `BT-${bt.id}`;

    if (bt.type === "Deposit") {
      let contra: { accountCode: string; projectId?: string | null; donorId?: string | null } = { accountCode: ACC.SUSPENSE };
      if (fxRe.test(bt.description)) contra = { accountCode: ACC.FXCLEAR };
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
    if (v) {
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
      post(bt.date, "Bank", `${bt.description}${note}`, ref, [
        { accountCode: ACC.FXCLEAR, debit: amt }, { accountCode: bank, credit: amt }]);
    } else if (atmRe.test(bt.description)) {
      post(bt.date, "Bank", `Cash drawn to petty cash: ${bt.description}${note}`, ref, [
        { accountCode: ACC.PETTY, debit: amt }, { accountCode: bank, credit: amt }]);
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
    const date = (e.created_at || "").split("T")[0] || "2026-01-01";
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

    if (e.paymentMethod === "Card") {
      // Accrue only — the matched statement line settles AP (rule 2). Unmatched card vouchers
      // stay open on AP and are listed below for the user; the money isn't on any statement.
      post(date, "Purchases", `Accrued ${e.voucherNo}: ${e.title}`, e.voucherNo, [
        ...debitLegs,
        { accountCode: ACC.AP, credit: netUSD, projectId: e.projectId },
        { accountCode: ACC.WHT, credit: whtUSD, projectId: e.projectId },
      ]);
    } else {
      // Cash (and legacy unknown-method) vouchers: paid from petty cash drawn at the ATM.
      post(date, "Purchases", `${e.voucherNo}: ${e.title} (cash)`, e.voucherNo, [
        ...debitLegs,
        { accountCode: ACC.PETTY, credit: netUSD, projectId: e.projectId },
        { accountCode: ACC.WHT, credit: whtUSD, projectId: e.projectId },
      ]);
    }
  }

  // ---- 3. sweep FX clearing to gain/loss ----
  let fxNet = 0; // credit balance = gain
  for (const en of entries) for (const it of JSON.parse(en.itemsJson)) {
    if (it.accountCode === ACC.FXCLEAR) fxNet += (it.credit || 0) - (it.debit || 0);
  }
  fxNet = r2(fxNet);
  if (Math.abs(fxNet) > 0.01) {
    post(bankTx[bankTx.length - 1].date, "Adjustment",
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
    post(bankTx[bankTx.length - 1].date, "Adjustment",
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
  for (const en of entries) for (const it of JSON.parse(en.itemsJson)) {
    const b = bal.get(it.accountCode) || { dr: 0, cr: 0 };
    b.dr += it.debit || 0; b.cr += it.credit || 0;
    bal.set(it.accountCode, b);
  }
  for (const a of accounts.concat(await prisma.account.findMany({ where: { code: { in: [ACC.SUSPENSE, ACC.FXCLEAR] } } }))) {
    const b = bal.get(a.code) || { dr: 0, cr: 0 };
    const natural = ["Asset", "Expense"].includes(a.type) ? b.dr - b.cr : b.cr - b.dr;
    // 1110 is displayed in EUR — divide the USD journal figure back by the same single rate.
    const value = a.code === ACC.BANK_EUR ? r2(natural / fx) : r2(natural);
    await prisma.account.update({ where: { code: a.code }, data: { balance: value } });
  }

  // ---- 5. verification ----
  let dr = 0, cr = 0;
  for (const en of entries) for (const it of JSON.parse(en.itemsJson)) { dr += it.debit || 0; cr += it.credit || 0; }
  const b1100 = (await prisma.account.findUnique({ where: { code: ACC.BANK_USD } }))!.balance;
  const b1110 = (await prisma.account.findUnique({ where: { code: ACC.BANK_EUR } }))!.balance;
  const b1120 = (await prisma.account.findUnique({ where: { code: ACC.PETTY } }))!.balance;
  const b2100 = (await prisma.account.findUnique({ where: { code: ACC.AP } }))!.balance;
  const b2900 = (await prisma.account.findUnique({ where: { code: ACC.SUSPENSE } }))!.balance;
  console.log(`journal totals: Dr ${r2(dr).toLocaleString()}  Cr ${r2(cr).toLocaleString()}  balanced=${Math.abs(dr - cr) < 0.05}`);
  console.log(`1100 Bank USD:  ${b1100}  (statement closing 1402.80 → tie=${Math.abs(b1100 - 1402.80) < 0.02})`);
  console.log(`1110 Bank EUR:  ${b1110}  (statement closing 2421.58 → tie=${Math.abs(b1110 - 2421.58) < 0.02})`);
  console.log(`1120 Petty cash on books: ${b1120.toLocaleString()}  <-- REAL GAP: cash drawn at bank minus cash vouchers documented`);
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
