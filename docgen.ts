// Document generation: digitized voucher records and staff/service contracts.
//
// Both produce self-contained, printable HTML written into the vault and registered as an
// AppDoc, so the app can open them like any other archived file. Kept in one module because
// the two share the same archive step — render, write beside the source documents, register.
//
// Accessibility is part of the output, not a later pass: documents carry lang, a real <title>,
// a single <h1>, <th scope> on every table header and a caption, so a screen reader can
// navigate them and the print view stays correct.
import fs from "fs";
import path from "path";
import os from "os";

const VAULT_ROOT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Downloads", "AnaHon_Document_Vault");

/**
 * Which vault folder holds a project's documents.
 *
 * A project's code does not always equal its folder — TRF-2026 lives in TRF-2025-IMS, FPU-2025
 * in FPU-2025-SUBGRANT. Writing to the code would scatter new files into a second folder away
 * from the audit file. So ask the documents already registered for this project where they live,
 * and only fall back to the code for a project that has none yet.
 */
export async function vaultFolderForProject(prisma: any, project: any): Promise<string> {
  if (!project) return "GENERAL";
  const firstSegment = (pointer?: string) => {
    const m = /^file:\/\/([^/]+)\//.exec(pointer || "");
    return m ? m[1] : null;
  };

  const projDoc = await prisma.appDoc.findFirst({
    where: { linkedRecordType: "Project", linkedRecordId: project.id },
  });
  const fromProject = firstSegment(projDoc?.base64);
  if (fromProject) return fromProject;

  const expense = await prisma.expense.findFirst({ where: { projectId: project.id } });
  if (expense) {
    const expDoc = await prisma.appDoc.findFirst({
      where: { linkedRecordType: "Expense", linkedRecordId: expense.id },
    });
    const fromExpense = firstSegment(expDoc?.base64);
    if (fromExpense) return fromExpense;
  }
  return project.code;
}

