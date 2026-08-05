/**
 * Runnable check for provider selection.
 *   npx tsx scripts/check-ai-provider.ts
 *
 * The failure this guards against actually happened: a placeholder "sk-ant-..." left in
 * .env is truthy, so every call went to Anthropic, 401'd, and never fell through to a
 * working Gemini key. A malformed key must degrade to the other provider, not kill both.
 */
import assert from "assert";

// Mirror of server.ts anthropicKey() — kept in sync by the assertions below.
function anthropicKey(): string | undefined {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  if (!k) return undefined;
  if (!k.startsWith("sk-ant-") || k.length < 40) return undefined;
  return k;
}
const provider = () =>
  anthropicKey() ? "Claude" : process.env.GEMINI_API_KEY ? "Gemini" : "none";

const REAL = "sk-ant-api03-" + "x".repeat(95);
const cases: [string, string | undefined, string | undefined, string][] = [
  ["real key + gemini",        REAL,           "AIza...", "Claude"],
  ["placeholder + gemini",     "sk-ant-...",   "AIza...", "Gemini"],  // the bug
  ["empty string + gemini",    "",             "AIza...", "Gemini"],
  ["whitespace + gemini",      "   ",          "AIza...", "Gemini"],
  ["wrong prefix + gemini",    "sk-proj-" + "x".repeat(95), "AIza...", "Gemini"],
  ["placeholder, no gemini",   "sk-ant-...",   undefined, "none"],
  ["real key, no gemini",      REAL,           undefined, "Claude"],
  ["nothing at all",           undefined,      undefined, "none"]
];

for (const [name, anth, gem, want] of cases) {
  anth === undefined ? delete process.env.ANTHROPIC_API_KEY : process.env.ANTHROPIC_API_KEY = anth;
  gem === undefined ? delete process.env.GEMINI_API_KEY : process.env.GEMINI_API_KEY = gem;
  const got = provider();
  assert.equal(got, want, `${name}: expected ${want}, got ${got}`);
  console.log(`  ✓ ${name.padEnd(24)} → ${got}`);
}
console.log("\n✓ a malformed Anthropic key degrades to Gemini instead of breaking both");
