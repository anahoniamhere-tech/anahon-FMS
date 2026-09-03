const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, 'prisma/seed.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// 1. Replace donors
content = content.replace(
  /donors:\s*\[[\s\S]*?\],\n\s*projects:/,
  `donors: [
    { id: "don-1", name: "Thomson Reuters Foundation", country: "United Kingdom", contactEmail: "projects@thomsonreuters.com", notes: "" }
  ],
  projects:`
);

// 2. Replace budgetLines
content = content.replace(
  /budgetLines:\s*\[\],/,
  `budgetLines: [
    { id: "bl-1", projectId: "proj-trf", code: "A.1.1", category: "Personnel", description: "Program director", allocatedUSD: 1560 },
    { id: "bl-2", projectId: "proj-trf", code: "A.1.2", category: "Personnel", description: "Finance officer", allocatedUSD: 1200 },
    { id: "bl-3", projectId: "proj-trf", code: "A.1.3", category: "Personnel", description: "Graphic designer", allocatedUSD: 1200 },
    { id: "bl-4", projectId: "proj-trf", code: "B.1.1", category: "Contractors/Freelancers", description: "Podcasters", allocatedUSD: 900 },
    { id: "bl-5", projectId: "proj-trf", code: "B.1.2", category: "Contractors/Freelancers", description: "Film makers", allocatedUSD: 2800 },
    { id: "bl-6", projectId: "proj-trf", code: "B.1.3", category: "Contractors/Freelancers", description: "Content creators", allocatedUSD: 800 },
    { id: "bl-7", projectId: "proj-trf", code: "C.1.3", category: "Travel", description: "Domestic transportation", allocatedUSD: 600 },
    { id: "bl-8", projectId: "proj-trf", code: "D.1.1", category: "Other Costs", description: "AI tools", allocatedUSD: 360 },
    { id: "bl-9", projectId: "proj-trf", code: "D.1.3", category: "Other Costs", description: "Internet data", allocatedUSD: 600 }
  ],`
);

// 3. Replace expenses
content = content.replace(
  /expenses:\s*\[\],/,
  `expenses: [
    { id: "exp-1", voucherNo: "PV-TRF-001", title: "Higgsfield Sub", purpose: "AI Video Generation", vendorId: "ven-7", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 15, rate: 1, convertedAmount: 15, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-001", created_at: "2026-06-23T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-2", voucherNo: "PV-TRF-002", title: "Google AI Credits", purpose: "Google One AI", vendorId: "ven-8", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 49.98, rate: 1, convertedAmount: 49.98, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-002", created_at: "2026-06-21T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-3", voucherNo: "PV-TRF-003", title: "Google AI Ultra", purpose: "Google One Ultra", vendorId: "ven-8", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 99.99, rate: 1, convertedAmount: 99.99, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-003", created_at: "2026-06-21T11:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true },
    { id: "exp-4", voucherNo: "PV-TRF-004", title: "Claude Pro", purpose: "Anthropic Subscription", vendorId: "ven-9", projectId: "proj-trf", budgetLineId: "bl-8", currency: "USD", amount: 20.00, rate: 1, convertedAmount: 20.00, requestorId: "emp-1", status: "Paid", paymentMethod: "Card", paymentRef: "CC-004", created_at: "2026-06-15T10:00:00Z", commentsJson: "[]", allocationsJson: "[]", hasAttachment: true }
  ],`
);

// 4. Update timesheets with allocationsJson
content = content.replace(/{ id: "ts-1", employeeId: "emp-1", month: "2026-02", totalDays: 20, allocationsJson: "\\[\\]", status: "Approved" }/g, '{ id: "ts-1", employeeId: "emp-1", month: "2026-02", totalDays: 20, allocationsJson: \'[{"budgetLineId":"bl-1","percentage":100}]\', status: "Approved" }');
content = content.replace(/{ id: "ts-2", employeeId: "emp-1", month: "2026-03", totalDays: 21, allocationsJson: "\\[\\]", status: "Approved" }/g, '{ id: "ts-2", employeeId: "emp-1", month: "2026-03", totalDays: 21, allocationsJson: \'[{"budgetLineId":"bl-1","percentage":100}]\', status: "Approved" }');
content = content.replace(/{ id: "ts-3", employeeId: "emp-2", month: "2026-02", totalDays: 20, allocationsJson: "\\[\\]", status: "Approved" }/g, '{ id: "ts-3", employeeId: "emp-2", month: "2026-02", totalDays: 20, allocationsJson: \'[{"budgetLineId":"bl-2","percentage":100}]\', status: "Approved" }');
content = content.replace(/{ id: "ts-4", employeeId: "emp-2", month: "2026-03", totalDays: 21, allocationsJson: "\\[\\]", status: "Approved" }/g, '{ id: "ts-4", employeeId: "emp-2", month: "2026-03", totalDays: 21, allocationsJson: \'[{"budgetLineId":"bl-2","percentage":100}]\', status: "Approved" }');
content = content.replace(/{ id: "ts-5", employeeId: "emp-3", month: "2026-02", totalDays: 20, allocationsJson: "\\[\\]", status: "Approved" }/g, '{ id: "ts-5", employeeId: "emp-3", month: "2026-02", totalDays: 20, allocationsJson: \'[{"budgetLineId":"bl-3","percentage":100}]\', status: "Approved" }');
content = content.replace(/{ id: "ts-6", employeeId: "emp-3", month: "2026-03", totalDays: 21, allocationsJson: "\\[\\]", status: "Approved" }/g, '{ id: "ts-6", employeeId: "emp-3", month: "2026-03", totalDays: 21, allocationsJson: \'[{"budgetLineId":"bl-3","percentage":100}]\', status: "Approved" }');

fs.writeFileSync(seedPath, content, 'utf8');
console.log("Successfully updated seed.ts");