export const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const money = (v: number, ccy = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(Number(v) || 0);

const longDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

// AnaHon Brand Guidelines v2.0 — Maroon #6D1A1A, Maroon Dark #4A1010, Signal Red #E23B3B,
// warm off-white #F7F1EC, Tajawal type. Logo embedded so every archived document is self-contained.
const LOGO = "data:image/png;base64,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";

const STYLE = `:root{color-scheme:light}
body{font-family:"Tajawal","Segoe UI",Georgia,serif;max-width:760px;margin:24px auto;background:#fff;color:#1a1a1a;line-height:1.55;font-size:13.5px}
.lh{display:flex;align-items:center;gap:14px;border-bottom:3px solid #6D1A1A;padding-bottom:10px;margin-bottom:14px}
.lh img{height:44px}
.lh .org{font-weight:700;font-size:14px;letter-spacing:1.5px;color:#4A1010}
.lh .org span{display:block;font-weight:400;font-size:10.5px;letter-spacing:.4px;color:#6D1A1A}
h1{font-size:15px;letter-spacing:2px;color:#4A1010;border-bottom:1px solid #6D1A1A;padding-bottom:6px}
h2{font-size:12px;color:#555;font-weight:normal;margin-top:-8px}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
caption{text-align:left;font-size:11px;color:#555;padding-bottom:4px}
td,th{border:1px solid #b9a9a2;padding:7px 10px;text-align:left}
th{background:#F7F1EC;color:#4A1010}
th[scope=row]{width:34%}
.r{text-align:right} .amt{font-size:16px;font-weight:bold;color:#6D1A1A}
.note{font-size:10px;color:#666;margin-top:16px;line-height:1.5}
.sig{display:flex;gap:60px;margin-top:44px}
.sig div{flex:1;border-top:1px solid #6D1A1A;padding-top:6px;font-size:12px}
@media print{body{margin:8px}}`;

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style></head><body>
<div class="lh"><img src="${LOGO}" alt="AnaHon" />
<div class="org">ANAHON MEDIA PLATFORM &middot; \u0623\u0646\u0627 \u0647\u0648\u0646<span>Independent media, reporting from where it happens &middot; Tripoli, Lebanon &middot; anahon.org</span></div></div>
${body}
</body></html>`;
}

/** Record card for one voucher. Mirrors the format of the 129 records already in the vault. */
export function digitizedInvoiceHtml(o: {
  expense: any; project: any; donor?: any; vendor?: any; budgetLine?: any; account?: any;
}) {
  const { expense: e, project: p, donor, vendor, budgetLine, account } = o;
  const row = (k: string, v: string, cls = "") =>
    `<tr><th scope="row">${esc(k)}</th><td${cls ? ` class="${cls}"` : ""}>${v}</td></tr>`;

  // How the money moved, and out of which account — a figure with no traceable source is
  // the thing this system exists to prevent.
  const paidFrom = account
    ? `${esc(expenseMethod(e))} — ${esc(account.name)} <span>${esc(account.accountNo)}</span>`
    : `${esc(expenseMethod(e))}${e.paymentRef ? ` · ref ${esc(e.paymentRef)}` : ""}`;

  return page(`${e.voucherNo} — Digitized Voucher`, `<h1>ANAHON MEDIA PLATFORM — DIGITIZED VOUCHER RECORD</h1>
<h2>Project ${esc(p?.code || "—")} · ${esc(p?.name || "—")}${donor ? ` · ${esc(donor.name)}` : ""}</h2>
<table>
<caption>Voucher detail as recorded in the financial management system.</caption>
<tbody>
${row("System Voucher", esc(e.voucherNo))}
${row("Title", esc(e.title))}
${row("Purpose", esc(e.purpose))}
${row("Date Raised", longDate(e.created_at))}
${row("Payee / Vendor", esc(vendor?.name || "—"))}
${row("Budget Line", esc(budgetLine ? `${budgetLine.code} — ${budgetLine.description}` : "—"))}
${row("Amount", `${esc(money(e.amount, e.currency))}${e.currency !== "USD" ? ` <span>(${esc(money(e.convertedAmount))} at ${esc(e.rate)})</span>` : ""}`, "amt")}
${row("Withholding Tax", esc(money(e.whtAmount || 0, e.currency)))}
${row("Net Paid", esc(money(e.netAmount || e.amount, e.currency)))}
${row("Paid From", paidFrom)}
${row("Status", esc(e.status))}
${row("Approved", longDate(e.approved_at))}
${row("Paid", longDate(e.paid_at))}
</tbody></table>
<p class="note">System-generated digitized record of voucher ${esc(e.voucherNo)}. Any scanned source document
remains attached to this voucher as the source reference per Policy &sect;6.4; retention 7 years per Policy
&sect;13.3. Regenerated automatically whenever the voucher changes. Generated ${esc(new Date().toISOString())}.</p>`);
}

function expenseMethod(e: any) {
  return e.paymentMethod || "Not recorded";
}

/**
 * Staff or service contract. Every figure comes from the caller; nothing is inferred, because
 * a contract is a signed instrument and an invented number in one is a real liability.
 * Signatory names come from the database, never hardcoded.
 */
export function contractHtml(o: {
  /** The counterparty: an Employee (employment) or a Vendor (service agreement). */
  party: { name: string; position: string; paymentMethod?: string; bankInfo?: string; taxId?: string };
  project?: any; account?: any; countersignatory?: { name: string; role: string };
  /** Real role / scope of services, when it differs from the party's stored position. */
  role?: string;
  kind: "Employment" | "Service";
  startDate: string; endDate: string; loePct?: number; monthlyFee: number; contractTotal: number;
  budgetLine?: any; reference: string;
}) {
  const { party: emp, project: p, account, countersignatory, kind, startDate, endDate, loePct, monthlyFee, contractTotal, budgetLine, reference } = o;
  const isService = kind === "Service";
  const roleText = String(o.role || "").trim() || emp.position;
  // A missing MoF registration is the REASON withholding is applied — state it on the
  // instrument rather than hiding the row, so the deduction is never a surprise.
  const taxId = String(emp.taxId ?? "").trim();
  const registered = !!taxId && !/^n\/a$/i.test(taxId);
  const title = isService ? "SERVICE AGREEMENT" : "EMPLOYMENT CONTRACT";

  const row = (k: string, v: string) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`;

  return page(`${reference} — ${title}`, `<h1>${esc(title)}</h1>
<h2>AnaHon Media Platform – Civil Company${p ? ` · Project ${esc(p.code)} — ${esc(p.name)}` : ""}</h2>
<table>
<caption>Contract particulars.</caption>
<tbody>
${row("Reference", esc(reference))}
${row(isService ? "Service Provider" : "Employee", esc(emp.name))}
${row(isService ? "Role / Scope of Services" : "Position / Role", esc(roleText))}
${row("Contract Type", esc(kind))}
${row("Period", `${esc(longDate(startDate))} to ${esc(longDate(endDate))}`)}
${loePct ? row("Level of Effort", `${esc(loePct)}%`) : ""}
${monthlyFee ? row(isService ? "Fee per period" : "Monthly Fee", esc(money(monthlyFee))) : ""}
${row("Contract Total", `<strong>${esc(money(contractTotal))}</strong>`)}
${budgetLine ? row("Budget Line", esc(`${budgetLine.code} — ${budgetLine.description}`)) : ""}
${row("MoF Tax Registry ID", registered
      ? esc(taxId)
      : `<strong>Not available</strong> — the ${isService ? "provider" : "employee"} is not registered with the Ministry of Finance${isService ? ", so 7.5% withholding tax is deducted at source from every payment under this agreement and remitted to the MoF by AnaHon" : ""}`)}
${row("Paid From", account
      ? `${emp.paymentMethod === "Cash" ? "Cash withdrawn from" : "Bank transfer from"} ${esc(account.name)} <span>${esc(account.accountNo)}</span>`
      : isService
        ? (() => {
          const info = String(emp.bankInfo ?? "").trim();
          const isCash = !info || /^(cash|n\/a)$/i.test(info);
          return `Against an approved payment voucher — ${isCash ? "paid in cash against a signed receipt" : `transferred to: ${esc(info)}`}`;
        })()
        : "<em>No source account on file</em>")}
</tbody></table>

<h2 style="margin-top:22px;color:#1a1a1a;font-size:13px"><strong>1. Engagement</strong></h2>
<p>AnaHon Media Platform engages ${esc(emp.name)} as <b>${esc(roleText)}</b>${p ? ` on project ${esc(p.code)} — ${esc(p.name)}` : ""}
for the period ${esc(longDate(startDate))} to ${esc(longDate(endDate))}.</p>

<h2 style="color:#1a1a1a;font-size:13px"><strong>2. ${isService ? "Fees" : "Remuneration"}</strong></h2>
<p>${loePct ? `The engagement is at a <b>${esc(loePct)}% level of effort</b>. ` : ""}${monthlyFee
      ? `It carries a <b>fixed ${isService ? "fee of" : "monthly fee of"} ${esc(money(monthlyFee))}${isService ? " per agreed period" : ""}</b>${isService
        ? ". Fees are payable on delivery and acceptance of the agreed outputs, against the provider's invoice."
        : ", independent of the number of days attended in the month. Attendance is recorded on monthly timesheets; the timesheet records effort, not the billing amount."} `
      : isService
        ? `It is a <b>lump-sum engagement</b>: the total below covers the agreed scope for the whole period, payable in instalments on delivery and acceptance of the agreed outputs, against the provider's invoice. `
        : ""}
The approved total value of this ${isService ? "agreement" : "contract"} is <b>${esc(money(contractTotal))}</b>.</p>

<h2 style="color:#1a1a1a;font-size:13px"><strong>3. Payment</strong></h2>
<p>Payment is made ${account
      ? `${emp.paymentMethod === "Cash" ? "in cash withdrawn from" : "by bank transfer from"} <b>${esc(account.name)}</b> (${esc(account.accountNo)})`
      : "from the account recorded in the financial management system"}, against an approved payment voucher
and ${isService ? "the provider's invoice for the delivered outputs" : "a signed timesheet for the month"}, in line with the
organisation's Accounting Policies Manual.${isService
      ? (registered
        ? " The provider is registered with the Ministry of Finance; withholding tax is applied where the law requires it."
        : ` Because the provider is not registered with the Ministry of Finance, <b>7.5% withholding tax is deducted at source</b> from each payment and remitted to the MoF by AnaHon; the provider receives the net amount. On the total value of this agreement that is ${esc(money(contractTotal * 0.075))} withheld and ${esc(money(contractTotal * 0.925))} net, unless the provider supplies a tax registry number, in which case payments are made gross.`)
      : ""}</p>

