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

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
