/**
 * The diversity tracker — Policy P3 §4.1 step 2, §2.5, §4.3 (Editorial Standards Handbook ed.7,
 * live 6 Oct 2026). «متتبّع التنوّع».
 *
 * It came out of FPU's MDM fellowship as a Google Sheet; this is the same instrument inside the
 * newsroom. §2.5 is the point of it: inclusivity "is checked, not assumed" — so every piece is
 * logged while it is produced, and the planning meeting reads the month back (§4.3).
 *
 * Pure: no I/O, no React, no database. The gate, the screen and the monthly summary all read it,
 * so what an author is asked for and what the server refuses cannot drift apart.
 *
 * NOT A JUDGEMENT ON THE PIECE. The tracker records what is in the piece; it never approves or
 * refuses one on its content. The only refusal here is "you have not filled it in yet".
 */

/** Who the piece is mainly about. The sheet only had Male/Female, but a piece about a ministry or
 *  a statement is about neither, and recording it as a man is how a tracker starts lying. */
export const MAIN_SUBJECTS: [key: string, en: string, ar: string][] = [
  ["woman", "Woman", "امرأة"],
  ["man", "Man", "رجل"],
  ["mixed", "Mixed", "مختلط"],
  ["not-person", "Not about a person", "ليست عن شخص"],
];

/** Exactly the sheet's list, and nothing added to it. */
export const VULNERABLE_GROUPS: [key: string, en: string, ar: string][] = [
  ["women-girls", "Women and girls", "النساء والفتيات"],
  ["refugees", "Refugees", "اللاجئون"],
  ["children", "Children and adolescents", "الأطفال والمراهقون"],
  ["disabilities", "Persons with disabilities (including psychosocial)", "الأشخاص ذوو الإعاقة (بما فيها الإعاقة النفسية-الاجتماعية)"],
  ["domestic-workers", "Migrant domestic workers", "عاملات وعمّال المنازل المهاجرون"],
  ["displaced", "Internally displaced", "النازحون داخلياً"],
  ["ethnic", "Ethnic minorities", "الأقليات الإثنية"],
  ["religious", "Religious minorities", "الأقليات الدينية"],
];

/** The explicit "we checked, and none" — kept apart from an empty list, which means nobody looked. */
export const NO_GROUP = "none";

/** The four counted fields, in the sheet's own order. */
export const PRESENCE_FIELDS: [key: string, en: string, ar: string][] = [
  ["mentionedWomen", "Women mentioned or quoted", "نساء ورد ذكرهنّ أو اقتُبس عنهنّ"],
  ["mentionedMen", "Men mentioned or quoted", "رجال ورد ذكرهم أو اقتُبس عنهم"],
  ["expertWomen", "Women quoted as experts", "نساء اقتُبس عنهنّ كخبيرات"],
  ["expertMen", "Men quoted as experts", "رجال اقتُبس عنهم كخبراء"],
];

export type Entry = {
  mainSubject?: string | null;
  mentionedWomen?: string | null;
  mentionedMen?: string | null;
  expertWomen?: string | null;
  expertMen?: string | null;
  groupsJson?: string | null;
  notes?: string | null;
};

/**
 * A counted field holds one of: "" (not recorded), "none", "yes", or a whole number.
 *
 * The sheet really does carry all of these — "Yes", "No", "None", "Yes (Mainly)", and bare 5, 3, 2 —
 * because an author sometimes knows how many and sometimes only that there were some. Forcing one
 * or the other would either throw away counts or invent them.
 */
export const isPresenceValue = (v: string | null | undefined): boolean => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "none" || s === "yes" || /^\d+$/.test(s);
};

/** Was anyone of this kind in the piece? "none", "0" and an unrecorded field are all not-present. */
export const present = (v: string | null | undefined): boolean => {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "yes") return true;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  return false;
};

/** The count when one was recorded, else null — "yes" is a presence, not a number. */
export const countOf = (v: string | null | undefined): number | null => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? Number(s) : null;
};

export const groupsOf = (entry: Entry): string[] => {
  try { const g = JSON.parse(String(entry.groupsJson || "[]")); return Array.isArray(g) ? g.map(String) : []; }
  catch { return []; }
};

/** Everything §4.1 step 2 names, recorded. Notes are optional — the policy does not ask for them. */
export function diversityComplete(entry: Entry | null | undefined): boolean {
  return !diversityBlockers(entry).length;
}

/**
 * Why this piece cannot go to fact-check yet (Policy P3 §4.1). Empty when the tracker is filled.
 *
 * "Recorded" includes saying there were none: §2.5 asks for a check, and "we looked and found no
 * women quoted" is a check. What it refuses is silence.
 */
