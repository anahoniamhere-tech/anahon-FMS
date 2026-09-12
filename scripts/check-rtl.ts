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

/**
 * `left-1/2` next to `-translate-x-1/2` is not a side — it is horizontal centring, and the
 * pair renders identically in both directions because both halves are physical and cancel.
 *
 * Swapping it to the logical class actively BREAKS it: `start-1/2` becomes `right: 50%` under
 * RTL while `translate-x` stays physical, so the element lands a full width off centre. The
 * pair is therefore removed before a line is judged. A bare `left-1/2` with no translate is
 * still a side, and so is `left-3` — the test below proves the narrowing did not blind the rule.
 */
const scrubCentring = (line: string) => {
  let l = line;
  if (/-translate-x-1\/2/.test(l)) l = l.replace(/(?<![A-Za-z0-9_])left-1\/2/g, "centred-x");
  if (/(?<!-)\btranslate-x-1\/2/.test(l)) l = l.replace(/(?<![A-Za-z0-9_])right-1\/2/g, "centred-x");
  return l;
};

console.log("\nno screen names a physical side");
for (const [what, pattern, fix] of PHYSICAL) {
  const hits: string[] = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      const subject = what === "position" ? scrubCentring(line) : line;
      if (new RegExp(pattern).test(subject)) hits.push(`${f}:${i + 1}`);
    });
  }
  ok(`${what} (${fix})`, hits.length === 0, hits.slice(0, 6).join(", ") + (hits.length > 6 ? ` +${hits.length - 6} more` : ""));
}

console.log("\nand the position rule still tells a side from a centre");
const POSITION = new RegExp(PHYSICAL.find(r => r[0] === "position")![1]);
const flags = (cls: string) => POSITION.test(scrubCentring(`<div className="${cls}">`));
ok("a centring pair is not a side", !flags("absolute -top-5 left-1/2 -translate-x-1/2 flex"));
ok("nor is the mirrored one", !flags("absolute right-1/2 translate-x-1/2"));
ok("a bare left-1/2 still is — that is positioning, not centring", flags("absolute left-1/2"));
ok("left-1/2 with a VERTICAL translate still is", flags("absolute left-1/2 -translate-y-1/2"));
ok("a plain left-3 still is", flags("absolute left-3"));
ok("right-0 still is", flags("absolute right-0"));
ok("and left-1/2 with a positive x-translate still is — that is not the centring pair",
  flags("absolute left-1/2 translate-x-1/2"));

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
// Pins the logical rounding and border, not the colour — this check guards direction,
// not the palette, and it failed the day the chrome went white.
ok("and is rounded on the content side", /rounded-e-xl border-e bg-\S+ border-y/.test(app));
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

console.log("\nmachine text that leads with a number is isolated");
// A run only scrambles when it STARTS with a digit or sign and then mixes with a
// Latin word: "−1,250.00 USD" renders "USD 1,250.00−" inside an Arabic paragraph,
// and "2026-08-01 → 2026-08-31" reads backwards. dir="ltr" on the inline element
// isolates it; putting it on a <td> instead would invert that column's alignment.
const risky: string[] = [];
for (const f of files) {
  const lines = read(f).split("\n");
  lines.forEach((line, i) => {
    // House style is toLocaleString(undefined, { minimumFractionDigits: 2 }), so demanding
    // EMPTY parens here meant the rule never saw a single house-style figure: sixteen
    // genuine cases shipped past it (Books room, 12 Sep). Any argument list counts now,
    // and the currency may sit a few characters further along — "0.00"} {exp.currency}.
    // The `<` keeps it to JSX: the same run inside a WhatsApp message string
    // (ExpensesTab, ProductionTab) has no element to carry dir, and isolating it there
    // is not a thing you can do.
    if (!/toLocaleString\([^)]*\)[\s\S]{0,30}?[Cc]urrency/.test(line) || !line.includes("<")) return;
    const window = lines.slice(Math.max(0, i - 2), i + 1).join(" ");
    if (!/dir="ltr"/.test(window)) risky.push(`${f}:${i + 1}`);
  });
}
ok("every amount + currency pair is isolated", risky.length === 0, risky.join(", "));
// Isolation goes on an INNER span, never on the <td> — dir on the cell inverts that
// column's alignment — and never on a paragraph, which would flip the Arabic prose
// around the figure. Both verified by hand in Banking/Reports (Books room, 12 Sep).
ok("a table cell isolates on an inner span, not the cell",
  !/<td[^>]*dir="ltr"/.test(read("src/tabs/BankingTab.tsx")));
