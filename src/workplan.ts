/**
 * The project workplan — the document a donor asks for before it releases the first instalment,
 * and the shape every AnaHon project's plan takes (Saad, 18 Sep 2026).
 *
 * It is generated from the record, never typed twice: the activities, their months, the milestones
 * and the reporting dates are the same rows the Projects screen already shows. A project that is
 * still an awarded opportunity — the money has not landed, so it is not a Project yet
 * ([[anahon-fms-nas-is-truth]] rule: no deposit, no project) — carries its plan on the opportunity
 * until it graduates, and prints exactly the same paper.
 */

export type WorkplanActivity = {
  /** "A1", "B3", or "" — the outline number the proposal uses. */
  code: string;
  title: string;
  detail?: string;
  /** 1-based month numbers within the implementation period. Empty = runs throughout. */
  months?: number[];
};

export type WorkplanPillar = { code: string; title: string; activities: WorkplanActivity[] };

export type WorkplanMilestone = { date: string; title: string; kind?: string };

export type Workplan = {
  pillars: WorkplanPillar[];
  milestones: WorkplanMilestone[];
  /** The results the plan commits to, one line each. */
  results: string[];
};

export const EMPTY_WORKPLAN: Workplan = { pillars: [], milestones: [], results: [] };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map(m => m.slice(0, 3));

/**
 * The implementation period as grant months, anchored on the start day — not calendar months.
 * SKF's 10 September – 10 March is six months, and a calendar grid would print seven columns for
 * it. M1 is [start, start+1 month), and the label names the month the window opens in.
 */
export function periodMonths(startDate: string, endDate: string): { n: number; label: string; start: string; end: string }[] {
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && !isNaN(Date.parse(`${d}T00:00:00Z`));
  if (!ok(startDate) || !ok(endDate) || endDate <= startDate) return [];
  const [y0, m0, d0] = startDate.split("-").map(Number);
  const add = (k: number) => {
    const m = m0 - 1 + k, y = y0 + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
    // The 31st of a month the next one does not have lands on its last day, never in the month after.
    const last = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
    return `${y}-${String(mm + 1).padStart(2, "0")}-${String(Math.min(d0, last)).padStart(2, "0")}`;
  };
  const out: { n: number; label: string; start: string; end: string }[] = [];
  for (let k = 0; k < 60; k++) {
    const start = add(k);
    if (start >= endDate) break;
    const [y, m] = start.split("-").map(Number);
    out.push({ n: k + 1, label: `M${k + 1} · ${SHORT[m - 1]} ${y}`, start, end: add(k + 1) });
  }
  return out;
}

/** Which grant month a date falls in, or 0 when it is outside the period (or unreadable). */
export function monthOf(date: string, months: { n: number; start: string; end: string }[]): number {
  const d = (date || "").slice(0, 10);
  return months.find(m => d >= m.start && d < m.end)?.n || 0;
}

/** True when an activity runs in month n. An activity with no months runs across the whole period. */
export function runsIn(a: WorkplanActivity, n: number): boolean {
  return !a.months || a.months.length === 0 ? true : a.months.includes(n);
}

/** "months 1–3", "months 2, 4 and 6", "throughout" — the same spans the table draws, in words. */
export function monthsLabel(a: WorkplanActivity, months: { n: number; label: string }[]): string {
  const ms = (a.months || []).filter(n => n >= 1 && n <= months.length).sort((x, y) => x - y);
  if (!ms.length) return "throughout";
  const runs: number[][] = [];
  for (const n of ms) {
    const last = runs[runs.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n); else runs.push([n]);
  }
  return runs.map(r => (r.length === 1 ? `month ${r[0]}` : `months ${r[0]}–${r[r.length - 1]}`)).join(", ");
}

type ActivityRow = {
  title: string; detail?: string; kind?: string; outlineNo?: string; resultGroup?: string;
  startDate?: string; dueDate?: string; status?: string;
};

/**
 * A project's own activity rows, read as a workplan. Kind decides the half it lands in: Activity
 * rows are the plan, everything dated that is not an Activity (Milestone, Report, Payment) is a
 * milestone. The Result group is the pillar; rows without one sit under "Activities".
 */
export function workplanFromActivities(rows: ActivityRow[], startDate: string, endDate: string, results: string[] = []): Workplan {
  const months = periodMonths(startDate, endDate);
  const pillars: WorkplanPillar[] = [];
  for (const r of rows.filter(r => (r.kind || "Activity") === "Activity")) {
    const group = r.resultGroup || "Activities";
    let pillar = pillars.find(p => p.title === group);
    if (!pillar) pillars.push(pillar = { code: "", title: group, activities: [] });
    const from = monthOf(r.startDate || "", months), to = monthOf(r.dueDate || "", months);
    const span = from && to ? Array.from({ length: Math.max(0, to - from) + 1 }, (_, i) => from + i) : from ? [from] : to ? [to] : [];
    pillar.activities.push({ code: r.outlineNo || "", title: r.title, detail: r.detail, months: span });
  }
  const milestones = rows
    .filter(r => (r.kind || "Activity") !== "Activity" && r.dueDate)
    .map(r => ({ date: r.dueDate!, title: r.title, kind: r.kind }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { pillars, milestones, results };
}

/** What is missing before this workplan can be sent to a donor. */
export function workplanBlocker(w: Workplan, startDate: string, endDate: string): string | null {
  if (!periodMonths(startDate, endDate).length) return "The project needs a start and an end date before a workplan can be drawn.";
  if (!w.pillars.some(p => p.activities.length)) return "This project has no activities yet — a workplan with no activities says nothing.";
  return null;
}
