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

/**
 * Who the party IS — a person, or an organisation (12 Sep 2026).
 *
 * The register already answered "engaged under an agreement, or bought from" (`engageable`).
 * This is the other axis, and the two are independent: an engaged individual (a freelance
 * editor), an engaged organisation (a production company), a purchase from an individual (the
 * landlord), a purchase from an organisation (Adobe).
 *
 * Blank means nobody has said yet, and blank is never treated as either. Nothing infers it from
 * `category` — "Service Provider" is worn by Khaled, by Kaynoona and by Magedz alike — for the
 * same reason `engageable` is explicit: a mislabelled category once let a service agreement be
 * drafted with Apple.
 */
export const PARTY_KINDS = [
  { key: "individual", label: "A person" },
  { key: "organisation", label: "An organisation" },
] as const;
export type PartyKind = "" | typeof PARTY_KINDS[number]["key"];

export function partyKindLabel(kind: string | null | undefined): string {
  return PARTY_KINDS.find(k => k.key === kind)?.label || "Not said yet";
}

/** The little of a Vendor row this module needs. Keeps the server and the UI honest. */
export type SupplierParty = {
  id: string; active?: boolean; blocked?: boolean; engageable?: boolean;
  partyKind?: string;
  /** The login this party is also known by, when they are one of the team. Explicit — the
   *  register never decides that two rows are the same person because the names match. */
  userEmail?: string;
};

/**
 * Is this party one of the team, engaged as a service provider?
 *
 * AnaHon has no employees: Saad declared on 12 Sep 2026 that everyone on the team works under
 * an annual service contract with subcontracts per project. So a party row that is also a team
 * member is not a classification problem to be flagged — it is the normal arrangement, and the
 * two records are two views of one person.
 *
 * Explicit only. `userEmail` is a link somebody made; a name that merely looks like a login is
 * a suggestion for a human to confirm, never a match this function will assert.
 */
export function isTeamMember(v: SupplierParty): boolean {
  return !!String(v.userEmail || "").trim();
}

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
  {
    // §7.2.D and §7.4.2 again, read for a PERSON rather than a company: identity and a CV are
    // what a consultancy file is expected to hold about the individual being engaged.
    //
    // Asked only of a person we ENGAGE, only once somebody has said the party is a person, and
    // never of a team member: their identity papers are in their personnel file, and a register
    // that demands a second copy creates a second thing to disagree. The row points at the
    // personnel record instead.
    key: "identity",
    label: "Identity paper",
    accepts: ["National ID", "Passport", "Residency / Work Permit"],
    onlyIf: v => v.engageable === true && v.partyKind === "individual" && !isTeamMember(v),
  },
  {
    key: "cv",
    label: "CV",
    accepts: ["CV"],
    onlyIf: v => v.engageable === true && v.partyKind === "individual" && !isTeamMember(v),
  },
  {
    // §7.3 Vendor Selection Process, "when necessary" — and Saad decided on 12 Sep 2026 that
    // for an organisation it is necessary. The twin of the identity paper above: where a person
    // proves who they are with an ID, a company proves it with its commercial record.
    //
    // Asked of an organisation whether we engage it or buy from it, because the question is who
    // the counterparty legally IS, which a purchase does not make less relevant. Known
    // consequence, accepted with the decision: a foreign software vendor has no Lebanese record
    // and this line will stand open against Adobe, OpenAI, Anthropic and Google until somebody
    // files what they do have or marks the row inactive.
    key: "commercial",
    label: "Commercial registration",
    accepts: ["Commercial Registration", "Commercial Register", "Commercial Circular", "Registration Certificate", "Certificate of Incorporation"],
    onlyIf: v => v.partyKind === "organisation",
  },
  {
    // The tax side of the same question. "Tax_Regularization" is here because it is the
    // spelling the vault already holds; the rest are what a person would reach for when
    // filing one. Nothing about the RATE is decided here — see the note below.
    key: "vat",
    label: "VAT / tax registration",
    accepts: ["VAT Certificate", "VAT Registration", "Tax Registration", "Tax_Regularization", "MoF Registration"],
    onlyIf: v => v.partyKind === "organisation",
  },
];

/**
 * Which required papers this supplier's file is missing.
 *
 * A blocked or deactivated party is asked for nothing: the policy governs suppliers we
 * procure from, and chasing a registration form for a shop we stopped using in 2024 is
 * noise on somebody's desk.
 *
 * Proof of legal and tax registration WAS excluded here, on the grounds that §7.3 requires it
 * only "when necessary" and that Adobe and OpenAI have no Lebanese MoF number and never will.
 * Saad overruled that on 12 Sep 2026: an organisation owes its commercial record and its VAT
 * details, whether we engage it or buy from it. The old reasoning is kept above rather than
 * deleted, because the consequence it predicted is real and was accepted knowingly — the
 * foreign software vendors will carry an open line until somebody files what they do have or
 * marks the row inactive. Nothing is demanded of a party whose kind nobody has said yet, so
 * this arrives row by row as the register is classified rather than all at once.
 *
 * Still deliberately NOT demanded: the conflict-of-interest declaration, which §7.7 binds *staff*
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
