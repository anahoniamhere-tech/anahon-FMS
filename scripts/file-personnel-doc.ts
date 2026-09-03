/**
 * File a personnel document (passport, ID, CV) into the vault under PERSONNEL/<name>
 * and register it as an AppDoc owned by that employee.
 *
 *   npx tsx scripts/file-personnel-doc.ts <employeeId> <category> <path-to-file>
 *
 * Same rules as the upload endpoint: bytes hashed so the same file never files twice,
 * DB keeps a file:// pointer, category is what makes it restricted (personnelDocs.ts).
 */
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { isPersonnelDoc } from "../src/personnelDocs.js";

const prisma = new PrismaClient();
const VAULT_ROOT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Documents", "AnaHon_Document_Vault");

async function nextDocRef(): Promise<string> {
  const rows = await prisma.appDoc.findMany({ where: { refNo: { not: null } }, select: { refNo: true } });
  const max = rows.reduce((m, r) => Math.max(m, parseInt((r.refNo || "").replace(/\D/g, ""), 10) || 0), 0);
  return `ANH-DOC-${String(max + 1).padStart(5, "0")}`;
}

async function main() {
  const [employeeId, category, src] = process.argv.slice(2);
  if (!employeeId || !category || !src) {
    console.error("usage: file-personnel-doc.ts <employeeId> <category> <file>");
    process.exit(1);
  }
  if (!isPersonnelDoc({ category })) {
    console.error(`"${category}" is not a personnel category — it would not be restricted.`);
    process.exit(1);
  }

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new Error(`No employee ${employeeId}`);

  const buffer = fs.readFileSync(src);
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const dupe = await prisma.appDoc.findFirst({ where: { contentHash } });
  if (dupe) {
    console.log(`Already on file as ${dupe.refNo || dupe.id} (${dupe.filename}) — nothing written.`);
    return;
  }

  const folder = path.join("PERSONNEL", emp.name.replace(/[^\w.\- ]/g, "_"));
  let filename = `${emp.name.replace(/\s+/g, "_")}_${category.replace(/[^\w]+/g, "_")}${path.extname(src)}`;
  const dir = path.join(VAULT_ROOT, folder, category);
  fs.mkdirSync(dir, { recursive: true });
  // A second CV for the same person must not silently overwrite the first: the older
  // AppDoc row would keep pointing at this path while its contentHash no longer matched
  // the bytes there — corruption that only surfaces at audit. Same guard the upload
  // endpoint uses.
  if (fs.existsSync(path.join(dir, filename))) {
    const ext = path.extname(filename);
    filename = `${path.basename(filename, ext)}_${new Date().toISOString().slice(0, 10)}_${Date.now()}${ext}`;
  }
  fs.writeFileSync(path.join(dir, filename), buffer);

  const refNo = await nextDocRef();
  const doc = await prisma.appDoc.create({
    data: {
      id: `doc-${Date.now()}`,
      refNo,
      filename,
      mimeType: /\.pdf$/i.test(src) ? "application/pdf" : "application/octet-stream",
      sizeStr: `${Math.max(1, Math.round(buffer.length / 1024))} KB`,
      base64: `file://${folder}/${category}/${filename}`,
      category,
      linkedRecordType: "Employee",
      linkedRecordId: emp.id,
      partyId: emp.id,
      contentHash,
      note: `${category} — personnel file of ${emp.name}. Restricted.`,
      created_at: new Date().toISOString(),
    },
  });

  await prisma.auditLog.create({
    data: {
      id: `log-${Date.now()}`,
      userId: "u-1",
      userName: "Saad Matar",
      action: "Personnel Document Filed",
      details: `${category} filed to the personnel file of ${emp.name} as ${refNo}. Visible only to HR / Payroll, the Program Director and ${emp.name}.`,
      timestamp: new Date().toISOString(),
    },
  });

  console.log(`${refNo}  ${doc.base64}`);
  console.log(`sha256 ${contentHash}`);
}

main().finally(() => prisma.$disconnect());
