// Does every number on screen come from somewhere?
//
// Phase 8 (5 Sep 2026). The dashboard asserted an "Audit Compliance Score" of 98.5% and
// a tax line reading "MoF 11% / SSD Pool" — both were literal text that nothing
// computed, and the compliance dot in the sidebar was painted on unconditionally. A
// figure nobody measures is worse than no figure, because it gets quoted to a donor.
// Run: npx tsx scripts/check-honesty.ts
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const dash = src("tabs/DashboardTab.tsx"), app = src("App.tsx"), nav = src("nav.tsx");

console.log("\nthe invented figures are gone");
ok("no asserted compliance score", !dash.includes("98.5"));
ok("no hard-coded tax line", !/MoF 11% \/ SSD Pool/.test(dash));
ok("the checklist tile counts the register", /complianceTasks \|\| \[\]\)\.filter\(t => t\.status === "Done"\)\.length/.test(dash));
ok("it names how many are late", /t\.status !== "Done" && t\.dueDate < new Date\(\)\.toLocaleDateString\("en-CA"\)/.test(dash));
ok("the tax tile reads the setting, whatever it is", /state\.orgSettings\?\.vatRate \?\? 0/.test(dash));
ok("and names the threshold it enforces", /approvalThresholdUSD/.test(dash));

console.log("\nthe badge means what it shows");
ok("the dot needs something overdue", /item\.badge === "compliance" && overdueTasks > 0/.test(app));
ok("overdue is counted, not assumed", /const overdueTasks = \(state\?\.complianceTasks \|\| \[\]\)\.filter\(/.test(app));
ok("it says how many when hovered", /title=\{`\$\{overdueTasks\} overdue`\}/.test(app));

console.log("\nrenewals have their own door");
ok("the door exists", /navKey: "subscriptions", label: "Subscriptions & renewals"/.test(nav));
ok("held by the seats that own the money", /navKey: "subscriptions"[^}]*roles: \["\*full", \.\.\.PLO\]/.test(nav));
ok("one component, two entrances", /activeTab === "vendors" && <VendorsTab \{\.\.\.shared\} only="suppliers"/.test(app) && /activeTab === "subscriptions" && <VendorsTab \{\.\.\.shared\} only="subscriptions"/.test(app));
ok("the label has Arabic", src("i18n.ts").includes('"Subscriptions & renewals":'));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
