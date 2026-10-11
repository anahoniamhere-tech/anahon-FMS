/**
 * Missing documents behind a payment, and the missing-receipt declaration — Policy P5 §6.6
 * (edition 2, 15 Sep 2026).
 *
 * Where a payment was made and its receipt is lost: first a copy re-issued by the supplier, the
 * bank or the transfer company; failing that, the person paid signs a declaration (date, amount,
 * what for, project), the Executive Director approves it, and it is filed in place of the receipt,
 * visibly marked as a declaration. Until then the payment counts as a missing document.
 *
 * One rule, here, applied on the server for every seat. It used to live in the browser, where any
 * linked file closed the gap — so an unsigned, unapproved declaration would have cleared it alone.
 */

export const REISSUED_COPY = "Receipt (re-issued copy)";
export const DECLARATION_UNSIGNED = "Missing-Receipt Declaration (unsigned)";
export const DECLARATION_SIGNED = "Missing-Receipt Declaration (signed)";

/** Documents the app wrote itself: never proof that money went where the voucher says. */
export const isOwnDocument = (category?: string | null) =>
  /^Digitized/i.test(category || "") || /^Reconstructed Voucher/i.test(category || "") || /^Missing-Receipt Declaration/i.test(category || "");
export const isReconstructed = (category?: string | null) => /^Reconstructed Voucher/i.test(category || "");

export type Evidence = "proof" | "reconstructed" | "declaration-unsigned" | "declaration-awaiting-director" | "missing";

export interface DeclarationLike { signedDocId?: string | null; approvedById?: string | null }

/** Where one payment's evidence stands. A declaration counts only once signed AND approved. */
export function evidenceOf(docs: { category: string }[], declaration?: DeclarationLike | null): Evidence {
  if (docs.some(d => !isOwnDocument(d.category))) return "proof";
  if (declaration?.signedDocId && declaration?.approvedById) return "proof";
  if (declaration && !declaration.signedDocId) return "declaration-unsigned";
  if (declaration && !declaration.approvedById) return "declaration-awaiting-director";
  if (docs.some(d => isReconstructed(d.category))) return "reconstructed";
  return "missing";
}

/**
 * Where one voucher's evidence stands, counting only documents whose file is still in the vault. A record whose
 * file is gone proves nothing: on 11 Oct 2026 25 posted vouchers read as proven with no scan behind them (Saad,
 * same day: a document with a missing file no longer counts as proof). `fileIsGone` is the vault test the state
 * load already uses for its `fileMissing` flag, so the register and the "Files lost" list can never disagree.
 */
export function evidenceWithFiles<D extends { category: string }>(
  docs: D[], declaration: DeclarationLike | null | undefined, fileIsGone: (d: D) => boolean): Evidence {
  return evidenceOf(docs.filter(d => !fileIsGone(d)), declaration);
}

/** The Executive Director approves, never the person who prepared it, and only a signed one. */
export function declarationApproveBlocker(d: { preparedById: string; signedDocId?: string | null; approvedById?: string | null },
  approver: { id: string; role: string }, directorSeats: string[]): string {
  if (d.approvedById) return "This declaration is already approved.";
  if (!directorSeats.includes(approver.role)) return "Policy P5 §6.6: the Executive Director approves a missing-receipt declaration.";
  if (approver.id === d.preparedById) return "You prepared this declaration — the approval must be somebody else's.";
  if (!d.signedDocId) return "File the declaration signed by the person paid before it is approved.";
  return "";
}
