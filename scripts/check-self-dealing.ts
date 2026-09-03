/**
 * Runnable check for related-party voucher detection.
 *   npx tsx scripts/check-self-dealing.ts
 *
 * Asserts the rule against the live register: a voucher is flagged only when its requester
 * is also its payee — not merely because the payee happens to hold a login.
 */
import { PrismaClient } from "@prisma/client";
import { selfDealingRequester } from "../src/selfDealing";
import assert from "assert";

const prisma = new PrismaClient();

async function main() {
  const [vendors, users, expenses] = await Promise.all([
    prisma.vendor.findMany(), prisma.user.findMany(), prisma.expense.findMany()
  ]);

  const linked = vendors.filter(v => v.userEmail);
  assert(linked.length, "No vendor is linked to a login — the flag can never fire. Set Vendor.userEmail.");

  // Real vouchers: flagged only where requester === payee.
  const flagged = expenses.filter(e => selfDealingRequester(e, vendors, users));
  for (const e of flagged) {
    const v = vendors.find(x => x.id === e.vendorId)!;
    const u = users.find(x => x.id === e.requestorId)!;
    assert.equal(u.email.toLowerCase(), (v.userEmail || "").toLowerCase(),
      `${e.voucherNo} flagged but requester ${u.email} is not payee ${v.userEmail}`);
  }

  // Paying a linked vendor is NOT on its own a conflict — someone else raising it is fine.
  const toLinked = expenses.filter(e => linked.some(v => v.id === e.vendorId));
  const byOthers = toLinked.filter(e => !selfDealingRequester(e, vendors, users));
  for (const e of byOthers) {
    const u = users.find(x => x.id === e.requestorId);
    const v = vendors.find(x => x.id === e.vendorId)!;
    assert.notEqual((u?.email || "").toLowerCase(), (v.userEmail || "").toLowerCase(),
      `${e.voucherNo} should have been flagged — requester and payee share an email`);
  }

  // Synthetic both-ways proof, so the check still means something when no real voucher qualifies.
  const v = linked[0];
  const owner = users.find(u => u.email.toLowerCase() === v.userEmail.toLowerCase());
  assert(owner, `Vendor "${v.name}" is linked to ${v.userEmail}, but no user has that email.`);
  const other = users.find(u => u.id !== owner!.id)!;
  assert(selfDealingRequester({ vendorId: v.id, requestorId: owner!.id }, vendors, users),
    "self-raised voucher was not flagged");
  assert(!selfDealingRequester({ vendorId: v.id, requestorId: other.id }, vendors, users),
    "voucher raised by someone else was wrongly flagged");
  assert(!selfDealingRequester({ vendorId: "ven-nonexistent", requestorId: owner!.id }, vendors, users),
    "unknown vendor should never flag");

  console.log(`✓ ${linked.length} linked provider(s): ${linked.map(l => `${l.name} → ${l.userEmail}`).join(", ")}`);
  console.log(`✓ ${toLinked.length} voucher(s) payable to them; ${flagged.length} related-party`);
  console.log(`✓ flags on self-raised, stays silent when ${other.name} raises it`);
}

main()
  .catch(e => { console.error("✗", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
