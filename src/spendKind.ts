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
 * NOT exempt, deliberately: 5120 Freelancers and 5130 Consultants. A consultant IS chosen,
 * most donors expect that choice to be competed, and Saad's instruction was "salaries and
 * rent". Five of the twenty-eight sit there; if AnaHon decides consultant selection is not a
 * procurement, this is the one line to add.
 */
export const NO_SUPPLIER_CHOICE: Record<string, string> = {
  "5100": "a salary under an employment contract",
  "5110": "the employer's CNSS contribution, set by law",
  "7100": "rent under a signed lease",
  "7200": "utilities from the local provider",
  "7400": "bank charges",
  "7700": "a foreign-exchange loss",
};

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
