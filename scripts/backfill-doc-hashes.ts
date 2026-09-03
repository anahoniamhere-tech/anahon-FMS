/**
 * Backfill AppDoc.contentHash for documents filed before hashing existed.
 * Read-only against the vault; writes only the hash column.
 *
 *   npx tsx scripts/backfill-doc-hashes.ts          # write
 *   npx tsx scripts/backfill-doc-hashes.ts --check  # report only
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const VAULT_ROOT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Downloads", "AnaHon_Document_Vault");
const CHECK = process.argv.includes("--check");
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.appDoc.findMany({ where: { contentHash: "" } });
  const seen = new Map<string, string>();   // hash → first refNo/id
  let hashed = 0, missing = 0, dupes = 0;

  for (const d of docs) {
    if (!d.base64.startsWith("file://")) { missing++; continue; }
    const abs = path.resolve(VAULT_ROOT, d.base64.slice("file://".length));
    if (!abs.startsWith(path.resolve(VAULT_ROOT)) || !fs.existsSync(abs)) { missing++; continue; }
    const hash = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
    const first = seen.get(hash);
    if (first) { dupes++; console.log(`  duplicate: ${d.refNo || d.id} "${d.filename}" == ${first}`); }
    else seen.set(hash, d.refNo || d.id);
    if (!CHECK) await prisma.appDoc.update({ where: { id: d.id }, data: { contentHash: hash } });
    hashed++;
  }

  console.log(`\n${hashed} hashed${CHECK ? " (dry run)" : ""} · ${dupes} duplicate file(s) found · ${missing} file(s) not on disk`);
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
