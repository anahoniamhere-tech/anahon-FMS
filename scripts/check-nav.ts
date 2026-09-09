// Is every screen in the sidebar exactly once, and does every role still see what it did?
//
// Phase 1 of the navigation decision (4 Sep 2026) regrouped the sidebar into data.
// The two ways it could silently go wrong: a screen that exists in App.tsx but has no
// door, and a role that lost a door it used to have. Run: npx tsx scripts/check-nav.ts
import { readFileSync } from "node:fs";
import { NAV, NAV_KEYS, LANDING, visibleNav } from "../src/nav.js";
import { ALL_ROLES } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const arSrcHas = (k: string) => readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8").includes(`"${k}":`);
const keys = (role: string) => visibleNav(role).flatMap(s => s.items.map(i => i.navKey)).sort();
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

console.log("\nevery screen App.tsx can render has exactly one door");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
// Negative assertions are tested against the code with comments stripped: App.tsx explains
// what it does NOT do ("replaceState, never pushState"; "no WebSocket"), and a bare grep
// over the source finds those words in the prose and fails on the explanation, not the code.
const code = app.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const rendered = [...new Set([...app.matchAll(/activeTab === "([a-z-]+)" && </g)].map(m => m[1]))].sort();
const listed = [...NAV_KEYS].sort();
ok(`${rendered.length} screens rendered, ${listed.length} doors listed`, rendered.length === listed.length, `rendered=${rendered.join(",")} listed=${listed.join(",")}`);
ok("no screen without a door", rendered.every(k => listed.includes(k)), rendered.filter(k => !listed.includes(k)).join(","));
ok("no door without a screen", listed.every(k => rendered.includes(k)), listed.filter(k => !rendered.includes(k)).join(","));
ok("no screen listed twice", new Set(listed).size === listed.length);
ok("eight doors", NAV.length === 8, String(NAV.length));

console.log("\nwhat each role sees, against what it saw before the regroup");
// Before: the three hand-written branches in App.tsx. After: the same, plus Help and
// Policies for the people the policies bind — the one deliberate change of phase 1 —
// My Desk for everyone, the one deliberate change of phase 3, and the doors screen
// everyone now lands on (5 Sep 2026).
const before = {
  "Project Officer": ["dashboard", "editorial", "expenses", "help", "procurement", "projects"],
  "Reporter": ["editorial", "help"],
  "Content Creator": ["editorial", "help"],
  "Podcaster": ["editorial", "help"],
  "Employee (Self-Service)": ["payroll"],
};
const added = ["doors", "handbooks", "mydesk"];   // visible to the restricted roles now
const addedSelf = ["doors", "handbooks", "help", "mydesk"]; // self-service had none of them
// Seats placed in phase 2 (they had no login before, so there is no "before" to compare):
const placed: Record<string, string[]> = {
  "Procurement and Logistics Officer": ["doors", "mydesk", "help", "handbooks", "projects", "network", "procurement", "vendors", "subscriptions", "expenses", "assets", "payroll"],
  "Digital Officer": ["doors", "mydesk", "help", "handbooks", "social", "live", "archive", "tools", "network", "payroll"],
  "Chief Editor": ["doors", "mydesk", "help", "handbooks", "editorial", "social", "live", "archive", "payroll"],
  "Production Manager": ["doors", "mydesk", "help", "handbooks", "editorial", "social", "live", "archive", "payroll"],
  "Graphic Designer": ["editorial", "help", "handbooks", "mydesk", "doors"],
};
for (const [role, want] of Object.entries(placed)) ok(`${role}: ${want.length} doors`, same(keys(role), [...want].sort()), `got ${keys(role).join(",")}`);
for (const [role, had] of Object.entries(before)) {
  const expect = [...had, ...(role === "Employee (Self-Service)" ? addedSelf : added)].sort();
  ok(`${role}: ${expect.length} doors`, same(keys(role), expect), `got ${keys(role).join(",")}`);
}
const full = listed;
for (const role of ["Super Admin", "Finance Officer", "Program Director", "Project Lead", "HR / Payroll Officer", "Auditor / Read-Only Reviewer"]) {
  ok(`${role}: sees every door`, same(keys(role), full), `missing ${full.filter(k => !keys(role).includes(k)).join(",")}`);
}

