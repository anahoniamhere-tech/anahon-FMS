/**
 * Solidarity with journalists and outlets at risk — Editorial Standards Handbook Ed. 7, P3 §7.5
 * (live 6 Oct 2026; Saad approved counting it the same day).
 *
 * §7.5 ends "every action is logged in the management system's events register, so it can be counted
 * and reported". That is this file: the six acts the policy names, and the three numbers the year
 * owes. The register holds what AnaHon DID — never details of the person at risk.
 */

/** The acts §7.5 offers, case by case. Not advocacy categories: forms of help. */
export const SOLIDARITY_ACTIONS = [
  "Case raised",
  "Mentoring",
  "Tools or templates shared",
  "Desk and equipment",
  "Paid commission",
  "Republished with credit",
] as const;
export type SolidarityAction = typeof SOLIDARITY_ACTIONS[number];

export const SOLIDARITY_KIND = "Solidarity";

/** What a year owes under §7.5. Cases raised have no target — they follow events, not a quota. */
export const MENTORING_HOURS_TARGET = 20;
export const TOOLS_ORGS_TARGET = 2;

type EngagementRow = {
  kind?: string; solidarityAction?: string; hours?: number;
  org?: string; startDate?: string; title?: string;
};

/** Why this engagement cannot be saved as it stands, or null (the server's rule, shared with the form). */
export function solidarityBlocker(e: EngagementRow): string | null {
  const isSolidarity = e.kind === SOLIDARITY_KIND;
  const action = String(e.solidarityAction || "").trim();
  if (isSolidarity && !action) return "A solidarity entry has to say which action it was.";
  if (!isSolidarity && action) return "Only a solidarity entry carries a solidarity action.";
  if (action && !(SOLIDARITY_ACTIONS as readonly string[]).includes(action)) return `Unknown solidarity action: ${action}`;
  const hours = Number(e.hours) || 0;
  if (hours < 0) return "Hours cannot be negative.";
  if (hours && !isSolidarity) return "Hours are counted on solidarity entries only.";
  return null;
}

/** One key per organisation, so "SKF", "skf " and "Skf" are the same outlet. */
export const orgKey = (org: string): string => String(org || "").trim().toLowerCase().replace(/\s+/g, " ");

export type SolidarityTally = {
  year: string;
  casesRaised: number;
  mentoringHours: number;
  mentoringTarget: number;
  toolsOrgs: string[];
  toolsTarget: number;
  /** Every solidarity action of the year, counted by kind, for the report. */
  byAction: { action: string; count: number }[];
};

/**
 * The year's solidarity, counted by the date the action started — a case raised in December belongs
 * to that December, whatever the row was edited afterwards.
 */
export function solidarityYear(rows: EngagementRow[], year: string): SolidarityTally {
  const mine = (rows || []).filter(r =>
    r.kind === SOLIDARITY_KIND && String(r.startDate || "").slice(0, 4) === String(year));
  const of = (action: string) => mine.filter(r => r.solidarityAction === action);
  // One entry per organisation, keeping the FIRST spelling recorded: "SKF" entered in April is what
  // the year reports, not " skf " typed again in May.
  const seen = new Map<string, string>();
  for (const r of of("Tools or templates shared")) {
    const key = orgKey(r.org || "");
    if (key && !seen.has(key)) seen.set(key, String(r.org || "").trim());
  }
  const toolsOrgs = Array.from(seen.values());
  return {
    year: String(year),
    casesRaised: of("Case raised").length,
    mentoringHours: Math.round(of("Mentoring").reduce((s, r) => s + (Number(r.hours) || 0), 0) * 10) / 10,
    mentoringTarget: MENTORING_HOURS_TARGET,
    toolsOrgs,
    toolsTarget: TOOLS_ORGS_TARGET,
    byAction: SOLIDARITY_ACTIONS.map(a => ({ action: a, count: of(a).length })).filter(x => x.count),
  };
}

/** The years that have any solidarity entry, newest first — what the tally can be shown for. */
export function solidarityYears(rows: EngagementRow[]): string[] {
  return Array.from(new Set((rows || [])
    .filter(r => r.kind === SOLIDARITY_KIND && /^\d{4}/.test(String(r.startDate || "")))
    .map(r => String(r.startDate).slice(0, 4)))).sort().reverse();
}