<h2 style="color:#1a1a1a;font-size:13px"><strong>4. Other terms</strong></h2>
<p>All other terms of engagement, including confidentiality, safeguarding and termination, are governed by the
organisation's standing policies, which form part of this ${isService ? "agreement" : "contract"}.</p>

<div class="sig">
<div>${esc(emp.name)}<br>${esc(emp.position)} — date &amp; signature</div>
<div>${esc(countersignatory?.name || "—")}<br>${esc(countersignatory?.role || "For AnaHon Media Platform")} — date &amp; signature</div>
</div>
<p class="note">Generated by the AnaHon Financial Management System on ${esc(new Date().toISOString())}.
Unsigned until countersigned by both parties. Never backdate: corrections are issued as a dated addendum
(Policy &sect;6.8 / &sect;14.2).</p>`);
}

/**
 * Write a generated document into the vault and register it so the app can serve it.
 * Deterministic id + fixed filename, so regenerating overwrites in place instead of
 * accumulating near-duplicates in the audit file.
 */
/** Client-facing quotation, laid out after the real ANAHON Production template
 *  (Drive: Quotation_Template.xlsx — header, MOF 3893185, items w/ Output column,
 *  standard FINANCIAL/PRODUCTION/TECHNICAL/EXTRAS note blocks). */
export function quotationHtml(o: {
  quoteNo: string; date: string; validUntil: string; preparedBy: string;
  clientName: string; clientContact: string; clientPhone: string; clientTaxId: string;
  currency: string; total: number;
  items: { service: string; description: string; output: string; unitPrice: number; qty: number }[];
  terms: { financial?: string; production?: string; technical?: string; extras?: string };
  notes: string;
}) {
  const rows = o.items.map((it, i) => `<tr>
    <td>${i + 1}</td>
    <td><strong>${esc(it.service)}</strong>${it.description ? `<br><span style="color:#444">${esc(it.description).replace(/\n/g, "<br>")}</span>` : ""}</td>
    <td>${esc(it.output).replace(/\n/g, "<br>")}</td>
    <td class="r">${money(it.unitPrice, o.currency)}</td>
    <td class="r">${it.qty}</td>
    <td class="r">${money(it.unitPrice * it.qty, o.currency)}</td>
  </tr>`).join("");

  const noteBlock = (label: string, text?: string) =>
    text ? `<p style="margin:6px 0"><strong>${label}:</strong> ${esc(text).replace(/\n/g, "<br>")}</p>` : "";

  return page(`Quotation ${o.quoteNo} — ${o.clientName}`, `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1 style="border:none;margin-bottom:0">ANAHON PRODUCTION</h1>
    <h2>Tripoli, Lebanon</h2>
    <p style="font-size:11px;color:#555;margin-top:8px">Behind Kasr El Helou (Hallab 1881), Gebran Khalil Gebran Street, Awada Bldg, 1st floor<br>
    MOF: 3893185 · Phone: +961 81 408 171 · info@anahon.org</p>
  </div>
  <div style="text-align:right">
    <p style="font-size:22px;letter-spacing:3px;margin:0"><strong>QUOTATION</strong></p>
    <p style="font-size:12px;margin:4px 0">№ <strong>${esc(o.quoteNo)}</strong><br>
    Date: ${longDate(o.date)}<br>
    Valid until: ${o.validUntil ? longDate(o.validUntil) : "—"}<br>
    Prepared by: ${esc(o.preparedBy)}</p>
  </div>
