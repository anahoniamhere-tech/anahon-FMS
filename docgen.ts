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

const STYLE = `:root{color-scheme:light}
body{font-family:Georgia,serif;max-width:760px;margin:24px auto;background:#fff;color:#1a1a1a;line-height:1.55;font-size:13.5px}
h1{font-size:15px;letter-spacing:2px;border-bottom:2px solid #1a1a1a;padding-bottom:6px}
h2{font-size:12px;color:#555;font-weight:normal;margin-top:-8px}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
caption{text-align:left;font-size:11px;color:#555;padding-bottom:4px}
td,th{border:1px solid #999;padding:7px 10px;text-align:left}
th{background:#f4f4f4}
th[scope=row]{width:34%}
.r{text-align:right} .amt{font-size:16px;font-weight:bold}
.note{font-size:10px;color:#666;margin-top:16px;line-height:1.5}
.sig{display:flex;gap:60px;margin-top:44px}
.sig div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:12px}
@media print{body{margin:8px}}`;

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style></head><body>
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
<p class="note">If you have any questions concerning this quotation, contact: Saad Matar — Program Director · Mobile: +961 81 408 171 · info@anahon.org<br>
ANAHON production · This quotation is not an invoice; services are booked upon written acceptance.</p>`);
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