// ponytail: formatUSD() embeds its own symbol, so this rule cannot see it — 72 lines
// carry one unisolated today. Most are a lone figure in its own cell, which does not
// scramble; the ones that bite sit inside a sentence. Widen to formatUSD only with a
// way to tell those apart, or it is 72 false positives.
ok("the date range on the payroll sheet is isolated",
  /<span dir="ltr">\{eng\[pid\]\.first\} → \{eng\[pid\]\.last\}<\/span>/.test(read("src/tabs/PayrollTab.tsx")));
ok("so is the LOE percentage", /<span dir="ltr">\{eng\[pid\]\.pct\}% \(payroll\)<\/span>/.test(read("src/tabs/PayrollTab.tsx")));
ok("the withholding line keeps its minus in front",
  /<span dir="ltr">−\{exp\.whtAmount\.toLocaleString\(\)\} \{exp\.currency\}<\/span>/.test(app));

console.log("\nthe phone screen");
// The lang button was 28px wide beside a 44px one — under the touch minimum and
// visibly lopsided. Both are 44 now, and the title yields instead of shoving them off.
ok("both header buttons meet the 44px touch minimum", (app.match(/min-h-\[44px\] min-w-\[44px\]/g) || []).length >= 2);
ok("the title block yields", /<div className="flex min-w-0 items-center gap-3">/.test(app) && /<h1 className="truncate text-xs font-bold/.test(app));
ok("the tab badge cannot grow without bound", /w-fit max-w-\[7\.5rem\] truncate/.test(app));
ok("the buttons never shrink", /<div className="flex shrink-0 items-center gap-2">/.test(app));
ok("they sit clear of the edge", /ps-4 pe-5 py-3 flex items-center justify-between/.test(app));
// The pill is fixed, so without this the last rows sit under it with no way to
// scroll them out — 31px of the row was unreadable on a phone.
ok("the list can scroll clear of the missing-evidence pill", /overflow-y-auto p-4 pb-24 md:p-8 md:pb-24/.test(app));
ok("and the pill is slimmer where the screen is narrow", /gap-1\.5 px-3 py-2\.5 sm:gap-2 sm:px-4 sm:py-3 rounded-full/.test(app));

console.log("\nthe help bubble");
// It rests on the content's first column (start-5 / md:start-8 is <main>'s own
// padding), so on a wide screen the last row sat under it for good: md:p-8 left
// 32px where the bubble reaches 68 — Suppliers' "Not on file" line, 6 Sep 2026.
// Derived from both class strings, so growing or lifting the bubble, or trimming
// the padding, fails here at either width. Tailwind spacing is 4px a step.
const bot = read("src/HelpDesk.tsx");
const mainCls = app.match(/<main className="([^"]+)"/)?.[1] ?? "";
const bubbleCls = bot.match(/className="([^"]*\bbottom-\d+[^"]*rounded-full[^"]*)"/)?.[1] ?? "";
const tw = (cls: string, at: string, ...props: string[]) => {
  for (const p of props) {
    const m = cls.match(new RegExp(`(?<![\\w:-])${at}${p}-(\\d+)(?![\\w./])`));
    if (m) return Number(m[1]) * 4;
  }
};
for (const [at, where] of [["", "on a phone"], ["md:", "on a wide screen"]]) {
  const pad = tw(mainCls, at, "pb", "p") ?? tw(mainCls, "", "pb", "p") ?? 0;
  const reach = (tw(bubbleCls, at, "bottom") ?? tw(bubbleCls, "", "bottom") ?? 0)
    + (tw(bubbleCls, at, "h") ?? tw(bubbleCls, "", "h") ?? 0);
  ok(`the list can scroll clear of it ${where}`, reach > 0 && pad >= reach, `${pad}px of padding, the bubble reaches ${reach}px`);
}
// The two things the fix above must not undo. `fixed` would place it against the
// viewport and put it back on the sidebar; above 96 it floats on the drawer's dim.
ok("it is placed against the content column, so it cannot cover the sidebar", bubbleCls.startsWith("absolute "));
const dim = Number(app.match(/fixed inset-0 bg-black\/50 z-\[(\d+)\]/)?.[1]);
const zs = [...bot.matchAll(/className="[^"]*?(?<![\w:-])z-\[(\d+)\]/g)].map(m => Number(m[1]));
ok("it and its panel stay under the missing-documents drawer's dim", zs.length === 2 && zs.every(z => z < dim), `${zs.join(", ")} vs ${dim}`);

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
