// Presentation rules for the policy reading view (HandbooksTab): which icon a section
// title or "At a glance" line gets, which lines read as a warning, and which words are
// marked as an amount or a deadline. Plain text in, a key or ranges out — no React, so
// scripts/check-policy-reading.ts can prove the rules against the real wording.
//
// Built 16 Sep 2026 against all 88 numbered section titles and all 43 "At a glance"
// lines of the live handbooks. Conservative by instruction ("when unsure, don't style"):
// anything no rule matches gets the neutral "general" icon, and a line is only a warning
// when it STARTS with the word.

export type Topic =
  | "ai" | "concern" | "alert" | "correction" | "diligence" | "gift" | "integrity" | "safety"
  | "privacy" | "data" | "training" | "approval" | "travel" | "time" | "reporting" | "records"
  | "equipment" | "people" | "money" | "editorial" | "review" | "general";

// First match wins, so the order matters: "Financial Reporting" is reporting before money,
// "People are chosen, paid…" is people before money, "Anti-Fraud … Conflict of Interest"
// is an alert before integrity, "fact-checked … and approved" is editorial before approval,
// "Figures come from … the management system" is reporting before data.
const RULES: [Topic, RegExp][] = [
  ["ai", /\bAI\b|\bartificial intelligence\b/i],
  ["editorial", /\bfact-check\w*/i],
  ["concern", /\b(concerns?|whistleblow\w*|disagreements?|worr(ied|ying))\b/i],
  ["alert", /\b(fraud|corruption|breach(es)?|incidents?|warning signs|theft|loss|lost)\b/i],
  ["correction", /\b(corrections?|corrected|mistakes?)\b/i],
  ["diligence", /\b(due diligence|know who you deal)\b/i],
  ["gift", /\b(gifts?|hospitality)\b/i],
  ["integrity", /\b(conflicts? of interest|personal interest|independence|bribe\w*|kickbacks?)\b/i],
  ["safety", /\b(safe|safety|safeguarding|wellbeing|dangerous|risks?)\b/i],
  ["privacy", /\b(privacy|confidential\w*|sensitive|protected source|protect a source|access|devices?)\b/i],
  ["reporting", /\b(reports?|reporting|indicators?|monitoring|figures)\b/i],
  ["data", /\b(data|information|backing up|system|sharing)\b/i],
  ["training", /\b(training|learning)\b/i],
  ["approval", /\b(approv\w*|authoris\w*|signator\w*|segregation|separation of duties)\b/i],
  ["travel", /\btravel\b/i],
  ["time", /\b(time off|timesheets?|working arrangements|work where)\b/i],
  ["records", /\b(records?|recorded|register|documentation|retention|chart of accounts)\b/i],
  ["equipment", /\b(equipment|assets?|custody|maintenance|repair|disposal|receiving|verification)\b/i],
  ["people", /\b(people|performance|recruit\w*|selection|joining|personnel|engage\w*|employee|diversity|inclusion|communit(y|ies)|suppliers|donors and supporters|responsibilities)\b/i],
  ["money", /\b(money|cash|bank|fees?|payment|paying|paid|currency|exchange|costs?|funds?|grants?|income|budget|accounting|per diem|financ\w*|procurement|contracting|depreciation)\b/i],
  ["editorial", /\b(journalism|content|publication|publish\w*|stor(y|ies)|news|piece|sources?)\b/i],
  ["review", /\b(review\w*|audit|compliance)\b/i],
];

export const topicOf = (text: string): Topic => RULES.find(([, re]) => re.test(text))?.[0] ?? "general";

/** "Must …", "Never …", "Do not …", "Only …" at the very start of a line. */
export const isWarningLine = (text: string) => /^(Must|Never|Do not|Only)\b/.test(text.trim());

