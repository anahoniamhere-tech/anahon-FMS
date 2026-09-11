// Can a stranger on the network read anything?
//
// Until 5 Sep 2026 the auth middleware guarded POST only, so every GET under /api — the
// bank-derived subscription suggestions among them — answered anyone who could reach the
// port. This pins the guard and the three routes that are narrower still.
// Run: npx tsx scripts/check-reads.ts
import { readFileSync } from "node:fs";
import { visibleNav } from "../src/nav.js";
import { ALL_ROLES, FULL_VIEW } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

console.log("\nthe guard");
ok("every API GET needs a viewer", /req\.method === "GET" && req\.path\.startsWith\("\/api\/"\) && !OPEN_GETS\.has\(req\.path\)/.test(server));
ok("no viewer, no read", /if \(!viewerId\) return res\.status\(401\)/.test(server));
ok("a deactivated account reads nothing", /if \(!viewer \|\| !viewer\.active\) return res\.status\(403\)/.test(server));
ok("it accepts the sign-in token or a document ticket", /const viewerId = await viewerIdFromReq\(req\);/.test(server));

console.log("\nthe exceptions, and only those");
const open = JSON.parse((server.match(/const OPEN_GETS = new Set\((\[[^\]]*\])\)/) || [])[1] || "[]") as string[];
ok("exactly four", open.length === 4, open.join(","));
ok("Meta's return address after connecting a Page", open.includes("/api/social/meta/callback"));
// It carries no sign-in header (Meta redirects the browser), so its credential is the random
// single-use state minted by /api/social/meta/connect for a signed-in editor; the callback must
// look it up and refuse without it.
ok("the callback demands the state it minted", /const who = state \? connectStates\.get\(state\) : undefined;/.test(server) && /if \(!who \|\| who\.expires < Date\.now\(\)\) return back\(/.test(server));
ok("the person's own feed", open.includes("/api/desk.ics"));
ok("the legacy shared editorial feed", open.includes("/api/calendar.ics"));
ok("the ticket route, which refuses by itself", open.includes("/api/document/ticket"));
ok("both feeds are office-network only", (server.match(/if \(!fromPrivateNetwork\(req\)\) return res\.status\(403\)/g) || []).length === 2);
ok("the private range excludes public addresses", (() => {
  const re = new RegExp((server.match(/const PRIVATE_IP = (\/.*\/)i;/) || [])[1].slice(1, -1), "i");
  return ["10.0.0.5", "192.168.1.22", "172.20.0.3", "127.0.0.1", "100.101.250.22", "::1"].every(ip => re.test(ip))
    && ["8.8.8.8", "51.15.3.4", "172.15.0.1", "100.63.0.1", "100.128.0.1", "2.2.2.2"].every(ip => !re.test(ip));
})());

console.log("\nnarrower still");
ok("the bank statement's suggestions are finance's and procurement's", /SUPPLIER_EDITORS\.includes\(\(req as any\)\.dbUser\?\.role\)/.test(server));
ok("the seat log is the director's", /isDirector\(req\.dbUser\?\.role\)\) return res\.status\(403\)/.test(server));
ok("the financial statements keep their own reader list", /REPORT_READERS\.includes\(reader\.role\)/.test(server));
ok("a quotation needs a role, not just a sign-in", /if \(!viewer \|\| !FULL_VIEW\.includes\(viewer\.role\)\)/.test(server));
ok("the quotation's role check comes before the record is looked up", (() => {
  const body = (server.match(/app\.get\("\/api\/quotations\/:id\/pdf"[\s\S]*?\n\}\);/) || [""])[0];
  return body.indexOf("FULL_VIEW.includes") > 0 && body.indexOf("FULL_VIEW.includes") < body.indexOf("prisma.quotation.findUnique");
})());
ok("and that list IS the Clients & quotations door, not a second opinion", (() => {
  const door = ALL_ROLES.filter(r => visibleNav(r).some(sec => sec.items.some(i => i.navKey === "production"))).sort();
  return door.length === FULL_VIEW.length && door.every((r, i) => r === [...FULL_VIEW].sort()[i]);
})(), "nav says one set, roles.ts another");
ok("a diary is personal — each person reads their own feeds only", /const feeds = feedsFor\(viewer\);/.test(server) && /f\.userId \? f\.userId === user\.id : isDirector\(user\.role\)/.test(server));

console.log("\nreads leave a trace");
ok("sensitive reads are recorded on the way out, with the status", /res\.on\("finish"/.test(server) && /res\.statusCode < 400 \? "Record Read" : "Read Refused"/.test(server));
ok("only a signed-in reader can write a line (no anonymous flooding)", (() => {
  const g = (server.match(/if \(req\.method === "GET"[\s\S]*?return next\(\);\n  \}/) || [""])[0];
  return g.indexOf('if (!viewerId) return res.status(401)') < g.indexOf("READ_AUDIT.find") && g.includes("READ_AUDIT.find");
})());
const watched = (server.match(/const READ_AUDIT: \[RegExp, string\]\[\] = \[([\s\S]*?)\n\];/) || ["", ""])[1];
ok("the quotation, the statements, the documents and the bank suggestions are watched",
  ["quotations", "reports", "document", "subscriptions", "audit"].every(k => watched.includes(k)));
ok("the whole-state read is NOT watched — it would bury the log", !/api\\\/state/.test(watched));
ok("nor the per-page raster — one document opened is one line, not twenty", !watched.includes("page\\/[^/]+\\/") && watched.includes("pages"));
ok("a document line names the paper, not just its id", /doc\.refNo/.test(server) && /doc\.filename/.test(server));
ok("a quotation line names the offer and the client", /q\.quoteNo/.test(server) && /client\.name/.test(server));
ok("the archive ships capped, not whole", /prisma\.auditLog\.findMany\(\{ orderBy: \{ timestamp: "desc" \}, take: 500 \}\)/.test(server));
ok("and the screen is told what it is not showing", /auditLogTotal: auditTotal/.test(server) && src("tabs/ComplianceTab.tsx").includes("state.auditLogTotal"));
ok("reads and changes can be told apart on the screen", (() => {
  const tab = src("tabs/ComplianceTab.tsx");
  return tab.includes('READS = ["Record Read", "Read Refused"]') && tab.includes("shownLogs");
})());

console.log("\nwhat the browser can still show");
const files = ["App.tsx", "tabs/EditorialTab.tsx", "tabs/ExpensesTab.tsx", "tabs/ProjectsTab.tsx", "tabs/ProductionTab.tsx", "tabs/AssetsTab.tsx"];
for (const f of files) {
  const text = src(f);
  const bare = [...text.matchAll(/(?:src|href)=\{`\/api\/[^`]*`\}/g)].map(m => m[0]);
  ok(`${f}: every element URL carries the ticket`, bare.length === 0, bare.join(" | "));
}
ok("the download link to the legacy feed needs nothing", src("tabs/EditorialTab.tsx").includes('href="/api/calendar.ics"'));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
