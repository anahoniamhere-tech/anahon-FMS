/**
 * The editorial chain, derived — never written out by hand.
 *
 * Stage 1 of the visual builder (see anahon-editorial-builder): show the machine, change
 * nothing. Every station, seat, verb, lock and blocker on this map is computed from the two
 * files that already govern the pipeline — the rule table in workflow.ts and the gate in
 * editorialGates.ts — so the drawing cannot drift from behaviour. If someone adds a status to
 * the gate or a rule to the table, a station appears here; if nobody does, no station can be
 * invented, and scripts/check-editorial-gates.ts fails the build if one ever is.
 *
 * Pure: no I/O, no React, no dates of its own. That is what makes it assertable.
 *
 * NOTHING HERE IS EDITABLE, and two things must never become editable (Policies 002 & 005):
 * the fact-check belongs to a named person who is not the author, and the two approval slots
 * must be held by two different people. They are rendered `locked` with the policy that fixes
 * them, so the map teaches the rule instead of inviting someone to drag it away.
 */
import { RULES, type Rule, type DeskItem } from "./workflow";
import { CONTENT_STATUSES, CONTENT_CHECKS, publishBlockers, type ContentGateFields } from "./editorialGates";

/** The one collection this map draws. Everything else in RULES belongs to another door. */
export const MAP_KIND = "contentItems";

/** Record fields the rule table uses to keep two people apart; named once, read below. */
const AUTHOR_FIELD = "assigneeUserId";

export type Lock = {
  /** What is fixed. */ rule: string;
  /** The policy that fixes it — shown on the station so the map teaches it. */ policy: string;
};
export type Slot = { emptyField: string; seat: string[]; verb: string; excludes: string[] };
export type Station = {
  status: string;
  index: number;
  /** Every rule in workflow.ts that fires on this status (Editorial Review has two). */
  rules: Rule[];
  seats: string[];
  /** Record field naming the individual whose turn it is, "" when the turn belongs to a seat. */
  personField: string;
  verbs: string[];
  slots: Slot[];
  locks: Lock[];
  door: string;
  dateField: string;
  /** No seat and no person: nothing in the rule table moves a piece on from here. */
  terminal: boolean;
  /** Publication blockers this station is the one to clear (see stationBlockers below). */
  clears: string[];
  /** Everything still standing between a piece here and publication. */
  outstanding: string[];
};

const contentRules = (): Rule[] => RULES.filter(r => r.kind === (MAP_KIND as any));

/**
 * Where the two policy steps sit in the chain — found by their SHAPE in the rule table, never
 * by name. The fact-check is the station whose turn belongs to a named individual and to no
 * seat; the approvals are the station that has more than one slot. Naming them as strings here
 * would be a hardcoded station by the back door, and check-editorial-gates.ts rejects it.
 */
const statusIndexWhere = (pred: (rules: Rule[]) => boolean) =>
  CONTENT_STATUSES.findIndex(status => {
    const rs = contentRules().filter(r => r.status === status);
    return rs.length > 0 && pred(rs);
  });
const FACT_CHECK_AT = statusIndexWhere(rs => rs.some(r => r.person) && rs.every(r => !r.seat));
const APPROVALS_AT = statusIndexWhere(rs => rs.filter(r => r.emptyField).length > 1);

/**
 * A piece standing at station `i`, as the gate would see it.
 *
 * The only modelling in this file, and it is ordering, not content: a fact-check that has
 * passed is behind you once you are past the station that holds it, and the two approvals are
 * behind you once you are past the station that holds them. Both indices are derived above, so
 * inserting a status in the gate moves this with it.
 */
function pieceAt(i: number, extra: Partial<ContentGateFields> = {}): ContentGateFields {
  return {
    status: CONTENT_STATUSES[i],
    factCheckPassedAt: i > FACT_CHECK_AT ? "passed" : "",
    // Two different ids on purpose: the same id in both slots is itself a blocker, and this
    // models a piece that cleared the station rather than one that broke the rule at it.
    pmApprovedBy: i > APPROVALS_AT ? "pm-person" : "",
    pdApprovedBy: i > APPROVALS_AT ? "pd-person" : "",
    legalFlag: false, legalReviewedBy: "",
    checksJson: "{}", aiAssisted: false, aiDisclosed: false,
    ...extra,
  };
}