console.log("\nthe redirect follows the data, and every landing door is visible");
ok("App.tsx has no hand-written allowlist left", !/\["dashboard", "projects", "expenses", "procurement", "editorial"\]\.includes\(activeTab\)/.test(app));
ok("App.tsx redirect reads visibleNav", /allowed = visibleNav\(role\)/.test(app));
for (const [role, land] of Object.entries(LANDING)) ok(`${role} lands on ${land}, which it can see`, keys(role).includes(land));
ok("everyone lands on the doors", ALL_ROLES.every(r => LANDING[r] === "doors" && keys(r).includes("doors")), ALL_ROLES.filter(r => LANDING[r] !== "doors").join(","));
console.log("\nthe phone can stand in for a seat");
// 9 Sep 2026: RoleSwitch rendered only in the desktop header, so from a phone the vacant
// seats were unreachable — and Saad tests the editorial chain by wearing them, with every
// action written into the audit log under his own name AND the seat.
const roleSwitch = readFileSync(new URL("../src/RoleSwitch.tsx", import.meta.url), "utf8");
ok("the phone header carries Act as", /<RoleSwitch compact currentUser=\{currentUser\}/.test(app));
ok("as an icon, not the desktop pill", /compact \? "\ud83c\udfad"/.test(roleSwitch));
ok("at the touch minimum", /flex h-11 w-11 items-center justify-center rounded-lg border text-lg/.test(roleSwitch));
// The panel is 384px wide; a 375px phone is narrower than that.
ok("its panel fits a phone", /w-\[min\(22rem,calc\(100vw-2rem\)\)\] max-h-\[70vh\]/.test(roleSwitch));
// It renders nothing for anyone else, which is why a sixth control is affordable at all.
ok("and it costs nobody else a pixel", /if \(!isSuperAdmin\) return null;/.test(roleSwitch));
// Display & appearance measured and pinned this header's spacing in check-rtl.ts (pe-5,
// gap-2, max-w-[7.5rem], shrink-0). Tightening any of it to buy room for this button
// belongs to them, so nothing here touches it — the button is added at their geometry.
ok("Display's pinned spacing is left alone", /ps-4 pe-5 py-3 flex items-center justify-between/.test(app)
  && /max-w-\[7\.5rem\] truncate/.test(app) && /flex shrink-0 items-center gap-2/.test(app));

