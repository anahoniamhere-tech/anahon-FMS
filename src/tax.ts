/**
 * Withholding tax on services bought from a provider who is not registered with the Ministry of
 * Finance — one rate, in one place (7 Oct 2026).
 *
 * The 2024 Budget Law raised the rate on services from 7.5% to 8.5% with effect from 1 April 2024.
 * Saad adopted 8.5% as Executive Director on 7 Oct 2026. How it is declared and remitted is still
 * with the accountant; that question does not change the rate the system withholds from now on.
 *
 * NEW VOUCHERS ONLY. A voucher already paid keeps the figure it was paid at — recomputing a stored
 * whtAmount would rewrite what actually left the bank, and any catch-up on past payments is the
 * accountant's call, not an edit. So anything that DESCRIBES a payment already made reads the rate
 * back from its own figures (whtLabelOf), and only what is being computed now uses WHT_RATE.
 */
export const WHT_RATE = 0.085;
export const WHT_LABEL = "8.5%";
/** What the provider is left with, as a factor: 0.915 of the gross. */
export const WHT_NET_FACTOR = Math.round((1 - WHT_RATE) * 1000) / 1000;

const r2 = (n: number) => Math.round(n * 100) / 100;
/** The tax withheld from one gross amount, at today's rate. */
export const whtOn = (gross: number) => r2(Number(gross) * WHT_RATE);
/** What the provider receives. */
export const netOfWht = (gross: number) => r2(Number(gross) - whtOn(gross));

/**
 * The rate a PAST payment was actually withheld at, as a label — read back from the voucher's own
 * gross and withheld figures, never assumed. A voucher paid at 7.5% keeps saying 7.5% on its own
 * invoice and on the screen; only a fresh computation says 8.5%.
 */
export function whtLabelOf(wht: number, gross: number): string {
  if (!(Number(gross) > 0) || !(Number(wht) > 0)) return WHT_LABEL;
  const pct = (Number(wht) / Number(gross)) * 100;
  return `${Math.round(pct * 10) / 10}%`;
}
