// Does every number on screen come from somewhere?
//
// Phase 8 (5 Sep 2026). The dashboard asserted an "Audit Compliance Score" of 98.5% and
// a tax line reading "MoF 11% / SSD Pool" — both were literal text that nothing
// computed, and the compliance dot in the sidebar was painted on unconditionally. A
// figure nobody measures is worse than no figure, because it gets quoted to a donor.
// Run: npx tsx scripts/check-honesty.ts
import { readFileSync } from "node:fs";
import { contractHtml } from "../docgen.js";

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

console.log("\na zero that is not a figure does not pretend to be one");
// Every salary base is 0 until a project funds the role, so the payroll card was printing
// "Base: $0.00 + $0.00 allowance" to the person whose card it is. Same failure as the
// invented 98.5% above, inverted: a number that measures nothing, shown as if it did.
const payroll = src("tabs/PayrollTab.tsx");
ok("an unset base says so instead of showing $0.00",
  /emp\.salary \|\| emp\.allowance \?/.test(payroll) && payroll.includes("No total salary stated yet"));
ok("and the figures come back the moment either one is set",
  /<span dir="ltr">\{formatUSD\(emp\.salary\)\}<\/span>/.test(payroll));
// A rate is not a wage: the figure is what 100% of this person costs, and what is actually
// paid is the level of effort a project subcontracts. The card must not read as a monthly wage.
ok("a stored figure is labelled the rate the yearly agreement sets, not a wage",
  payroll.includes('{t("Full salary")}') && payroll.includes("The total salary stated in the annual contract"));
ok("the sentence has Arabic, so it is not the English fallback",
  /"No total salary stated yet[^"]*":\s*"[^"]*[؀-ۿ]/.test(src("i18n.ts")));
// Same empty base, second screen: the co-funding sheet apportioned it into "40% ($0.00)".
const projects = src("tabs/ProjectsTab.tsx");
ok("a co-funding share with no base shows the percentage alone, not $0.00",
  /const hasBase = !!\(emp\?\.salary \|\| emp\?\.allowance\);/.test(projects)
  && /\{alloc\?\.percentage \|\| 0\}%\{hasBase \? /.test(projects));
ok("and the sheet says once why the amounts are missing, not on every row",
  projects.includes("A share shown without an amount"));
ok("that sentence has Arabic too",
  /"A share shown without an amount[^"]*":\s*"[^"]*[؀-ۿ]/.test(src("i18n.ts")));

console.log("\none number, three places");
// A staff cost share is computed on the co-funding screen, on the payslip, and again when a
// timesheet is approved and the budget line is charged. The screen took salary alone while
// both server paths took salary + allowance: three implementations, two answers, and they
// agreed only because every base is 0. A donor reads the screen and the payslip.
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
ok("the co-funding screen apportions salary + allowance",
  /const allocatedSalary = \(\(emp\?\.salary \|\| 0\) \+ \(emp\?\.allowance \|\| 0\)\)/.test(projects));
ok("the payslip apportions the same gross",
  /const gross = \(employee\.salary \|\| 0\) \+ \(employee\.allowance \|\| 0\);/.test(server));
ok("and so does the posting that charges the budget line",
  /const baseCompensation = emp\.salary \+ emp\.allowance;/.test(server));
ok("no one of the three has quietly gone back to salary alone",
  !/allocatedSalary = \(emp\?\.salary \|\| 0\) \*/.test(projects));

console.log("\nand not on a contract, where it would be signed");
// The framework contract carries no money of its own — each project is contracted separately.
// Printing "$0.00" as its approved total would state a value nobody agreed to. Rendered here
// rather than grepped, because what matters is the sentence a person signs.
const contract = (o: any) => contractHtml({
  party: { name: "Sally Kayyali", position: "Graphic Designer", paymentMethod: "Bank Transfer" },
  countersignatory: { name: "Saad Matar", role: "Executive Director" },
  startDate: "2026-01-01", endDate: "2026-12-31", monthlyFee: 0, reference: "ANH-EC-SK-2026-01",
  kind: "Employment", project: null, contractTotal: 0, ...o,
} as any).replace(/<[^>]+>/g, "");
const framework = contract({});
ok("a framework contract states no fixed value", framework.includes("No fixed value; each engagement is contracted separately per project"));
ok("and says it as a sentence too, in lower case mid-clause", framework.includes("has no fixed value; each engagement"));
ok("and prints no $0.00 anywhere", !framework.includes("$0.00"));
const funded = contract({ project: { code: "TRF-2026", name: "Trust Fund" }, monthlyFee: 800, contractTotal: 9600 });
ok("a funded subcontract still states its real total", funded.includes("total value of this contract is $9,600.00"));
const service = contract({ kind: "Service", contractTotal: 2000 });
ok("an unregistered provider's withholding is still computed from a real total",
  service.includes("$150.00 withheld") && service.includes("$1,850.00 net"));
ok("and reads as a sentence when there is no total to compute it from",
  contract({ kind: "Service" }).includes("computed on the contracted value of each engagement, unless the provider"));
ok("the project select no longer forces one onto a framework contract",
  /<select id=\{`ct-project-\$\{emp\.id\}`\} value=/.test(payroll) && payroll.includes("None: annual service contract"));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
