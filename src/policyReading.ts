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
const MARK = new RegExp(
  "\\b(?:USD|EUR|LBP)\\s?\\d[\\d,]*(?:\\.\\d+)?\\b" +
  "|\\b\\d[\\d,]*(?:\\.\\d+)?\\s?(?:USD|EUR|LBP)\\b" +
  `|\\bwithin ${N}(?: to ${N})? (?:working |calendar |business )?(?:days?|hours?|weeks?|months?)\\b` +
  "|\\bby the (?:last|first|\\d+(?:st|nd|rd|th)?) (?:working )?day of (?:the|each) month\\b",
  "gi",
);

export type Piece = { text: string; mark: false | "fact" | "find" };

/** Shortest search that filters and highlights; one letter would match nearly everything. */
export const MIN_FIND = 2;
const findKey = (find: string) => find.trim().toLowerCase();
export const isFinding = (find: string) => findKey(find).length >= MIN_FIND;
export const mentions = (text: string, find: string) => text.toLowerCase().includes(findKey(find));

// Plain indexOf, never a RegExp built from what the reader typed. toLowerCase keeps length
// for the English (and caseless Arabic) text these documents hold.
const splitFind = (p: Piece, q: string): Piece[] => {
  const out: Piece[] = [];
  const low = p.text.toLowerCase();
  let at = 0;
  for (let i = low.indexOf(q); i !== -1; i = low.indexOf(q, at)) {
    if (i > at) out.push({ text: p.text.slice(at, i), mark: p.mark });
    out.push({ text: p.text.slice(i, i + q.length), mark: "find" });
    at = i + q.length;
  }
  if (at < p.text.length) out.push({ text: p.text.slice(at), mark: p.mark });
  return out;
};

/** The text cut into plain, "fact" (amount/deadline) and "find" (the reader's search) pieces,
 *  in order; joining them gives the text back. A search hit inside a fact wins that stretch. */
export const markPieces = (text: string, find = ""): Piece[] => {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index! > at) out.push({ text: text.slice(at, m.index), mark: false });
    out.push({ text: m[0], mark: "fact" });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  return isFinding(find) ? out.flatMap(p => splitFind(p, findKey(find))) : out;
};

/** "… a decision you take. Examples: engaging a relative, …" → the sentence before, and the
 *  example from its marker on. Only a capitalised marker at a sentence start ("Examples:",
 *  "Example:", "For example,") — a lower-case "for example" mid-sentence stays in place. */
export const splitExample = (text: string): { before: string; example: string } | null => {
  const m = /(^|[.;:!?]\s+)(Examples?:|For example,)/.exec(text);
  if (!m) return null;
  const at = m.index + m[1].length;
  return { before: text.slice(0, at).trimEnd(), example: text.slice(at) };
};