</div>
<table>
  <caption>Quotation to</caption>
  <tr><th scope="row">Client</th><td>${esc(o.clientName)}${o.clientTaxId ? ` — MOF/Tax ID: ${esc(o.clientTaxId)}` : ""}</td></tr>
  ${o.clientContact || o.clientPhone ? `<tr><th scope="row">Contact</th><td>${esc([o.clientContact, o.clientPhone].filter(Boolean).join(" · "))}</td></tr>` : ""}
</table>
<table>
  <caption>Services</caption>
  <thead><tr><th>#</th><th>Service</th><th>Output</th><th class="r">Unit</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}
  <tr><td colspan="5" class="r"><strong>TOTAL</strong></td><td class="r amt">${money(o.total, o.currency)}</td></tr></tbody>
</table>
${noteBlock("FINANCIAL NOTES", o.terms.financial)}
${noteBlock("PRODUCTION NOTES", o.terms.production)}
${noteBlock("TECHNICAL NOTES", o.terms.technical)}
${noteBlock("EXTRAS", o.terms.extras)}
${o.notes ? noteBlock("NOTES", o.notes) : ""}
<h3 style="font-size:12px;letter-spacing:1px;margin:14px 0 4px">ACCEPTANCE</h3>
<p style="margin:0;font-size:10.5px">By signing below, the client accepts the services, quantities and prices set out above, and the notes attached to them. Production is booked once this page is signed and returned.</p>
<div class="sig">
<div>${esc(o.preparedBy)}<br>For ANAHON PRODUCTION — date &amp; signature</div>
<div>${esc(o.clientName)}<br>Client — date &amp; signature</div>
</div>
<p class="note">If you have any questions concerning this quotation, contact: Saad Matar — Program Director · Mobile: +961 81 408 171 · info@anahon.org<br>
ANAHON production · This quotation is not an invoice; services are booked upon written acceptance.</p>`);
}

/** Cash receipt. For a bank or OMT payment the counterparty holds a trace; for cash
 *  nobody does, so this signed page IS the evidence. Issued by the person who actually
 *  took the notes — that is why "received by" is a field and not a constant. */
export function cashReceiptHtml(o: {
  receiptNo: string; date: string; method: string;
  clientName: string; clientContact: string;
  currency: string; amount: number; amountWords: string;
  againstQuoteNo: string; againstTitle: string;
  receivedBy: string;
}) {
  return page(`Receipt ${o.receiptNo} — ${o.clientName}`, `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1 style="border:none;margin-bottom:0">ANAHON PRODUCTION</h1>
    <h2>Tripoli, Lebanon</h2>
    <p style="font-size:11px;color:#555;margin-top:8px">Behind Kasr El Helou (Hallab 1881), Gebran Khalil Gebran Street, Awada Bldg, 1st floor<br>
    MOF: 3893185 · Phone: +961 81 408 171 · info@anahon.org</p>
  </div>
  <div style="text-align:right">
    <p style="font-size:22px;letter-spacing:3px;margin:0"><strong>RECEIPT</strong></p>
    <p style="font-size:12px;margin:4px 0">№ <strong>${esc(o.receiptNo)}</strong><br>
    Date: ${longDate(o.date)}<br>
    Method: <strong>${esc(o.method)}</strong></p>
  </div>
