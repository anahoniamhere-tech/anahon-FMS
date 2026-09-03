// Reissue AnaHon's OWN payment voucher for closed-grant expenses whose hard copy is lost.
//
// What this does and does not do:
//   DOES  — reproduce the internal payment voucher AnaHon itself authored, from data the
//           organisation already holds: the approved budget line, the transcribed original
//           invoice reference, and the financial report the funder accepted.
//   DOES  — state on the face of every page that the original is unavailable, name the
//           sources it was rebuilt from, and leave a signature block.
//   NEVER — generate third-party paper. A vendor invoice, a utility bill or a shop receipt
//           belongs to the party that issued it; producing one here would be a forgery.
//
// The reconstruction is filed under its own category so it is never silently counted as an
// original. It closes the "no record at all" gap, not the "no independent evidence" gap —
// and an auditor is told which one they are looking at.
//
//   npx tsx scripts/reconstruct-vouchers.ts BWZ-2023-FRL            dry run
//   npx tsx scripts/reconstruct-vouchers.ts BWZ-2023-FRL --apply    write files + register
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import os from "os";
import path from "path";

const prisma = new PrismaClient();
const VAULT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Downloads", "AnaHon_Document_Vault");
const CATEGORY = "Reconstructed Voucher (original unavailable)";
const COUNTED = ["Approved", "Paid", "Posted"];

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Pull an original invoice/reference number out of the transcribed description, if one is there. */
function originalRef(title: string): string {
  const m = /invoice\s+([A-Za-z0-9\-\/]+)/i.exec(title) || /فاتورة\s+([A-Za-z0-9\-\/]+)/.exec(title);
  return m ? m[1] : "";
}

/**
 * The payee, when no vendor record was ever created. These descriptions were transcribed in a
 * consistent shape — "what it was — who it was paid to (invoice N)" — so the name is recoverable
 * from the text rather than being lost. Marked as read from the description, never invented.
 */
