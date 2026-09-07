// What the proposal brain is grounded in.
//
// 6 Sep 2026. The brain writes proposals in AnaHon's name, so the failure modes are the
// quiet ones: the wrong document (two handbooks are numbered 018), the whole 177k policy
// manual instead of the four strategy papers, a second extractor drifting away from Home &
// desk's cache, a heading with no rows under it that the model then explains away, or a
// fit assessment nudged towards optimism because a weak fit feels unhelpful. It is not.
// Run: npx tsx scripts/check-brain.ts
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync("server.ts", "utf8");
const brain = (server.match(/async function anahonBrainContext[\s\S]*?\n\}/) || [""])[0];
const corpus = (server.match(/async function strategyCorpus[\s\S]*?\n\}/) || [""])[0];
const ids = (server.match(/const STRATEGY_DOC_IDS = \[[\s\S]*?\];/) || [""])[0];

console.log("\nA. the four documents, named by id");
ok("exactly four", (ids.match(/"doc-hb-/g) || []).length === 4);
for (const [label, id] of [
  ["Strategic Plan 007", "doc-hb-anahon-strategicplan-strategy-007"],
  ["KPIs 008", "doc-hb-anahon-keyperformanceindicators-008"],
  ["Fundraising Policy 018", "doc-hb-anahon-fundraisingpolicy-018"],
  ["Proposal & Grants 019", "doc-hb-anahon-proposal-grantsmanagement-policy-019"],
] as const) ok(`${label} is on the list`, ids.includes(id));
// The trap this list exists to avoid: Anahon_Sharing Repository Policy_018 carries the
// same number as the Fundraising Policy, so "the 018 one" is not a way to choose a paper.
ok("the other 018 — Sharing Repository Policy — is not picked up", !ids.includes("sharing-repository"));
ok("chosen by document id, never by the number in a filename",
  !/_\(?0?(007|008|018|019)\)?[^"]*\/\.test|filename.*match.*018/.test(corpus));

console.log("\nB. Home & desk's extraction, not a second one");
ok("it calls documentText, the in-process extractor", /await documentText\(r\.id\)/.test(corpus));
ok("no HTTP fetch of the document route — a server fetching itself is what killed reports/pdf",
  !/fetch\(/.test(corpus) && !/docx-text/.test(corpus));
ok("no second unzip/python of its own", !/zipfile|word\/document\.xml|PyMuPDF|fitz/.test(corpus));
ok("cached on the documents' own content hashes, like the policy corpus",
  /\$\{r\.id\}:\$\{r\.contentHash\}/.test(corpus) && /strategyCache && strategyCache\.key === key/.test(corpus));
ok("a document that is not on file is survivable, and says so", /is not on file/.test(corpus));
ok("an unreadable one does not take the brain down", /could not read/.test(corpus));

console.log("\nC. the strategy is in the brain, the whole manual is not");
ok("the brain builds the strategy corpus", /strategyCorpus\(\)/.test(brain));
ok("it does not pull the 177k policy manual — that belongs to the help desk", !/policyCorpus/.test(brain));
ok("the documents outrank the hardcoded briefs, and the model is told so",
  /these documents are correct/.test(brain));
ok("and is asked to name the goal or KPI it relied on",
  /name the[\s\S]{0,40}strategic goal or the KPI/.test(brain));
ok("nothing is added when the four documents are all missing", /strategy\.text \? \[/.test(brain));

console.log("\nD. the track record degrades to nothing when a table is empty");
for (const [label, guard] of [
  ["engagements", "if (engagements.length) alsoDone.push("],
  ["clients", "if (clients.length) alsoDone.push("],
  ["published content", "if (published.length) alsoDone.push("],
] as const) ok(`${label}: no rows, no heading`, brain.includes(guard));
// Retract keeps status "Published" on purpose (the record is permanent, Policy 005) and sets
// retractedAt, so filtering on status alone would offer a funder work AnaHon has withdrawn.
ok("only content the pipeline published AND has not retracted is claimed",
  /contentItem\.findMany\(\{ where: \{ status: "Published", retractedAt: "" \}/.test(brain));
ok("a client with no quotation still reads as a client, not as an empty list",
  /no quotation yet/.test(brain));
ok("quotations are attached to their own client, not pooled",
  /quotations\.filter\(q => q\.clientId === c\.id\)/.test(brain));

console.log("\nE. the programme briefs follow the documents");
// The Strategic Plan and the KPIs describe podcasts, advocacy platforms and awareness
// campaigns; neither claims investigative reporting. A brain told otherwise writes it into
// proposals, which is exactly the invention the RULES line forbids.
// Comments are stripped first: the line recording WHY the wording changed necessarily
// contains the old phrase, and a check that trips on its own explanation is a bad check.
const briefValues = (brain.match(/^\s*"[^"]+": "[^"]*",?$/gm) || []).join("\n");
ok("the Platform brief no longer claims investigative reporting",
  briefValues.length > 200 && !/investigative reporting/.test(briefValues), briefValues.slice(0, 60));
ok("it claims what the documents do describe",
  /podcasts, advocacy platforms and awareness campaigns/.test(brain));
ok("the change is recorded where the next reader will see it", /The document wins over the code/.test(brain));

console.log("\nF. an honest weak fit is still the point");
ok("intake still asks for an honest assessment", /Assess fit honestly against the real track record above/.test(server));
ok("and still says a weak fit is a useful answer", /a weak fit is a useful answer/.test(server));
ok("the fit enum still allows Weak", /enum: \["Strong", "Moderate", "Weak"\]/.test(server));
// Scoped to the two prompts, not the whole file: "amount must be positive" elsewhere is
// a validation message, not a nudge to the model.
const prompts = (server.match(/TASK: Read the call[\s\S]*?`,/) || [""])[0]
  + (server.match(/const task = mode === "assess"[\s\S]*?;/) || [""])[0];
ok("neither prompt tells the model to be encouraging, positive or optimistic",
  prompts.length > 200 && !/(be|sound|stay) (encouraging|positive|optimistic)|emphasis\w* the strengths|make the case for|avoid discouraging/i.test(prompts));
ok("the assess prompt still asks for real risks", /real risks \(capacity, deadline, compliance/.test(prompts));

console.log("\nH. the free path answers in the shape the callers read");
// 7 Sep 2026: Saad could not enter a British Council call. The server's Anthropic key is
// invalid, so every askJson lands on Gemini — and that branch sent no schema at all, so the
// route read title/fit/rationale out of an object the model had shaped as it pleased.
const gemini = (server.match(/if \(process\.env\.GEMINI_API_KEY\) \{[\s\S]*?parseModelJson\(r\.text \|\| "\{\}"\);/) || [""])[0];
ok("the Gemini branch is given the same schema Claude gets",
  /\.\.\.\(schema \? \{ responseJsonSchema: schema \} : \{\}\)/.test(gemini));
ok("in responseJsonSchema, not the older narrower responseSchema field",
  !/responseSchema:/.test(gemini));
ok("it still asks for JSON as well, so a schemaless caller is unchanged",
  /responseMimeType: "application\/json"/.test(gemini));
ok("and the fence-stripping salvage is still the last resort", /parseModelJson\(r\.text/.test(gemini));
ok("no caller's schema was rewritten to suit one provider — askJson still takes one schema",
  /async function askJson\(\s*\n?\s*prompt: string, schema: Record<string, any>/.test(server));
ok("the help desk's own provider choice is untouched",
  /\.\.\.\(prefer === "gemini" \? \{ thinkingConfig: \{ thinkingBudget: 0 \} \} : \{\}\)/.test(gemini));
// The key that sends every call down this path in the first place.
ok("anthropicKey() still only judges a key by its shape, never by whether the API took it",
  /if \(!k\.startsWith\("sk-ant-"\) \|\| k\.length < 40\)/.test(server));

console.log("\nG. the size of what is sent is recorded");
ok("every build logs its character count and the two additions", /\[brain\] \$\{context\.length\} characters/.test(brain));
ok("the extraction logs its own cost once, when cold", /\[strategy\] extracted/.test(corpus));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