</div>
<table>
  <caption>Received with thanks</caption>
  <tr><th scope="row">From</th><td>${esc(o.clientName)}${o.clientContact ? ` — ${esc(o.clientContact)}` : ""}</td></tr>
  <tr><th scope="row">The sum of</th><td><strong>${money(o.amount, o.currency)}</strong>${o.amountWords ? ` — ${esc(o.amountWords)}` : ""}</td></tr>
  <tr><th scope="row">In settlement of</th><td>Quotation № ${esc(o.againstQuoteNo)}${o.againstTitle ? ` — ${esc(o.againstTitle)}` : ""}</td></tr>
</table>
<p style="margin:10px 0;font-size:10.5px">This receipt acknowledges payment in full of the quotation named above. It is issued by
ANAHON PRODUCTION and is valid only when signed by the person who received the payment.</p>
<div class="sig">
<div>${esc(o.receivedBy)}<br>Received by, for ANAHON PRODUCTION — date &amp; signature</div>
<div>${esc(o.clientName)}<br>Payer — date &amp; signature</div>
</div>
<p class="note">ANAHON production · MOF 3893185 · Keep this receipt: for a cash payment it is the only proof of settlement.</p>`);
}

/** AnaHon master project proposal — the internal template the team adapts into
 *  each donor's own format. AnaHon is always the applicant (Civil Company 90/2023). */
export function proposalHtml(o: {
  title: string; donorName: string; stream: string; currency: string; amount: number;
  deadline: string; decisionDate: string; preparedBy: string;
  proposal: {
    summary?: string; problem?: string; solution?: string; objectives?: string;
    deliverables?: string; outputs?: string; outcomes?: string;
    budget?: { line: string; description: string; amount: number }[];
    timeline?: { activity: string; start: string; end: string }[];
  };
}) {
  const p = o.proposal || {};
  const section = (label: string, text?: string) =>
    text ? `<h3 style="font-size:13px;letter-spacing:1px;margin:18px 0 4px">${label.toUpperCase()}</h3><p style="margin:0;white-space:pre-wrap">${esc(text)}</p>` : "";
  const budget = (p.budget || []).filter(r => r.line || r.amount);
  const timeline = (p.timeline || []).filter(r => r.activity);
  const budgetTotal = budget.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return page(`Proposal — ${o.title}`, `
