/**
 * Which paper fills each of a project's four core slots.
 *
 * Saad found Ahmad's staff contract sitting in Thomson Reuters' "signed agreement" slot.
 * The panel tested one regular expression against category and filename joined together
 * and took the first hit: the six staff contracts are category "Contract", their names
 * read "Service agreement …", and the lowest reference number won. The real sub-grant,
 * filed as "Grant Agreement", was never reached.
 *
 * So the order of trust is: the category a person chose when filing the paper, then the
 * filename, then nothing. Categories are free text and have drifted into near-duplicates
 * (Contract/Contracts, Agreement/Grant Agreement, Invoice/Invoices/Invoice (Reference)),
 * so they are compared normalised — which folds those pairs together without renaming a
 * single row.
 */

export type CoreDoc = { category: string; filename: string; refNo?: string | null; created_at?: string };

/** Lowercase, drop bracketed suffixes and punctuation, collapse spaces. */
export const normCategory = (s: string) =>
  (s || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * The categories that genuinely belong to each slot. A trailing plural is accepted, so
 * "Proposals" counts as "proposal" and "Contracts" as "contract".
 *
 * "Agreement" and "Grant Agreement" are the same paper under two spellings — this panel's
 * own upload writes the first — so both fill the agreement slot. **"Contract" does not**,
 * and that is the whole fix: a staff contract is a different kind of document with a
 * category of its own.
 */
export const CORE_CATEGORIES: Record<string, string[]> = {
  Proposal: ["proposal", "concept note"],
  Timetable: ["timetable", "activity timetable", "work plan"],
  Budget: ["budget", "approved budget"],
  Agreement: ["agreement", "grant agreement", "grant offer", "sub grant agreement"]
};

/**
 * Papers that are never one of the four, whatever their filename says. Only the filename
 * fallback consults this: TRF's "Budget_IMS_Grantee_Anahon2_5months_UPDATED.xlsx" is filed
 * as a Financial Report and used to win the budget slot on the strength of its name.
 * Matched as a prefix of the normalised category, so "Timesheet Rev.2 (Signed)",
 * "Invoice (Reference)" and "Contract Addendum (Signed)" are all covered.
 */
export const NEVER_CORE = [
  "contract", "timesheet", "invoice", "receipt", "team receipt",
  "payment voucher", "financial report", "payslip", "handbook"
];

/** Newest filing first; the reference number only breaks an exact tie. */
export const newestFirst = (a: CoreDoc, b: CoreDoc) =>
  String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
  String(b.refNo || "").localeCompare(String(a.refNo || ""));

/**
 * The document that fills one slot, or undefined when the project has none.
 *
 * Three passes, each narrower than the last:
 *   1. right category **and** a filename that reads like the slot — this separates SKF's
 *      signed grant agreement from the donor's call for proposals filed beside it under
 *      the same "Agreement" category;
 *   2. right category, whatever it is called — FPU's seven "Grant Agreement" attachments;
 *   3. no document carries the category at all: fall back to the filename, but only among
 *      papers that could be a core document in the first place.
 * The newest of whichever pass answers wins; the rest stay reachable behind "replace / add".
 */
export function pickCoreDoc<T extends CoreDoc>(key: string, re: RegExp, docs: T[]): T | undefined {
  const wanted = CORE_CATEGORIES[key] || [];
  const byCategory = docs.filter(d => {
    const c = normCategory(d.category);
    return wanted.some(w => c === w || c === `${w}s`);
  });
  const named = byCategory.filter(d => re.test(d.filename.toLowerCase()));
  const pool = named.length ? named
    : byCategory.length ? byCategory
    : docs.filter(d => !NEVER_CORE.some(n => normCategory(d.category).startsWith(n))
        && re.test(`${d.category} ${d.filename}`.toLowerCase()));
  return [...pool].sort(newestFirst)[0];
}

/** The pattern each slot recognises in a filename. "contract" is deliberately absent. */
export const CORE_PATTERNS: Record<string, RegExp> = {
  Proposal: /proposal|concept note/,
  Timetable: /timetable|timeline|work ?plan|year plan/,
  Budget: /budget/,
  Agreement: /agreement|grant offer/
};

/**
 * The categories a filed document can be moved into — the four core slots and nothing else.
 * The same list the server enforces on /api/documents/meta. Deliberately not free text:
 * free text is how Contract/Contracts and Agreement/Grant Agreement came to mean one thing
 * under two names, and the panel above reads exactly these four.
 */
export const REFILE_CATEGORIES = ["Proposal", "Timetable", "Budget", "Grant Agreement"];

/**
 * The four slots, named once. The panel labels them, the list counts them and the desk
 * asks for them, so the wording lives here rather than in three places that drift.
 */
export const CORE_SLOTS: { key: string; label: string }[] = [
  { key: "Proposal", label: "Proposal" },
  { key: "Timetable", label: "Activity timetable" },
  { key: "Budget", label: "Approved budget" },
  { key: "Agreement", label: "Signed agreement" }
];

/**
 * Which of the four papers a project is still missing.
 *
 * Deliberately the same shape and the same name pattern as `missingPersonnelDocs` and
 * `missingSupplierDocs` — `{ key, label }[]`, empty when nothing is owed — because Home &
 * desk turns all three into desk items with one rule, and a third shape would mean a third
 * branch. Where those two answer "is this person or supplier properly papered", this one
 * answers "does this grant carry what every donor audit asks for first".
 *
 * `hasImportedTimetable` excuses the timetable slot: a donor timetable imported into the
 * project's own timeline is the paper, in a more useful form than a spreadsheet nobody
 * opens. The panel has always treated it that way and the desk must agree.
 *
 * Nothing is stored. The answer is computed from the documents each time it is asked, so
 * filing the paper removes the item everywhere it appeared, for everyone, with nothing to
 * tick and nothing left behind to go stale.
 */
export function missingCoreDocs(
  docs: (CoreDoc & { linkedRecordType?: string; linkedRecordId?: string })[],
  projectId: string,
  hasImportedTimetable = false
): { key: string; label: string }[] {
  const mine = docs.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === projectId);
  return CORE_SLOTS
    .filter(s => !(s.key === "Timetable" && hasImportedTimetable))
    .filter(s => !pickCoreDoc(s.key, CORE_PATTERNS[s.key], mine))
    .map(({ key, label }) => ({ key, label }));
}