/**
 * The seven Policy 002 standards are a constant obligation, not a station's job — they can be
 * ticked at any point and block publication until they are. Kept out of the per-station lists
 * so a station shows what IT clears, and surfaced once by standingRequirements().
 */
const isStandard = (b: string) => CONTENT_CHECKS.some(([, label]) => b.includes(label));

/**
 * The status at which nothing structural stands in the way of publishing — asked of the gate
 * rather than named here: it is the one status that, with the fact-check passed and both
 * approvals in, produces no blocker at all. Everything before it is the chain.
 */
export const PUBLISHABLE_STATUS: string = CONTENT_STATUSES.find(status =>
  publishBlockers(pieceAt(CONTENT_STATUSES.length - 1, { status })).filter(b => !isStandard(b)).length === 0
)!;

/**
 * What publication is waiting on for a piece standing at station `i`.
 *
 * Standards excluded (they are a standing duty, above), and the status itself excluded — asking
 * the gate about a piece "already at the publishable status" leaves only the substantive work:
 * the fact-check and the two approvals. Without this the same "status is not Approved" sentence
 * restates itself at every station and reads as though each one cleared it.
 */
const blockersAt = (i: number) =>
  publishBlockers(pieceAt(i, { status: PUBLISHABLE_STATUS })).filter(b => !isStandard(b));

/** The seven standards, and the two conditional duties — all read out of the gate itself. */
export function standingRequirements() {
  const clean = publishBlockers(pieceAt(CONTENT_STATUSES.length - 1));
  const flagged = publishBlockers(pieceAt(CONTENT_STATUSES.length - 1, { legalFlag: true, aiAssisted: true }));
  return {
    standards: CONTENT_CHECKS.map(([, label, sentence]) => ({ label, sentence })),
    conditional: flagged.filter(b => !clean.includes(b)),
  };
}

/**
 * Every station of the chain, in order, with what governs it.
 *
 * Built by grouping the rule table on status — the station list IS the rule table's own set of
 * content statuses, ordered by the gate. There is no literal station name anywhere in this file.
 */
export function editorialStations(): Station[] {
  const rules = contentRules();
  return CONTENT_STATUSES.map((status, index) => {
    const mine = rules.filter(r => r.status === status);
    const slots: Slot[] = mine.filter(r => r.emptyField).map(r => ({
      emptyField: r.emptyField!, seat: [...(r.seat || [])], verb: r.verb, excludes: [...(r.exclude || [])],
    }));
    const personField = mine.find(r => r.person)?.person || "";
    const locks: Lock[] = [];
    // A turn pinned to a record field rather than to a seat: one named individual owns it.
    if (personField && mine.every(r => !r.seat)) locks.push({
      rule: "One named person, chosen when the piece is sent here — and never the author.",
      policy: "Policy 005 (impartiality)",
    });
    // Two slots that each exclude the other are two different people, by construction.
    if (slots.length > 1 && slots.every(s => slots.some(o => o !== s && s.excludes.includes(o.emptyField)))) locks.push({
      // A static sentence, not a template literal: this string is an i18n key, and an
      // interpolated one can never be translated. The count is visible in "The slots" below.
      rule: "No one person may hold more than one of these approvals.",
      policy: "Policy 002 (Production Manager AND Programs Director)",
    });
    if (mine.some(r => r.exclude?.includes(AUTHOR_FIELD))) locks.push({
      rule: "Never the author of the piece.",
      policy: "§4.3 (segregation of duties)",
    });
    // publishBlockers answers "may this be published?", which is meaningless once it has been.
    // A terminal station is past the question, so it claims to clear nothing and owes nothing.
    const terminal = mine.every(r => !r.seat && !r.person && !r.standIns);
    const outstanding = terminal ? [] : blockersAt(index);
    const next = terminal || index + 1 >= CONTENT_STATUSES.length ? [] : blockersAt(index + 1);
    return {
      status, index, rules: mine,
      seats: [...new Set(mine.flatMap(r => [...(r.seat || [])]))],
      personField,
      verbs: [...new Set(mine.map(r => r.verb).filter(Boolean))],
      slots, locks,
      door: mine[0]?.door || "",
      dateField: mine.find(r => r.when)?.when || "",
      terminal,
      clears: outstanding.filter(b => !next.includes(b)),
      outstanding,
    };
  });
}

