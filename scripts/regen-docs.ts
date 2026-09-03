// Regenerate the 4 app-generated documents lost in the vault incident, using the
// system's own generators + archive() — same ids, same filenames as the originals.
import { PrismaClient } from "@prisma/client";
import { payslipHtml, quotationHtml, providerInvoiceHtml, archive, vaultFolderForProject } from "../docgen.js";
const prisma = new PrismaClient();

async function audit(action: string, details: string) {
  await prisma.auditLog.create({ data: {
    id: `log-regen-${action.replace(/\W+/g, "").slice(0, 12)}-${Date.now() % 100000}`,
    userId: "u-1", userName: "Saad Matar", action, details, timestamp: new Date().toISOString()
  }});
}

async function payslip(employeeId: string, month: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error(`no employee ${employeeId}`);
  const timesheet = await prisma.timesheet.findFirst({ where: { employeeId, month } });
  const account = employee.bankAccountId ? await prisma.bankAccount.findUnique({ where: { id: employee.bankAccountId } }) : null;
  const gross = (employee.salary || 0) + (employee.allowance || 0);
  const rawAllocs: any[] = timesheet ? JSON.parse(timesheet.allocationsJson || "[]") : [];
  const allocations = [] as any[];
  for (const a of rawAllocs) {
    const proj = a.projectId ? await prisma.project.findUnique({ where: { id: a.projectId } }) : null;
    allocations.push({ code: proj?.code || a.projectId || "—", name: proj?.name || "",
      percentage: Number(a.percentage) || 0,
      amount: Number(((gross * (Number(a.percentage) || 0)) / 100).toFixed(2)) });
  }
  const officer = await prisma.user.findFirst({ where: { role: "Program Director", active: true } })
    || await prisma.user.findFirst({ where: { role: "Finance Officer", active: true } });
  const html = payslipHtml({ employee, month, timesheet, allocations, account,
    countersignatory: officer ? `${officer.name} (${officer.role})` : "Authorised signatory" });
  const filename = `${month}_PAYSLIP_${employee.name.replace(/\s+/g, "-")}_${gross}.html`;
  await archive(prisma, { docId: `doc-payslip-${employeeId}-${month}`, projectCode: "GENERAL",
    category: "Payslip", filename, html, linkedRecordType: "Employee", linkedRecordId: employeeId, partyId: employeeId });
  await audit("Payslip Generated", `${employee.name} — ${month}: gross USD ${gross} (regenerated after vault loss; content from live records).`);
  console.log("payslip:", filename);
}

async function quotation(id: string) {
  const quote = await prisma.quotation.findUnique({ where: { id } });
  if (!quote) throw new Error("no quote");
  const client = await prisma.client.findUnique({ where: { id: quote.clientId } });
  if (!client) throw new Error("no client");
  const html = quotationHtml({ quoteNo: quote.quoteNo, date: quote.date, validUntil: quote.validUntil,
    preparedBy: "Saad Matar — Program Director", clientName: client.name, clientContact: client.contact,
    clientPhone: client.phone, clientTaxId: client.taxId, currency: quote.currency, total: quote.amount,
    items: JSON.parse(quote.itemsJson || "[]"), terms: JSON.parse(quote.termsJson || "{}"), notes: quote.notes });
  const filename = `${quote.date.slice(0, 4)}_QUOTATION_${quote.quoteNo.replace("/", "-")}_${client.name.replace(/\s+/g, "")}_${quote.amount}.html`;
  await archive(prisma, { docId: `doc-qt-${quote.id}`, projectCode: "GENERAL", category: "Quotations",
    filename, html, linkedRecordType: "quotation", linkedRecordId: quote.id });
  await audit("Quotation Document Generated", `Rendered quotation ${quote.quoteNo} for ${client.name} (${quote.currency} ${quote.amount}) — regenerated after vault loss.`);
  console.log("quotation:", filename);
}

async function providerInvoice(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense?.vendorId) throw new Error("no expense/vendor");
  const vendor = await prisma.vendor.findUnique({ where: { id: expense.vendorId } });
  if (!vendor?.engageable) throw new Error("vendor not engageable");
  const project = expense.projectId ? await prisma.project.findUnique({ where: { id: expense.projectId } }) : null;
  const agreement = await prisma.appDoc.findFirst({ where: { partyId: vendor.id, category: { contains: "Contract" } }, orderBy: { created_at: "desc" } });
  const officer = await prisma.user.findFirst({ where: { role: "Program Director", active: true } });
  const html = providerInvoiceHtml({ vendor, expense, project,
    agreementRef: agreement?.filename?.split("_")[0] || "",
    countersignatory: officer ? `${officer.name} (${officer.role})` : "Authorised signatory" });
  const projectCode = project ? await vaultFolderForProject(prisma, project) : "GENERAL";
  const filename = `${(expense.paid_at || expense.created_at || "").slice(0, 4)}_${expense.voucherNo}_SERVICE-INVOICE-RECEIPT_${vendor.name.replace(/\s+/g, "-")}_${expense.netAmount ?? expense.amount}.html`;
  await archive(prisma, { docId: `doc-provinv-${expense.id}`, projectCode, category: "Invoice",
    filename, html, linkedRecordType: "Expense", linkedRecordId: expense.id, partyId: vendor.id });
  await prisma.expense.update({ where: { id: expense.id }, data: { hasAttachment: true } });
  await audit("Provider Invoice & Receipt Generated", `${vendor.name} — voucher ${expense.voucherNo}: regenerated after vault loss. Unsigned form — valid only once the provider signs.`);
  console.log("provider invoice:", filename);
}

async function main() {
  await payslip("emp-1", "2026-05");
  await payslip("emp-4", "2026-05");
  await quotation("qt-1785580187688");
  await providerInvoice("exp-ler-003");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