console.log("\nthe phone can search too");
// 9 Sep 2026, found by Saad in the installed app: the global search lived inside the
// desktop header's `hidden md:flex`, so on a phone it did not exist at all. The phone's
// search is on the doors screen because the phone header measurably cannot hold a fourth
// button — at 375px it truncates "AnaHon MS" and cuts the door badge mid-word.
const doors = readFileSync(new URL("../src/tabs/DoorsTab.tsx", import.meta.url), "utf8");
ok("the doors screen carries a search field", /value=\{globalQuery\}/.test(doors) && /onChange=\{e => setGlobalQuery/.test(doors));
ok("and it is the phone's, so the desktop keeps its header one", /className="mt-3 md:hidden"/.test(doors));
// One search, not two: both callers read the same query and the same hit builder.
ok("both surfaces call the same searchHits", /searchHits\(globalQuery, state, searchNav\)/.test(app)
  && /searchHits\(globalQuery, state, searchNav\)/.test(doors));
ok("and render the same result list", /<SearchHits/.test(app) && /<SearchHits/.test(doors));
ok("the header no longer builds its own hits", !/const hits: Hit\[\] = \[\];/.test(app));
// Picking one navigates and clears in a single action, so the list closes itself.
ok("a result navigates and closes at once", (doors.match(/h\.go\(\); setGlobalQuery\(""\)/g) || []).length === 1
  && (app.match(/h\.go\(\); setGlobalQuery\(""\)/g) || []).length === 1);
ok("Escape clears it and lets the keyboard go", /e\.key === "Escape"\) \{ setGlobalQuery\(""\); searchRef\.current\?\.blur\(\); \}/.test(doors));
ok("there is a visible clear, at 44px", /aria-label=\{t\("Clear search"\)\}/.test(doors) && /h-11 w-11 -translate-y-1\/2/.test(doors));
ok("the field itself meets the touch minimum", /min-h-\[44px\] w-full rounded-xl/.test(doors));
ok("self-service is not offered a search it cannot use", /\{!isSelfService && \(/.test(doors));

console.log("\nthe sidebar remembers whether it is open");
// 7 Sep 2026: Saad is deciding whether the sidebar earns its place now that the doors
// screen is home. The choice used to reset on every reload, so "try working without it"
// was not something he could actually do.
ok("the open state is seeded from localStorage", /localStorage\.getItem\("anahon-sidebar-open"\)/.test(app));
ok("and written back when it changes", /localStorage\.setItem\("anahon-sidebar-open", isOpen \? "1" : "0"\)/.test(app));
ok("a blocked store still renders — both sides are wrapped", (app.match(/} catch \{ \/\* storage blocked|} catch \{ \/\* nothing to do/g) || []).length === 2);
// On a phone this same element is the drawer over the content: restoring it open would
// put the black overlay across the screen on load.
ok("the phone is never written to, and always starts closed",
  /if \(!wide\) return false;/.test(app) && /window\.innerWidth < 768\) return;   \/\/ never from the phone drawer/.test(app));
ok("the width default survives as the fallback", /return wide;/.test(app));
// The sidebar itself is untouched — it still reads the same nav data everything else does.
ok("the sidebar still renders from visibleNav", /visibleNav\(currentUser\?\.role \|\| ""\)\.map/.test(app));

console.log("\nan open screen catches up on its own");
// 7 Sep 2026: one person filed a document and the others kept showing their last load.
// The server was never the problem — the client had no focus listener, no
// visibilitychange listener and no interval anywhere.
ok("it refreshes when the window is focused again", /window\.addEventListener\("focus", catchUp\)/.test(app));
ok("and when the tab becomes visible again", /document\.addEventListener\("visibilitychange", onVisible\)/.test(app));
ok("plus a 60-second tick", /setInterval\(catchUp, 60_000\)/.test(app));
ok("all three are torn down again", /removeEventListener\("focus", catchUp\)/.test(app)
  && /removeEventListener\("visibilitychange", onVisible\)/.test(app) && /clearInterval\(t\)/.test(app));
// A hidden tab must cost nothing — this is the whole of the phone battery answer.
ok("nothing is requested while the tab is hidden", /if \(catchingUp\.current \|\| document\.hidden\) return;/.test(app));
ok("and a slow load cannot stack", /catchingUp\.current = true;/.test(app) && /finally \{ catchingUp\.current = false; \}/.test(app));
// /api/state is 985 KB uncompressed; the probe is 44 bytes. Polling the wrong one of
// those once a minute per tab is a megabyte a minute each.
ok("the cheap question is asked before the expensive one",
  /const r = await fetch\("\/api\/state\/version"\);/.test(app) && /if \(!v \|\| v === stateVersion\.current\) return;/.test(app));
ok("the first look only records the version, it does not refetch", /stateVersion\.current === null.*return;/.test(app));
ok("and a person's own action does not read as someone else's change",
  /fetch\("\/api\/state\/version"\)[\s\S]{0,160}stateVersion\.current = d\.v/.test(app));
ok("it does not run at all when nobody is signed in", /if \(!fbUser\) return;/.test(app));
// Explicitly not built, and the reasons are in the commit: no socket, no polling library,
// and no notification — web push stays reserved for a person's own turn.
ok("no WebSocket and no polling library", !/WebSocket|socket\.io|swr|react-query/i.test(code));

console.log("\nthe masthead is the way back to the doors");
// 6 Sep 2026: the brand block in both headers is the button home — not a home icon added
// beside it. On a phone the sidebar is behind the hamburger, so this is the whole
// difference between the doors being one tap away and two.
ok("it goes through the sidebar's own handler, never a bare setActiveTab",
  /const goHome = \(\) => handleNavClick\(LANDING\[/.test(app));
// A literal "doors" here would silently outlive a change to the landing rule.
ok("and it targets LANDING, not a tab name written out", !/handleNavClick\("doors"\)/.test(app)
  && /LANDING\[currentUser\?\.role \|\| ""\]/.test(app));
ok("both headers are real buttons, not clickable divs",
  (app.match(/onClick=\{goHome\}/g) || []).length === 2
  && (app.match(/type="button" onClick=\{goHome\}/g) || []).length === 2);
ok("each carries a translated label saying where it goes",
  (app.match(/aria-label=\{t\("Go to the doors"\)\}/g) || []).length === 2
  && arSrcHas("Go to the doors"));
// The phone is the surface that needs the touch target; the header there is 64px tall.
ok("the phone one meets the 44px touch minimum", /\$\{BRAND_BUTTON\} min-h-\[44px\]/.test(app));
ok("both read as pressable — hover tint and a focus ring", /hover:bg-\[#6D1A1A\]/.test(app)
  && /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#6D1A1A\]/.test(app));

console.log("\na reload keeps the door, and only the door");
// 6 Sep 2026: reloading on any screen returned to the landing page, because the open door
// lived only in React state. The address bar already carried one for a single hop (the
// notification deep link) and now keeps it. The distinction this rests on: a door is where
// you are standing and survives; a record is an instruction, carried out once.
ok("the open door is seeded from the address bar, not from a literal",
  /useState<string>\(\s*\(\) => new URLSearchParams\(window\.location\.search\)\.get\("door"\) \|\| "doors"\s*\)/.test(app));
ok("and every change to it is written back", /replaceState\(\{\}, "", `\$\{window\.location\.pathname\}\?door=\$\{encodeURIComponent\(activeTab\)\}`\)/.test(app)
  && /\}, \[activeTab\]\);/.test(app));
// The old code scrubbed the whole query. Keeping `door` is the fix; keeping `focus` would
// re-open the same voucher on every later reload, which is the bug the scrub existed for.
ok("the record is still read once and not written back", /const focus = new URLSearchParams\(window\.location\.search\)\.get\("focus"\);/.test(app)
  && !/\?door=[^`]*focus=/.test(code));
ok("nothing was swapped in for the URL — no sessionStorage, no second home for the door",
  !/sessionStorage/.test(code));
// pushState would make the phone's Back button walk between doors. A real improvement and
// a separate decision; today Back still leaves the app, and this must not change that.
ok("the history is replaced, never pushed", !/pushState|popstate/.test(code));
// A cold start of the installed app has no query at all: start_url is "/".
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
ok(`a cold start carries no door (start_url ${manifest.start_url}) and falls back to the landing`,
  manifest.start_url === "/" && ALL_ROLES.every(r => LANDING[r] === "doors"));
// The one thing that must still hold: a door in the URL that this role cannot open.
for (const role of ["Project Officer", "Employee (Self-Service)", "Reporter"]) {
  ok(`${role}: a hand-typed ?door=banking is still refused and falls back to ${LANDING[role]}`,
    !keys(role).includes("banking") && keys(role).includes(LANDING[role]));
}

const arSrc = readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8");
const labels = NAV.flatMap(s => [s.section, ...s.items.map(i => i.label)]);
ok("every door and section has an Arabic label", labels.every(l => arSrc.includes(`"${l.replace(/"/g, '\\"')}":`)), labels.filter(l => !arSrc.includes(`"${l}":`)).join(", "));

console.log("\nrestricted roles never see the books");
for (const role of ["Project Officer", "Reporter", "Employee (Self-Service)", "Procurement and Logistics Officer", "Digital Officer", "Chief Editor", "Production Manager", "Graphic Designer"]) {
  ok(`${role}: no ledger, bank, accounts, reports`, !keys(role).some(k => ["ledger", "banking", "accounts", "reports", "partners"].includes(k)));
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