/* ── The live layer ───────────────────────────────────────────────────────────
 * A map with a position on it beats a diagram, and this needs no new query: the
 * pieces are already in the state the tab receives, and deskItems() is the same pure
 * function My Desk calls in the browser. So the map reads exactly what the desk reads.
 */
export type Standing = {
  /** Active accounts that can serve this station today. */ holders: { id: string; name: string; role: string }[];
  /** Nobody active holds any of its seats. */ vacant: boolean;
  /** Its slots need more distinct people than are available. */ understaffed: boolean;
};

/** Who can actually serve a station right now — the seat lists read against the live accounts. */
export function stationStanding(st: Station, users: any[]): Standing {
  const active = (users || []).filter((u: any) => u.active);
  const holders = active.filter((u: any) => st.seats.includes(u.role))
    .map((u: any) => ({ id: u.id, name: u.name, role: u.role }));
  // A named-person station is served by whoever is named, so it is never "vacant" here.
  const seatBased = st.seats.length > 0;
  return {
    holders,
    vacant: seatBased && holders.length === 0,
    // Two slots that must be two different people need two different people to exist.
    understaffed: st.slots.length > 1 && holders.length < st.slots.length,
  };
}

export type LivePiece = {
  id: string; title: string; when: string | null;
  urgency: DeskItem["urgency"] | null;
  /** "mine" / "cover" from the desk when this piece is the viewer's turn, else null. */
  turn: DeskItem["group"] | null;
  /** Which approval slots are still empty, for a piece in Editorial Review. */ openSlots: string[];
};

/**
 * Where every piece is standing, keyed by status. Counts come from the pieces themselves so a
 * piece appears once; the desk rows only decorate them with urgency and whose turn it is.
 */
export function livePositions(items: any[], desk: DeskItem[]): Record<string, LivePiece[]> {
  const byRecord = new Map<string, DeskItem[]>();
  for (const d of desk) {
    if (d.kind !== MAP_KIND) continue;
    byRecord.set(d.recordId, [...(byRecord.get(d.recordId) || []), d]);
  }
  const out: Record<string, LivePiece[]> = {};
  for (const status of CONTENT_STATUSES) out[status] = [];
  for (const it of items || []) {
    if (!out[it.status]) continue;                       // a status the gate does not know: not on this map
    const rows = byRecord.get(it.id) || [];
    // "mine" beats "cover" beats "week" — the strongest claim the desk makes on this piece.
    const turn = (["mine", "cover", "week"] as const).find(g => rows.some(r => r.group === g)) || null;
    out[it.status].push({
      id: it.id, title: it.title,
      when: rows[0]?.when ?? (it.dueDate || null),
      urgency: rows[0]?.urgency ?? null,
      turn,
      openSlots: rows.filter(r => r.id.includes(":") && r.id.split(":").length > 2).map(r => r.id.split(":")[2]),
    });
  }
  return out;
}

/* ── After publication ────────────────────────────────────────────────────────
 * Deliberately NOT stations. The rule table ends at the terminal status, so anything past it
 * has no seat, no verb and no turn — drawing it as a station would put a box on the map that
 * behaviour has nothing to say about, which is the exact thing the check script forbids.
 *
 * But leaving it off would let the map imply that publishing is the end, when Policy 005 puts a
 * standing duty on a published piece: correct it publicly, with the date and the details. So it
 * is drawn as an afterwards, in its own band, labelled as not part of the chain.
 *
 * Each one names the record field that proves it happened, so the band stays as checkable as
 * the stations: these are the two things the server can do to a published piece.
 */
export const AFTER_PUBLICATION = [
  {
    action: "Correct it",
    field: "correctionsJson",
    what: "The record stays published and a dated correction is appended to it, in public.",
    policy: "Policy 005 (public record of corrections, with date and details)",
  },
  {
    action: "Retract it",
    field: "retractedAt",
    what: "The piece comes off the website with a written reason; the record itself stays, because the published record is never silently removed.",
    policy: "Policy 005 (no silent edits to the published record)",
  },
] as const;
