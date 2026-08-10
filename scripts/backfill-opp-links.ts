// One-off: attach the verified application URL to each opportunity that has a public call.
// Goes through /api/opportunities/save (not the DB) so every write lands an audit line.
// Only links confirmed on the funder's own site are here; relationship-based prospects
// (FPU, Asfari, TRF, SKF sub-grant) have no public application page and stay empty.
import { PrismaClient } from "@prisma/client";

const LINKS: [string, string][] = [
  ["Pulitzer Center", "https://pulitzercenter.org/grant-application"],
  ["Earth Journalism Network", "https://earthjournalism.net/opportunities/media-grants-to-support-coverage-of-countries-progress-toward-the-30x30-marine-0"],
  ["IDFA Bertha Fund", "https://professionals.idfa.nl/training-funding/funding/ibf-classic/"],
  ["Goethe-Institut", "https://www.goethe.de/en/kul/foe/int.html"],
  ["British Council", "https://arts.britishcouncil.org/connections-through-culture"],
  ["EED re-engagement", "https://democracyendowment.eu/support"],
];

async function main() {
const prisma = new PrismaClient();
const opps = await prisma.opportunity.findMany();
await prisma.$disconnect();

for (const [needle, link] of LINKS) {
  const o = opps.find(x => x.title.includes(needle));
  if (!o) { console.log(`SKIP  no opportunity matching "${needle}"`); continue; }
  const r = await fetch("http://localhost:3000/api/opportunities/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: o.id, title: o.title, donorId: o.donorId, stream: o.stream, stage: o.stage,
      amount: o.amount, currency: o.currency, deadline: o.deadline, decisionDate: o.decisionDate,
      renewalOfProjectId: o.renewalOfProjectId, notes: o.notes, link,
      user: { id: "u-1", name: "Saad Matar", role: "Super Admin" },
    }),
  });
  const j = await r.json();
  console.log(`${r.ok ? "OK   " : "FAIL "} ${o.title.slice(0, 50).padEnd(52)} ${r.ok ? j.opportunity.link : JSON.stringify(j)}`);
}
}
main();
