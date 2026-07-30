const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, 'prisma/seed.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// 1. Update expenses
const expensesStr = `expenses: [
    { id: "exp-1", voucherNo: "PV-TRF-001", title: "Higgsfield Sub", purpose: "AI Video Generation", vendorId: "ven-7", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 15, rate: 1, convertedAmount: 15, whtAmount: 1.13, netAmount: 13.87, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-001", created_at: "2026-06-23T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-3", voucherNo: "PV-TRF-003", title: "Google AI Ultra", purpose: "Google One Ultra", vendorId: "ven-8", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 99.99, rate: 1, convertedAmount: 99.99, whtAmount: 7.50, netAmount: 92.49, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-003", created_at: "2026-06-21T11:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-4", voucherNo: "PV-TRF-004", title: "Claude Pro", purpose: "Anthropic Subscription", vendorId: "ven-9", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 20.00, rate: 1, convertedAmount: 20.00, whtAmount: 1.50, netAmount: 18.50, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-004", created_at: "2026-06-15T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true }
  ],`;
content = content.replace(/expenses:\s*\[[\s\S]*?\],/, expensesStr);

// 2. Update journalEntries
const jeStr = `journalEntries: [
    { id: "je-1", journal: "General Journal", date: "2026-06-23", description: "PV-TRF-001 Higgsfield WHT", referenceNo: "PV-TRF-001", isPosted: true, itemsJson: JSON.stringify([{ accountCode: "6400", debit: 15, credit: 0, projectId: "proj-trf" }, { accountCode: "1100", debit: 0, credit: 13.87, projectId: "proj-trf" }, { accountCode: "2310", debit: 0, credit: 1.13, projectId: "proj-trf" }]) },
    { id: "je-2", journal: "General Journal", date: "2026-06-21", description: "PV-TRF-003 Google Ultra WHT", referenceNo: "PV-TRF-003", isPosted: true, itemsJson: JSON.stringify([{ accountCode: "6400", debit: 99.99, credit: 0, projectId: "proj-trf" }, { accountCode: "1100", debit: 0, credit: 92.49, projectId: "proj-trf" }, { accountCode: "2310", debit: 0, credit: 7.50, projectId: "proj-trf" }]) },
    { id: "je-3", journal: "General Journal", date: "2026-06-15", description: "PV-TRF-004 Claude Pro WHT", referenceNo: "PV-TRF-004", isPosted: true, itemsJson: JSON.stringify([{ accountCode: "6400", debit: 20.00, credit: 0, projectId: "proj-trf" }, { accountCode: "1100", debit: 0, credit: 18.50, projectId: "proj-trf" }, { accountCode: "2310", debit: 0, credit: 1.50, projectId: "proj-trf" }]) }
  ],`;
content = content.replace(/journalEntries:\s*\[\],/, jeStr);

fs.writeFileSync(seedPath, content, 'utf8');
