/**
 * Import a BLOM statement (.xls from eBLOM) into the books — Books' monthly routine.
 *
 * There is no importer in the FMS for statements, only for eBLOM advices, so this was done by hand each
 * month (memory anahon-fms-nas-is-truth). It is the same routine, written down: the account comes from the
 * statement header, posted lines keep the BUSINESS date, the running-balance chain is proven against the
 * brought-forward before anything is written, and the stored balance is set to the posted closing because it
 * is a stored field, not a derived one. A line in the trailing pending block goes in with pending = 1 and
 * never counts toward a balance.
 *
 * It is idempotent: a line already on the books (same account, business date, signed amount) is skipped, and
 * an eBLOM advice the statement now confirms is confirmed in place, keeping its id and anything linked to it.
 * A pending line the system itself recorded (a withdrawal for payment requests, a redeposit, a top-up, a
 * channel deposit, a voucher payment) is left for Books to match on screen — never silently replaced.
 *
 * It links nothing to a project: that is Projects & funding's act, on their screen.
 *
 *   npx tsx scripts/import-blom-statement.ts <statement.xls> [more.xls ...]   # dry run, writes nothing
 *   npx tsx scripts/import-blom-statement.ts <statement.xls> --apply
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";
// The ESM build reads no files and knows no codepages until it is given them; the statements are
// Windows-1256, which is where the Arabic narratives live.
XLSX.set_fs(fs);
XLSX.set_cptable(cptable);
import { isStatementMatchRef } from "../src/pettyCash.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FILES = process.argv.slice(2).filter(a => !a.startsWith("--"));
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (s: string) => Number(String(s).replace(/,/g, "").trim());
const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s).trim());
const iso = (dmy: string) => dmy.trim().split("/").reverse().join("-");

/** The house style: an English label with the bank's own Arabic narrative in brackets. */
const LABELS: [RegExp, string][] = [
  [/مصاريف حساب/, "Account maintenance fee"],
  [/عمولة سحب نقدي/, "Cash withdrawal fee"],
  [/عمولا ?ت أخر/, "Other commissions"],
  [/سحب آلي|ZBLMN/, "ATM withdrawal"],
  [/سحب نقدي/, "Cash withdrawal"],
  [/دفعة نقدية/, "Cash deposit"],
  [/حوالة واردة/, "Incoming transfer"],
  [/ع\.قطع/, "FX conversion"],
  [/الغاء/, "Reversal"],
  [/عمولة تحويل|عمولة حوالة/, "Transfer commission"],
];
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
function describe(narrative: string): string {
  const n = narrative.replace(/\s+/g, " ").trim();
  const hit = LABELS.find(([re]) => re.test(n));
  if (hit) return `${hit[1]} [${n}]`;
  // A Latin narrative is the bank's own words — kept verbatim, so a card spend still matches the ledger rules.
  return hasArabic(n) ? `Statement line [${n}]` : n;
}

/**
 * An incoming transfer's narrative is a bank code ("IPO/03MX26092232622"), and who sent it and what for are in
 * the statement's details column. A line that reads "Incoming transfer — SAMIR KASSIR FOUNDATION, 'FIRST PAYMENT
 * FOR EU FSTP…'" is worth more in the books than the code, and it is the bank's own text, not an interpretation.
 */
