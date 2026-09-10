/**
 * The receipt series — one number per receipt, derived from the receipts themselves.
 *
 * A receipt number must never come from "how many files sit in this category": a delete,
 * a refile, or a stray upload moves the count and puts a hole in the series, which is the
 * first thing an external financial review looks for. The number is therefore the highest
 * RC already issued, plus one.
 *
 * One receipt = one number = one log entry. The client's signed scan is the SAME receipt,
 * so it is stored carrying the same number with receiptSigned set — a second row on disk,
 * never a second entry in the log and never a number of its own.
 */

export const RECEIPT_CATEGORY = "Cash Receipt";

export interface ReceiptDoc {
  id: string;
  refNo?: string | null;
  filename: string;
  category: string;
  linkedRecordId: string;
  receiptNo?: string | null;
  receiptSigned?: boolean;
  created_at: string;
}

/** RC-007/2026 → { seq: 7, year: 2026 }; anything else → null. */
export function parseReceiptNo(no: string | null | undefined): { seq: number; year: number } | null {
  const m = /RC-(\d+)[/-](\d{4})/.exec(String(no || ""));
  return m ? { seq: Number(m[1]), year: Number(m[2]) } : null;
}

/**
 * The receipt number of a record. Prefers the stored column; falls back to the filename
 * so the receipts issued before the column existed still take their place in the series.
 */
export function receiptNoOf(d: ReceiptDoc): string | null {
  const stored = parseReceiptNo(d.receiptNo);
  if (stored) return `RC-${String(stored.seq).padStart(3, "0")}/${stored.year}`;
  const fromName = parseReceiptNo(d.filename);
  return fromName ? `RC-${String(fromName.seq).padStart(3, "0")}/${fromName.year}` : null;
}

export function isReceipt(d: { category: string }): boolean {
  return d.category === RECEIPT_CATEGORY;
}

/** The next number in the series for a year: the highest issued that year, plus one. */
export function nextReceiptNo(docs: ReceiptDoc[], year: number): string {
  const highest = docs.filter(isReceipt).reduce((max, d) => {
    const p = parseReceiptNo(receiptNoOf(d));
    return p && p.year === year && p.seq > max ? p.seq : max;
  }, 0);
  return `RC-${String(highest + 1).padStart(3, "0")}/${year}`;
}

export interface ReceiptRow {
  receiptNo: string;
  seq: number;
  year: number;
  date: string;
  quotationId: string;
  /** The issued receipt itself — what to open. */
  docId: string;
  refNo?: string | null;
  /** Whether the copy that came back with both signatures on it is on file. */
  signed: boolean;
  signedDocId?: string;
}

/**
 * The receipt log: one row per receipt number, newest first. A quotation settled in
 * tranches carries several rows — nothing here assumes one receipt per quotation.
 */
export function receiptLog(docs: ReceiptDoc[]): ReceiptRow[] {
  const byNo = new Map<string, ReceiptRow>();
  for (const d of docs.filter(isReceipt)) {
    const no = receiptNoOf(d);
    if (!no) continue;
    const p = parseReceiptNo(no)!;
    const row = byNo.get(no) || {
      receiptNo: no, seq: p.seq, year: p.year, date: d.created_at,
      quotationId: d.linkedRecordId, docId: d.id, refNo: d.refNo, signed: false
    };
    if (d.receiptSigned) { row.signed = true; row.signedDocId = d.id; }
    else { row.docId = d.id; row.refNo = d.refNo; row.date = d.created_at; row.quotationId = d.linkedRecordId; }
    byNo.set(no, row);
  }
  return [...byNo.values()].sort((a, b) => b.year - a.year || b.seq - a.seq);
}

/** Holes in the series, per year — a receipt number that was never issued. */
export function receiptGaps(rows: ReceiptRow[]): string[] {
  const gaps: string[] = [];
  const years = [...new Set(rows.map(r => r.year))];
  for (const y of years) {
    const seqs = new Set(rows.filter(r => r.year === y).map(r => r.seq));
    const top = Math.max(...seqs);
    for (let i = 1; i <= top; i++) if (!seqs.has(i)) gaps.push(`RC-${String(i).padStart(3, "0")}/${y}`);
  }
  return gaps;
}