export function diversityBlockers(entry: Entry | null | undefined): string[] {
  if (!entry) return ["The diversity tracker has not been filled in for this piece — the main subject, the women and men mentioned or quoted, any vulnerable group, and the women and men quoted as experts (Policy P3 §4.1)."];
  const out: string[] = [];
  const subject = String(entry.mainSubject || "").trim();
  if (!subject) out.push("Diversity tracker: say who the piece is mainly about (Policy P3 §4.1).");
  else if (!MAIN_SUBJECTS.some(([k]) => k === subject)) out.push(`Diversity tracker: "${subject}" is not one of the main-subject options (Policy P3 §4.1).`);
  for (const [key, en] of PRESENCE_FIELDS) {
    const v = (entry as any)[key];
    if (!String(v ?? "").trim()) out.push(`Diversity tracker: record ${en.toLowerCase()} — a number, "yes", or "none" (Policy P3 §4.1).`);
    else if (!isPresenceValue(v)) out.push(`Diversity tracker: "${v}" is not a value for ${en.toLowerCase()} — use a number, "yes" or "none" (Policy P3 §4.1).`);
  }
  const groups = groupsOf(entry);
  if (!groups.length) out.push(`Diversity tracker: name any vulnerable group in the piece, or tick "${NO_GROUP}" to record that there is none (Policy P3 §4.1).`);
  else {
    const bad = groups.filter(g => g !== NO_GROUP && !VULNERABLE_GROUPS.some(([k]) => k === g));
    if (bad.length) out.push(`Diversity tracker: "${bad[0]}" is not one of the vulnerable groups the tracker records (Policy P3 §4.1).`);
    if (groups.includes(NO_GROUP) && groups.length > 1) out.push(`Diversity tracker: "${NO_GROUP}" cannot be combined with a group (Policy P3 §4.1).`);
  }
  return out;
}

/**
 * Pieces in production when the tracker went live did not have one to fill. They are PROMPTED, not
 * blocked: the obligation starts with the work, not retroactively. Compared against the piece's own
 * created_at, so the exemption expires on its own as those pieces finish — nothing to clean up.
 */
export const TRACKER_FROM = "2026-10-06T13:50:10.000Z";
export const trackerRequired = (createdAt: string | null | undefined): boolean =>
  String(createdAt || "") >= TRACKER_FROM;

export type MonthRow = Entry & { loggedOn?: string | null; title?: string | null };

/**
 * What the planning meeting reads once a month (§4.3): how many pieces were logged, and the share
 * of them that put a woman at the centre, mentioned women at all, and quoted a woman as an expert —
 * plus which of the eight groups appeared. Shares are of the pieces LOGGED that month, which is the
 * only honest denominator: a piece nobody logged is not evidence of anything.
 */
export function monthlySummary(rows: MonthRow[], month: string) {
  const inMonth = rows.filter(r => String(r.loggedOn || "").slice(0, 7) === month);
  const n = inMonth.length;
  const share = (k: number) => (n ? Math.round((k / n) * 100) : 0);
  const womenSubject = inMonth.filter(r => r.mainSubject === "woman").length;
  const womenMentioned = inMonth.filter(r => present(r.mentionedWomen)).length;
  const womenExperts = inMonth.filter(r => present(r.expertWomen)).length;
  const menExperts = inMonth.filter(r => present(r.expertMen)).length;
  const groups = VULNERABLE_GROUPS.map(([key, en, ar]) => ({
    key, en, ar, pieces: inMonth.filter(r => groupsOf(r).includes(key)).length,
  }));
  return {
    month, logged: n,
    womenSubject, womenSubjectShare: share(womenSubject),
    womenMentioned, womenMentionedShare: share(womenMentioned),
    womenExperts, womenExpertsShare: share(womenExperts),
    menExperts, menExpertsShare: share(menExperts),
    groups,
    groupsCovered: groups.filter(g => g.pieces > 0).length,
    /** The months present in the data, newest first — what the panel offers to look at. */
    noneLogged: n === 0,
  };
}

export const monthsLogged = (rows: MonthRow[]): string[] =>
  [...new Set(rows.map(r => String(r.loggedOn || "").slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();

/** §4.3: a major local issue is planned as a package of angles, each with the format that suits it. */
export const PACKAGE_ANGLES: [key: string, en: string, ar: string][] = [
  ["officials", "Officials", "المسؤولون"],
  ["affected", "The people affected", "المتأثرون"],
  ["experts", "Experts", "الخبراء"],
  ["solutions", "Those working on solutions", "العاملون على الحلول"],
];