// Amounts: a currency code next to a figure ("USD 1,000", "300 EUR"). Deadlines: "within
// 5 working days", "within seven days", "within 30 to 60 days", "by the last working day
// of the month". Frequencies ("monthly", "the same day") are left alone on purpose.
const N = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|sixty|ninety)";
// The Arabic twins (16 Sep 2026) write the same facts as «1,000 دولار», «خلال 5 أيام عمل»,
// «خلال سبعة أيام», «في آخر يوم عمل من الشهر». JS \b is ASCII-only, so Arabic words are
// bounded with a lookbehind on the Arabic block instead.
const NA = "(?:\\d+|سبعة|ثلاثة|خمسة|عشرة|خمسة عشر|ثلاثين|ستين)";
const NOT_AR = "(?<![\\u0621-\\u064A])";
const MARK = new RegExp(
  "\\b(?:USD|EUR|LBP)\\s?\\d[\\d,]*(?:\\.\\d+)?\\b" +
  "|\\b\\d[\\d,]*(?:\\.\\d+)?\\s?(?:دولار(?:اً)?|يورو)(?![\\u0621-\\u064A])" +
  `|${NOT_AR}خلال ${NA}(?: إلى ${NA})? (?:أيام|يوم|يوماً|أسابيع|أسبوع|أشهر|شهر|شهراً)(?: عمل)?(?![\\u0621-\\u064A])` +
  `|${NOT_AR}(?:في|بحلول) (?:آخر|أول) يوم عمل من (?:الشهر|كل شهر)(?![\\u0621-\\u064A])` +
  "|\\b\\d[\\d,]*(?:\\.\\d+)?\\s?(?:USD|EUR|LBP)\\b" +
  `|\\bwithin ${N}(?: to ${N})? (?:working |calendar |business )?(?:days?|hours?|weeks?|months?)\\b` +
  "|\\bby the (?:last|first|\\d+(?:st|nd|rd|th)?) (?:working )?day of (?:the|each) month\\b",
  "gi",
);

/** A cross-reference: "P5 §0.3" → { policy: "P5", sec: "0.3" }; a bare "§6.3" has no policy
 *  (it means the policy being read); "(P7)" or "Policy P6" has no section. */
export type Ref = { policy?: string; sec?: string };
export type Piece = { text: string; mark: false | "fact" | "find" | "role" | "ref"; ref?: Ref };

/** Shortest search that filters and highlights; one letter would match nearly everything. */
export const MIN_FIND = 2;
// Arabic is searched without its short vowels and tatweel: the twins are voweled («يُقيَّد»),
// a reader types «يقيد». Dropping them changes length, so splitFind keeps an index map.
const MARKS_AR = /[\u064B-\u065F\u0670\u0640]/g;
const fold = (s: string) => s.toLowerCase().replace(MARKS_AR, "");
const findKey = (find: string) => fold(find.trim());
export const isFinding = (find: string) => findKey(find).length >= MIN_FIND;
export const mentions = (text: string, find: string) => fold(text).includes(findKey(find));

// Plain indexOf, never a RegExp built from what the reader typed. toLowerCase keeps length
// for the English (and caseless Arabic) text these documents hold.
const splitFind = (p: Piece, q: string): Piece[] => {
  const out: Piece[] = [];
  const src = p.text.toLowerCase();
  let low = "";
  const orig: number[] = [];               // orig[k] = index in p.text of folded char k
  for (let k = 0; k < src.length; k++) if (!/[\u064B-\u065F\u0670\u0640]/.test(src[k])) { orig.push(k); low += src[k]; }
  orig.push(src.length);
  let at = 0;
  for (let f = low.indexOf(q), from = 0; f !== -1; f = low.indexOf(q, from)) {
    const i = orig[f];
    // A hit ends after any vowel marks that sit on its last letter.
    let end = orig[f + q.length - 1] + 1;
    while (end < src.length && /[\u064B-\u065F\u0670]/.test(src[end])) end++;
    if (i > at) out.push({ text: p.text.slice(at, i), mark: p.mark });
    out.push({ text: p.text.slice(i, end), mark: "find" });
    at = end;
    from = f + q.length;
  }
  if (at < p.text.length) out.push({ text: p.text.slice(at), mark: p.mark });
  return out;
};

