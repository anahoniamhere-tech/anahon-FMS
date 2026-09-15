// A voucher's two dates (Projects & funding's late-cost trace, 15 Sep 2026; Policy 020 §6.8).
//
// transactionDate is when the cost happened; created_at is when it was recorded. Reports place a
// cost by the first. The late-cost rule — a cost recorded after a donor report was submitted — reads
// the second, so it has to stay the real recording time: a backfill that writes a synthetic
// created_at would make a late record look punctual, which §6.8 calls backdating.
//   npx tsx scripts/check-voucher-dates.ts
import { readFileSync, readdirSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const root = new URL("../", import.meta.url);
const read = (f: string) => readFileSync(new URL(f, root), "utf8");
const server = read("server.ts");

console.log("\n1. the period report places a cost by its true date");
const period = server.slice(server.indexOf('app.get("/api/reports/period"'), server.indexOf("\n});\n", server.indexOf('app.get("/api/reports/period"')));
ok("vouchers are windowed by transactionDate, falling back to created_at only when it is blank",
  /inWindow\(e\.transactionDate \? `\$\{e\.transactionDate\}T12:00:00Z` : e\.created_at\)/.test(period));
ok("no voucher in the period report is windowed by created_at alone", !/inWindow\(e\.created_at\)/.test(period));
// The same rule, run: a 2024 voucher recorded today is in 2024, not in this month.
const inWindow = (iso: string | null | undefined, start: Date, end: Date) => { if (!iso) return false; const d = new Date(iso); return d >= start && d < end; };
const placed = (e: { transactionDate: string; created_at: string }) => e.transactionDate ? `${e.transactionDate}T12:00:00Z` : e.created_at;
const sep2026 = [new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2026, 9, 1))] as const;
const mar2024 = [new Date(Date.UTC(2024, 2, 1)), new Date(Date.UTC(2024, 3, 1))] as const;
const backfilled = { transactionDate: "2024-03-31", created_at: "2026-09-15T08:00:00.000Z" };
ok("a voucher backfilled today for 31 Mar 2024 lands in March 2024 …", inWindow(placed(backfilled), ...mar2024));
ok("… and not in September 2026", !inWindow(placed(backfilled), ...sep2026));
ok("an old voucher with no true date still falls back to when it was recorded", inWindow(placed({ transactionDate: "", created_at: "2026-09-02T10:00:00Z" }), ...sep2026));

console.log("\n1b. Books' other readers of a voucher's date (sweep of 15 Sep 2026)");
const ledgerTab = read("src/tabs/LedgerTab.tsx");
ok("the ledger's reclassify picker orders vouchers by their true date first", /b\.transactionDate \|\| b\.paid_at \|\| b\.created_at/.test(ledgerTab) && !/\(b\.paid_at \|\| b\.created_at/.test(ledgerTab));
const audit = server.slice(server.indexOf('app.post("/api/gemini/compliance-audit"'), server.indexOf("\n});\n", server.indexOf('app.post("/api/gemini/compliance-audit"')));
ok("the compliance audit is given each voucher's true date AND when it was recorded", /date: e\.transactionDate \|\| e\.created_at\?\.split\("T"\)\[0\], recordedOn: e\.created_at/.test(audit));

console.log("\n2. nothing writes a synthetic created_at on a voucher");
// Every place a voucher is written: the server and every backfill/import script. prisma/seed.ts is the
// demo fixture for an empty database and never runs against the books.
const files = ["server.ts",
  ...readdirSync(new URL("scripts/", root)).filter(f => f.endsWith(".ts") && f !== "check-voucher-dates.ts").map(f => `scripts/${f}`),
  ...readdirSync(new URL("prisma/", root)).filter(f => f.endsWith(".ts") && f !== "seed.ts").map(f => `prisma/${f}`)];
const REAL_NOW = /^(new Date\(\)\.toISOString\(\)|nowStr|now)$/;
let writes = 0;
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/\b(?:prisma|tx|t)\.expense\.(create|createMany|update|updateMany|upsert)\(/g)) {
    writes++;
    // The call itself, to its closing bracket — not whatever query follows it.
    let depth = 0, i = m.index! + m[0].length - 1;
    for (; i < src.length; i++) { if (src[i] === "(") depth++; else if (src[i] === ")" && --depth === 0) break; }
    const body = src.slice(m.index!, i + 1);
    const stamp = body.match(/\bcreated_at:\s*([^,\n}]+)/);
    if (m[1] === "create" || m[1] === "createMany") {
      ok(`${f}: expense.${m[1]} stamps created_at with the real time`, !stamp || REAL_NOW.test(stamp[1].trim()), stamp?.[1]);
    } else {
      ok(`${f}: expense.${m[1]} never rewrites created_at`, !stamp, stamp?.[1]);
    }
  }
}
ok("the scan found the voucher writers it is meant to guard", writes >= 5, `${writes} found`);
ok("the late-cost rule has a real recording time to read: the rebuild never writes an expense", !/expense\.(create|update|upsert)/.test(read("prisma/rebuild-ledger.ts")));

// The party file (App.tsx) lists a payee's vouchers: ordered and dated by the true date, recording time shown only when it differs.
const app = read("src/App.tsx");
ok("the party file dates each voucher by transactionDate, then paid_at, then created_at",
  /const voucherDay = \(e: any\) => String\(e\.transactionDate \|\| e\.paid_at \|\| e\.created_at/.test(app));
ok("the party file orders its vouchers by that date, not by when they were recorded",
  /\.sort\(\(a, b\) => voucherDay\(a\)\.localeCompare\(voucherDay\(b\)\)\)/.test(app) && !/\.sort\(\(a, b\) => \(a\.created_at/.test(app));
ok("the party file shows the voucher's date, and 'recorded' only where the recording day differs",
  app.includes("{voucherDay(e)} · {e.voucherNo}") && /\(e\.created_at \|\| ""\)\.slice\(0, 10\) !== voucherDay\(e\) && <em[^>]*>recorded /.test(app)
  && !app.includes('{(e.created_at || "").slice(0, 10)} · {e.voucherNo}'));
console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
