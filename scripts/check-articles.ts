// The master article editor: the file parser and the P3 §8 correction rule.
// Run: npx tsx scripts/check-articles.ts
import assert from "node:assert";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parseArticle, writeArticle, field, tagsOf, listOf, changedText, correctionBlocker, EDITABLE, TEXT_FIELDS } from "../src/articleFile";

const SAMPLE = `---
title: "A title: with a colon"
date: 2024-09-02
lang: en
slug: "a-slug"
translation: "counterpart-slug"
---
The body.
`;

// --- reading
const a = parseArticle(SAMPLE);
assert.strictEqual(field(a, "title"), "A title: with a colon", "a quoted title with a colon reads whole");
assert.strictEqual(field(a, "date"), "2024-09-02");
assert.strictEqual(field(a, "missing"), "", "an absent key is empty, not a crash");
assert.strictEqual(a.body, "The body.\n");
assert.deepStrictEqual(parseArticle("no front matter").lines, [], "a file with no front matter parses to nothing");
assert.strictEqual(parseArticle("").body, "");

// --- the rule this module exists for: an unknown key SURVIVES a save
const saved = writeArticle(SAMPLE, { category: "Media", tags: ["a", "b"] });
assert.match(saved, /translation: "counterpart-slug"/, "a key the editor does not know is untouched, never dropped");
assert.match(saved, /category: "Media"/, "a new key is added");
assert.deepStrictEqual(tagsOf(parseArticle(saved)), ["a", "b"], "tags round-trip");
assert.strictEqual(parseArticle(saved).body, "The body.\n", "the body is untouched when only fields change");
assert.match(writeArticle(SAMPLE, { date: "2025-01-02" }), /^date: 2025-01-02$/m, "a date stays bare for Astro to coerce");
assert.match(writeArticle(SAMPLE, { title: 'He said "hi": ok' }), /^title: "He said \\"hi\\": ok"$/m, "a quote or colon in a title cannot break the document");
assert.ok(!/translation/.test(writeArticle(SAMPLE, { translation: null })), "null removes a key");
assert.strictEqual(parseArticle(writeArticle(SAMPLE, {}, "New body.\n")).body, "New body.\n", "the body can be replaced");
assert.deepStrictEqual(tagsOf(parseArticle(writeArticle(SAMPLE, { tags: [] }))), [], "an empty tag list is written and read back");
assert.throws(() => writeArticle("no front matter", { title: "x" }), /no front matter/, "a file that is not an article is refused, not rewritten");
// Order is preserved, so a diff of the file stays readable.
assert.deepStrictEqual(parseArticle(writeArticle(SAMPLE, { title: "New" })).lines.map(l => l.key),
  ["title", "date", "lang", "slug", "translation"], "keys keep their order");

// --- P3 §8: metadata is free, changing what a reader read is not
const before = { title: "T", body: "B" };
assert.deepStrictEqual(changedText(before, { title: "T", body: "B" }), [], "no change, nothing to declare");
assert.deepStrictEqual(changedText(before, { title: "T " }), [], "whitespace alone is not a change");
assert.deepStrictEqual(changedText(before, { title: "T2" }), ["title"]);
assert.deepStrictEqual(changedText(before, { body: "B2" }), ["body"]);
assert.deepStrictEqual(changedText(before, { title: "T2", body: "B2" }), ["title", "body"]);
assert.strictEqual(correctionBlocker([], ""), "", "reclassifying needs no correction note");
assert.match(correctionBlocker(["body"], ""), /what was wrong and what is right/, "a body edit must say what was wrong");
assert.match(correctionBlocker(["body"], "typo"), /Policy P3/, "a token word is not a correction");
assert.strictEqual(correctionBlocker(["title"], "The mayor was named wrongly; it is Ali Hassan."), "", "a real correction passes");
assert.deepStrictEqual([...TEXT_FIELDS], ["title", "body"]);
for (const f of ["articleType", "category", "tags", "contentLabel"]) assert.ok((EDITABLE as readonly string[]).includes(f), `${f} is editable`);
for (const f of ["fmsId", "lang"]) assert.ok(!(EDITABLE as readonly string[]).includes(f), `${f} is not something this screen rewrites`);

// --- against the real files on disk, which is what the screen will list
const root = new URL("../../website/src/content/articles/", import.meta.url);
if (existsSync(root)) {
  let n = 0;
  for (const lang of ["en", "ar"]) {
    const dir = new URL(`${lang}/`, root);
    for (const f of readdirSync(dir).filter(x => x.endsWith(".md"))) {
      const text = readFileSync(new URL(f, dir), "utf8");
      const parsed = parseArticle(text);
      assert.ok(parsed.fence, `${lang}/${f} has front matter`);
      assert.ok(field(parsed, "title"), `${lang}/${f} has a title the list can show`);
      assert.ok(field(parsed, "slug"), `${lang}/${f} has a slug`);
      // The real point: reading and writing a live article back unchanged must not alter one byte.
      assert.strictEqual(writeArticle(text, {}), text, `${lang}/${f} survives a no-op save byte for byte`);
      n++;
    }
  }
  assert.ok(n >= 14, `all ${n} live articles checked`);
  console.log(`check-articles: ${n} live article files round-trip unchanged`);
}
// --- corrections are a LIST, because P4 wants "a public record of ALL corrections made, including
// the date and details" — one page across every article, which a growing single string cannot feed.
const c1 = writeArticle(SAMPLE, { corrections: ["2026-09-22: Was Ali; is Ali Hassan."] });
assert.deepStrictEqual(listOf(parseArticle(c1), "corrections"), ["2026-09-22: Was Ali; is Ali Hassan."]);
const c2 = writeArticle(c1, { corrections: [...listOf(parseArticle(c1), "corrections"), "2026-09-23: Second one."] });
assert.deepStrictEqual(listOf(parseArticle(c2), "corrections").length, 2, "a later correction is appended, never overwritten (P3 §8 permanence)");
assert.match(listOf(parseArticle(c2), "corrections")[0], /^2026-09-22: /, "each entry carries its own date");
// A comma inside the text must not split the entry — the obvious way this breaks.
const c3 = writeArticle(SAMPLE, { corrections: ["2026-09-22: Was 3,000; is 2,500."] });
assert.deepStrictEqual(listOf(parseArticle(c3), "corrections"), ["2026-09-22: Was 3,000; is 2,500."], "a comma inside a correction survives");
assert.deepStrictEqual(tagsOf(parseArticle(writeArticle(SAMPLE, { tags: ["a, b", "c"] }))), ["a, b", "c"], "…and inside a tag");
assert.ok(!(EDITABLE as readonly string[]).includes("corrections"), "the screen never submits corrections; the server writes them");

console.log("check-articles: all asserts passed");
