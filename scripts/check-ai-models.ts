// Which Claude model does each paid route run on?
//
// 16 Sep 2026 (Saad, D6/D5). The paid key came back and every feature defaulted to Opus 5.
// Readers and short extraction now run on Haiku 4.5; drafting and judgement on Sonnet 5;
// nothing on Opus. This reads server.ts route by route, so a route that quietly drops its
// tier (and falls to the default) or a stray Opus id fails here before it reaches the bill.
// Run: npx tsx scripts/check-ai-models.ts
import { readFileSync } from "node:fs";
import { helpPromptParts, helpPrompt } from "../src/helpBot.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const src = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

/** The text of one route handler: from its app.post line to the next route. */
const route = (path: string): string => {
  const a = src.indexOf(`app.post("${path}"`);
  if (a < 0) return "";
  const b = src.indexOf("\napp.", a + 10);
  return src.slice(a, b < 0 ? undefined : b);
};

console.log("\nA. the model ids");
ok("no Opus id anywhere in server.ts", !/claude-opus/.test(src));
ok("Haiku id is claude-haiku-4-5", /haiku: "claude-haiku-4-5"/.test(src));
ok("Sonnet id is claude-sonnet-5", /sonnet: "claude-sonnet-5"/.test(src));
ok("askJson defaults to Sonnet, not to a paid surprise", /prefer: Tier \| "gemini" = "sonnet"/.test(src));
ok("Haiku calls send no thinking or effort (Haiku 4.5 rejects effort)",
  /prefer === "haiku"\s*\?\s*\{ output_config: \{ format: \{ type: "json_schema", schema \} \} \}/.test(src));

console.log("\nB. Haiku routes");
const HAIKU: [string, RegExp][] = [
  ["/api/help/ask", /"low", "haiku"\s*\)/],
  ["/api/meetings/extract-topics", /"low", "haiku"\)/],
  ["/api/vendor/scan", /\{ base64, mimeType \}, "low", "haiku"\)/],
  ["/api/expense/scan-invoice", /\{ base64, mimeType \}, "low", "haiku"\)/],
  ["/api/assets/scan-label", /readLabel\("haiku"\)/],
];
for (const [p, re] of HAIKU) ok(`${p} runs on Haiku`, re.test(route(p)), route(p) ? "" : "route not found");
ok("/api/assets/scan-label never names another Claude tier", !/readLabel\("(claude|sonnet)"\)/.test(route("/api/assets/scan-label")));
ok("compliance audit's askText is on Haiku",
  /async function askText[\s\S]{0,900}model: MODELS\.haiku/.test(src) && /askText\(prompt\)/.test(route("/api/gemini/compliance-audit")));
ok("the help desk no longer asks the free tier first", !/"gemini"\s*\)/.test(route("/api/help/ask")));

console.log("\nC. Sonnet routes (the default tier, never overridden)");
for (const p of ["/api/opportunities/intake", "/api/opportunities/ai-assist", "/api/content/produce", "/api/content/brainstorm"]) {
  const r = route(p);
  ok(`${p} calls askJson on the default tier`, /askJson\(/.test(r) && !/"(haiku|gemini)"\)/.test(r), r ? "" : "route not found");
}
ok("research (web search) runs on Sonnet", /async function askWithSearch[\s\S]{0,2500}model: MODELS\.sonnet/.test(src));

console.log("\nD. the help desk's cached prefix carries nothing about the asker");
const asker = { role: "Finance Officer", ownRole: "Finance Officer", doors: ["expenses"], rows: [], today: "2031-01-02" };
const [prefix, rest] = helpPromptParts("QUESTION-XYZ", asker, "HANDBOOK-TEXT");
ok("prefix holds the handbooks", prefix.includes("HANDBOOK-TEXT"));
ok("prefix has no question", !prefix.includes("QUESTION-XYZ"));
ok("prefix has no date", !prefix.includes("2031-01-02"));
ok("the question is in the rest", rest.includes("QUESTION-XYZ"));
ok("prefix is the same for a different asker",
  helpPromptParts("other", { ...asker, role: "Executive Director", today: "2031-05-05" }, "HANDBOOK-TEXT")[0] === prefix);
ok("helpPrompt is still the two halves joined", helpPrompt("QUESTION-XYZ", asker, "HANDBOOK-TEXT") === `${prefix}\n\n${rest}`);

console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
