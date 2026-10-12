/**
 * A quotation's arithmetic, shared by the form, the server and the PDF (15 Sep 2026).
 *
 * A discount is a quotation-level amount, not a negative line: unit prices stay what the work
 * is worth, the package value is their sum, and the discount is shown once beneath it. `amount`
 * stays the net total, because tranches, the outstanding balance and payment matching all key on it.
 * A total can never go negative — a discount larger than the package is refused, never clamped.
 */

/**
 * Who a quotation is issued as — three papers (Saad, 12 Oct 2026). iContent Media is the creators'
 * academy (icontent.media), iContent Studio the production company (icontent.studio), AnaHon the main
 * platform (journalism trainings, services, collaborations). Numbering is one NNN/YYYY series for all three.
 */
export const QUOTE_ISSUERS = ["icontent-media", "icontent-studio", "anahon"] as const;
export type QuoteIssuer = typeof QUOTE_ISSUERS[number];
/** New quotations default to iContent Studio (Saad, 15 Sep and 12 Oct 2026); saved quotations keep theirs. */
export const DEFAULT_NEW_QUOTE_ISSUER: QuoteIssuer = "icontent-studio";
export const QUOTE_ISSUER_LABELS: Record<QuoteIssuer, string> = {
  "icontent-media": "iContent Media (أنا المحتوى)", "icontent-studio": "iContent Studio", anahon: "AnaHon Media Platform",
};
/** Either iContent paper: names no AnaHon, prints a package table, carries no ANH-DOC line. */
export const isIContent = (issuedAs?: string) => issuedAs === "icontent-media" || issuedAs === "icontent-studio";
export const DEFAULT_DISCOUNT_LABEL = "Discount";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type Line = { unitPrice: number; qty: number };

export function quoteTotals(items: Line[], discountAmount = 0) {
  const packageValue = r2(items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 1), 0));
  const discount = r2(Number(discountAmount) || 0);
  return { packageValue, discount, total: r2(packageValue - discount) };
}

/** Why a quotation's discount cannot be saved, or "" when it can. */
export function discountBlocker(items: Line[], discountAmount: unknown): string {
  const d = Number(discountAmount || 0);
  if (!Number.isFinite(d) || d < 0) return "A discount is entered as a positive amount; it is shown as a deduction.";
  if (d > 0 && !items.length) return "A discount needs service lines to be deducted from.";
  if (items.some(it => (Number(it.unitPrice) || 0) < 0)) return "A service line cannot carry a negative price — use the discount instead.";
  const { packageValue } = quoteTotals(items, 0);
  if (d > packageValue + 0.005) return `The discount (${d.toFixed(2)}) is more than the package value (${packageValue.toFixed(2)}); a quotation total cannot go below zero.`;
  return "";
}
