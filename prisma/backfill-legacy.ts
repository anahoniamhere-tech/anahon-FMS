// One-off backfill: donors + projects the bank statements and vault know about but the app did not.
// Idempotent — deterministic ids, upserts throughout. Safe to re-run.
//   npx tsx prisma/backfill-legacy.ts
//
// Budget basis: cash actually received per the BLOM statements (user decision, 30 Jul 2026).
// Where no deposit exists in the statement period the budget is 0 rather than a proposal figure —
// the vault budget files for ASFARI-2024 and SKF-2025-INVJ are a recycled 2022 template and do not
// describe those grants. Dates shown as Jan-01..Dec-31 mean "year known, exact dates not evidenced".
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import os from "os";

const prisma = new PrismaClient();
const VAULT_ROOT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Downloads", "AnaHon_Document_Vault");
const EUR = 1.1406; // FxRates.EUR — same rate the rest of the app reports at

const DONORS = [
  { id: "don-skf", name: "Samir Kassir Foundation", country: "Lebanon", contactEmail: "",
    notes: "SKF. Bank: $1,643.74 (10-Jan-2025) + $1,651.38 (13-Nov-2025) service/subscription contributions; EUR 20,297.30 MediaMig first payment (02-Jun-2026)." },
  { id: "don-asfari", name: "The Asfari Foundation", country: "United Kingdom", contactEmail: "",
    notes: "Bank: $8,877.68 (21-Jun-2024, 2024 grant); $10,000.00 (09-Jun-2026, 2026 LER grant). Contact Nada Hamad." },
  { id: "don-bwz", name: "Basmeh & Zeitooneh", country: "Lebanon", contactEmail: "",
    notes: "FRL sub-grant 2023 ('I Am the Content'). No deposit in the BLOM statement period — funded before 26-Jan-2024. Vault holds contract + financial report + 3 invoices." },
  { id: "don-weworld", name: "WeWorld GVC", country: "Italy", contactEmail: "",
    notes: "Bank: $4,301.50 (09-Jun-2026). No project documents in the vault; purpose to confirm." },
  { id: "don-iri", name: "International Republican Institute", country: "United States", contactEmail: "",
    notes: "Bank: $4,000.00 (24-Oct-2024). One-off, no vault documents." },
  { id: "don-fld", name: "Front Line Defenders", country: "Ireland", contactEmail: "",
    notes: "Bank: EUR 1,370.00 (30-Dec-2024, ref A1170/24LB10). One-off, no vault documents." },
  { id: "don-fhi360", name: "FHI 360", country: "United States", contactEmail: "",
    notes: "Pass-through only, not AnaHon income: $915.00 (04-Sep-2024) + $579.19 (04-Oct-2024) forwarded to Malek Alloush." },
  { id: "don-tec", name: "Tripoli Entrepreneurs Club", country: "Lebanon", contactEmail: "",
    notes: "Bank: $255.00 + $1,100.00 (05-Jun-2024, transfers from 068/02/353/2055145/1). One-off, no vault documents." },
];

