import { PERSONNEL_FILE, PAYROLL_VIEWERS, MANAGERS } from "./roles";
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
 * Three ways in, and only three. You hold the personnel file for the organisation; or the
 * file is your own (`employees`, matched on userEmail, the field self-service timesheets key
 * on — Policy 8.5); or — added 14 Sep 2026 — you head a field of the freelancer pool and the
 * document is the CV of someone in YOUR field. That third way is narrow on purpose: CVs only,
 * pool entries only, never an employee's file, never the other field's people. It exists
 * because Policy P11 says access follows the work, and a field head cannot assess a freelancer
 * without reading their CV.
 *
 * `poolFieldsOf` answers "which pool fields is this party in?" for the third way. Callers that
 * do not pass it get exactly the old two-way rule, so nothing that predates the pool changes.
 */
export function maySeePersonnelFile(
  viewer: { role?: string; email?: string } | null | undefined,
  employees: { id: string; userEmail?: string | null }[],
  partyId?: string | null,
  category?: string | null,
  poolFieldsOf?: (partyId: string) => string[]
): boolean {
  if (!viewer) return false;
  if (PERSONNEL_ROLES.includes(String(viewer.role))) return true;
  // A payslip is a personnel paper, but the people who run payroll must be able to open
  // the one they just generated and pay from.
  if (String(category || "") === "Payslip" && PAYROLL_VIEWERS.includes(String(viewer.role))) return true;
  if (partyId && poolFieldsOf && String(category || "") === "CV") {
    const v = poolViewFor(viewer.role);
    if (v?.kind === "fields" && poolFieldsOf(partyId).some(f => (v.fields as string[]).includes(f))) return true;
  }
  if (!partyId || !viewer.email) return false;
  const email = viewer.email.trim().toLowerCase();
  return employees.some(e => e.id === partyId && (e.userEmail || "").trim().toLowerCase() === email);
}

/**
 * The freelancer pool — people AnaHon may engage but has no contract with yet — split by field.
 *
 * Saad, 14 Sep 2026: each field is assessed by the head whose terms of reference cover it. A
 * person may be in both fields; status and assessment live per field.
 *
 * The permission keys are the seats as roles.ts spells them: "Chief Editor" and "Production
 * Manager". Both are vacant today — no account holds Chief Editor, and the only Production
 * Manager accounts are the two retired interim approvers, inactive — so Saad covers them with
 * "Act as…". That changes what he may SET, never what he is sent: /api/state always loads for
 * the real account, so as Super Admin he still sees every field.
 */
export const POOL_FIELDS = [
  { key: "Editorial", head: "Chief Editor", covers: "journalists, writers, fact-checkers, translators" },
  { key: "Production", head: "Production Manager", covers: "camera, editing, producers, sound, design" },
] as const;
export type PoolField = (typeof POOL_FIELDS)[number]["key"];
export const POOL_FIELD_KEYS: PoolField[] = POOL_FIELDS.map(f => f.key);
export const POOL_STATUSES = ["Prospect", "Worked with us", "Not a fit"] as const;

/**
 * The Executive Director, as permission keys. "Program Director" is the policies' name for the
 * seat and must never be renamed; it is vacant, and the master account stands in for a vacant
 * seat here exactly as it does for the countersignature.
 */
const EXECUTIVE = ["Program Director", "Super Admin"];

/**
 * What of the pool this viewer is sent — the ONE rule, applied in loadState and, for CVs, on the
 * byte route and on upload through maySeePersonnelFile.
 *   all     — the file holders (Super Admin, HR, the Executive Director): every entry and CV
 *   fields  — a field head: whole entries and CVs for THEIR field's people, and only their
 *             field's assessment; nothing about anyone outside it
 *   summary — the Finance Officer: name and skills, no status, no assessment, no CV
 *   null    — everyone else: nothing
 */
export type PoolView =
  | { kind: "all" }
  | { kind: "fields"; fields: PoolField[] }
  | { kind: "summary" }
  | null;
export function poolViewFor(role?: string | null): PoolView {
  const r = String(role || "");
  if (PERSONNEL_ROLES.includes(r)) return { kind: "all" };
  const heads = POOL_FIELDS.filter(f => f.head === r).map(f => f.key);
  if (heads.length) return { kind: "fields", fields: heads };
  if (MANAGERS.includes(r)) return { kind: "summary" };
  return null;
}
/** The fields a "summary" viewer receives — exactly name and skills; the id only so a list can
 *  key its rows. Not status, not assessment, not city: Finance does not assess freelancers. */