function payeeFromTitle(title: string): string {
  const m = /—\s*([^(]+?)\s*(?:\(|$)/.exec(title || "");
  if (!m) return "";
  const name = m[1].trim().replace(/[,;]$/, "");
  // "Program Director 45% LoE (Saad Matar)" style lines put the person in brackets instead.
  if (/^\d|%|line\s/i.test(name)) return "";
  return name.length > 1 && name.length < 60 ? name : "";
}

function voucherHtml(o: {
  voucherNo: string; date: string; payee: string; description: string; amount: number;
  currency: string; method: string; projectCode: string; projectName: string; donor: string;
  budgetLine: string; funderRef: string; origRef: string; sources: string[]; generatedAt: string;
}) {
  const row = (k: string, v: string) => v ? `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(o.voucherNo)} — Reconstructed Payment Voucher</title><style>
body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:24px auto;color:#1a1212;line-height:1.5}
h1{font-size:14px;letter-spacing:2px;border-bottom:2px solid #6D1A1A;padding-bottom:6px;margin-bottom:2px}
h2{font-size:11px;color:#6B5C5C;font-weight:normal;margin:0 0 14px}
.flag{border:1.5px solid #B3261E;background:#fdf4f3;color:#7a1a15;padding:10px 12px;font-size:11.5px;margin:14px 0;line-height:1.55}
.flag b{display:block;font-size:12px;letter-spacing:.5px;margin-bottom:3px}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12.5px}
td{border:1px solid #d8cdc7;padding:6px 9px;vertical-align:top}
td:first-child{width:34%;background:#f7f1ec;font-weight:bold}
.amt{font-size:15px;font-weight:bold}
.sign{margin-top:26px;display:flex;gap:28px;font-size:11px;color:#4a4040}
.sign div{flex:1;border-top:1px solid #999;padding-top:5px}
.note{font-size:9.5px;color:#6B5C5C;margin-top:18px;line-height:1.6;border-top:1px dashed #d8cdc7;padding-top:9px}
@media print{body{margin:8px}}
</style></head><body>
<h1>ANAHON MEDIA PLATFORM — RECONSTRUCTED PAYMENT VOUCHER</h1>
<h2>سند دفع مُعاد إصداره · ${esc(o.projectCode)} · ${esc(o.projectName)}${o.donor ? " · " + esc(o.donor) : ""}</h2>

<div class="flag">
  <b>ORIGINAL HARD COPY UNAVAILABLE · النسخة الأصلية غير متوفّرة</b>
  This is not the original voucher and is not an invoice issued by any third party. It is AnaHon's own
  payment voucher, reconstructed on ${esc(o.generatedAt)} from records the organisation holds, because the
  signed hard copy could not be located after the project closed. It evidences what AnaHon recorded and
  reported; it does not by itself evidence receipt by the payee.
</div>

<table>
  ${row("System Voucher", o.voucherNo)}
  ${row("Date of Expense", o.date)}
  ${row("Payee / Vendor", o.payee)}
  ${row("Description", o.description)}
  ${row("Original Invoice Ref. (as transcribed)", o.origRef)}
  ${row("Budget Line", o.budgetLine)}
  ${row("Funder Reference", o.funderRef)}
  ${row("Payment Method", o.method)}
  <tr><td>Amount</td><td class="amt">${esc(o.currency)} ${money(o.amount)}</td></tr>
</table>

<div class="sign">
  <div>Prepared by · أعدّه<br><br></div>
  <div>Approved by · اعتمده<br><br></div>
  <div>Date · التاريخ<br><br></div>
</div>

<p class="note">
  <b>Basis of reconstruction.</b> Rebuilt from: ${o.sources.map(esc).join("; ")}.
  No third-party document has been recreated. Where an original invoice number appears above it was
  transcribed into the accounting record at the time of payment and is reproduced here as a pointer to
  the missing original, not as a copy of it.<br>
  Filed under &ldquo;${esc(CATEGORY)}&rdquo; so that it is never counted as original supporting evidence.
</p>
</body></html>`;
}

async function main() {
  const code = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!code) { console.error("usage: reconstruct-vouchers.ts <PROJECT-CODE> [--apply]"); process.exit(1); }

  const [expenses, docs, projects, lines, vendors, donors] = await Promise.all([
    prisma.expense.findMany(), prisma.appDoc.findMany(), prisma.project.findMany(),
    prisma.budgetLine.findMany(), prisma.vendor.findMany(), prisma.donor.findMany()
  ]);

  const project = projects.find(p => p.code === code);
  if (!project) { console.error(`no project ${code}`); process.exit(1); }
  if (project.status !== "Completed") {
    console.error(`${code} is ${project.status}. Reconstruction is for closed grants whose originals are`);
    console.error(`genuinely unrecoverable — on a live grant, chase the original instead.`);
    process.exit(1);
  }

  const hasProof = (id: string) => docs.some(d =>
    d.linkedRecordType === "Expense" && d.linkedRecordId === id && !/^Digitized/i.test(d.category || ""));
  const already = (id: string) => docs.some(d => d.linkedRecordId === id && d.category === CATEGORY);

  const targets = expenses.filter(e =>
    COUNTED.includes(e.status) && e.projectId === project.id && !hasProof(e.id) && !already(e.id));

  const donor = donors.find(d => d.id === project.donorId)?.name || "";
  const generatedAt = new Date().toISOString().slice(0, 10);
  const reportDocs = docs
    .filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === project.id && /financial report|budget/i.test(d.category || ""))
    .map(d => d.filename);
  const sources = [
    `the approved project budget for ${code}`,
    reportDocs.length ? `the financial report submitted to and accepted by the funder (${reportDocs.slice(0, 2).join(", ")})` : "the financial report submitted to the funder",
    "the expense register maintained in the AnaHon management system"
  ];

  console.log(`\n${code} — ${project.name}`);
  console.log(`status ${project.status}, ended ${project.endDate}`);
  console.log(`${targets.length} voucher(s) to reconstruct, value $${money(targets.reduce((s, e) => s + e.convertedAmount, 0))}`);
  console.log(apply ? "MODE: apply — files written and registered\n" : "MODE: dry run — nothing written (pass --apply)\n");

  const dir = path.join(VAULT, code, "Reconstructed");
  if (apply) fs.mkdirSync(dir, { recursive: true });

  let n = 0;
  for (const e of targets) {
    const bl = lines.find(l => l.id === e.budgetLineId);
    const html = voucherHtml({
      voucherNo: e.voucherNo,
      date: String(e.created_at).slice(0, 10),
      payee: vendors.find(v => v.id === e.vendorId)?.name
        || (payeeFromTitle(e.title || "") ? `${payeeFromTitle(e.title || "")} (read from the recorded description)` : "(not recorded)"),
      description: e.title || e.purpose || "",
      amount: e.convertedAmount,
      currency: "USD",
      method: e.paymentMethod || "(not recorded)",
      projectCode: code, projectName: project.name, donor,
      budgetLine: bl ? `${bl.code} — ${bl.description}` : "",
      funderRef: e.paymentRef || "",
      origRef: originalRef(e.title || ""),
      sources, generatedAt
    });
    const filename = `${e.voucherNo.replace(/[^\w.-]/g, "_")}_reconstructed.html`;
    console.log(`  ${e.voucherNo.padEnd(15)} $${money(e.convertedAmount).padStart(9)}  ${String(e.title).slice(0, 44)}`);

    if (apply) {
      fs.writeFileSync(path.join(dir, filename), html);
      await prisma.appDoc.create({
        data: {
          id: `doc-recon-${e.id}`,
          refNo: null,
          filename,
          mimeType: "text/html",
          sizeStr: `${Math.max(1, Math.round(html.length / 1024))} KB`,
          base64: `file://${code}/Reconstructed/${filename}`,
          category: CATEGORY,
          linkedRecordType: "Expense",
          linkedRecordId: e.id,
          created_at: new Date().toISOString(),
          contentHash: "",
          note: `Reconstructed ${generatedAt}. Original hard copy unavailable.`
        }
      });
      n++;
    }
  }

  if (apply && n) {
    await prisma.auditLog.create({
      data: {
        id: `log-recon-${code}-${Math.floor(Date.parse(new Date().toISOString()) / 1000)}`,
        userId: "u-1", userName: "Saad Matar",
        action: "Vouchers Reconstructed",
        details: `${n} payment voucher(s) reconstructed for ${code} (${project.name}), a closed grant whose signed hard copies could not be located. ` +
          `Rebuilt from the approved budget, the financial report accepted by the funder, and the expense register. ` +
          `Filed under "${CATEGORY}" and deliberately NOT counted as original supporting evidence. No third-party document was recreated.`,
        timestamp: new Date().toISOString()
      }
    });
    console.log(`\nwrote ${n} voucher(s) to ${dir}`);
    console.log(`registered under "${CATEGORY}" and logged to the audit trail.`);
  }

  await prisma.$disconnect();
}

main();
