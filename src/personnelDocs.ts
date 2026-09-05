import { PERSONNEL_FILE, PAYROLL_VIEWERS } from "./roles";
/**
 * Personnel documents — the HR side of the vault.
 *
 * A passport, an ID card or a CV is not like a receipt: it identifies a private person
 * and it is the one class of document in this system that must NOT be visible to
 * everyone who can open the materials library. This module is the single definition of
 * "which documents are personal" and "who may see them", shared by the server (which
 * filters state and refuses byte requests) and the UI (which renders the section) —
 * the same pattern selfDealing.ts and editorialGates.ts already use, so the two can
 * never disagree about who is allowed to look.
 */

/** Document categories that make a document part of someone's personnel file. */
export const PERSONNEL_CATEGORIES = [
  "Passport",
  "National ID",
  "Residency / Work Permit",
  "Visa",
  "CV",
  "Diploma / Certificate",
  "Personal Photo",
  "Personnel",
  "Payslip",
] as const;

/** Roles that hold the personnel file for the whole organisation. */
export const PERSONNEL_ROLES = PERSONNEL_FILE;

/**
 * What every personnel file is supposed to hold, and the category spellings that satisfy each.
 *
 * The spellings are the point. `AppDoc.category` is free text, and the vault genuinely holds
 * BOTH "Contract" (the 12 papers imported from the old drive) and "Contracts" (what the
 * generator writes). A check that keys on one spelling reports a file as empty when it is
 * full — that is not hypothetical: it produced a report on 6 Sep 2026 claiming six project
 * engagements had never been contracted, when every one of them had two to four signed
 * documents on file. So this list is the single answer to "does this person have a contract",
 * and anything that asks that question asks it here.
 */
export const REQUIRED_PERSONNEL: { key: string; label: string; accepts: string[] }[] = [
  { key: "identity", label: "Identity paper", accepts: ["National ID", "Passport"] },
  { key: "cv", label: "CV", accepts: ["CV"] },
  { key: "contract", label: "Signed contract", accepts: ["Contract", "Contracts", "Contract Addendum (Signed)"] },
];

/**
 * Which required papers this person's file is missing. Optional papers — a visa, a work
 * permit, a diploma — are deliberately not listed: they apply to some people and not others,
 * and a checklist that nags about a residency permit for a Lebanese national is a checklist
 * people learn to ignore.
 */
export function missingPersonnelDocs(
  docs: { category?: string; partyId?: string | null }[],
  partyId: string
): { key: string; label: string }[] {
  const held = new Set(
    docs.filter(d => d.partyId === partyId).map(d => String(d.category || "").trim())
  );
  return REQUIRED_PERSONNEL
    .filter(r => !r.accepts.some(c => held.has(c)))
    .map(({ key, label }) => ({ key, label }));
}

export function isPersonnelDoc(doc: { category?: string }): boolean {
  return PERSONNEL_CATEGORIES.includes(String(doc?.category || "") as any);
}

/**
 * May this viewer see personnel documents about `partyId`?
 *
 * Two ways in, and only two: you hold the personnel file for the organisation, or the
 * file is your own. `employees` is the Employee list; the match is on userEmail, the
 * same field self-service timesheets already key on (Policy 8.5).
 */
export function maySeePersonnelFile(
  viewer: { role?: string; email?: string } | null | undefined,
  employees: { id: string; userEmail?: string | null }[],
  partyId?: string | null,
  category?: string | null
): boolean {
  if (!viewer) return false;
  if (PERSONNEL_ROLES.includes(String(viewer.role))) return true;
  // A payslip is a personnel paper, but the people who run payroll must be able to open
  // the one they just generated and pay from.
  if (String(category || "") === "Payslip" && PAYROLL_VIEWERS.includes(String(viewer.role))) return true;
  if (!partyId || !viewer.email) return false;
  const email = viewer.email.trim().toLowerCase();
  return employees.some(e => e.id === partyId && (e.userEmail || "").trim().toLowerCase() === email);
}

/** Drop every personnel document this viewer is not entitled to. */
export function filterPersonnelDocs<T extends { category?: string; partyId?: string | null }>(
  docs: T[],
  viewer: { role?: string; email?: string } | null | undefined,
  employees: { id: string; userEmail?: string | null }[]
): T[] {
  if (viewer && PERSONNEL_ROLES.includes(String(viewer.role))) return docs;
  return docs.filter(d => !isPersonnelDoc(d) || maySeePersonnelFile(viewer, employees, d.partyId, d.category));
}
