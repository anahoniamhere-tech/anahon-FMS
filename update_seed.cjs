const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, 'prisma/seed.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// Replace projects array
const projectsRegex = /projects:\s*\[[\s\S]*?\n  \],/m;
const projectsReplacement = `projects: [
    {
      id: "proj-trf",
      name: "Thomson Reuters Foundation (TRF)",
      code: "TRF-2026",
      donorId: "don-1",
      budgetUSD: 100000,
      startDate: "2026-02-10",
      endDate: "2026-06-30",
      fundingType: "Restricted Grant",
      status: "Active"
    }
  ],`;
content = content.replace(projectsRegex, projectsReplacement);

// Replace budgetLines array
const budgetLinesRegex = /budgetLines:\s*\[[\s\S]*?\n  \],/m;
content = content.replace(budgetLinesRegex, `budgetLines: [],`);

// Replace expenses array
const expensesRegex = /expenses:\s*\[[\s\S]*?\n  \],/m;
content = content.replace(expensesRegex, `expenses: [],`);

// Replace procurements array
const procurementsRegex = /procurements:\s*\[[\s\S]*?\n  \],/m;
content = content.replace(procurementsRegex, `procurements: [],`);

// Replace journalEntries array
const journalEntriesRegex = /journalEntries:\s*\[[\s\S]*?\n  \],/m;
content = content.replace(journalEntriesRegex, `journalEntries: [],`);

// Replace timesheets array
const timesheetsRegex = /timesheets:\s*\[[\s\S]*?\n  \],/m;
content = content.replace(timesheetsRegex, `timesheets: [],`);

// Replace fixedAssets array
const fixedAssetsRegex = /fixedAssets:\s*\[[\s\S]*?\n  \],/m;
content = content.replace(fixedAssetsRegex, `fixedAssets: [],`);

fs.writeFileSync(seedPath, content);
console.log('Seed file updated successfully.');
