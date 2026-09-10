// Does every document record still have its bytes?
//
// A row in AppDoc outlives its file. On 9 Sep 2026 this found 107 of 498 documents pointing at
// files that were not on the NAS, not on the Mac mirror and not in the oldest ZFS snapshot —
// including signed contract addenda, grant agreements, payment vouchers and 26 team receipts.
// This is the check that says whether that is still true, and the one to run after any recovery
// attempt to see what came back.
//
// Read-only. Locally:  DATABASE_URL="file:./dev.db" VAULT_ROOT=/path/to/vault npx tsx scripts/check-vault-files.ts
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";

const VAULT_ROOT = process.env.VAULT_ROOT || "/data/vault";
/** Exactly the app's own resolver (server.ts vaultPathFromPointer) — so this gives the same answer the routes do. */
const resolve = (pointer: string): string | null => {
  if (!pointer.startsWith("file://")) return null;
  const abs = path.resolve(VAULT_ROOT, pointer.slice("file://".length));
  return abs.startsWith(path.resolve(VAULT_ROOT)) ? abs : null;
};
/** Categories where a lost file costs more than a reference photo does. */
const SENSITIVE = /contract|agreement|voucher|invoice|receipt|payslip|payroll|personnel|passport|bank|registration|quotation|report|statement|certificate|licen|legal|tax/i;

const prisma = new PrismaClient();
const docs = await prisma.appDoc.findMany({ orderBy: { created_at: "asc" } });
const missing = docs.filter(d => {
  const b = d.base64 || "";
  if (!b.startsWith("file://")) return false;          // inline bytes, or none recorded — not a lost file
  const f = resolve(b);
  return !f || !existsSync(f);
});
const sensitive = missing.filter(d => SENSITIVE.test(d.category));
const byCategory = missing.reduce<Record<string, number>>((a, d) => (a[d.category] = (a[d.category] || 0) + 1, a), {});

console.log(`documents: ${docs.length}  ·  bytes present: ${docs.length - missing.length}  ·  MISSING: ${missing.length}  ·  of those sensitive: ${sensitive.length}`);
for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${cat}${SENSITIVE.test(cat) ? "   <-- sensitive" : ""}`);
}
if (missing.length) {
  const dates = missing.map(d => d.created_at.slice(0, 10)).sort();
  console.log(`  filed between ${dates[0]} and ${dates[dates.length - 1]}`);
}
process.exit(missing.length ? 1 : 0);   // non-zero so it can gate a backup or a deploy
