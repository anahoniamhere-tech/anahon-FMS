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
