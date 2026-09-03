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
body{font-family:"Tajawal",Georgia,'Times New Roman',serif;max-width:720px;margin:24px auto;color:#1a1212;line-height:1.5}
.lh{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.lh img{height:40px}
h1{font-size:14px;letter-spacing:2px;border-bottom:2px solid #6D1A1A;padding-bottom:6px;margin-bottom:2px}
h2{font-size:11px;color:#6B5C5C;font-weight:normal;margin:0 0 14px}
.flag{border:1.5px solid #E23B3B;background:#fdf4f3;color:#7a1a15;padding:10px 12px;font-size:11.5px;margin:14px 0;line-height:1.55}
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
<div class="lh"><img src="data:image/png;base64,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" alt="AnaHon" /></div>
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
