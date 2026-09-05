/**
 * Who may do what — one list per door, imported by the server AND the interface.
 *
 * Before 4 Sep 2026 these lists were spelled out by hand in nine files, and two of
 * them named roles that do not exist ("Executive Director", "Programs Director"). A seat
 * added on the server stayed locked out in the browser, and the Approve button on
 * payments was gated on a role nobody could hold. This file is the cure: change a
 * list here and both sides move together.
 *
 * The seats themselves are the organisation's (see anahon-team-roles). "Program
 * Director" is the policies' name for the director seat; the person in it is the
 * Executive Director, and the Super Admin account stands in for every vacant seat.
 */
export const DIRECTORS = ["Super Admin", "Program Director"];
export const FINANCE = ["Super Admin", "Finance Officer"];
export const MANAGERS = ["Super Admin", "Finance Officer", "Program Director"];
export const HR = ["Super Admin", "HR / Payroll Officer"];
export const PAYROLL_VIEWERS = ["Super Admin", "HR / Payroll Officer", "Finance Officer"];
export const PERSONNEL_FILE = ["Super Admin", "HR / Payroll Officer", "Program Director"];

export const PLO = "Procurement and Logistics Officer";
export const DIGITAL = "Digital Officer";
export const CREW = ["Reporter", "Content Creator", "Podcaster", "Graphic Designer"];
export const EDITORS = ["Chief Editor", "Production Manager"];

/** May raise a payment request or a bid comparison, and plan project timelines. */
export const REQUESTERS = ["Super Admin", "Finance Officer", "Project Lead", "Project Officer", PLO];
/** May onboard suppliers and keep the equipment register. */
export const SUPPLIER_EDITORS = ["Super Admin", "Finance Officer", PLO];
/** Physical verification of equipment is never done by the keeper of the register. */
export const EQUIPMENT_VERIFIERS = ["Super Admin", "Auditor / Read-Only Reviewer"];
/** Project timeline steps and core documents. */
export const ACTIVITY_EDITORS = [...MANAGERS, "Project Officer", PLO];

/** Editorial approval and publishing (Policy 002 seats plus the Chief Editor). */
export const CONTENT_EDITORS = ["Production Manager", "Program Director", "Super Admin", "Chief Editor"];
/** Editorial Review slots: a role fills its own slot; the Chief Editor and the master account may take either empty one. */
export const PM_SLOT = CONTENT_EDITORS.filter(r => r !== "Program Director");   // Production Manager, Super Admin, Chief Editor
export const PD_SLOT = CONTENT_EDITORS.filter(r => r !== "Production Manager"); // Program Director, Super Admin, Chief Editor
/** Site work: website copy, the live editor, the archive, social posting. */
export const SITE_EDITORS = [...CONTENT_EDITORS, DIGITAL];
export const ARCHIVE_EDITORS = [...SITE_EDITORS, "Project Officer"];
/** Contacts and the tools register. */
export const CONTACT_EDITORS = [...MANAGERS, "Production Manager", PLO, DIGITAL];
export const TOOL_EDITORS = CONTACT_EDITORS;

/** The master account alone — what is nobody's seat yet (the statutory checklist) is its own work, not a vacancy it covers. */
export const MASTER = ["Super Admin"];
export const AUDITOR = "Auditor / Read-Only Reviewer";
export const SELF = "Employee (Self-Service)";
/** Every role an account may hold — the server's whitelist and the Admin tab's selector. */
export const ALL_ROLES = [
  "Super Admin", "Finance Officer", "Program Director", "Project Officer", "Project Lead", "HR / Payroll Officer",
  AUDITOR, SELF, "Production Manager", "Reporter", "Content Creator", "Podcaster",
  "Chief Editor", PLO, DIGITAL, "Graphic Designer",
];
/** May read the financial statements. */
export const REPORT_READERS = [...MANAGERS, AUDITOR];

export const has = (list: readonly string[], role?: string | null) => list.includes(role || "");
