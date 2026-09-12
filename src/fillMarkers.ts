/**
 * `[FILL: …]` markers — the draft's unfinished facts (12 Sep 2026).
 *
 * The draft step has no web access by design, so the model marks anything it cannot know as
 * `[FILL: the figure]` rather than inventing it. That is correct behaviour, but a marker rendered
 * as plain text makes a draft LOOK finished. This module is the one place the markers are parsed,
 * imported by BOTH `server.ts` (the research route) and the Newsroom screen — so the count an
 * editor sees is exactly the list the route would research, and the two cannot drift apart.
 *
 * A marker is not a gate. An item with none is not cleared for anything: Policy 005 still needs a
 * named fact-checker who is not the author, and research is not a fact-check.
 */

/** Built fresh on each call — a shared /g regex carries lastIndex between callers. */
const re = () => /\[FILL:\s*([^\]]+)\]/g;

/** The open facts in one piece of text, in the order they appear, de-duplicated. */
export function openFacts(text: string): string[] {
  return [...new Set(
    [...String(text || "").matchAll(re())].map(m => m[1].trim()).filter(Boolean)
  )];
}

/** Every open fact on an item — its brief plus every draft, which is what the route reads. */
export function itemOpenFacts(item: { brief?: string; drafts?: { text?: string }[] } | null): string[] {
  if (!item) return [];
  return openFacts([item.brief || "", ...(item.drafts || []).map(d => d?.text || "")].join("\n"));
}

/** Text split into runs: plain prose, and the markers between them, in order.
 *  On a marker run, `text` is the label alone — the brackets are the notation, not the content. */
export type Run = { fill: boolean; text: string };
export function splitFill(text: string): Run[] {
  const out: Run[] = [];
  const s = String(text || "");
  let last = 0;
  for (const m of s.matchAll(re())) {
    const at = m.index ?? 0;
    if (at > last) out.push({ fill: false, text: s.slice(last, at) });
    out.push({ fill: true, text: m[1].trim() });
    last = at + m[0].length;
  }
  if (last < s.length) out.push({ fill: false, text: s.slice(last) });
  return out;
}
