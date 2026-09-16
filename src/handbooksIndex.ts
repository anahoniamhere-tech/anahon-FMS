/**
 * The Policies Index, read as data.
 *
 * AnaHon's policies live in five documents (four handbooks + Strategy) plus Policy P11,
 * which stands on its own. Since 16 Sep 2026 they are numbered P1–P11; FORMER maps the old
 * three-digit numbers (still printed on older contracts and files) to the new ones. The Index document is itself the single source for which
 * policy numbers exist and which handbook carries each one — this file parses its real
 * text, so the numbering here can never drift from what the Index says. Nothing here
 * decides whether a document still governs; that is `isSupersededPointer` (helpBot.ts),
 * used exactly as the help bot uses it.
 */

export type Chapter = { no: string; title: string; note: string };
export type HandbookGroup = { heading: string; chapters: Chapter[] };
export type ParsedIndex = {
  handbooks: HandbookGroup[];
  standalone: Chapter[];
  numbersNotInUse: string;
  stillToSettle: string[];
};

const BULLET = /^•\s*/;
const CHAPTER_LINE = /^(P\d{1,2})\s+(.+)$/;

/** Old three-digit numbers → P-numbers (renumbered 16 Sep 2026), including policies merged away. */
export const FORMER: Record<string, string> = {
  "001": "P1", "013": "P1", "023": "P1",
  "006": "P2", "004": "P2", "015": "P2", "016": "P2",
  "002": "P3", "021": "P3", "022": "P3",
  "005": "P4",
  "020": "P5", "003": "P5",
  "012": "P6", "009": "P6",
  "017": "P7",
  "018": "P8", "019": "P8",
  "011": "P9", "008": "P9",
  "007": "P10",
  "010": "P11", "024": "P11",
};

/** "P5", "p5", "020" → "P5"; anything else is returned as written. */
export const policyNo = (raw: string): string => {
  const s = String(raw || "").trim();
  if (/^p\d{1,2}$/i.test(s)) return s.toUpperCase();
  return FORMER[s] ?? s;
};

const splitFirst = (s: string, sep: string): [string, string] => {
  const i = s.indexOf(sep);
  return i === -1 ? [s.trim(), ""] : [s.slice(0, i).trim(), s.slice(i + sep.length).trim()];
};

