// Can a stranger on the network read anything?
//
// Until 5 Sep 2026 the auth middleware guarded POST only, so every GET under /api — the
// bank-derived subscription suggestions among them — answered anyone who could reach the
// port. This pins the guard and the three routes that are narrower still.
// Run: npx tsx scripts/check-reads.ts
import { readFileSync } from "node:fs";

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
ok("exactly three", open.length === 3, open.join(","));
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
ok("a diary is personal — each person reads their own feeds only", /const feeds = feedsFor\(viewer\);/.test(server) && /f\.userId \? f\.userId === user\.id : isDirector\(user\.role\)/.test(server));

console.log("\nwhat the browser can still show");
const files = ["App.tsx", "tabs/EditorialTab.tsx", "tabs/ExpensesTab.tsx", "tabs/ProjectsTab.tsx", "tabs/ProductionTab.tsx"];
for (const f of files) {
  const text = src(f);
  const bare = [...text.matchAll(/(?:src|href)=\{`\/api\/[^`]*`\}/g)].map(m => m[0]);
  ok(`${f}: every element URL carries the ticket`, bare.length === 0, bare.join(" | "));
}
ok("the download link to the legacy feed needs nothing", src("tabs/EditorialTab.tsx").includes('href="/api/calendar.ics"'));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