// "P5 §0.3", "Policy P6", "(P7)", "§6.3" — the forms the handbooks use (17 spellings counted,
// all reduce to these). A section number never swallows a sentence's closing full stop.
// Arabic: «السياسة P5، البند 4.3», «(P5، البند 6.8)», «البند 6».
const REF = /(?:\bPolicy\s|(?<![\u0621-\u064A])السياسة\s)?\bP(\d{1,2})(?:(?:\s§\s?|،\s?البند\s)(\d+(?:\.\d+)*))?\b|(?:§\s?|(?<![\u0621-\u064A])البند\s)(\d+(?:\.\d+)*)/g;
const splitRefs = (p: Piece): Piece[] => {
  if (p.mark) return [p];
  const out: Piece[] = [];
  let at = 0;
  for (const m of p.text.matchAll(REF)) {
    // A quoted sample of how to cite ('"§7.2"' in P5 §0) is talking about references, not making one.
    if (/["“'‘«]/.test(p.text[m.index! - 1] ?? "")) continue;
    if (m.index! > at) out.push({ text: p.text.slice(at, m.index), mark: false });
    out.push({ text: m[0], mark: "ref", ref: m[1] ? { policy: `P${m[1]}`, sec: m[2] } : { sec: m[3] } });
    at = m.index! + m[0].length;
  }
  if (at < p.text.length) out.push({ text: p.text.slice(at), mark: false });
  return out;
};

/** The text cut into plain, "fact" (amount/deadline) and "find" (the reader's search) pieces,
 *  in order; joining them gives the text back. A search hit inside a fact wins that stretch. */
export const markPieces = (text: string, find = "", roles: Record<string, string> = {}): Piece[] => {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index! > at) out.push({ text: text.slice(at, m.index), mark: false });
    out.push({ text: m[0], mark: "fact" });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  const found = (isFinding(find) ? out.flatMap(p => splitFind(p, findKey(find))) : out).flatMap(splitRefs);
  const abbrs = Object.keys(roles);
  if (!abbrs.length) return found;
  // Keys come from roleDefs (2–4 capital letters), so they are safe inside a pattern.
  const re = new RegExp(`\\b(?:${abbrs.join("|")})\\b`, "g");
  return found.flatMap(p => {
    if (p.mark) return [p];
    const parts: Piece[] = [];
    let at = 0;
    for (const m of p.text.matchAll(re)) {
      if (m.index! > at) parts.push({ text: p.text.slice(at, m.index), mark: false });
      parts.push({ text: m[0], mark: "role" });
      at = m.index! + m[0].length;
    }
    if (at < p.text.length) parts.push({ text: p.text.slice(at), mark: false });
    return parts;
  });
};

/** "… a decision you take. Examples: engaging a relative, …" → the sentence before, and the
 *  example from its marker on. Only a capitalised marker at a sentence start ("Examples:",
 *  "Example:", "For example,") — a lower-case "for example" mid-sentence stays in place. */
export const splitExample = (text: string): { before: string; example: string } | null => {
  const m = /(^|[.;:!?؛]\s+)(Examples?:|For example,|أمثلة:|مثال:|على سبيل المثال،)/.exec(text);
  if (!m) return null;
  const at = m.index + m[1].length;
  return { before: text.slice(0, at).trimEnd(), example: text.slice(at) };
};

/** The first deadline in a line ("within 5 working days", "by the last working day of the
 *  month"), for a step's time chip. Amounts are not deadlines. */
export const deadlineIn = (text: string): string | null =>
  markPieces(text).find(p => p.mark === "fact" && /^(within|by the|خلال|في آخر|في أول|بحلول)/i.test(p.text))?.text ?? null;

/** "Custodian and float: the Finance Officer holds …" → label + detail. A capitalised lead of
 *  at most six words before a colon, with text after it; "Never paid from the float:" (a list
 *  lead-in, nothing after) is not one. 98 of the 644 real bullets have this shape. */
export const splitLabel = (text: string): { label: string; detail: string } | null => {
  const m = /^([A-Z\u0621-\u064A][^:.;؛]{1,40}):\s+(\S.*)$/.exec(text.trim());
  if (!m || m[1].trim().split(/\s+/).length > 6) return null;
  return { label: m[1].trim(), detail: m[2] };
};

/** The anchor a section number lands on in the reading view: "6.3" → "sec-6-3". */
export const secId = (sec: string) => `sec-${sec.replace(/\./g, "-")}`;

/** The seats a handbook defines for itself — '"Executive Director" (ED)' — as ED → title.
 *  Read from the document, so a new seat (P11's "Digital Officer" (DO)) needs no code. */
export const roleDefs = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/"([A-Z][A-Za-z]+(?: [A-Za-z]+){0,4})" \(([A-Z]{2,4})\)/g)) out[m[2]] ??= m[1];
  return out;
};