export const POOL_SUMMARY_FIELDS = ["id", "name", "skills"] as const;

/**
 * Cut the pool down to exactly what `role` may be sent. Pure, so it can be tested, and the only
 * implementation — loadState calls it for every branch. A field head gets the people in their
 * field, whole, carrying only their field's assessment; nobody else in the payload, and a
 * dual-field person's other judgement is not in it. Finance gets id, name and skills.
 */
export function cutPoolFor<C extends { id: string }, A extends { candidateId: string; field: string }>(
  role: string | null | undefined, rows: C[], assessments: A[]
): any[] {
  const view = poolViewFor(role);
  if (!view) return [];
  if (view.kind === "summary") return rows.map(c => Object.fromEntries(POOL_SUMMARY_FIELDS.map(k => [k, (c as any)[k]])));
  const scoped = view.kind === "fields" ? (view.fields as string[]) : null;
  const fieldsOf = (id: string) => assessments.filter(a => a.candidateId === id).map(a => a.field);
  return rows
    .filter(c => !scoped || fieldsOf(c.id).some(f => scoped.includes(f)))
    .map(c => ({ ...c, assessments: assessments.filter(a => a.candidateId === c.id && (!scoped || scoped.includes(a.field))) }));
}

/**
 * Who assesses a field right now. Saad, 14 Sep 2026: until a Chief Editor is hired, the Executive
 * Director covers that seat. This is the system's ONE vacancy rule — the same as /api/roles/seats
 * and the desk's "cover": a seat is vacant when no ACTIVE account holds its role. No account id is
 * named, so the day someone active is given the head's role the field is theirs, with no code change.
 * The Executive Director's own right to assess (below) does not depend on this; what does is how
 * their assessment is recorded and what the screen says the field is waiting on.
 */
export function poolHeadSeat(field: string, users: { role?: string; active?: boolean }[]): { head: string; vacant: boolean } {
  const head = POOL_FIELDS.find(f => f.key === field)?.head || "";
  return { head, vacant: !!head && !users.some(u => u.active !== false && u.role === head) };
}

/** The seat to write on an assessment: the role worn, "(acting)" for a stand-in via Act as, and
 *  for the Executive Director in a field whose head seat is vacant, the seat they are covering. */
export function poolAssessedAs(user: { role?: string; actingAs?: unknown } | null | undefined, field: string, users: { role?: string; active?: boolean }[]): string {
  const role = String(user?.role || "");
  if (user?.actingAs) return `${role} (acting)`;
  const { head, vacant } = poolHeadSeat(field, users);
  return EXECUTIVE.includes(role) && vacant ? `Executive Director, covering the vacant ${head} seat` : role;
}

/** Add or edit entries: the Chief Editor, the Production Manager, the Executive Director. HR sees
 *  everything and edits nothing — Saad's decision, 14 Sep 2026. */
export function mayEditPool(role?: string | null): boolean {
  const r = String(role || "");
  return EXECUTIVE.includes(r) || POOL_FIELDS.some(f => f.head === r);
}
/** Which fields this role may place people in and assess: its own, or any for the Executive Director. */
export function poolFieldsWritableBy(role?: string | null): PoolField[] {
  const r = String(role || "");
  if (EXECUTIVE.includes(r)) return [...POOL_FIELD_KEYS];
  return POOL_FIELDS.filter(f => f.head === r).map(f => f.key);
}
/** Set the status and assessment for one field: that field's head, or the Executive Director. */
export function mayAssess(role?: string | null, field?: string | null): boolean {
  return (poolFieldsWritableBy(role) as string[]).includes(String(field || ""));
}
/** Remove a person from the pool entirely — it touches both fields, so the Executive Director only. */
export function mayRemoveFromPool(role?: string | null): boolean {
  return EXECUTIVE.includes(String(role || ""));
}

/** Drop every personnel document this viewer is not entitled to. */
export function filterPersonnelDocs<T extends { category?: string; partyId?: string | null }>(
  docs: T[],
  viewer: { role?: string; email?: string } | null | undefined,
  employees: { id: string; userEmail?: string | null }[],
  poolFieldsOf?: (partyId: string) => string[]
): T[] {
  if (viewer && PERSONNEL_ROLES.includes(String(viewer.role))) return docs;
  return docs.filter(d => !isPersonnelDoc(d) || maySeePersonnelFile(viewer, employees, d.partyId, d.category, poolFieldsOf));
}
