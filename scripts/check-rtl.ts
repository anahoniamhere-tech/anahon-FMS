// Does the screen actually turn around in Arabic?
//
// 5 Sep 2026. The Arabic toggle set dir="rtl" on <html> and stopped there: ~230
// Tailwind classes still named a physical side (ml-, pr-, border-l, left-3,
// text-right), so every icon gap, indent, sidebar border and drawer stayed on the
// left-to-right side while the words ran the other way. Logical classes (ms/me,
// ps/pe, start/end, border-s/e, text-start/end) follow the direction the element
// is in, so one class serves both languages. This check fails if a physical one
// comes back — the diff would look harmless and only show up in Arabic.
// Run: npx tsx scripts/check-rtl.ts
import { readFileSync, readdirSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const dir = new URL("../src/", import.meta.url);
const files = [
  ...readdirSync(dir).filter(f => f.endsWith(".tsx")).map(f => `src/${f}`),
  ...readdirSync(new URL("tabs/", dir)).filter(f => f.endsWith(".tsx")).map(f => `src/tabs/${f}`),
];
const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// A class token: never preceded by a word character, so "border-left:",
// "padding-left:" and "html-" in raw CSS or prose are left alone.
const B = "(?<![A-Za-z0-9_])";
const PHYSICAL: [string, string, string][] = [
  ["margin",    `${B}m[lr]-[\\w.\\[]`,                    "ml-/mr- → ms-/me-"],
  ["padding",   `${B}p[lr]-[\\w.\\[]`,                    "pl-/pr- → ps-/pe-"],
  ["alignment", `${B}text-(left|right)\\b`,               "text-left/right → text-start/end"],
  ["border",    `${B}border-[lr](?![a-z])`,               "border-l/r → border-s/e"],
  ["radius",    `${B}rounded-[lr]-`,                      "rounded-l-/r- → rounded-s-/e-"],
  ["position",  `${B}(left|right)-([\\d.]|full|auto|px|\\[)`, "left-/right- → start-/end-"],
];

console.log("\nno screen names a physical side");
for (const [what, pattern, fix] of PHYSICAL) {
  const hits: string[] = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (new RegExp(pattern).test(line)) hits.push(`${f}:${i + 1}`);
    });
  }
  ok(`${what} (${fix})`, hits.length === 0, hits.slice(0, 6).join(", ") + (hits.length > 6 ? ` +${hits.length - 6} more` : ""));
}

const app = read("src/App.tsx");
console.log("\nthe page turns around");
ok("dir follows the language", /document\.documentElement\.dir = lang === "ar" \? "rtl" : "ltr"/.test(app));
ok("rtl is handed to every tab", /state, setState, currentUser, t, lang, rtl,/.test(app));

console.log("\nthe sidebar needs no direction branch");
// Left in LTR and right in RTL is one place — inline start. A ternary here is a
// second copy of what the class already knows, and drifts.
ok("the panel is pinned by one class", /fixed top-16 bottom-0 start-0 z-50/.test(app));
ok("its content-side border is logical", /'translate-x-0 w-64 p-4 border-e'/.test(app));
ok("the handle sits at one offset", /\$\{isOpen \? 'start-64' : 'start-0'\}/.test(app));
ok("and is rounded on the content side", /rounded-e-xl border-e bg-slate-800/.test(app));
// The one physical thing with no logical twin: transform. It keeps its branch.
ok("the off-screen slide keeps its branch", /rtl \? "translate-x-full" : "-translate-x-full"/.test(app));

console.log("\ndirectional glyphs turn too");
const desk = read("src/tabs/MyDeskTab.tsx");
ok("closed disclosure chevrons flip", (desk.match(/\? "rotate-90" : "rtl:rotate-180"/g) || []).length === 2);
ok("the back arrow flips", /<ArrowLeft size=\{14\} className="rtl:rotate-180" \/>/.test(read("src/IcontentInvPage.tsx")));

console.log("\nthe two places a physical side is still correct");
// This span carries dir="rtl" itself, so a logical class would resolve against
// the span, not the page. It wants the same gap on both sides regardless.
ok("the Arabic label in the reports keeps an even gap", /<span className="text-slate-500 mx-2" dir="rtl">/.test(read("src/tabs/ReportsTab.tsx")));
// The Word export restyles a clone of the live DOM by class name. Rename a class
// in the JSX without renaming it here and the exported .doc loses its alignment.
const proj = read("src/tabs/ProjectsTab.tsx");
ok("the Word export's selector matches the JSX", proj.includes(".text-end {") && !proj.includes(".text-right {"));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