/** One bulleted Index line, which may hold several "·"-separated chapters. */
function bulletChapters(line: string): Chapter[] {
  if (!BULLET.test(line)) return [];
  return line.replace(BULLET, "").split("·")
    .map(part => CHAPTER_LINE.exec(part.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => { const [title, note] = splitFirst(m[2], " — "); return { no: m[1], title, note }; });
}

/** Parse the Index document's own extracted text into its sections. */
export function parseHandbooksIndex(text: string): ParsedIndex {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const handbooks: HandbookGroup[] = [];
  const standalone: Chapter[] = [];
  const stillToSettle: string[] = [];
  let numbersNotInUse = "";
  let section: "handbook" | "standalone" | "numbers" | "settle" | null = null;
  let current: HandbookGroup | null = null;

  for (const line of lines) {
    const heading = /^\d\.\s+(.+)$/.exec(line);
    if (heading) { current = { heading: heading[1], chapters: [] }; handbooks.push(current); section = "handbook"; continue; }
    if (line === "Standing on its own") { section = "standalone"; current = null; continue; }
    if (line === "Numbers not in use") { section = "numbers"; current = null; continue; }
    if (line === "Still to settle") { section = "settle"; current = null; continue; }

    if (section === "handbook" && current) current.chapters.push(...bulletChapters(line));
    else if (section === "standalone") standalone.push(...bulletChapters(line));
    else if (section === "numbers") numbersNotInUse = numbersNotInUse ? `${numbersNotInUse} ${line}` : line;
    else if (section === "settle" && BULLET.test(line)) stillToSettle.push(line.replace(BULLET, "").trim());
  }

  return { handbooks, standalone, numbersNotInUse, stillToSettle };
}

/** A real fault, not a guess — a number the Index itself uses twice. */
export function findIndexFaults(parsed: ParsedIndex): string[] {
  const seen = new Map<string, string>();
  const faults: string[] = [];
  const all = [
    ...parsed.handbooks.flatMap(h => h.chapters.map(c => ({ ...c, where: h.heading }))),
    ...parsed.standalone.map(c => ({ ...c, where: "Standing on its own" })),
  ];
  for (const c of all) {
    if (seen.has(c.no)) faults.push(`Policy ${c.no} is listed twice: in ${seen.get(c.no)} and in ${c.where}.`);
    else seen.set(c.no, c.where);
  }
  return faults;
}

/**
 * Where a handbook's own compiled text splits into chapters — "Part One — <Title>
 * (Policy P5, formerly 020)". A single-chapter document (Strategy, Policy P11) carries no
 * "Part" heading;
 * callers treat an empty anchor map as "the whole document is the one chapter."
 */
const CHAPTER_HEADING = /^Part\s+\S+\s+—\s+.+\(.*?Policy\s+(P\d{1,2})\b.*?\)\s*$/;

export function chapterAnchors(text: string): Record<string, number> {
  const anchors: Record<string, number> = {};
  text.split("\n").forEach((raw, i) => {
    const m = CHAPTER_HEADING.exec(raw.trim());
    if (m) anchors[m[1]] = i;
  });
  return anchors;
}

/** The lines belonging to one chapter — from its heading to the next one, or the end. */
export function chapterSlice(text: string, no: string, anchors: Record<string, number>): string {
  const lines = text.split("\n");
  const ordered = Object.entries(anchors).sort((a, b) => a[1] - b[1]);
  const at = ordered.findIndex(([n]) => n === no);
  if (at === -1) return text.trim();
  const start = ordered[at][1];
  const end = at + 1 < ordered.length ? ordered[at + 1][1] : lines.length;
  return lines.slice(start, end).join("\n").trim();
}

/**
 * Chapters the Index promises for a handbook that its own compiled text does not carry
 * — a real fault, found by reading the document, not guessed from a filename. A
 * single-chapter document (no "Part N —" heading at all, e.g. Strategy) is not checked
 * this way: its whole text is the one chapter, by construction.
 */
export function missingChapterText(chapters: Chapter[], anchors: Record<string, number>): Chapter[] {
  if (Object.keys(anchors).length === 0) return [];
  return chapters.filter(c => !(c.no in anchors));
}

/**
 * Where the system enforces a policy, as door navKeys — the links the reader follows
 * out of a chapter. Deliberately small: only the numbers the room named, not a guess at
 * every policy's enforcement. scripts/check-handbooks.ts fails if a door here stops
 * existing in nav.tsx.
 */
export const POLICY_DOORS: Record<string, string[]> = {
  "P3": ["editorial"],
  "P4": ["editorial"],
  "P5": ["procurement", "expenses"],
  "P7": ["assets"],
  "P11": ["compliance"],
  "P2": ["payroll"],
};

export function checkPolicyDoors(existingNavKeys: readonly string[]): string[] {
  const problems: string[] = [];
  for (const [no, doors] of Object.entries(POLICY_DOORS))
    for (const d of doors) if (!existingNavKeys.includes(d)) problems.push(`Policy ${no} names door "${d}", which no longer exists.`);
  return problems;
}

/**
 * Which chapter an old file belongs to, for the History list — read from its own note
 * first ("…Policy 010 is now…", mapped through FORMER), since that is the fact a person wrote down about it;
 * the trailing number in its filename is only a fallback for the few notes that don't
 * name one.
 */
export function historyChapterOf(doc: { filename: string; note?: string | null }): string | null {
  const fromNote = /Policy\s+(P\d{1,2}|\d{3})\b/i.exec(doc.note || "");
  if (fromNote) return policyNo(fromNote[1]);
  const fromName = /(\d{3})(?:[^\d]*)$/.exec(doc.filename.replace(/\.\w+$/, ""));
  return fromName ? policyNo(fromName[1]) : null;
}
