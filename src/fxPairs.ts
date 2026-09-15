/**
 * Pairing the two legs of a currency conversion between the BLOM accounts (Books, 15 Sep 2026).
 *
 * A conversion leaves one account and arrives in the other. Only a conversion whose two legs are both on
 * statements is a gain or loss; a leg whose partner has not posted is money in transit between our own
 * accounts and waits on FX clearing (2910). A BLOM reversal (الغاء) undoes a line on its own account and is
 * never half of a conversion, so it always settles. Shared by the ledger rebuild (the sweep) and the
 * consultant's 2910 schedule, so the two can never disagree.
 */
export interface FxLeg { id: string; date: string; eur: boolean; type: string; net: number; reversal: boolean }
export const FX_PATTERN = /FX conversion|ع\.قطع|الغاء|Reversal/i;
export const isFxReversal = (description: string) => /الغاء|Reversal/i.test(description);
export const FX_PAIR_DAYS = 5;

export function pairFxLegs(legs: FxLeg[]): { pairedIds: Set<string>; unpaired: FxLeg[] } {
  const pairedIds = new Set<string>(legs.filter(l => l.reversal).map(l => l.id));
  const gap = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
  for (const e of legs.filter(l => l.eur && !l.reversal)) {
    const partner = legs.filter(u => !u.eur && !u.reversal && !pairedIds.has(u.id) && u.type !== e.type && gap(u.date, e.date) <= FX_PAIR_DAYS)
      .sort((a, b) => gap(a.date, e.date) - gap(b.date, e.date))[0];
    if (partner) { pairedIds.add(e.id); pairedIds.add(partner.id); }
  }
  return { pairedIds, unpaired: legs.filter(l => !pairedIds.has(l.id)) };
}
