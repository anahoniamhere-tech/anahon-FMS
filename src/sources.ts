/**
 * Paying a protected source — Policy 010 §6 (approved by Saad, 15 Sep 2026).
 *
 * A fixer, a contributor, an interviewee reimbursed for travel: their payment follows every finance
 * rule, and only who can see their name changes. So the identity never enters the voucher at all.
 * A confidential request carries a code name ("Source S-2026-03") as its title and no supplier row;
 * the real name, contact, identity, sanctions check and the signed receipt live in a sealed file that
 * only the Executive Director (as themselves) and the Finance Officer can open, every opening logged.
 *
 * Because the voucher itself never held the name, every place that reads a voucher — the ledger line,
 * the digitized record, reports, the consultant's month pack, /api/state — shows the code name
 * without being told to. Nothing downstream has to remember to hide anything.
 *
 * The sealed papers are NOT AppDoc rows. They are files listed on the sealed file and served by its
 * own route, so no document list, byte route, search or pack can ever carry them.
 */

export const CONFIDENTIAL_PURPOSE = "Confidential payment — Policy 010 §6";

/** "Source S-2026-03": the highest issued in the year plus one. */
export function nextSourceCode(year: string, existing: string[]): string {
  const prefix = `Source S-${year}-`;
  const highest = existing.filter(c => c.startsWith(prefix)).map(c => Number(c.slice(prefix.length)) || 0).reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(highest + 1).padStart(2, "0")}`;
}

/** Only the ED and the FO open a sealed file — by their own account, never through a seat worn. */
export function maySealedRead(viewer: { role?: string; active?: boolean } | null | undefined, actingAs: string): boolean {
  if (!viewer || viewer.active === false || String(actingAs || "").trim()) return false;
  return viewer.role === "Super Admin" || viewer.role === "Finance Officer";
}
export const SEALED_REFUSAL = "A sealed source file is opened only by the Executive Director or the Finance Officer, as themselves.";

/** What a confidential request may not carry: a supplier row names the person, so there is none. */
export function confidentialRaiseBlocker(b: { vendorId?: string }): string {
  if (String(b.vendorId || "").trim()) return "A confidential payment names no supplier — the person is identified only in the sealed file.";
  return "";
}

export const SANCTIONS_RESULTS = ["", "clear", "possible match — referred", "not run"] as const;
export const SEALED_DOC_KINDS = ["identity", "signed-receipt", "other"] as const;
export type SealedDoc = { id: string; kind: string; filename: string; mimeType: string; path: string; expenseId: string; addedAt: string; addedById: string };

/** A confidential payment's receipt is the one signed in the real name, kept in the sealed file. */
export const hasSealedReceipt = (docs: SealedDoc[], expenseId: string) => docs.some(d => d.kind === "signed-receipt" && d.expenseId === expenseId);

/** The ED's quarterly review (§6): due when nothing was reviewed since the quarter began. */
export function quarterStart(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
}
export const reviewDue = (lastReviewedOn: string, today: string, anyPayments: boolean) => anyPayments && (!lastReviewedOn || lastReviewedOn < quarterStart(today));