const PROJECTS = [
  // code === vault folder name, so document pointers resolve without moving a single file
  { id: "proj-bwz-frl", code: "BWZ-2023-FRL", name: "I Am the Content — Basmeh & Zeitooneh (FRL)",
    donorId: "don-bwz", budgetUSD: 0, startDate: "2023-04-15", endDate: "2023-05-15",
    fundingType: "Restricted Grant", status: "Completed",
    why: "Budget 0: no matching BLOM deposit (predates the statement period). Its own financial report shows a $19,932 grant and $4,072 spent — confirm before reporting." },

  { id: "proj-asfari-2024", code: "ASFARI-2024", name: "Asfari Foundation Grant 2024",
    donorId: "don-asfari", budgetUSD: 8877.68, startDate: "2024-06-21", endDate: "2024-12-31",
    fundingType: "Restricted Grant", status: "Completed",
    why: "Budget = $8,877.68 received 21-Jun-2024. End date is a year-end placeholder; the vault budget file is a recycled 2022 SKF template and was not used." },

  { id: "proj-fpu-icontent2", code: "FPU-2024-ICONTENT2", name: "IContent 2 — Free Press Unlimited (2024)",
    donorId: "don-fpu", budgetUSD: 0, startDate: "2024-01-01", endDate: "2024-12-31",
    fundingType: "Restricted Grant", status: "Completed",
    why: "Budget 0: no matching BLOM deposit — receipts show funds arrived via BOB Finance. Proposal budget was EUR 19,980 over 4 months; dates not evidenced." },

  { id: "proj-skf-invj", code: "SKF-2025-INVJ", name: "Investigative Journalism — Samir Kassir Foundation",
    donorId: "don-skf", budgetUSD: 3295.12, startDate: "2025-01-01", endDate: "2025-12-31",
    fundingType: "Unrestricted Service", status: "Completed",
    why: "Budget = $1,643.74 + $1,651.38 SKF service payments received in 2025. Both vault budget files are recycled templates ($39,080 / $20,042) and were not used." },

  { id: "proj-asfari-ler", code: "ASFARI-2026-LER", name: "Asfari Foundation — LER 2026",
    donorId: "don-asfari", budgetUSD: 10000, startDate: "2026-06-09", endDate: "2026-08-15",
    fundingType: "Restricted Grant", status: "Active",
    why: "ACTIVE. Budget = $10,000 received 09-Jun-2026. End = End-of-Grant Report date; implementation window closes 01-Aug-2026. Note $5,000 of the grant is not covered by the approved plan — open with Asfari." },

  { id: "proj-skf-mediamig", code: "SKF-2026-MEDIAMIG", name: "MediaMig — Samir Kassir Foundation",
    donorId: "don-skf", budgetUSD: Number((20297.30 * EUR).toFixed(2)), startDate: "2026-06-02", endDate: "2026-12-31",
    fundingType: "Restricted Grant", status: "Active",
    why: `ACTIVE. Budget = EUR 20,297.30 FIRST payment converted at ${EUR}. Total grant value unknown — replace with the contract figure. End date is a placeholder.` },
];

// Folders whose files exist on disk but were never registered
const FOLDERS_TO_REGISTER = ["BWZ-2023-FRL", "ASFARI-2024", "FPU-2024-ICONTENT2", "SKF-2025-INVJ"];

// Incoming donor money -> the project it funds. Outgoing money already reaches a project through
// voucherNo, so only deposits are listed here. Matched on date + amount so a wrong row cannot be
// silently claimed; anything that does not match exactly is reported and left unlinked.
// Deliberately NOT linked: WeWorld $4,301.50, IRI $4,000, FLD EUR 1,370, FHI360 pass-through,
// TEC $1,355 (donor records only, no project), and FX/fee/reversal lines (operational, not donor income).
const FUNDING: { date: string; amount: number; projectId: string }[] = [
  { date: "2024-06-21", amount: 8877.68, projectId: "proj-asfari-2024" },
  { date: "2025-01-10", amount: 1643.74, projectId: "proj-skf-invj" },
  { date: "2025-11-13", amount: 1651.38, projectId: "proj-skf-invj" },
  { date: "2026-06-09", amount: 10000.0, projectId: "proj-asfari-ler" },
  { date: "2026-06-02", amount: 20297.3, projectId: "proj-skf-mediamig" },
  // Already-known projects, previously unlinked to their own funding
  { date: "2025-08-19", amount: 11285.0, projectId: "proj-fpu-vu" },
  { date: "2026-01-07", amount: 9028.0, projectId: "proj-fpu-vu" },
  { date: "2026-07-02", amount: 2236.0, projectId: "proj-fpu-vu" },
  { date: "2026-03-27", amount: 500.0, projectId: "proj-fpu-vu" },  // ref 50679/25049 — purpose still to clarify with FPU
  { date: "2026-07-10", amount: 21.0, projectId: "proj-fpu-vu" },   // ref 50679/25049 residual
  { date: "2026-02-26", amount: 2000.0, projectId: "proj-trf" },
  { date: "2026-06-08", amount: 3029.43, projectId: "proj-trf" },
];

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html",
  ".txt": "text/plain",
  ".zip": "application/zip",
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".")) return []; // .DS_Store and friends
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

