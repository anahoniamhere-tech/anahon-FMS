/**
 * Write the agreement-sourced reporting obligations onto the project records, and retire
 * the invented "Final report submitted to the donor" rows they replace.
 *
 * Idempotent: run it again after editing src/donorDeadlines.ts and the rows are updated in
 * place. It never touches a status a person set by hand — only the auto rows it created.
 */
import { PrismaClient } from "@prisma/client";
import { DONOR_OBLIGATIONS, DOCUMENTED_PROJECT_IDS, obligationId } from "../src/donorDeadlines.js";

const prisma = new PrismaClient();
const today = new Date().toISOString().slice(0, 10);

for (const o of DONOR_OBLIGATIONS) {
  const id = obligationId(o);
  const data = {
    projectId: o.projectId,
    title: o.title,
    detail: `${o.detail}\n\nSource: ${o.source}`,
    kind: "Report",
    dueDate: o.due,
    status: o.done ? "Done" : "Planned",
    completedOn: o.done ? o.due || today : "",
    source: "agreement",
    assigneeUserId: "", budgetLineId: "",
    outlineNo: "", resultGroup: "", titleAr: "", startDate: "", periodsJson: "[]"
  };
  await prisma.projectActivity.upsert({
    where: { id }, update: data, create: { id, ...data, created_at: new Date().toISOString() }
  });
  console.log(`${o.due || "UNKNOWN".padEnd(10)}  ${o.projectId}  ${o.title.slice(0, 60)}`);
}

// The guessed row for the same grant would sit beside the real one saying something else.
const dropped = await prisma.projectActivity.deleteMany({
  where: { id: { in: DOCUMENTED_PROJECT_IDS.map(id => `act-auto-${id}-report`) } }
});
console.log(`\nretired ${dropped.count} invented "Final report" row(s)`);
process.exit(0);
