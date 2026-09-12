// [FILL: …] markers — the parser the Newsroom counts with and the research route researches.
// Run: npx tsx scripts/check-fill.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { openFacts, itemOpenFacts, splitFill } from "../src/fillMarkers";

// --- parsing
assert.deepStrictEqual(openFacts("The port took [FILL: the tonnage] last year."), ["the tonnage"]);
assert.deepStrictEqual(openFacts("none here"), [], "no markers, no facts");
assert.deepStrictEqual(openFacts(""), []);
assert.deepStrictEqual(openFacts(null as any), [], "a missing draft is not a crash");
assert.deepStrictEqual(openFacts("[FILL: a] then [FILL: b]"), ["a", "b"], "order is kept");
assert.deepStrictEqual(openFacts("[FILL: a] and again [FILL:  a ]"), ["a"], "the same fact counts once");
assert.deepStrictEqual(openFacts("[FILL:]"), [], "an empty marker is not a fact");
assert.deepStrictEqual(openFacts("[FILL: عدد المشاركين]"), ["عدد المشاركين"], "Arabic labels survive");

// A shared /g regex carries lastIndex between callers — the classic way a count goes wrong on
// the second call. Same input must give the same answer every time.
const twice = "x [FILL: one] y [FILL: two]";
assert.deepStrictEqual(openFacts(twice), openFacts(twice), "no lastIndex leak between calls");

// --- the item view is brief + every draft, which is exactly what the route reads
assert.deepStrictEqual(
  itemOpenFacts({ brief: "b [FILL: from the brief]", drafts: [{ text: "d [FILL: from a draft]" }] }),
  ["from the brief", "from a draft"]);
assert.deepStrictEqual(itemOpenFacts(null), [], "no item, no facts");
assert.deepStrictEqual(itemOpenFacts({ brief: "clean", drafts: [] }), []);

// --- splitting for the chips: the runs must rebuild the original exactly
const src = "Before [FILL: the figure] after [FILL: the date] end.";
const runs = splitFill(src);
assert.strictEqual(runs.filter(r => r.fill).length, 2, "two chips");
assert.strictEqual(
  runs.map(r => r.fill ? `[FILL: ${r.text}]` : r.text).join(""), src,
  "the split is lossless — nothing of the draft is dropped on the way to the screen");
assert.strictEqual(splitFill("[FILL: only]").length, 1, "a marker with no prose around it");
assert.deepStrictEqual(splitFill(""), [], "empty text, no runs");

// --- the screen and the route must use this one parser, or the count drifts from what is researched
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
assert.ok(/import \{ itemOpenFacts \} from "\.\/src\/fillMarkers\.js"/.test(server),
  "the research route must import the shared parser");
const route = server.slice(server.indexOf('app.post("/api/content/research"'), server.indexOf('app.post("/api/content/draft-save"'));
assert.ok(/itemOpenFacts\(/.test(route), "…and use it for the fact list");
assert.ok(!/matchAll\(\/\\\[FILL/.test(route), "…with no second copy of the regex beside it");
assert.ok(/ANTHROPIC_API_KEY/.test(route) && /503/.test(route),
  "a missing research key must say which key, not fail as a generic 500");
// A key that is PRESENT but rejected is the case that actually happened on the NAS (12 Sep 2026):
// it surfaced as a raw upstream 401 blob, which reads as "the feature is broken".
assert.ok(/authentication_error|API key is invalid/.test(route) && /invalid or revoked/.test(route),
  "an upstream 401 must be translated into a plain sentence naming the key");
assert.ok(!/\$\{key\}|ANTHROPIC_API_KEY\s*\}/.test(route), "…and must never echo the key itself");

const tab = readFileSync(new URL("../src/tabs/EditorialTab.tsx", import.meta.url), "utf8");
assert.ok(/from "\.\.\/fillMarkers"/.test(tab), "the Newsroom counts with the same parser");
assert.ok(/<FillText text=\{d\.text\}/.test(tab), "a draft's body renders markers as chips");
assert.ok(/<FillText text=\{item\.brief\}/.test(tab), "…and so does the brief");
assert.ok(/<FillText dark/.test(tab), "…and the Idea Desk's draft preview");
assert.ok(/facts still to establish/.test(tab), "the count is stated, not just the markers drawn");
// Research is offered beside the facts, and only on a press.
assert.ok(/runResearch\(item, "sources"\)/.test(tab) && /runResearch\(item, "search"\)/.test(tab), "both modes offered");
assert.ok(/costs money each run/.test(tab), "open search says plainly that it bills per run");
assert.ok(!/useEffect[\s\S]{0,200}runResearch/.test(tab), "research never runs on its own");

// Research is not a fact-check: it must not write the log or the draft by itself.
assert.ok(!/runResearch[\s\S]{0,600}factcheck-log/.test(tab),
  "findings are never auto-logged — a person presses + Log on a source they checked");
assert.ok(!/setResearch[\s\S]{0,400}draft-save/.test(tab), "…and never pasted into the draft");

console.log("check-fill: all asserts passed");