/** Which defined seats a stretch of text names, by abbreviation or full title, in definition order. */
export const rolesIn = (text: string, defs: Record<string, string>): string[] =>
  Object.entries(defs).filter(([a, full]) => new RegExp(`\\b${a}\\b`).test(text) || text.includes(full)).map(([a]) => a);

/** A section's key numbers — its amounts and deadlines — for tiles at the top. The caption is
 *  only ever the document's own words: the line's "Label:" if it has one, otherwise the title
 *  of the (sub)section it sits in. Each tile lands on that (sub)section. First `max`, no repeats. */
export const keyFacts = (lines: { text: string; at: { id: string; title: string } }[], max = 6) => {
  const out: { fact: string; caption: string; id: string }[] = [];
  for (const { text, at } of lines) {
    for (const p of markPieces(text)) {
      if (p.mark !== "fact") continue;
      const caption = splitLabel(text)?.label ?? at.title;
      if (out.some(f => f.fact === p.text && f.caption === caption)) continue;
      out.push({ fact: p.text, caption, id: at.id });
      if (out.length === max) return out;
    }
  }
  return out;
};

/** "At a glance" in either language. */
export const isGlanceLabel = (label: string) => /^(at a glance|لمحة سريعة)$/i.test(label.trim());

/** Chapter headings of an Arabic twin: «الجزء الأول — مدوّنة السلوك والنزاهة (السياسة P1)» → P1 at
 *  that line, and the Arabic title. The English ones are read by handbooksIndex.chapterAnchors. */
const AR_CHAPTER = /^الجزء\s+\S+\s+—\s+(.+?)\s*\(السياسة\s+(P\d{1,2})\b.*?\)\s*$/;
export const arabicChapters = (text: string) => {
  const anchors: Record<string, number> = {};
  const titles: Record<string, string> = {};
  text.split("\n").forEach((raw, i) => {
    const m = AR_CHAPTER.exec(raw.trim());
    if (m) { anchors[m[2]] = i; titles[m[2]] = m[1]; }
  });
  return { anchors, titles };
};

/** Which text governs, read from a twin's own status line (plan §1): the current «… يُعمل بالنص
 *  الإنكليزي …», the draft «… يبقى النص الإنكليزي هو النص النافذ», or, once approved, «… والنص
 *  العربي هو النص الملزم …». The line itself is returned so the view can show it as written. */
export const governingLine = (text: string): { line: string; governs: "en" | "ar" } | null => {
  for (const raw of text.split("\n").slice(0, 8)) {
    const line = raw.trim();
    if (/يُعمل بالنص العربي|النص العربي هو النص الملزم/.test(line)) return { line, governs: "ar" };
    if (/يُعمل بالنص الإنكليزي|النص الإنكليزي هو النص النافذ/.test(line)) return { line, governs: "en" };
  }
  return null;
};
