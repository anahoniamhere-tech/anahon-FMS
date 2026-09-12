/**
 * Spend where there was no supplier to choose — so asking for an RFQ is asking the wrong
 * question (12 Sep 2026).
 *
 * The missing-documents counter flags anything over the procurement threshold with no
 * comparison behind it. That is right for a purchase and meaningless for a salary: nobody
 * collects three quotations for their own Finance Officer, for the rent under a signed lease,
 * or for a bank charge. Eighteen of the twenty-eight items on the list Saad read on 12 Sep
 * were people or premises, and no amount of diligence would ever have cleared them.
 *
 * The signal is the account the books already debited — exact, recorded by Finance, and not a
 * guess made from the wording of a voucher title. A voucher is exempt only when EVERY expense
 * account it touches is in this list: a mixed voucher that pays rent and buys a lens still
 * has a purchase in it, and still deserves the question.
 *
 * Freelancers (5120) and consultants (5130) were left OUT of this list when it was first
 * written, on the reasoning that a consultant is chosen and most donors expect that choice to
 * be competed. Saad ruled otherwise on 12 Sep 2026: at AnaHon a named researcher or trainer on
 * a grant budget line is engaged under an agreement, not bought, so the fee is a personnel
 * cost like any other. His call, recorded here because it is the one line in this file a donor
 * auditor might question — the answer is that the engagement contract, not a quotation
 * comparison, is the paper that supports it.
 *
 * Still NOT exempt, and this is the whole of the rest: anything bought from a supplier —
 * project costs (6000), equipment (6300), software (6400), travel (6200), catering, printing.
 */
export const NO_SUPPLIER_CHOICE: Record<string, string> = {
  "5100": "a salary under an employment contract",
  "5110": "the employer's CNSS contribution, set by law",
  "5120": "a freelancer's fee under an agreement",
  "5130": "a consultant's fee under an agreement",
  "7100": "rent under a signed lease",
  "7200": "utilities from the local provider",
  "7400": "bank charges",
  "7700": "a foreign-exchange loss",
};

/**
 * The accounts a person may put on a payment request, as the ledger names them. The books'
 * own list — 5xxx personnel, 6xxx direct project costs, 7xxx overheads — filtered to the
 * expense side, because a voucher is never a bank account or a liability.
 */
export function costAccountChoices(accounts: { code: string; name: string; type: string; active?: boolean }[]) {
  return accounts.filter(a => a.type === "Expense" && a.active !== false).sort((x, y) => x.code.localeCompare(y.code));
}

/**
 * Why this spend never involved choosing a supplier, or "" when it did — or when the books
 * have not said yet. An unposted voucher has no account behind it, so it stays on the list:
 * silence is never read as an exemption.
 */
export function noSupplierChoice(expenseAccountCodes: string[]): string {
  if (!expenseAccountCodes.length) return "";
  if (!expenseAccountCodes.every(c => NO_SUPPLIER_CHOICE[c])) return "";
  const reasons = [...new Set(expenseAccountCodes.map(c => NO_SUPPLIER_CHOICE[c]))];
  return reasons.length === 1 ? reasons[0] : reasons.slice(0, -1).join(", ") + " and " + reasons[reasons.length - 1];
}
