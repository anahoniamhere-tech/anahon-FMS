/**
 * Who may call each route — the same seats the desk uses to say whose turn it is.
 *
 * Before 5 Sep 2026 the server checked a role inside only 23 of its 104 POST routes.
 * The restricted seats were held back by their allowlists, but anyone on a full view —
 * the Finance Officer, a Project Lead, an HR officer — could call almost anything,
 * including approving a payment the interface never offers them. The interface and the
 * server disagreed, and the interface was the only thing enforcing the policy.
 *
 * This table closes that. It is deliberately exhaustive: a route with no entry is
 * refused, and scripts/check-gates.ts fails if a route exists without one, so a new
 * route cannot slip in ungated. The lists are the same roles.ts constants the buttons
 * are gated on, so a change moves both sides at once.
 *
 * Route-level only. Whether it is *this* record's turn — the requester may not approve
 * their own voucher, a task is ticked by its holder — stays in the route, where the
 * record is in hand.
 */
import {
  DIRECTORS, FINANCE, MANAGERS, HR, PAYROLL_VIEWERS, REQUESTERS, SUPPLIER_EDITORS,
  EQUIPMENT_VERIFIERS, ACTIVITY_EDITORS, CONTENT_EDITORS, SITE_EDITORS, ARCHIVE_EDITORS,
  CONTACT_EDITORS, TOOL_EDITORS, CREW, EDITORS, PLO, DIGITAL, SELF, AUDITOR,
} from "./roles";

/** Any active account. Used where the record itself decides — own timesheet, own papers, own task. */
export const ANY = ["*any"] as const;
const MASTER_ONLY = ["Super Admin"] as const;
/** Everyone who works on a piece of content: the crew who make it and the editors who clear it. */
const NEWSROOM = [...CONTENT_EDITORS, ...CREW, "Project Officer"];
/** The people who run the organisation's money. */
const BOOKS = FINANCE;

