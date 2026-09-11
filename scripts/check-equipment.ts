// Receiving equipment: the sticker series, the serial, and who may confirm an item.
//
// 11 Sep 2026 (Buying & paying). Four things can go quietly wrong. A tag numbered by
// counting rows hands out the same sticker twice the day an item is removed. A register
// that invents a serial when the field is blank records a number no item carries. A route
// that falls back to a named person when no user arrives writes somebody else's name into
// the audit trail. And the rule that the keeper of the register never confirms an item is
// empty at the role level for the master account, which sits in both lists — so it has to
// be a rule about the PERSON, or it holds for everyone except the one account that most
// needs it. Run: npx tsx scripts/check-equipment.ts
import { readFileSync } from "node:fs";
import { NO_SERIAL, nextEquipmentTag, parseTag, sameSerial, equipmentStatus, mayVerifyEquipment } from "../src/equipment.js";
import { ROUTE_SEATS } from "../src/gates.js";
import { EQUIPMENT_VERIFIERS, SUPPLIER_EDITORS, PLO, AUDITOR } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const tab = read("src/tabs/AssetsTab.tsx");
const between = (from: string, to: string) => server.slice(server.indexOf(from), server.indexOf(to, server.indexOf(from)));
const scan = between('app.post("/api/assets/scan-label"', 'app.post("/api/assets/register"');
const reg = between('app.post("/api/assets/register"', 'app.post("/api/assets/verify"');
const ver = between('app.post("/api/assets/verify"', "// Partner drawings & contributions");

console.log("\nA. the sticker series numbers itself from the stickers");
ok("the first item is EQ-001", nextEquipmentTag([]) === "EQ-001");
ok("the next is the highest plus one", nextEquipmentTag(["EQ-001", "EQ-002"]) === "EQ-003");
ok("a removed item does not free its number — EQ-007 on file means EQ-008, not EQ-003",
  nextEquipmentTag(["EQ-001", "EQ-007"]) === "EQ-008");
ok("rows without a tag, and junk, are ignored", nextEquipmentTag([null, undefined, "junk", "EQ-010"]) === "EQ-011");
ok("past 999 it keeps counting", nextEquipmentTag(["EQ-999"]) === "EQ-1000");
ok("a tag reads back to its number", parseTag("EQ-042") === 42 && parseTag("RC-042/2026") === null);
ok("the database refuses a second sticker with the same number",
  /CREATE UNIQUE INDEX "FixedAsset_tag_key" ON "FixedAsset"\("tag"\)/.test(read("prisma/migrations/20260911120000_equipment_receiving/migration.sql")));
ok("and two receipts in the same instant retry rather than fail",
  /e\?\.code !== "P2002" \|\| attempt >= 2/.test(reg) && /nextEquipmentTag\(/.test(reg));

console.log("\nB. a serial is typed or declared absent — never invented");
ok("nothing on the server invents one any more", !server.includes("SN-M-"));
ok("nor in the browser, which used to invent it before the server could refuse", !tab.includes("SN-M-"));
ok("blank is refused unless someone says there is none",
  /b\.noSerial === true \? NO_SERIAL : String\(b\.serialNumber \|\| ""\)\.trim\(\)/.test(reg) && /if \(!serialNumber\) return res\.status\(400\)/.test(reg));
ok("the same serial typed differently is still the same item", sameSerial("AB-12 34", "ab1234"));
ok("different serials are different items", !sameSerial("X100", "X101"));
ok("blank never matches blank", !sameSerial("", ""));
ok("any number of items may carry no serial", !sameSerial(NO_SERIAL, NO_SERIAL));
ok("a second item with a serial already on file is refused, naming the first",
  /const twin = onFile\.find\(a => sameSerial\(a\.serialNumber, serialNumber\)\)/.test(reg) && /status\(409\)/.test(reg));

console.log("\nC. the rest comes from the form or the voucher, not from a default");
ok("condition is the person's, from the four the register knows", !/condition: "Excellent"/.test(reg) && /CONDITIONS as readonly string\[\]\)\.includes\(b\.condition\)/.test(reg));
ok("currency is never assumed to be USD", !/currency: "USD"/.test(reg));
ok("on a voucher: its currency, date and project, not retyped",
  /currency = exp\.currency;/.test(reg) && /fundingProjectId = exp\.projectId;/.test(reg) && /exp\.paid_at \|\| exp\.approved_at \|\| exp\.created_at/.test(reg));
ok("only a request whose money is committed", /\["Approved", "Paid", "Posted"\]\.includes\(exp\.status\)/.test(reg));
ok("and never more than is left of it once other items on it are counted", /if \(cost > left \+ 0\.005\)/.test(reg));
ok("the browser offers the same three statuses the route accepts", /const BOOKABLE = \["Approved", "Paid", "Posted"\];/.test(tab));
ok("the invented custodian and location are gone", !tab.includes("Mina Studio Coordinator") && !tab.includes("Tripoli Principal Office"));

