// Does an action taken in someone else's seat always say so?
//
// The claim the whole feature rests on: no audit line written while standing in a seat
// can come out looking like the person's own work. Run: npx tsx scripts/check-acting-log.ts
import { actingContext, currentSeat, stampDetails, stampActingAs } from "../src/auditContext.js";

let failed = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}`); } else console.log(`  ok    ${label}`);
};

console.log("\nacting as nobody — the line is untouched");
ok("details unchanged", stampDetails("Voucher approved") === "Voucher approved");
ok("actingAs is null", stampActingAs() === null);
ok("no seat reported", currentSeat() === null);

console.log("\nstanding in a vacant seat");
actingContext.run({ actingAs: "Production Manager", ownRole: "Super Admin", vacant: true }, () => {
  const d = stampDetails("Content Published: 'Tripoli water report'");
  ok("names the seat", d.includes("acting as Production Manager"));
  ok("says the seat was vacant", d.includes("seat vacant"));
  ok("keeps the person's own role", d.includes("own role Super Admin"));
  ok("keeps the original detail", d.startsWith("Content Published: 'Tripoli water report'"));
  ok("actingAs is set for querying", stampActingAs() === "Production Manager");
});

console.log("\nstanding in a seat somebody else holds");
actingContext.run({ actingAs: "Finance Officer", ownRole: "Super Admin", vacant: false }, () => {
  const d = stampDetails("Payment released");
  ok("flags that someone else holds it", d.includes("seat also held by someone else"));
  ok("actingAs is the bypassed seat", stampActingAs() === "Finance Officer");
});

console.log("\nthe seat does not leak past the request");
actingContext.run({ actingAs: "Reporter", ownRole: "Super Admin", vacant: true }, () => { /* one request */ });
ok("context is clear again", currentSeat() === null);
ok("a later line is unstamped", stampDetails("Unrelated action") === "Unrelated action");

console.log("\nthe seat survives an await inside the request");
await actingContext.run({ actingAs: "Content Creator", ownRole: "Super Admin", vacant: true }, async () => {
  await new Promise(r => setTimeout(r, 5));
  ok("still stamped after awaiting", stampDetails("Slow action").includes("acting as Content Creator"));
});

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