<h1 style="margin-bottom:0">ANAHON MEDIA PLATFORM</h1>
<h2>Project Proposal — internal master (adapt to the donor's template)</h2>
<p style="font-size:11px;color:#555">Applicant & implementing body: AnaHon (Lebanese Civil Company 90/2023, registered 12-Oct-2023, Commercial Register Tripoli · MOF 3893185)<br>
Behind Kasr El Helou (Hallab 1881), Gebran Khalil Gebran Street, Awada Bldg, 1st floor, Tripoli · +961 81 408 171 · info@anahon.org</p>
<table>
  <caption>Application overview</caption>
  <tr><th scope="row">Project title</th><td><strong>${esc(o.title)}</strong></td></tr>
  <tr><th scope="row">Donor / call</th><td>${esc(o.donorName || "—")}</td></tr>
  <tr><th scope="row">AnaHon program</th><td>${esc(o.stream || "—")}</td></tr>
  <tr><th scope="row">Requested amount</th><td>${o.amount ? `${esc(o.currency)} ${o.amount.toLocaleString()}` : "—"}</td></tr>
  ${o.deadline ? `<tr><th scope="row">Submission deadline</th><td>${longDate(o.deadline)}</td></tr>` : ""}
  ${o.decisionDate ? `<tr><th scope="row">Decision expected</th><td>${longDate(o.decisionDate)}</td></tr>` : ""}
  <tr><th scope="row">Prepared by</th><td>${esc(o.preparedBy)}</td></tr>
</table>
${section("Executive summary", p.summary)}
${section("Problem statement", p.problem)}
${section("Proposed solution / project description", p.solution)}
${section("Objectives", p.objectives)}
${timeline.length ? `<h3 style="font-size:13px;letter-spacing:1px;margin:18px 0 4px">ACTIVITIES & TIMELINE</h3>
<table><thead><tr><th>Activity</th><th>Start</th><th>End</th></tr></thead>
<tbody>${timeline.map(r => `<tr><td>${esc(r.activity)}</td><td>${esc(r.start || "—")}</td><td>${esc(r.end || "—")}</td></tr>`).join("")}</tbody></table>` : ""}
${section("Deliverables", p.deliverables)}
${section("Outputs", p.outputs)}
${section("Outcomes / expected impact", p.outcomes)}
${budget.length ? `<h3 style="font-size:13px;letter-spacing:1px;margin:18px 0 4px">INDICATIVE BUDGET</h3>
<table><thead><tr><th>Line</th><th>Description</th><th class="r">Amount</th></tr></thead>
<tbody>${budget.map(r => `<tr><td>${esc(r.line)}</td><td>${esc(r.description)}</td><td class="r">${esc(o.currency)} ${(Number(r.amount) || 0).toLocaleString()}</td></tr>`).join("")}
<tr><td colspan="2" class="r"><strong>TOTAL</strong></td><td class="r amt">${esc(o.currency)} ${budgetTotal.toLocaleString()}</td></tr></tbody></table>` : ""}
<p class="note">Internal working document — figures are indicative until the donor's budget format is completed. Not a signed instrument.</p>`);
}

/** Service invoice + payment receipt for an engaged provider, built from the voucher's
 *  real figures (never re-typed). Issued by AnaHon on behalf of a provider who is not
 *  MoF-registered and has no invoice book — the document says so plainly and is worthless
 *  until the provider signs it. Never a fabricated third-party bill. */
export function providerInvoiceHtml(o: {
  vendor: any; expense: any; project?: any; agreementRef?: string; countersignatory: string;
}) {
  const { vendor: v, expense: e, project: p } = o;
  const gross = Number(e.amount) || 0;
  const wht = Number(e.whtAmount) || 0;
  const net = Number(e.netAmount ?? gross - wht);
  const real = (s: any) => {
    const t = String(s ?? "").trim();
    return t && t.toUpperCase() !== "N/A" ? t : "";
  };
  const hasTaxId = !!real(v.taxId);
  const contact = real(v.contact);

  return page(`Service Invoice & Receipt — ${v.name} — ${e.voucherNo}`, `
<h1>SERVICE INVOICE &amp; PAYMENT RECEIPT</h1>
<h2>Reference ${esc(e.voucherNo)}${o.agreementRef ? ` · Agreement ${esc(o.agreementRef)}` : ""}</h2>
<table>
  <caption>Parties</caption>
  <tbody>
  <tr><th scope="row">Service provider</th><td><strong>${esc(v.name)}</strong>${contact ? `<br>${esc(contact)}` : ""}${hasTaxId ? `<br>MoF / Tax ID: ${esc(v.taxId)}` : "<br><em>Not registered with the Ministry of Finance</em>"}</td></tr>
  <tr><th scope="row">Billed to</th><td>AnaHon Media Platform — Lebanese Civil Company 90/2023, Tripoli · MoF 3893185</td></tr>
  ${p ? `<tr><th scope="row">Project</th><td>${esc(p.code)} — ${esc(p.name)}</td></tr>` : ""}
  <tr><th scope="row">Date</th><td>${longDate(e.paid_at || e.created_at)}</td></tr>
  </tbody>
</table>
<table>
  <caption>Services rendered</caption>
  <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
  <tbody>
    <tr><td>${esc(e.title)}${p ? `<br><span style="color:#555;font-size:12px">Services rendered under project ${esc(p.code)}</span>` : ""}</td><td class="r">${money(gross, e.currency)}</td></tr>
    <tr><th scope="row">Gross fee</th><td class="r">${money(gross, e.currency)}</td></tr>
    ${wht > 0 ? `<tr><th scope="row">Less withholding tax (7.5%)</th><td class="r">− ${money(wht, e.currency)}</td></tr>` : ""}
    <tr><th scope="row">Net payable to provider</th><td class="r amt">${money(net, e.currency)}</td></tr>
  </tbody>
</table>
${wht > 0 ? `<p class="note"><strong>Withholding:</strong> ${money(wht, e.currency)} has been withheld at source under Lebanese income-tax rules for services from a provider not registered with the Ministry of Finance, and is remitted to the MoF by AnaHon. The provider receives the net amount shown above.</p>` : ""}
<p style="margin-top:18px">I, the undersigned, confirm that I rendered the services described above and that I have received the net amount of <strong>${money(net, e.currency)}</strong>${e.paymentMethod ? ` by ${esc(String(e.paymentMethod).toLowerCase())}` : ""} in full and final settlement of this invoice.</p>
<div class="sig">
  <div>Service provider — ${esc(v.name)}<br>Signature &amp; date</div>
  <div>For AnaHon Media Platform — ${esc(o.countersignatory)}<br>Signature &amp; date</div>
</div>
<p class="note">Issued through the AnaHon financial management system from voucher ${esc(e.voucherNo)}; figures are taken from the recorded payment and are not re-entered by hand.
This form is prepared for the provider's signature because the provider does not issue their own invoices; it is <strong>not valid until signed by the provider</strong>. Retention 7 years per Policy §13.3.</p>`);
}