function withSender(base: string, details: string): string {
  const lines = String(details || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const at = (label: string) => { const i = lines.findIndex(l => new RegExp(label, "i").test(l)); return i < 0 ? [] : lines.slice(i + 1); };
  // The first line under "Ordering Customer" that is a name, not an account number or IBAN.
  const who = at("Ordering Customer|Odering Customer").find(l => /[A-Za-z]{3}/.test(l) && !/^[A-Z]{2}\d{2}[A-Z0-9]{6,}$/.test(l) && !/^\d[\d\s]+$/.test(l));
  const why = at("Details of Payment").filter(l => !/^Ordering|^Odering/i.test(l)).join(" ").replace(/\s+/g, " ").trim();
  if (!who && !why) return base;
  return `${base}${who ? ` — ${who}` : ""}${why ? `, "${why}"` : ""}`;
}

interface Line { date: string; amount: number; desc: string; ref: string; pending: boolean }
function parse(file: string) {
  const wb = XLSX.readFile(file, { codepage: 1256 });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" })
    .map(r => r.map(c => String(c).trim()));
  const header = rows.find(r => /^Statement of/.test(r[0] || "")) || [];
  const accountNo = (header[0] || "").match(/Statement of ([\d-]+)/)?.[1] || "";
  const bf = rows.flat().find(c => /^Brought Forward Balance/.test(c)) || "";
  const broughtForward = num((bf.match(/([\d,]+\.\d{2})/) || ["", "0"])[1]);
  const currency = /EUR/.test(bf) ? "EUR" : "USD";
  const lines: Line[] = [];
  for (const r of rows) {
    const cells = r.filter((c, i) => c !== "" || i === 6);
    if (!cells.length || !isDate(cells[0])) continue;
    if (isDate(cells[1] || "")) {
      // posted: business date, value date, narrative, amount, running balance, ref
      lines.push({ date: iso(cells[0]), amount: num(cells[3]), desc: withSender(describe(cells[2]), cells[6] || ""), ref: cells[5] || "", pending: false });
    } else {
      // the trailing block the bank does not consider definitive: date, narrative…, amount
      const amount = num(cells[cells.length - 1]);
      if (!Number.isFinite(amount)) continue;
      lines.push({ date: iso(cells[0]), amount, desc: describe(cells.slice(1, -1).join(" — ")), ref: "", pending: true });
    }
  }
  return { file, accountNo, currency, broughtForward, lines };
}

for (const file of FILES) {
  const st = parse(file);
  const account = await prisma.bankAccount.findFirst({ where: { accountNo: { contains: st.accountNo.slice(0, 12) } } })
    || await prisma.bankAccount.findFirst({ where: { type: "Bank", currency: st.currency } });
  if (!account) throw new Error(`${file}: no bank account matches ${st.accountNo} (${st.currency})`);
  const posted = st.lines.filter(l => !l.pending), waiting = st.lines.filter(l => l.pending);
  const closing = r2(posted.reduce((b, l) => r2(b + l.amount), st.broughtForward));
  console.log(`\n${file.split("/").pop()}\n  ${account.name} (${account.currency}) · ${posted.length} posted, ${waiting.length} in the bank's pending block`);
  console.log(`  chain ${st.broughtForward} -> ${closing}`);

  const existing = await prisma.bankTransaction.findMany({ where: { bankAccountId: account.id } });
  let next = Math.max(0, ...existing.map(e => Number(e.id.split("-").pop()) || 0));
  const used = new Set<string>();
  const now = new Date().toISOString();
  let added = 0, confirmed = 0, already = 0;
  for (const l of st.lines) {
    const type = l.amount >= 0 ? "Deposit" : "Withdrawal", amount = r2(Math.abs(l.amount));
    const same = (e: any) => !used.has(e.id) && e.type === type && Math.abs(e.amount - amount) < 0.005;
    const on = existing.find(e => same(e) && !e.pending && e.date === l.date);
    if (on) { used.add(on.id); already++; continue; }
    if (!l.pending) {
      const advice = existing.find(e => same(e) && e.pending && Math.abs(new Date(e.date).getTime() - new Date(l.date).getTime()) <= 3 * 86400000);
      if (advice && (isStatementMatchRef(advice.noticeRef) || advice.voucherNo)) {
        console.log(`  WAITING  ${advice.id} [${advice.noticeRef || advice.voucherNo}] looks like this line — leave it for "Match a statement line" on Bank & cash`);
      } else if (advice) {
        used.add(advice.id); confirmed++;
        console.log(`  confirm  ${advice.id} (eBLOM advice) -> ${l.date} ${l.amount}`);
        if (APPLY) await prisma.bankTransaction.update({ where: { id: advice.id }, data: { pending: false, reconciled: true, date: l.date, description: l.desc, noticeRef: l.ref || advice.noticeRef } });
        continue;
      }
    }
    const staged = l.pending && existing.find(e => same(e) && e.pending);
    if (staged) { used.add(staged.id); already++; continue; }
    const id = `${account.id}-${String(++next).padStart(4, "0")}`;
    added++;
    console.log(`  ${l.pending ? "pending " : "new     "} ${id} ${l.date} ${l.amount >= 0 ? "+" : ""}${l.amount} ${l.desc}`);
    if (APPLY) await prisma.bankTransaction.create({ data: { id, bankAccountId: account.id, date: l.date, description: l.desc, amount, type, reconciled: !l.pending, pending: l.pending, noticeRef: l.ref || null, recordedAt: now, recordedById: "u-1" } });
  }
  console.log(`  ${added} added, ${confirmed} confirmed, ${already} already on the books`);
  console.log(`  stored balance ${account.balance} -> ${closing}${APPLY ? "" : " (dry run)"}`);
  if (APPLY) {
    await prisma.bankAccount.update({ where: { id: account.id }, data: { balance: closing } });
    await prisma.auditLog.create({ data: { id: `aud-stmt-${Date.now()}-${account.id}`, userId: "u-1", userName: "Saad Matar", timestamp: now, action: "Bank Statement Imported",
      details: `${account.name}: ${file.split("/").pop()} imported by Books. ${added} new line(s), ${confirmed} eBLOM advice(s) confirmed, ${already} already on the books. Chain ${st.broughtForward} -> ${closing}; stored balance set to the posted closing. Nothing linked to a project.` } });
  }
  // The books' own total must equal the statement's closing, or the parse is wrong.
  const all = await prisma.bankTransaction.findMany({ where: { bankAccountId: account.id, pending: false } });
  const booked = r2(all.reduce((s, t) => r2(s + (t.type === "Deposit" ? t.amount : -t.amount)), 0));
  console.log(`  confirmed lines on the books sum to ${booked}${APPLY ? (Math.abs(booked - closing) < 0.005 ? " — TIES" : " — DOES NOT TIE") : " (before apply)"}`);
}
await prisma.$disconnect();
