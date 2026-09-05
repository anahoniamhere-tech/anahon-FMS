/**
 * A quotation settled in more than one go.
 *
 * Production clients pay half up front and half on delivery, and until now the record
 * held one deposit — so the second payment had nowhere to go and the first one made the
 * quote "Paid" while most of the money was still outstanding.
 *
 * A tranche is a bank line and nothing else: the deposit carries the amount, the date and
 * the account, so there is no figure here anyone can type over the evidence. The server
 * and the screen both ask the same three questions of that list, which is why they live
 * outside both.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What the linked deposits add up to. A missing bank line counts as nothing — never as the quote. */
export function paidOn(txIds: string[], txs: { id: string; amount: number }[]): number {
  return round2((txIds || []).reduce((sum, id) => sum + (txs.find(t => t.id === id)?.amount || 0), 0));
}

/** What is still owed. Never negative: an overpayment is a conversation, not a debt. */
export function outstandingOn(amount: number, paid: number): number {
  return Math.max(0, round2((amount || 0) - paid));
}

/**
 * The status the tranches imply, and the only thing that writes Invoiced or Paid when a
 * settlement is recorded.
 *
 * It deliberately produces nothing `src/workflow.ts` does not already have a rule for:
 * a quote with money against it but not covered is **Invoiced** — still owed, still on
 * Finance's desk under "Link the deposit" — and only a covered one is **Paid**. With no
 * evidence left against it a "Paid" drops back to Invoiced, because without the deposit
 * that is a claim rather than a fact; any other status is left where a person put it,
 * since a deposit does not accept an offer on the client's behalf.
 *
 * The half-cent tolerance is for a bank line that lands 0.001 short of the quote after
 * the round trip through a float — not a licence to call a real shortfall settled.
 */
export function tranchedStatus(current: string, amount: number, paid: number): string {
  if (paid <= 0) return current === "Paid" ? "Invoiced" : current;
  return paid >= (amount || 0) - 0.005 ? "Paid" : "Invoiced";
}
