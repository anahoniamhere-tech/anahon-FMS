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
  PERSONNEL_FILE,
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
  "/api/reminders/plan": ANY,                   // what would go into my own calendar
  "/api/reminders/push": ANY,                   // and putting it there
  "/api/document/upload": ANY,                  // my own papers; the personnel filter decides who reads them
  "/api/materials/link": NEWSROOM,
  "/api/help/ask": ANY,
  "/api/anna/turn": ANY,
  "/api/anna/voicebank/consent": ["Super Admin"], // Saad's own voice recordings; checked as himself in the route
  "/api/anna/voicebank/take": ["Super Admin"],
  "/api/anna/voicebank/delete": ["Super Admin"],
  "/api/anna/train/save": ["Super Admin"], // Saad correcting his own test-set transcripts
  "/api/anna/say": ANY,                         // Anna's voice for Saad; the owner is checked in the route
  "/api/anna/listen": ANY,                      // Saad's voice clip to words; ANNA_USERS is checked in the route
  "/api/anna/chats/delete": ANY,                // Saad deleting his own saved chats; ANNA_USERS and the owner are checked in the route
  "/api/requests/save": ANY,                    // filing one's own feature request (Anna plan §3)
  "/api/requests/triage": ["Super Admin"],      // setting its status, room and note                        // Anna; ANNA_USERS (src/anna.ts) is enforced in the route                         // asking the help desk a question; the answer is scoped to the asker
  "/api/push/subscribe": ANY,                   // this device wants to be told when it is my turn
  "/api/push/unsubscribe": ANY,                 // and to stop; both act on the caller's own rows only
  "/api/compliance/complete": ANY,              // the route checks the task is mine
  "/api/compliance/reopen": ANY,
  "/api/timesheets/submit": ANY,                // the route checks it is my own card
  "/api/documents/meta": [...MANAGERS, ...EDITORS, "Project Officer", PLO, DIGITAL],

  // ---- The books -----------------------------------------------------------
  "/api/bank/import-notice": BOOKS,
  "/api/bank/reconcile": BOOKS,
  "/api/journal-entry/adjustment": BOOKS,
  "/api/ledger/reclassify": BOOKS,
  "/api/budgets/allocate": BOOKS,
  // Policy P5 §4.4.1: counted by anyone but the custodian — the route refuses the custodian by
  // person as well; a top-up is raised by the custodian and approved by the Executive Director.
  "/api/cash/count": [...DIRECTORS, PLO],
  "/api/cash/topup/raise": BOOKS,
  "/api/cash/topup/decide": DIRECTORS,
  // Cash withdrawn for approved payment requests, and its leftover — Finance's (Saad, 14 Sep 2026).
  "/api/cash/draw": BOOKS,
  "/api/cash/draw/return": BOOKS,
  // Money received or paid outside the bank, and matching a statement line — Finance's (Policy P5 §4.4.4).
  "/api/offbank/receive": BOOKS,
  "/api/offbank/deposit": BOOKS,
  "/api/bank/match-line": BOOKS,
  // The external consultant's month pack and reconciliations (Policy P5 §4.3, §12.1). Marking a reconciliation is
  // further narrowed to the Finance Officer's own seat, by person, in the route.
  "/api/consultant/pack": BOOKS,
  "/api/consultant/reconciliation/mark": BOOKS,
  "/api/consultant/reconciliation/review": BOOKS,
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
  "/api/vendors/phone": SUPPLIER_EDITORS,
  "/api/vendors/party-kind": SUPPLIER_EDITORS,        // a person or an organisation; never inferred
  "/api/vendors/link-login": SUPPLIER_EDITORS,        // the same person, seen from the register
  "/api/vendors/payment-doc": SUPPLIER_EDITORS,
  "/api/vendor/scan": SUPPLIER_EDITORS,
  "/api/subscriptions/save": SUPPLIER_EDITORS,
  "/api/subscriptions/delete": SUPPLIER_EDITORS,
  "/api/subscriptions/verify": SUPPLIER_EDITORS,
  "/api/subscriptions/roll": SUPPLIER_EDITORS,
  "/api/assets/register": SUPPLIER_EDITORS,
  "/api/assets/update": SUPPLIER_EDITORS,              // correcting what an item is; never what happened to it
  "/api/assets/value": FINANCE,                        // a value and where it comes from (Policy P5 §9)
  "/api/declarations/prepare": FINANCE,                // a missing-receipt declaration, from the voucher (§6.6)
  "/api/declarations/approve": DIRECTORS,              // the Executive Director, never the preparer
  "/api/assets/scan-label": SUPPLIER_EDITORS,        // reads a label, saves nothing
  "/api/assets/checkout": SUPPLIER_EDITORS,
  "/api/assets/checkin": SUPPLIER_EDITORS,
  "/api/assets/move": SUPPLIER_EDITORS,                // where a resting item is; a loan still goes out and comes back
  "/api/assets/delete": SUPPLIER_EDITORS,              // only an unconfirmed mistake; the route itself refuses the rest
  "/api/assets/end": MANAGERS,                         // what became of it; the route separates a disposal from an event
  "/api/assets/end-confirm": MANAGERS,                 // Policy P7's second signature, never the proposer's
  "/api/assets/repair": SUPPLIER_EDITORS,
  "/api/assets/verify": EQUIPMENT_VERIFIERS,          // never the keeper of the register

  // ---- Projects and funding -------------------------------------------------
  "/api/projects/new": [...MANAGERS, "Project Officer"],
  "/api/projects/delete": DIRECTORS,
  "/api/reports/submission": MANAGERS,              // append-only record of a donor report as submitted
  "/api/projects/channel-rule": MANAGERS,           // bank only must cite the project's agreement (Policy P5 §4.4.4)
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
  "/api/quotations/share": MANAGERS,                  // a client link on the VPS (QUOTATION-LINKS.md)
  "/api/quotations/share/revoke": MANAGERS,
  "/api/quotations/issue-receipt": FINANCE,
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
  "/api/content/preview": NEWSROOM,             // rehearsals only — the route refuses a real piece
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
  "/api/website/locate": SITE_EDITORS,
  "/api/website/build": SITE_EDITORS,
  "/api/archive/item": ARCHIVE_EDITORS,
  "/api/archive/schema": ARCHIVE_EDITORS,
  "/api/archive/home": ARCHIVE_EDITORS,
  "/api/archive/publish": SITE_EDITORS,
  "/api/social/accounts/remove": SITE_EDITORS,
  "/api/social/queue": SITE_EDITORS,            // a post tied to an unpublished item waits as a Draft; the gate itself is /api/content/publish
  "/api/social/queue/cancel": SITE_EDITORS,
  "/api/social/queue/retry": SITE_EDITORS,
  "/api/social/media": SITE_EDITORS,            // a video or image into the vault, raw bytes; filed like any document
  "/api/social/edit": SITE_EDITORS,
  "/api/social/delete": SITE_EDITORS,
  // The stored series (7 Sep 2026) — typed in, never written by the live Meta pull.
  "/api/social/periods/save": SITE_EDITORS,
  "/api/social/periods/delete": SITE_EDITORS,
  // A vault image copied onto the website so Meta can fetch it (Instagram fetches for itself).
  "/api/social/image-public": SITE_EDITORS,
  "/api/tools/save": TOOL_EDITORS,
  "/api/tools/delete": TOOL_EDITORS,
  "/api/contacts/save": CONTACT_EDITORS,
  "/api/contacts/delete": CONTACT_EDITORS,
  "/api/engagements/save": CONTACT_EDITORS,     // the events behind the contacts
  "/api/engagements/delete": CONTACT_EDITORS,

  // ---- People ---------------------------------------------------------------
  "/api/employees/new": HR,
  "/api/employees/set-active": HR,
  "/api/employees/phone": ANY,                  // the personnel file decides — the route asks maySeePersonnelFile
  "/api/employees/start-date": HR,
  "/api/employees/login": HR,                   // who may open this person's own file — a grant, not a detail
  // The freelancer pool, split by field. The routes narrow further — a head to their own field.
  "/api/pool/save": ["Super Admin", "Program Director", "Chief Editor", "Production Manager"],
  "/api/pool/assess": ["Super Admin", "Program Director", "Chief Editor", "Production Manager"],
  "/api/pool/delete": ["Super Admin", "Program Director"],   // touches both fields — the Executive Director
  "/api/timesheets/approve": DIRECTORS,                // and never one's own — checked in the route
  "/api/payroll/payslip": PAYROLL_VIEWERS,
  "/api/contracts/generate": [...HR, ...SUPPLIER_EDITORS],

  // ---- The desk and the diary ----------------------------------------------
  // The read-only mail watcher. Polling only reads Gmail; settling only closes a desk row.
  // There is no route here that sends, replies to, labels or deletes mail — by design.
  "/api/mail/poll": DIRECTORS,          // check the mailbox now
  "/api/mail/settle": ANY,              // the route checks the item is mine
  // Policy P1 §7 — the integrity register. MASTER_ONLY is the Super Admin seat; the routes
  // themselves additionally refuse a Super Admin who is standing in as another seat, and
  // there is deliberately NO update or delete route here or anywhere (§7.1 append-only).
  // Policy P11 §6 — sealed source files. The routes also refuse a stand-in seat and log refusals.
  "/api/sources/update": ["Super Admin", "Finance Officer"],
  "/api/sources/document": ["Super Admin", "Finance Officer"],
  "/api/sources/review": MASTER_ONLY,
  "/api/integrity/record": MASTER_ONLY,
  "/api/integrity/line": MASTER_ONLY,
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
    // Saad, 14 Sep 2026: the Finance Officer approves too. A bank payment still needs Saad's
    // signature on the BLOM letter, and cash above USD 150 still needs the director (§4.4.2).
    "approve": MANAGERS,
    "return": MANAGERS,
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