/** Monthly payslip / salary payment receipt, built from the employee record and the
 *  approved timesheet for that month. Shows which project funds which share of the cost —
 *  AnaHon's standing rule is that a role is only paid where a project funds it. */
export function payslipHtml(o: {
  employee: any; month: string; timesheet?: any;
  allocations: { code: string; name: string; percentage: number; amount: number }[];
  account?: any; countersignatory: string;
}) {
  const { employee: emp, month, timesheet: ts } = o;
  const base = Number(emp.salary) || 0;
  const allowance = Number(emp.allowance) || 0;
  const gross = base + allowance;
  const allocated = o.allocations.reduce((s, a) => s + a.amount, 0);
  const unfunded = Math.max(0, gross - allocated);
  const monthLabel = (() => {
    const d = new Date(`${month}-01T00:00:00Z`);
    return isNaN(d.getTime()) ? month : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  })();

  return page(`Payslip ${month} — ${emp.name}`, `
<h1>ANAHON MEDIA PLATFORM — PAYSLIP</h1>
<h2>${esc(monthLabel)} · ${esc(emp.name)}</h2>
<table>
  <caption>Employee</caption>
  <tbody>
  <tr><th scope="row">Name</th><td><strong>${esc(emp.name)}</strong></td></tr>
  <tr><th scope="row">Position</th><td>${esc(emp.position)}</td></tr>
  <tr><th scope="row">Engagement</th><td>${esc(emp.contractType || "—")}</td></tr>
  <tr><th scope="row">Period</th><td>${esc(monthLabel)}${ts ? ` · ${esc(ts.totalDays)} days worked (timesheet ${esc(ts.status)})` : " · no approved timesheet on file"}</td></tr>
  </tbody>
</table>
<table>
  <caption>Earnings</caption>
  <tbody>
  <tr><th scope="row">Base salary</th><td class="r">${money(base)}</td></tr>
  <tr><th scope="row">Allowance</th><td class="r">${money(allowance)}</td></tr>
  <tr><th scope="row">Gross for the month</th><td class="r amt">${money(gross)}</td></tr>
  <tr><th scope="row">Statutory deductions</th><td class="r">${money(0)}</td></tr>
  <tr><th scope="row">Net payable</th><td class="r amt">${money(gross)}</td></tr>
  </tbody>
</table>
${o.allocations.length ? `<table>
  <caption>Cost allocation — which project funds this month</caption>
  <thead><tr><th>Project</th><th class="r">Share</th><th class="r">Amount</th></tr></thead>
  <tbody>${o.allocations.map(a => `<tr><td>${esc(a.code)} — ${esc(a.name)}</td><td class="r">${esc(a.percentage)}%</td><td class="r">${money(a.amount)}</td></tr>`).join("")}
  ${unfunded > 0.004 ? `<tr><td>Not funded by any project</td><td class="r">—</td><td class="r">${money(unfunded)}</td></tr>` : ""}</tbody>
</table>` : `<p class="note">No project allocation recorded for this month.</p>`}
<table>
  <caption>Payment</caption>
  <tbody>
  <tr><th scope="row">Method</th><td>${esc(emp.paymentMethod || "—")}</td></tr>
  <tr><th scope="row">Funds drawn from</th><td>${o.account ? `${esc(o.account.name)} ${esc(o.account.accountNo)}` : "—"}</td></tr>
  </tbody>
</table>
${gross === 0 ? `<p class="note"><strong>Nil payslip.</strong> No salary is recorded for this role in this month. Under AnaHon's standing rule a position carries a salary only while a project funds it; this record exists to document the month, not to assert a payment.</p>` : ""}
<div class="sig">
  <div>Employee — ${esc(emp.name)}<br>Signature &amp; date (received)</div>
  <div>For AnaHon Media Platform — ${esc(o.countersignatory)}<br>Signature &amp; date</div>
</div>
<p class="note">System-generated from the employee record and the approved timesheet for ${esc(month)}; figures are not re-entered by hand.
Statutory deductions are shown as nil because AnaHon's payroll-tax and CNSS treatment is pending the worker-classification decision with the accountant — this payslip must be reissued if that decision changes the month's figures. Unsigned until countersigned. Retention 7 years per Policy §13.3.</p>`);
}

/** Next unique document reference (ANH-DOC-NNNNN). Max-based so deletions can't
 *  cause a collision with the unique index. */
export async function nextDocRef(prisma: any): Promise<string> {
  const docs = await prisma.appDoc.findMany({ where: { refNo: { not: null } }, select: { refNo: true } });
  const max = docs.reduce((m: number, d: any) => Math.max(m, parseInt(String(d.refNo).split("-").pop() || "0", 10) || 0), 0);
  return `ANH-DOC-${String(max + 1).padStart(5, "0")}`;
}

export async function archive(prisma: any, o: {
  docId: string; projectCode: string; category: string; filename: string; html: string;
  linkedRecordType: string; linkedRecordId: string; partyId?: string;
}) {
  // A document keeps its reference for life — regeneration reuses it, only a
  // brand-new registration draws the next number.
  const existing = await prisma.appDoc.findUnique({ where: { id: o.docId } });
  const refNo = existing?.refNo || await nextDocRef(prisma);
  const html = o.html.replace(
    "</body>",
    `<p class="note">Document reference: <strong>${esc(refNo)}</strong> — issued via AnaHon FMS.</p></body>`
  );

  const dir = path.join(VAULT_ROOT, o.projectCode, o.category);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = o.filename.replace(/[^\w.\-()\[\] ]/g, "_");
  fs.writeFileSync(path.join(dir, safeName), html);

  const pointer = `file://${o.projectCode}/${o.category}/${safeName}`;
  const kb = Math.max(1, Math.round(Buffer.byteLength(html) / 1024));
  const data = {
    refNo,
    filename: safeName,
    mimeType: "text/html",
    sizeStr: `${kb} KB`,
    base64: pointer,
    category: o.category,
    linkedRecordType: o.linkedRecordType,
    linkedRecordId: o.linkedRecordId,
    partyId: o.partyId || null,
    created_at: new Date().toISOString(),
  };
  await prisma.appDoc.upsert({ where: { id: o.docId }, update: data, create: { id: o.docId, ...data } });
  return pointer;
}

/** Build (or rebuild) the digitized record for one voucher. Safe to call on every change. */
export async function syncDigitizedInvoice(prisma: any, expenseId: string) {
  const e = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!e) return null;

  const [project, vendor, budgetLine] = await Promise.all([
    prisma.project.findUnique({ where: { id: e.projectId } }),
    prisma.vendor.findUnique({ where: { id: e.vendorId } }),
    prisma.budgetLine.findUnique({ where: { id: e.budgetLineId } }),
  ]);
  const donor = project ? await prisma.donor.findUnique({ where: { id: project.donorId } }) : null;
  // The bank line that cleared this voucher is the proof of payment — carry it onto the record.
  const bankTx = await prisma.bankTransaction.findFirst({ where: { voucherNo: e.voucherNo } });
  const account = bankTx ? await prisma.bankAccount.findUnique({ where: { id: bankTx.bankAccountId } }) : null;

  const html = digitizedInvoiceHtml({ expense: e, project, donor, vendor, budgetLine, account });
  return archive(prisma, {
    docId: `doc-digi-${e.id}`,
    projectCode: await vaultFolderForProject(prisma, project),
    category: "Digitized",
    filename: `${e.voucherNo}_digitized.html`,
    html,
    linkedRecordType: "Expense",
    linkedRecordId: e.id,
  });
}
