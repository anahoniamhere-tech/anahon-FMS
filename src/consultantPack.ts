/**
 * The external financial consultant's reports and month pack — Policy 020 §12.1, §12.4, §13 (edition 2).
 *
 * The consultant has no login. Finance produces the files here; Saad shares a dated, view-only copy on
 * Drive. Pure module: the server loads the books and these functions decide what the reports say and what
 * the pack may carry, so the checks can prove it without a database.
 */
import { isPersonnelDoc } from "./personnelDocs";
import { isSourceMaterial } from "./editorialGates";

export const CONSULTANT_REVIEW_CATEGORY = "Reconciliation Review (External Consultant)";
/** §4.3: the Finance Officer, who executes no bank transfers, prepares every bank reconciliation; the
 *  Executive Director, the only signatory, never reconciles an account alone. Checked on the PERSON's own seat. */
export const RECONCILER_SEAT = "Finance Officer";

const r2 = (n: number) => Math.round(n * 100) / 100;
export const isMonth = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}
export const monthOf = (date: string) => String(date || "").slice(0, 7);

/** Why a document may not go to the consultant, or "" when it may. The personnel rule is the vault's own. */
export function packExcludes(doc: { category?: string | null; linkedRecordType?: string | null }): "" | "identity or personnel paper" | "source or editorial material" {
  if (isPersonnelDoc({ category: doc.category || "" })) return "identity or personnel paper";
  if (isSourceMaterial(doc)) return "source or editorial material";
  return "";
}

export function reconcileMarkBlocker(person: { role?: string | null } | null | undefined): string {
  if (person?.role === RECONCILER_SEAT) return "";
  return "Policy 020 §4.3: the Finance Officer prepares every bank reconciliation. The Executive Director is the only signatory and never reconciles an account alone — standing in as another seat does not change who you are.";
}

export interface Leg { entryId: string; date: string; recordedAt: string; journal: string; accountCode: string; debit: number; credit: number; projectId: string; referenceNo: string; description: string }
export function legsOf(entries: { id: string; date: string; recordedAt?: string | null; journal: string; referenceNo?: string | null; description: string; itemsJson: string }[]): Leg[] {
  return entries.flatMap(e => (JSON.parse(e.itemsJson || "[]") as any[]).map(l => ({
    entryId: e.id, date: e.date, recordedAt: e.recordedAt || "", journal: e.journal, accountCode: String(l.accountCode),
    debit: Number(l.debit || 0), credit: Number(l.credit || 0), projectId: l.projectId || "", referenceNo: e.referenceNo || "", description: e.description,
  })));
}
export const naturalOf = (type: string, debit: number, credit: number) => ["Asset", "Expense"].includes(type) ? debit - credit : credit - debit;

/** Every account as at a date, from the journal. 1110 is shown in EUR as well (stored in EUR; posted in USD). */
export function trialBalance(legs: Leg[], accounts: { code: string; name: string; type: string }[], asAt: string, eurRate: number) {
  const sums = new Map<string, { dr: number; cr: number }>();
  for (const l of legs) if (l.date <= asAt) {
    const s = sums.get(l.accountCode) || { dr: 0, cr: 0 };
    s.dr += l.debit; s.cr += l.credit; sums.set(l.accountCode, s);
  }
  return accounts.slice().sort((a, b) => a.code.localeCompare(b.code)).map(a => {
    const s = sums.get(a.code) || { dr: 0, cr: 0 };
    const balance = r2(naturalOf(a.type, s.dr, s.cr));
    return { code: a.code, name: a.name, type: a.type, debits: r2(s.dr), credits: r2(s.cr), balanceUSD: balance, balanceEUR: a.code === "1110" ? r2(balance / eurRate) : null };
  }).filter(r => r.debits || r.credits);
}

/** What is still open on a clearing account as at a date, reference by reference. */
export function openItems(legs: Leg[], code: string, asAt: string, type: "Asset" | "Liability") {
  const byRef = new Map<string, { referenceNo: string; firstDate: string; description: string; net: number; projectId: string }>();
  for (const l of legs) if (l.accountCode === code && l.date <= asAt) {
    const k = l.referenceNo || l.entryId;
    const row = byRef.get(k) || { referenceNo: k, firstDate: l.date, description: l.description, net: 0, projectId: l.projectId };
    row.net += naturalOf(type, l.debit, l.credit);
    if (l.date < row.firstDate) row.firstDate = l.date;
    byRef.set(k, row);
  }
  return [...byRef.values()].map(r => ({ ...r, net: r2(r.net) })).filter(r => Math.abs(r.net) >= 0.005).sort((a, b) => a.firstDate.localeCompare(b.firstDate));
}

/** "Paid in the month": the payment line's date when one exists, else paid_at (Home & desk, Q3). */
export function paymentDate(e: { voucherNo: string; paid_at?: string | null }, payLineDateByVoucher: Map<string, string>): string {
  return payLineDateByVoucher.get(e.voucherNo) || String(e.paid_at || "").slice(0, 10);
}

/**
 * Records added late: recorded after the previous pack was produced, dated into a month that pack (or an
 * earlier one) already covered. Recording time is created_at / recordedAt, which nothing may fake.
 */
export interface Recorded { kind: string; id: string; trueDate: string; recordedAt: string; label: string; amount?: number }
export function lateRecords(packs: { month: string; producedAt: string }[], rows: Recorded[]) {
  if (!packs.length) return { since: "", rows: [] as Recorded[] };
  const since = packs.map(p => p.producedAt).sort().at(-1)!;
  const packed = new Set(packs.map(p => p.month));
  return { since, rows: rows.filter(r => r.recordedAt && r.recordedAt > since && packed.has(monthOf(r.trueDate))).sort((a, b) => a.trueDate.localeCompare(b.trueDate)) };
}

/** A safe path segment for a file name inside the zip. */
export const safeName = (s: string) => String(s || "").normalize("NFKC").replace(/[\\/:*?"<>|]+/g, "-").replace(/\p{Cc}+/gu, "").replace(/\s+/g, " ").trim().slice(0, 120) || "unnamed";
