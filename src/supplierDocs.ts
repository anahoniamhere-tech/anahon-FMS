/**
 * Supplier documents — what the procurement policy demands of a party we buy from.
 *
 * The twin of personnelDocs.ts, and deliberately the same two exports in the same
 * shape, because Home & desk adds ONE desk rule that calls both. Where the personnel
 * list answers "does this person have a contract", this one answers "is this supplier
 * properly on the register" — and both answer it in exactly one place, so a screen and
 * a desk rule can never disagree about whether a file is complete.
 *
 * The rows come from AnaHon_Accounting_Business_Policy_020, §5 and §7. Only what the
 * policy demands of the PARTY is here. §7.5's procurement file — purchase request,
 * quotations, bid analysis, purchase order, goods received note, invoice, proof of
 * payment — belongs to a single purchase, not to the supplier, and the voucher screen
 * already says when an invoice is missing.
 */

/** The little of a Vendor row this module needs. Keeps the server and the UI honest. */
export type SupplierParty = { id: string; active?: boolean; blocked?: boolean; engageable?: boolean };

/**
 * What an active supplier's file is supposed to hold, and the category spellings that
 * satisfy each. The spellings are the point, exactly as they are for personnel: the
 * vault holds "Contract" (imported from the old drive), "Contracts" (what the contract
 * generator writes) and "Agreement" side by side, and a check that keys on one of them
 * reports a party as unpapered when it is not.
 *
 * `onlyIf` is the one place this list departs from the personnel twin, and it is
 * load-bearing. Policy §7.4.2 and §7.2.D demand a signed contract from a consultant or
 * a service provider; a shop, a taxi or a software subscription is a purchase and needs
 * a voucher, not an agreement — the same line `Vendor.engageable` already draws. Without
 * it, twenty-one of the thirty-four rows on the register would be nagged for a paper the
 * policy never asked them for, and a checklist that does that is one people learn to
 * ignore.
 */
export const REQUIRED_SUPPLIER: {
  key: string;
  label: string;
  accepts: string[];
  onlyIf?: (v: SupplierParty) => boolean;
}[] = [
  {
    // §7.3 Vendor Selection Process: "For new vendors: A Vendor Registration Form is
    // completed and archived." Archived is the word that makes this a document rather
    // than a field — and §6.6 refuses to process a transaction where "Supplier
    // information is incomplete".
    key: "registration",
    label: "Vendor registration form",
    accepts: ["Vendor Registration", "Vendor Registration Form", "Supplier Registration"],
  },
  {
    // §7.4.2 Consultancy Contracts and §7.2.D ("All consultants must have: Signed
    // contract"); §5.8 requires a signed contract as an approver of every consultancy
    // payment, and §5.9 prohibits paying uncontracted consultants outright.
    // "Agreement" is accepted because service agreements are filed under it — a donor's
    // Grant Agreement carries no partyId and so can never answer for a supplier here.
    key: "agreement",
    label: "Signed agreement",
    accepts: ["Contract", "Contracts", "Agreement", "Service Agreement", "Contract Addendum (Signed)"],
    onlyIf: v => v.engageable === true,
  },
];

/**
 * Which required papers this supplier's file is missing.
 *
 * A blocked or deactivated party is asked for nothing: the policy governs suppliers we
 * procure from, and chasing a registration form for a shop we stopped using in 2024 is
 * noise on somebody's desk.
 *
 * Deliberately NOT demanded: proof of legal or tax registration, which §7.3 requires
 * only "when necessary" — Adobe and OpenAI have no Lebanese MoF number and never will,
 * and the system already enforces the consequence by withholding 7.5% from any supplier
 * without a tax ID. And the conflict-of-interest declaration, which §7.7 binds *staff*
 * involved in procurement rather than the vendor, and which `Vendor.declarationSigned`
 * already records on the record itself; a second copy is a second thing to disagree.
 */
export function missingSupplierDocs(
  docs: { category?: string; partyId?: string | null }[],
  vendor: SupplierParty
): { key: string; label: string }[] {
  if (!vendor || vendor.active === false || vendor.blocked === true) return [];
  const held = new Set(
    docs.filter(d => d.partyId === vendor.id).map(d => String(d.category || "").trim())
  );
  return REQUIRED_SUPPLIER
    .filter(r => !r.onlyIf || r.onlyIf(vendor))
    .filter(r => !r.accepts.some(c => held.has(c)))
    .map(({ key, label }) => ({ key, label }));
}
