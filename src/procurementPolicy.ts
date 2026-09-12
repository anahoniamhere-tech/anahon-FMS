/**
 * How much competition a purchase needs, and above which figure — Accounting Policy 020.
 *
 * Saad raised the threshold on 12 Sep 2026: it was a flat USD 300 for everything, which put
 * a laptop cable and a month of studio hire through the same three-quotation comparison.
 * Now: three compared quotations above USD 1,000, two from USD 150 up to it, none below.
 *
 * The number lives here and nowhere else. Before this it was typed into six places — the
 * route that refuses a voucher, the form that asks for the authority, the procurement
 * screen's note, the missing-documents counter and two help answers — which is how a policy
 * change becomes five screens quietly disagreeing with each other.
 *
 * NOT here, and deliberately unchanged: the USD 300 petty-cash ceiling and the USD 150
 * director's approval for cash (Policy 4.4.2). Those are about how money leaves the
 * building, not about how a supplier was chosen, and they did not move.
 */

/** Above this, a voucher must name an approved procurement, and it needs three quotations. */
export const QUOTES_REQUIRED_ABOVE = 1000;

/** From this up to QUOTES_REQUIRED_ABOVE, a comparison needs two quotations. */
export const TWO_QUOTES_FROM = 150;

/** How many compared quotations this much money needs. A single-source waiver is the
 *  documented exception to whichever number applies — never a way round having one. */
export function quotationsRequired(usd: number): 0 | 2 | 3 {
  if (usd > QUOTES_REQUIRED_ABOVE) return 3;
  if (usd >= TWO_QUOTES_FROM) return 2;
  return 0;
}

/** Does a voucher this size have to point at an approved procurement? */
export function needsProcurement(usd: number): boolean {
  return usd > QUOTES_REQUIRED_ABOVE;
}

/** "USD 1,000" — the figure as it is said to a person, in one place so the screens agree. */
export const THRESHOLD_LABEL = `USD ${QUOTES_REQUIRED_ABOVE.toLocaleString("en-US")}`;
