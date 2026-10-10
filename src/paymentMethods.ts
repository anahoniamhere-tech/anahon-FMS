/**
 * How a payment actually left — one list, 10 Oct 2026.
 *
 * Nobody on the team has a bank account and AnaHon has no chequebook, so a fee is often paid by a
 * BLOM PAYMENT ORDER on the EUR account: the payee collects the cash at the counter against ID, and
 * the proof is BLOM's debit advice plus the receipt signed on the order. That is a BANK payment —
 * it posts against the bank's own ledger account and reconciles to the statement line — and the pay
 * panel used to stamp every payment "Petty cash envelope", bank payments included.
 *
 * The method is a WORD ON THE RECORD, not a rule: what an account may pay and where it posts is
 * decided by the account itself (src/pettyCash.ts). Nothing here changes a gate.
 */
export const PAYMENT_METHODS = [
  { key: "Bank transfer", forTypes: ["Bank"], refLabel: "Bank transfer reference" },
  { key: "Bank payment order (cash collected at the bank)", forTypes: ["Bank"], refLabel: "Payment order / debit advice number" },
  { key: "Petty cash envelope", forTypes: ["Petty Cash", "Cash in transit"], refLabel: "Reference" },
  { key: "Card", forTypes: ["Bank"], refLabel: "Card transaction reference" },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]["key"];

/** The methods that make sense for the account the money leaves from. */
export const methodsFor = (accountType: string): string[] =>
  PAYMENT_METHODS.filter(m => (m.forTypes as readonly string[]).includes(accountType)).map(m => m.key as string);

/** What the panel opens on: a bank account is a transfer unless somebody says otherwise. */
export const defaultMethodFor = (accountType: string) =>
  methodsFor(accountType)[0] || "Petty cash envelope";

export const refLabelFor = (method: string) =>
  PAYMENT_METHODS.find(m => m.key === method)?.refLabel || "Reference";

/** A method the system knows, and one that suits the account it is paid from. */
export function methodBlocker(method: string, accountType: string): string {
  if (!method) return "";                                   // older vouchers and the default path
  if (!PAYMENT_METHODS.some(m => m.key === method)) return "That is not a payment method the system records.";
  if (!methodsFor(accountType).includes(method)) return `"${method}" is not how money leaves ${accountType === "Bank" ? "a bank account" : "that account"}.`;
  return "";
}
