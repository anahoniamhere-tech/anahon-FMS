/**
 * The donor's own clauses on a project (8 Oct 2026): the route People shipped (f4cdb09) now has a
 * screen. Both languages or neither — the Arabic governs the contract.
 */
import assert from "assert";
import fs from "fs";
import { AR } from "../src/i18n.js";

const server = fs.readFileSync("server.ts", "utf8");
const tab = fs.readFileSync("src/tabs/ProjectsTab.tsx", "utf8");
const REFUSAL = "Donor clauses are set in both Arabic and English, or in neither — the Arabic text governs the contract.";

// A — the rule, as the server writes it.
assert.ok(server.includes(`if (!!en !== !!ar) return res.status(400).json({ error: "${REFUSAL}" });`), "the server's one rule, unchanged");
assert.ok(/MANAGERS_SEATS\.includes\(user\?\.role\)/.test(server.slice(server.indexOf('app.post("/api/projects/donor-clauses"'), server.indexOf('app.post("/api/projects/donor-clauses"') + 600)), "Finance or a director only");

// B — the screen refuses the same thing, in the same words, before asking the server.
const panel = tab.slice(tab.indexOf("The donor's own clauses (People, f4cdb09)"), tab.indexOf('{projectWorkspaceTab === "money"'));
assert.ok(panel.length > 500, "found the panel");
assert.ok(panel.includes(REFUSAL), "the screen shows the route's refusal text, word for word");
assert.ok(/const half = !!clauseDraft && \(!!clauseDraft\.en\.trim\(\) !== !!clauseDraft\.ar\.trim\(\)\)/.test(panel), "half-filled is the same test as the server's");
assert.ok(/disabled=\{half\}/.test(panel), "a half-filled pair cannot be submitted");
assert.ok(/donorClausesEn: clauseDraft!\.en, donorClausesAr: clauseDraft!\.ar/.test(panel), "both languages are sent together");
assert.ok(/dir="rtl"/.test(panel) && /dir="ltr"/.test(panel), "each box is read in its own direction");
assert.ok(/MANAGERS\.includes\(currentUser\.role\)/.test(panel), "the button is for the seats the route allows");
assert.ok(!/\bml-\d|\bmr-\d|text-left|text-right/.test(panel), "logical classes only");
assert.ok(/Clear the clauses/.test(panel), "clearing both is offered, since the route allows neither-language");

// C — the Arabic the screen needs.
for (const key of ["The donor's own clauses", REFUSAL, "Arabic — this is the text that governs", "Save the clauses", "donor clauses cleared"]) {
  assert.ok(AR[key] && /[؀-ۿ]/.test(AR[key]), `Arabic missing for "${key}"`);
}
assert.ok(AR["none — contracts carry AnaHon's own terms only"].includes("اناهون"), "اناهون is one word");

console.log("check-donor-clauses: all passed");
