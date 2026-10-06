/**
 * The currencies a client is quoted in, and what one unit is worth in USD.
 *
 * AED was added on 7 Oct 2026 for quotation 007/2026 (Taifour Al Bustami, Dubai), which was issued
 * and accepted in dirhams. The dirham is **pegged** to the dollar at 3.6725 AED = 1 USD — the same
 * rate the UAE commercial register uses — so it is stored as a fixed rate and labelled as the peg,
 * not refreshed like EUR and LBP, which move.
 *
 * Rates are held the way FxRates already holds them: USD per one unit of the currency.
 */

export const QUOTE_CURRENCIES = ["USD", "EUR", "LBP", "AED"] as const;
export type QuoteCurrency = typeof QUOTE_CURRENCIES[number];

/** Currencies pegged to the dollar: units of the currency for one USD. */
export const PEGGED: Record<string, number> = { AED: 3.6725 };
export const PEG_NOTE: Record<string, string> = { AED: "pegged at 3.6725 AED = 1 USD" };

/** USD per one AED, to six places — the peg, inverted once and in one place. */
export const AED_IN_USD = Math.round((1 / PEGGED.AED) * 1e6) / 1e6;

type Rates = { EUR?: number; LBP?: number; AED?: number } | null | undefined;

/** What one unit of this currency is worth in USD. An unknown currency is worth itself: never guess a rate. */
export function usdPerUnit(currency: string, rates: Rates): number {
  const c = String(currency || "USD").toUpperCase();
  if (c === "USD") return 1;
  if (PEGGED[c]) return Math.round((1 / PEGGED[c]) * 1e6) / 1e6;   // a peg is not a market rate
  const r = Number((rates as any)?.[c]);
  return r > 0 ? r : 1;
}

/** An amount in USD. Rounded to the cent, because this is money a person reads. */
export function toUSD(amount: number, currency: string, rates: Rates): number {
  return Math.round((Number(amount) || 0) * usdPerUnit(currency, rates) * 100) / 100;
}

/** True when a total made of these currencies would be a nonsense sum (mixed money, one number). */
export function isMixed(currencies: string[]): boolean {
  return new Set(currencies.map(c => String(c || "USD").toUpperCase())).size > 1;
}
