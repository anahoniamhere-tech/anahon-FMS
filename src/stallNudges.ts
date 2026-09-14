/**
 * The shadow office's follow-up rhythm: what to say when a turn has stalled.
 *
 * pushTurnsFor already tells a person the moment work BECOMES their turn. This is the other
 * half — what happens when they don't act on it. The rhythm is Saad's decision (14 Sep 2026):
 * one reminder when a task becomes overdue, a second two days later, then the Executive
 * Director is told if it is still untouched. It stops the moment the item leaves the desk.
 *
 * Nothing here acts on a record. The shadow office reminds a person to act IN THE SYSTEM; it
 * never approves, pays, publishes, signs or sends. Pure — no clock, no network, no database —
 * so scripts/check-stall-nudges.ts can read every branch back, like src/reminders.ts.
 */
import type { DeskItem } from "./workflow";

export const STALL_RHYTHM = { secondAfterDays: 2, escalateAfterDays: 2 } as const;
export const STALL_CHANNELS = ["stall-1", "stall-2", "escalate"] as const;
export type StallChannel = (typeof STALL_CHANNELS)[number];

/** The subset of a Reminder ledger row this plan reads. */
export type StallRow = { id: string; itemId: string; channel: string; state: string; createdAt: string };

export type StallPlan = {
  /** Overdue, and this person has not been reminded about it yet. */
  first: DeskItem[];
  /** Reminded at least two days ago, still owed. */
  second: DeskItem[];
  /** Reminded twice, the second at least two days ago, still owed: tell the Executive Director. */
  escalate: DeskItem[];
  /** Active rows whose work has left the desk (or is no longer overdue): close them silently. */
  close: { id: string; itemId: string; because: string }[];
};

const daysBetween = (fromIso: string, toDate: string) =>
  Math.floor((Date.parse(`${toDate}T12:00:00Z`) - Date.parse(`${fromIso.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

/**
 * `items` is the person's own turn list (mine/cover, doors they can open, no standing
 * backlog) — the same reading pushTurnsFor uses. `canEscalate` is false when the person IS the
 * one escalations go to: nobody is told about their own overdue work by themselves.
 *
 * Each item advances at most ONE stage per run, and every stage is timed from when the previous
 * reminder was actually sent — so on the first day this runs, a month-old item gets its first
 * reminder, not an immediate escalation.
 */
export function planStallNudges(items: DeskItem[], ledger: StallRow[], today: string, opts: { canEscalate: boolean }): StallPlan {
  const overdue = items.filter(item => item.urgency === "overdue");
  const owed = new Set(overdue.map(item => item.id));
  const active = ledger.filter(row => row.state === "active" && (STALL_CHANNELS as readonly string[]).includes(row.channel));
  const rowFor = (itemId: string, channel: StallChannel) => active.find(row => row.itemId === itemId && row.channel === channel);

  const plan: StallPlan = { first: [], second: [], escalate: [], close: [] };
  for (const item of overdue) {
    const one = rowFor(item.id, "stall-1"), two = rowFor(item.id, "stall-2"), up = rowFor(item.id, "escalate");
    if (!one) { plan.first.push(item); continue; }
    if (!two) { if (daysBetween(one.createdAt, today) >= STALL_RHYTHM.secondAfterDays) plan.second.push(item); continue; }
    if (!up && opts.canEscalate && daysBetween(two.createdAt, today) >= STALL_RHYTHM.escalateAfterDays) plan.escalate.push(item);
  }
  for (const row of active) {
    if (!owed.has(row.itemId)) plan.close.push({ id: row.id, itemId: row.itemId, because: "no longer overdue on this desk — acted on, reassigned or re-dated" });
  }
  return plan;
}

export const planIsQuiet = (plan: StallPlan) => !plan.first.length && !plan.second.length && !plan.escalate.length && !plan.close.length;

const line = (item: DeskItem) => `${item.verb}: ${item.title}${item.when ? ` (due ${item.when})` : ""}`;
const andMore = (count: number) => (count > 0 ? ` — and ${count} more` : "");

/** One notification per person per run, however many items moved. */
export function personMessage(plan: StallPlan): { title: string; body: string; lead: DeskItem } | null {
  const lead = plan.second[0] ?? plan.first[0];
  if (!lead) return null;
  const total = plan.first.length + plan.second.length;
  const title = plan.second.length ? "Still waiting on you" : total === 1 ? "Now overdue on your desk" : `${total} tasks now overdue on your desk`;
  return { title, body: line(lead) + andMore(total - 1), lead };
}

/** One notification to the Executive Director per run, naming who and what. */
export function escalationMessage(entries: { personName: string; item: DeskItem }[]): { title: string; body: string } | null {
  if (!entries.length) return null;
  const head = entries[0];
  return {
    title: entries.length === 1 ? "Still overdue after two reminders" : `${entries.length} tasks still overdue after two reminders`,
    body: `${head.personName} — ${line(head.item)}${andMore(entries.length - 1)}`,
  };
}