export const ROUTE_SEATS: Record<string, readonly string[]> = {
  // ---- Signing in, and things every account does for itself -----------------
  "/api/auth/sync": ANY,
  "/api/calendar/feed": ANY,                    // my own feed address
  "/api/document/upload": ANY,                  // my own papers; the personnel filter decides who reads them
  "/api/materials/link": NEWSROOM,
  "/api/compliance/complete": ANY,              // the route checks the task is mine
  "/api/compliance/reopen": ANY,
  "/api/timesheets/submit": ANY,                // the route checks it is my own card
  "/api/documents/meta": [...MANAGERS, ...EDITORS, "Project Officer", PLO, DIGITAL],

  // ---- The books -----------------------------------------------------------
  "/api/bank/import-notice": BOOKS,
  "/api/bank/reconcile": BOOKS,
  "/api/journal-entry/adjustment": BOOKS,
  "/api/budgets/allocate": BOOKS,
  "/api/cash/count": BOOKS,
  "/api/fxRates": BOOKS,
  "/api/fxRates/sync-inforeuro": BOOKS,
  "/api/partners/draw": DIRECTORS,
  "/api/gemini/compliance-audit": MANAGERS,

  // ---- Paying ---------------------------------------------------------------
  "/api/expense/new": REQUESTERS,
  "/api/expense/action": [...DIRECTORS, ...FINANCE],   // per-action seats below
  "/api/expense/direct-petty-cash": [...DIRECTORS, ...FINANCE],
  "/api/expense/scan-invoice": REQUESTERS,
  "/api/procurement/new": REQUESTERS,
  "/api/procurement/approve": DIRECTORS,
  "/api/procurement/waiver-inline": DIRECTORS,

  // ---- Suppliers and things we own -----------------------------------------
  "/api/vendors/new": SUPPLIER_EDITORS,
  "/api/vendors/engageable": SUPPLIER_EDITORS,
  "/api/vendors/payment-doc": SUPPLIER_EDITORS,
  "/api/vendor/scan": SUPPLIER_EDITORS,
  "/api/subscriptions/save": SUPPLIER_EDITORS,
  "/api/subscriptions/delete": SUPPLIER_EDITORS,
  "/api/subscriptions/verify": SUPPLIER_EDITORS,
  "/api/subscriptions/roll": SUPPLIER_EDITORS,
  "/api/assets/register": SUPPLIER_EDITORS,
  "/api/assets/verify": EQUIPMENT_VERIFIERS,          // never the keeper of the register

  // ---- Projects and funding -------------------------------------------------
  "/api/projects/new": [...MANAGERS, "Project Officer"],
  "/api/projects/delete": DIRECTORS,
  "/api/activities/save": ACTIVITY_EDITORS,
  "/api/activities/delete": ACTIVITY_EDITORS,          // the route checks the programme is theirs
  "/api/activities/generate": ACTIVITY_EDITORS,
  "/api/activities/import-timetable": ACTIVITY_EDITORS,
  "/api/opportunities/save": MANAGERS,
  "/api/opportunities/delete": DIRECTORS,
  "/api/opportunities/intake": MANAGERS,
  "/api/opportunities/call-source": MANAGERS,
  "/api/opportunities/proposal-doc": MANAGERS,
  "/api/opportunities/ai-assist": MANAGERS,

  // ---- Clients and quotations ----------------------------------------------
  "/api/clients/save": MANAGERS,
  "/api/quotations/save": MANAGERS,
  "/api/quotations/delete": MANAGERS,
  "/api/quotations/generate-doc": MANAGERS,
  "/api/quotations/issue-receipt": FINANCE,
  "/api/quotations/settle-offbank": FINANCE,
  "/api/quotations/link-payment": FINANCE,

  // ---- The newsroom ---------------------------------------------------------
  "/api/content/save": NEWSROOM,
  "/api/content/start": NEWSROOM,
  "/api/content/submit-factcheck": NEWSROOM,
  "/api/content/factcheck-log": NEWSROOM,
  "/api/content/factcheck-pass": NEWSROOM,             // the route checks it is the named checker
  "/api/content/cover": NEWSROOM,
  "/api/content/draft-save": NEWSROOM,
  "/api/content/draft-delete": NEWSROOM,
  "/api/content/brainstorm": NEWSROOM,
  "/api/content/produce": NEWSROOM,
  "/api/content/research": NEWSROOM,
  "/api/content/approve": CONTENT_EDITORS,             // the route keeps the two slots apart
  "/api/content/return": CONTENT_EDITORS,
  "/api/content/legal-record": CONTENT_EDITORS,
  "/api/content/publish": CONTENT_EDITORS,
  "/api/content/retract": CONTENT_EDITORS,
  "/api/content/correction": CONTENT_EDITORS,
  "/api/content/delete": CONTENT_EDITORS,
  "/api/meetings/save": NEWSROOM,
  "/api/meetings/delete": CONTENT_EDITORS,
  "/api/meetings/extract-topics": NEWSROOM,
  "/api/meetings/transcribe": NEWSROOM,

  // ---- The site and what it shows ------------------------------------------
  "/api/website/content": SITE_EDITORS,
  "/api/website/image": SITE_EDITORS,
  "/api/website/edit": SITE_EDITORS,
  "/api/website/build": SITE_EDITORS,
  "/api/archive/item": ARCHIVE_EDITORS,
  "/api/archive/schema": ARCHIVE_EDITORS,
  "/api/archive/home": ARCHIVE_EDITORS,
  "/api/archive/publish": SITE_EDITORS,
  "/api/social/publish": SITE_EDITORS,
  "/api/social/edit": SITE_EDITORS,
  "/api/social/delete": SITE_EDITORS,
  "/api/tools/save": TOOL_EDITORS,
  "/api/tools/delete": TOOL_EDITORS,
  "/api/contacts/save": CONTACT_EDITORS,
  "/api/contacts/delete": CONTACT_EDITORS,

  // ---- People ---------------------------------------------------------------
  "/api/employees/new": HR,
  "/api/employees/set-active": HR,
  "/api/timesheets/approve": DIRECTORS,                // and never one's own — checked in the route
  "/api/payroll/payslip": PAYROLL_VIEWERS,
  "/api/contracts/generate": [...HR, ...SUPPLIER_EDITORS],

  // ---- The desk and the diary ----------------------------------------------
  "/api/compliance/save": DIRECTORS,
  "/api/compliance/delete": DIRECTORS,
  "/api/calendar/connect": ANY,        // everyone connects their own diary
  "/api/calendar/disconnect": ANY,     // and removes only their own

  // ---- Administering the system itself -------------------------------------
  "/api/users/create": MASTER_ONLY,
  "/api/users/set-role": MASTER_ONLY,
  "/api/users/set-active": MASTER_ONLY,
  "/api/documents/set-ref": MASTER_ONLY,
  "/api/state": [...FINANCE],                          // a written-back whole state is finance's
};

/**
 * Routes whose seat depends on the step being taken. The voucher's own life: the
 * director signs it, finance parks it for review, pays it and posts it.
 */
export const ACTION_SEATS: Record<string, Record<string, readonly string[]>> = {
  "/api/expense/action": {
    "approve": DIRECTORS,
    "return": DIRECTORS,
    "finance-review": FINANCE,
    "cashbook-pay": FINANCE,
    "general-ledger-post": FINANCE,
  },
};

/** May this role call this route (and, where it matters, take this step)? */
export function mayCall(path: string, role: string, action?: string): boolean {
  const steps = ACTION_SEATS[path];
  // A route whose steps are listed accepts only those steps: a name nobody wrote down is
  // refused rather than falling back to the route's own, wider list.
  const seats = steps ? steps[String(action)] : ROUTE_SEATS[path];
  if (!seats) return false;                       // an unlisted route or step is refused, not waved through
  if (seats === ANY || seats[0] === "*any") return true;
  return seats.includes(role);
}

/** The seats a route names, for the refusal message. */
export const seatsFor = (path: string, action?: string): readonly string[] => {
  const steps = ACTION_SEATS[path];
  return (steps ? steps[String(action)] : ROUTE_SEATS[path]) ?? [];
};
