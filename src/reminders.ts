/**
 * What to put in a calendar, and what to take out again.
 *
 * The desk already answers "what is owed, to whom, by when". This decides what that
 * should mean for a calendar that has been written to before: create the events that are
 * new, correct the ones whose date or wording moved, and cancel the ones whose work has
 * left the desk. Pure — no clock, no network, no database — so the plan can be shown to a
 * person before anything is written, and so scripts/check-reminders.ts can read every
 * branch back.
 *
 * Phase 6 of the 4 Sep 2026 navigation decision. The ledger it plans against exists for
 * one reason: without it a nightly run recreates the same event every night.
 */
import type { DeskItem } from "./workflow";

/** A row of the ledger — one person, one desk item, the event it became. */
export type LedgerRow = {
  id: string;
  userId: string;
  itemId: string;
  googleEventId: string | null;
  title: string;
  whenDate: string;
  state: string;            // "active" | "cancelled"
};

export type Plan = {
  create: { itemId: string; title: string; whenDate: string; description: string }[];
  update: { id: string; itemId: string; googleEventId: string | null; title: string; whenDate: string; description: string; because: string }[];
  cancel: { id: string; itemId: string; googleEventId: string | null; title: string; because: string }[];
  /** Items the desk owes that carry no date — a calendar has nowhere to put them. */
  skipped: { itemId: string; title: string; because: string }[];
};

/** The one-line summary a calendar entry carries. Kept here so plan and push agree. */
export const reminderTitle = (i: DeskItem) => `${i.verb}: ${i.title}`;

/** The body: what it is, and where to go to deal with it. */
export function reminderBody(i: DeskItem, systemUrl: string): string {
  const lines = [
    `${i.status}${i.seats.length ? ` — owed to the ${i.seats.join(", ")} seat` : ""}`,
    i.urgency === "overdue" ? "This one is already late." : "",
    "",
    `Open it in the system: ${systemUrl.replace(/\/$/, "")}`,
    "Acting on the record is what clears this — the calendar entry is only a copy.",
  ];
  return lines.filter(l => l !== "").join("\n");
}

/**
 * Compare what the desk owes with what the calendar was already told.
 *
 * `items` should already be this one person's own — their turn and the seats they cover.
 * Undated work is reported as skipped rather than dropped, because "nothing to do" and
 * "nowhere to put it" are different answers and only one of them is a bug.
 */
export function planReminders(items: DeskItem[], ledger: LedgerRow[], systemUrl: string): Plan {
  const plan: Plan = { create: [], update: [], cancel: [], skipped: [] };
  const byItem = new Map(ledger.map(r => [r.itemId, r]));
  const owed = new Set<string>();

  for (const i of items) {
    const title = reminderTitle(i);
    if (!i.when) { plan.skipped.push({ itemId: i.id, title, because: "no date on the record" }); continue; }
    owed.add(i.id);
    const description = reminderBody(i, systemUrl);
    const row = byItem.get(i.id);
    if (!row || row.state !== "active") {
      plan.create.push({ itemId: i.id, title, whenDate: i.when, description });
      continue;
    }
    const movedDate = row.whenDate !== i.when;
    const movedTitle = row.title !== title;
    if (movedDate || movedTitle) {
      plan.update.push({
        id: row.id, itemId: i.id, googleEventId: row.googleEventId, title, whenDate: i.when, description,
        because: movedDate && movedTitle ? "the date and the wording changed"
          : movedDate ? `moved from ${row.whenDate} to ${i.when}` : "the wording changed",
      });
    }
  }

  for (const row of ledger) {
    if (row.state !== "active" || owed.has(row.itemId)) continue;
    plan.cancel.push({ id: row.id, itemId: row.itemId, googleEventId: row.googleEventId, title: row.title, because: "no longer owed" });
  }

  return plan;
}

/** Is there anything to do? Used to keep a quiet night quiet. */
export const planIsEmpty = (p: Plan) => !p.create.length && !p.update.length && !p.cancel.length;

/** A sentence a person can read before authorising the run. */
export function describePlan(p: Plan): string {
  if (planIsEmpty(p)) return "Nothing to change — the calendar already matches the desk.";
  const parts = [
    p.create.length ? `${p.create.length} to add` : "",
    p.update.length ? `${p.update.length} to correct` : "",
    p.cancel.length ? `${p.cancel.length} to remove` : "",
  ].filter(Boolean);
  const tail = p.skipped.length ? `, and ${p.skipped.length} with no date that a calendar cannot hold` : "";
  return parts.join(", ") + tail + ".";
}
