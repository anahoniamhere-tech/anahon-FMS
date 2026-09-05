// What the desk shows today, per active login, straight from the database. Read-only.
//
// Caveat: this reads the WHOLE database, not the trimmed payload each role actually
// receives from loadState. For a restricted seat the real "Due this week" is smaller —
// a Procurement or Digital Officer is never sent the statutory checklist, so those rows
// appear here and not on their screen. "Waiting on you" is right either way.
// Run: DATABASE_URL="file:./dev.db" npx tsx scripts/desk-preview.ts
import { PrismaClient } from "@prisma/client";
import { deskItems } from "../src/workflow.js";
const p = new PrismaClient();
const today = new Date().toLocaleDateString("en-CA");
const s: any = {
  users: await p.user.findMany(), employees: await p.employee.findMany(), projects: await p.project.findMany(),
  expenses: await p.expense.findMany(), procurements: await p.procurement.findMany(), timesheets: await p.timesheet.findMany(),
  contentItems: await p.contentItem.findMany(), projectActivities: await p.projectActivity.findMany(),
  opportunities: await p.opportunity.findMany(), quotations: await p.quotation.findMany(), complianceTasks: await p.complianceTask.findMany(),
  subscriptions: await p.subscription.findMany(), tools: await p.tool.findMany(), networkContacts: await p.networkContact.findMany(),
};
for (const u of s.users.filter((x: any) => x.active)) {
  const items = deskItems({ id: u.id, email: u.email, role: u.role }, s, today);
  const g = (k: string) => items.filter(i => i.group === k);
  console.log(`\n== ${u.name} (${u.role}) — mine ${g("mine").length} · cover ${g("cover").length} · week ${g("week").length}`);
  for (const k of ["mine", "cover", "week"]) for (const i of g(k).slice(0, 6)) console.log(`   ${k.padEnd(5)} ${i.urgency.padEnd(7)} ${(i.when || "-").padEnd(10)} ${i.kind.padEnd(17)} ${i.verb} · ${i.title.slice(0, 60)}${i.seats.length ? "  [" + i.seats.join(", ") + "]" : ""}`);
  const byKind: Record<string, number> = {}; for (const i of items) byKind[`${i.group}/${i.kind}`] = (byKind[`${i.group}/${i.kind}`] || 0) + 1;
  console.log("   totals:", JSON.stringify(byKind));
}
await p.$disconnect();
