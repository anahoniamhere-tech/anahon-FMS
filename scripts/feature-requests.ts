// What people asked the FMS to do and it could not — the New and Triaged rows (Anna plan §3).
// The rooms run this when coordinating; the room that takes one triages it to Planned with its
// name on the Help & Q&A door. Nothing pushes into a session.
// Run on the NAS: docker cp scripts/feature-requests.ts anahon-fms:/app/ &&
//   docker exec -u 0 anahon-fms sh -c "cd /app && node_modules/.bin/tsx feature-requests.ts"
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.featureRequest.findMany({
  where: { status: { in: ["New", "Triaged"] } }, orderBy: [{ status: "asc" }, { createdAt: "asc" }],
});
if (!rows.length) console.log("No open requests.");
for (const r of rows) {
  console.log(`\n[${r.status}] ${r.title}  (${r.urgency}, ${r.createdName}, ${r.createdAt.slice(0, 10)}${r.door ? `, door ${r.door}` : ""}${r.room ? `, room ${r.room}` : ""})`);
  console.log(`  need: ${r.need}`);
  if (r.example) console.log(`  example: ${r.example}`);
  if (r.note) console.log(`  note: ${r.note}`);
}
await prisma.$disconnect();