async function audit(action: string, details: string) {
  await prisma.auditLog.create({
    data: {
      id: `aud-backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: "u-1",
      userName: "Saad Matar",
      action,
      details,
      timestamp: new Date().toISOString(),
    },
  });
}

async function main() {
  if (!fs.existsSync(VAULT_ROOT)) throw new Error(`Vault not found at ${VAULT_ROOT}`);

  for (const d of DONORS) {
    const existed = await prisma.donor.findUnique({ where: { id: d.id } });
    await prisma.donor.upsert({ where: { id: d.id }, update: d, create: d });
    if (!existed) await audit("Donor Created", `Backfilled donor ${d.name} from bank statement evidence. ${d.notes}`);
  }
  console.log(`donors:   ${DONORS.length} upserted`);

  for (const { why, ...p } of PROJECTS) {
    const existed = await prisma.project.findUnique({ where: { id: p.id } });
    await prisma.project.upsert({ where: { id: p.id }, update: p, create: p });
    if (!existed) await audit("Project Created", `Backfilled project ${p.name} (${p.code}), budget ${p.budgetUSD} USD. ${why}`);
  }
  console.log(`projects: ${PROJECTS.length} upserted`);

  let registered = 0;
  for (const folder of FOLDERS_TO_REGISTER) {
    const project = PROJECTS.find((p) => p.code === folder)!;
    const root = path.join(VAULT_ROOT, folder);
    if (!fs.existsSync(root)) { console.warn(`  ! missing folder ${folder}`); continue; }

    for (const file of walk(root)) {
      const rel = path.relative(VAULT_ROOT, file);
      const pointer = `file://${rel}`;
      if (await prisma.appDoc.findFirst({ where: { base64: pointer } })) continue; // already registered

      const ext = path.extname(file).toLowerCase();
      const kb = Math.max(1, Math.round(fs.statSync(file).size / 1024));
      await prisma.appDoc.create({
        data: {
          id: `doc-legacy-${rel.replace(/[^\w]+/g, "-").toLowerCase()}`,
          filename: path.basename(file),
          mimeType: MIME[ext] || "application/octet-stream",
          sizeStr: `${kb} KB`,
          base64: pointer,
          category: path.dirname(rel).split(path.sep)[1] || "General", // the folder under the project code
          linkedRecordType: "Project",
          linkedRecordId: project.id,
          created_at: new Date().toISOString(),
        },
      });
      registered++;
    }
  }
  if (registered) await audit("Documents Registered", `Registered ${registered} pre-existing vault files against backfilled projects. Files were not moved or modified; the app now points at them in place.`);
  console.log(`docs:     ${registered} newly registered`);

  let linked = 0;
  for (const f of FUNDING) {
    const matches = await prisma.bankTransaction.findMany({
      where: { date: f.date, amount: f.amount, type: "Deposit" },
    });
    if (matches.length !== 1) {
      console.warn(`  ! ${f.date} ${f.amount}: expected 1 deposit, found ${matches.length} — left unlinked`);
      continue;
    }
    const tx = matches[0];
    if (tx.projectId === f.projectId) continue; // already linked
    await prisma.bankTransaction.update({ where: { id: tx.id }, data: { projectId: f.projectId } });
    await audit("Bank Transaction Linked", `Linked deposit ${f.date} ${f.amount} ("${tx.description}") to project ${f.projectId}. Source: BLOM statement, account ${tx.bankAccountId}.`);
    linked++;
  }
  console.log(`funding:  ${linked} deposits newly linked to projects`);

  const unlinked = await prisma.bankTransaction.count({ where: { type: "Deposit", projectId: null } });
  console.log(`          ${unlinked} deposits remain unlinked (donor-only income, FX, fees, reversals)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
