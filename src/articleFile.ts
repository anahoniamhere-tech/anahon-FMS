/**
 * An article on the website is a Markdown file with YAML front matter. This module reads and
 * rewrites one (Newsroom, 22 Sep 2026) for the master article editor — the screen that manages
 * pieces already on the site, as opposed to the Editorial chain that produces new ones.
 *
 * Two rules it exists to keep:
 *
 * 1. **Nothing is silently dropped.** The file is kept as a list of front-matter lines in their
 *    original order, and a save rewrites only the keys it was given. A key this system does not
 *    know — `translation`, or anything added later — survives untouched instead of disappearing
 *    because a writer forgot it. The route refuses an unknown key out loud (EDITABLE).
 * 2. **Changing what a reader saw is not metadata.** `TEXT_FIELDS` are the ones whose change alters
 *    the piece a reader already read; P3 §8 then requires a dated correction saying what was wrong
 *    and what is right. `needsCorrection()` decides that, and the route enforces it.
 *
 * No YAML library: the front matter here is flat scalars plus one string list, and a parser that
 * preserves unknown lines verbatim is safer for this job than one that re-serialises the whole file.
 */

/** Fields the master editor may write. Anything else is refused rather than quietly ignored. */
export const EDITABLE = [
  "title", "description", "date", "author", "slug", "tags", "category", "cover",
  "translation", "articleType", "contentLabel", "sponsorDisclosure", "updated",
] as const;

/** Changing one of these changes the piece a reader already read (P3 §8). "body" is the text itself. */
export const TEXT_FIELDS = ["title", "body"] as const;

export const ARTICLE_TYPES = ["news", "investigation", "analysis", "report", "opinion", "interview"] as const;

export type Article = {
  /** front-matter lines in file order: a known `key` with its raw value, or a line kept verbatim. */
  lines: { key: string; raw: string }[];
  body: string;
  /** "" when the file has no front matter at all — which is a file this editor must not rewrite. */
  fence: string;
};

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*):\s?(.*)$/;

export function parseArticle(text: string): Article {
  const s = String(text || "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(s);
  if (!m) return { lines: [], body: s, fence: "" };
  const lines: { key: string; raw: string }[] = [];
  for (const line of m[1].split(/\r?\n/)) {
    const k = KEY_LINE.exec(line);
    // A continuation or comment line has no key; it is carried through as-is.
    lines.push(k ? { key: k[1], raw: k[2] } : { key: "", raw: line });
  }
  return { lines, body: s.slice(m[0].length), fence: m[0] };
}

/** A front-matter scalar as a plain string: quotes off, nothing else interpreted. */
export function unquote(raw: string): string {
  const v = String(raw ?? "").trim();
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) { try { return JSON.parse(v.replace(/^'|'$/g, '"')); } catch { return v.slice(1, -1); } }
  return v;
}

export function field(a: Article, key: string): string {
  return unquote(a.lines.find(l => l.key === key)?.raw ?? "");
}

/** `tags: ["a", "b"]` → ["a","b"]; an absent or empty list → []. */
export function tagsOf(a: Article): string[] {
  const raw = (a.lines.find(l => l.key === "tags")?.raw ?? "").trim();
  if (!raw || raw === "[]") return [];
  const inner = /^\[(.*)\]$/.exec(raw);
  if (!inner) return [];
  return inner[1].split(",").map(t => unquote(t)).filter(Boolean);
}

const encode = (key: string, value: string | string[]): string =>
  key === "tags"
    ? `[${(Array.isArray(value) ? value : [value]).filter(Boolean).map(v => JSON.stringify(String(v))).join(", ")}]`
    // A date stays bare (Astro coerces it); everything else is quoted, so a colon or a # in a
    // title cannot break the document.
    : key === "date" || key === "updated" ? String(value) : JSON.stringify(String(value));

/**
 * The file with `updates` applied: a key already present is rewritten in place, a new one is added
 * at the end of the front matter, and every other line — known or not — is left exactly as it was.
 * A value of `null` removes the key.
 */
export function writeArticle(text: string, updates: Record<string, string | string[] | null>, body?: string): string {
  const a = parseArticle(text);
  if (!a.fence) throw new Error("That file has no front matter — it is not an article this editor writes.");
  const seen = new Set<string>();
  const out = a.lines
    .filter(l => !(l.key && updates[l.key] === null))
    .map(l => {
      if (!l.key || !(l.key in updates)) return l;
      seen.add(l.key);
      return { key: l.key, raw: encode(l.key, updates[l.key] as string | string[]) };
    });
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || seen.has(k)) continue;
    out.push({ key: k, raw: encode(k, v) });
  }
  const fm = out.map(l => (l.key ? `${l.key}: ${l.raw}` : l.raw)).join("\n");
  return `---\n${fm}\n---\n${body === undefined ? a.body : body}`;
}

/** Which submitted fields change what a reader already read — "" when none do. */
export function changedText(
  before: { title: string; body: string },
  after: { title?: string; body?: string }
): string[] {
  const out: string[] = [];
  if (after.title !== undefined && after.title.trim() !== before.title.trim()) out.push("title");
  if (after.body !== undefined && after.body.trim() !== before.body.trim()) out.push("body");
  return out;
}

/**
 * P3 §8: an error is corrected "in a place and manner as prominent as the original", the correction
 * says what was wrong and what is right, and it stays on the record permanently with its date.
 * Retyping a headline or the text of a published piece is exactly that; reclassifying it is not.
 * Returns the refusal, or "" when the save may go ahead.
 */
export function correctionBlocker(changed: string[], note: string): string {
  if (!changed.length) return "";
  return String(note || "").trim().length >= 10
    ? ""
    : `Changing the ${changed.join(" and ")} of a published article changes what a reader already read. Say in one line what was wrong and what is right — it is kept with its date and shown on the article (Policy P3 §8).`;
}
