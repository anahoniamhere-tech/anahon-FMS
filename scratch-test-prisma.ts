import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== AnaHon Relational SQLite Database Test ===");

  try {
    // 1. Check Table Counts
    const [
      userCount,
      accountCount,
      donorCount,
      projectCount,
      budgetLineCount,
      vendorCount,
      expenseCount,
      bankAccountCount,
      auditLogCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.donor.count(),
      prisma.project.count(),
      prisma.budgetLine.count(),
      prisma.vendor.count(),
      prisma.expense.count(),
      prisma.bankAccount.count(),
      prisma.auditLog.count()
    ]);

    console.log("\n--- Table Record Counts ---");
    console.log(`- Users: ${userCount}`);
    console.log(`- Accounts: ${accountCount}`);
    console.log(`- Donors: ${donorCount}`);
    console.log(`- Projects: ${projectCount}`);
    console.log(`- Budget Lines: ${budgetLineCount}`);
    console.log(`- Vendors: ${vendorCount}`);
    console.log(`- Expenses: ${expenseCount}`);
    console.log(`- Bank Accounts: ${bankAccountCount}`);
    console.log(`- Audit Logs: ${auditLogCount}`);

    // 2. Fetch and Display Sample User
    const firstUser = await prisma.user.findFirst();
    console.log("\n--- Sample Database User ---");
    if (firstUser) {
      console.log(`- ID: ${firstUser.id}`);
      console.log(`- Name: ${firstUser.name}`);
      console.log(`- Email: ${firstUser.email}`);
      console.log(`- Role: ${firstUser.role}`);
      console.log(`- Active: ${firstUser.active}`);
    } else {
      console.log("No users found.");
    }

    // 3. Fetch and Display Sample Bank Account
    const firstBank = await prisma.bankAccount.findFirst();
    console.log("\n--- Sample Bank Account ---");
    if (firstBank) {
      console.log(`- ID: ${firstBank.id}`);
      console.log(`- Name: ${firstBank.name}`);
      console.log(`- Type: ${firstBank.type}`);
      console.log(`- Currency: ${firstBank.currency}`);
      console.log(`- Balance: ${firstBank.balance}`);
    } else {
      console.log("No bank accounts found.");
    }

    console.log("\n=============================================");
    console.log("✓ SQLite Database Verification Successful!");
  } catch (err: any) {
    console.error("✗ Database Verification Failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