console.log("\nD. the actor is the signed-in person, and only that person");
for (const [name, body] of [["scan", scan], ["register", reg], ["verify", ver]] as const) {
  ok(`${name}: refuses a request with no signed-in user`, /if \(!user\?\.id\) return res\.status\(401\)/.test(body));
  ok(`${name}: never falls back to a named seat or id`, !/\|\| "u-\d"|"Finance Officer"|\|\| "Auditor"/.test(body));
}
ok("who took delivery is written on the record", /receivedAt: new Date\(\)\.toISOString\(\), receivedBy: user\.id/.test(reg));
ok("and who confirmed it", /verifiedAt: new Date\(\)\.toISOString\(\), verifiedBy: user\.id/.test(ver));

console.log("\nE. the keeper never confirms an item — enforced on the server");
const item = (receivedBy: string | null) => ({ receivedBy });
const as = (id: string, role: string) => ({ id, role });
ok("an auditor may confirm what the keeper received", mayVerifyEquipment(as("u-2", AUDITOR), item("u-ahmad")));
ok("the master account may confirm what somebody else received", mayVerifyEquipment(as("u-1", "Super Admin"), item("u-ahmad")));
ok("the master account may NOT confirm what it received itself", !mayVerifyEquipment(as("u-1", "Super Admin"), item("u-1")));
ok("standing in as the auditor does not change who took delivery", !mayVerifyEquipment(as("u-1", AUDITOR), item("u-1")));
ok("the keeper of the register may not confirm, even an item somebody else received", !mayVerifyEquipment(as("u-ahmad", PLO), item("u-1")));
ok("nor may the Finance Officer, who also keeps it", !mayVerifyEquipment(as("u-7", "Finance Officer"), item("u-1")));
ok("an item entered before receiving existed can still be confirmed", mayVerifyEquipment(as("u-2", AUDITOR), item(null)));
ok("nobody signed in confirms nothing", !mayVerifyEquipment(null, item(null)) && !mayVerifyEquipment({ role: AUDITOR }, item(null)));
ok("the master account is the one seat in both lists — which is why the rule is about the person",
  JSON.stringify(SUPPLIER_EDITORS.filter(r => EQUIPMENT_VERIFIERS.includes(r))) === JSON.stringify(["Super Admin"]));
ok("the route asks the same predicate the button does", /if \(!mayVerifyEquipment\(user, asset\)\)/.test(ver) && /mayVerifyEquipment\(currentUser, a\)/.test(tab));
ok("a refusal is written to the audit log", /"Action Refused"/.test(ver));
ok("the gate keeps verifying with the verifiers", ROUTE_SEATS["/api/assets/verify"] === EQUIPMENT_VERIFIERS);
ok("receiving and scanning stay with the keepers", ROUTE_SEATS["/api/assets/register"] === SUPPLIER_EDITORS && ROUTE_SEATS["/api/assets/scan-label"] === SUPPLIER_EDITORS);
ok("the Procurement Officer's allowlist carries the scan, or the seat would refuse what the gate allows",
  server.includes('"/api/assets/register", "/api/assets/scan-label",'));

console.log("\nF. the scan reads, it never saves");
ok("it uses the free Gemini path, which takes the photo as inlineData", /\{ base64, mimeType \}, "low", "gemini"\)/.test(scan));
ok("and creates nothing", !/fixedAsset\.(create|update)/.test(scan));
ok("it warns when the serial it read is already on the register", /extracted\.duplicateOfTag = twin/.test(scan));
ok("the phone opens the camera for the label and for the item", (tab.match(/capture="environment"/g) || []).length >= 2);

console.log("\nG. the photos are documents like any other");
ok("filed through the one upload route, against the item", /fetch\("\/api\/document\/upload"/.test(tab) && /linkedRecordType: "FixedAsset", linkedRecordId: assetId/.test(tab));
ok("into the funding project's folder, beside the voucher", /linkedRecordType === "FixedAsset" && linkedRecordId/.test(server));
ok("the keeper receives the photos they filed", /const DOMAIN = buys \? new Set\(\["Expense", "Project", "Website", "FixedAsset"\]\)/.test(server));
ok("a thumbnail carries the sign-in ticket", tab.includes("withTicket(`/api/document/content/${doc.id}`)"));

console.log("\nH. status");
ok("entered before receiving existed", equipmentStatus({}) === "Registered");
ok("delivery taken", equipmentStatus({ receivedAt: "2026-09-11" }) === "Received");
ok("confirmed by somebody else", equipmentStatus({ receivedAt: "2026-09-11", verifiedAt: "2026-09-12" }) === "Verified");

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
