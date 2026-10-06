/**
 * Recompute BudgetLine.actualUSD and committedUSD from the vouchers (Books). Dry run by default.
 *
 *   npx tsx scripts/reconcile-budget-actuals.ts --project TRF-2026
 *   npx tsx scripts/reconcile-budget-actuals.ts --project TRF-2026 --apply
 *   npx tsx scripts/reconcile-budget-actuals.ts --all            # every project, dry run
 *
 * It changes no voucher and no ledger entry: only the two stored totals the budget screen reads, and only
 * where they disagree with the vouchers. The rule lives in src/budgetActuals.ts.
 */
import { PrismaClient } from "@prisma/client";
import { budgetTotals, budgetDrift } from "../src/budgetActuals.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const code = process.argv[process.argv.indexOf("--project") + 1];
if (!ALL && (!code || code.startsWith("--"))) throw new Error("Name the project: --project TRF-2026, or --all");

const projects = await prisma.project.findMany({ where: ALL ? {} : { code } });
if (!projects.length) throw new Error(`No project ${code}`);
const vouchers = await prisma.expense.findMany();
const totals = budgetTotals(vouchers as any);
const now = new Date().toISOString();

for (const p of projects) {
  const lines = await prisma.budgetLine.findMany({ where: { projectId: p.id }, orderBy: { code: "asc" } });
  const changes: string[] = [];
  for (const l of lines) {
    const drift = budgetDrift(l, totals);
    if (!drift) { console.log(`  ok    ${p.code} ${l.code}  actual ${l.actualUSD.toFixed(2)} · committed ${l.committedUSD.toFixed(2)}`); continue; }
    console.log(`  DRIFT ${p.code} ${l.code}  actual ${l.actualUSD.toFixed(2)} -> ${drift.actualUSD.toFixed(2)} (${drift.actualDiff >= 0 ? "+" : ""}${drift.actualDiff.toFixed(2)}) · committed ${l.committedUSD.toFixed(2)} -> ${drift.committedUSD.toFixed(2)} (${drift.committedDiff >= 0 ? "+" : ""}${drift.committedDiff.toFixed(2)})`);
    changes.push(`${l.code}: actual ${l.actualUSD.toFixed(2)} → ${drift.actualUSD.toFixed(2)}, committed ${l.committedUSD.toFixed(2)} → ${drift.committedUSD.toFixed(2)}`);
    if (APPLY) await prisma.budgetLine.update({ where: { id: l.id }, data: { actualUSD: drift.actualUSD, committedUSD: drift.committedUSD } });
  }
  const after = await prisma.budgetLine.findMany({ where: { projectId: p.id } });
  const sum = (f: "allocatedUSD" | "actualUSD" | "committedUSD") => after.reduce((s, l) => s + l[f], 0).toFixed(2);
  console.log(`  ${p.code}: ${changes.length} line(s) ${APPLY ? "reconciled" : "would change"} · allocated ${sum("allocatedUSD")} · actual ${sum("actualUSD")} · committed ${sum("committedUSD")}${APPLY ? "" : " (dry run)"}`);
  if (APPLY && changes.length) {
    await prisma.auditLog.create({ data: { id: `aud-budget-${Date.now()}-${p.id}`, userId: "u-1", userName: "Saad Matar", timestamp: now, action: "Budget Actuals Reconciled",
      details: `${p.code}: the stored budget totals were recomputed from the vouchers by Books — actual = posted vouchers, committed = approved or paid but not yet posted, allocations split across their own lines. ${changes.length} line(s) changed: ${changes.join("; ")}. No voucher, ledger entry or balance was touched.` } });
  }
}
await prisma.$disconnect();
