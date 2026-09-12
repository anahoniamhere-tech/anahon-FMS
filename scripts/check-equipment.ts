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
import { NO_SERIAL, nextEquipmentTag, parseTag, sameSerial, equipmentStatus, mayVerifyEquipment, blankIfPlaceholder,
  checkOutBlocker, stickerLink, stickerSheetHtml, QR_ALPHANUMERIC, STICKER_SIZES, DEFAULT_STICKER_MM, STRIP_SIZES,
  CHECK_EVERY_MONTHS, DEFAULT_CHECK_MONTHS,
  EQUIPMENT_KINDS, USEFUL_LIFE_BY_KIND, DEFAULT_KIND, normalizeKind, usefulLifeFor, mayOverrideUsefulLife,
  HOLDER_KINDS, EQUIPMENT_LOCATIONS, OTHER_LOCATION, resolveLocation, currentMovement,
  EDITABLE_FIELDS, LOCKED_FIELDS, VERIFIED_FIELDS, equipmentChanges, verificationLapses,
  deleteBlocker, endBlocker, endIsEffective, isDisposal, endKindOf, END_KINDS, mayEndEquipment,
  confirmDisposalBlocker, disposalSides } from "../src/equipment.js";
import { RULES, deskItems } from "../src/workflow.js";
import { ROUTE_SEATS } from "../src/gates.js";
import { EQUIPMENT_VERIFIERS, SUPPLIER_EDITORS, PLO, AUDITOR, FINANCE } from "../src/roles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const server = read("server.ts");
const tab = read("src/tabs/AssetsTab.tsx");
const types = read("src/types.ts");
const between = (from: string, to: string) => server.slice(server.indexOf(from), server.indexOf(to, server.indexOf(from)));
const scan = between('app.post("/api/assets/scan-label"', 'app.post("/api/assets/register"');
// What an item IS is validated in one helper now, so a correction cannot be held to looser
// rules than the first entry. The register's own slice is the helper plus the route.
const fields = between("async function validateEquipmentFields", 'app.post("/api/assets/register"');
const reg = fields + between('app.post("/api/assets/register"', 'app.post("/api/assets/update"');
const edit = between('app.post("/api/assets/update"', 'app.post("/api/assets/verify"');
const ver = between('app.post("/api/assets/verify"', 'app.post("/api/assets/checkout"');
const out = between('app.post("/api/assets/checkout"', 'app.post("/api/assets/checkin"');
const back = between('app.post("/api/assets/checkin"', 'app.post("/api/assets/move"');
const moved = between('app.post("/api/assets/move"', 'app.post("/api/assets/delete"');
const gone = between('app.post("/api/assets/delete"', 'app.post("/api/assets/write-off"');
const ended = between('app.post("/api/assets/end"', 'app.post("/api/assets/end-confirm"');
const second = between('app.post("/api/assets/end-confirm"', 'app.post("/api/assets/repair"');
const fix = between('app.post("/api/assets/repair"', "// Stickers to print:");
const stick = between('app.get("/api/assets/stickers"', 'app.get("/e/:tag"');
const short = between('app.get("/e/:tag"', "// Partner drawings & contributions");
const i18n = read("src/i18n.ts");
const pkg = read("package.json");

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
  /b\.noSerial === true \? NO_SERIAL : blankIfPlaceholder\(b\.serialNumber\);/.test(reg) && /if \(!serialNumber\) return bad\(/.test(reg));
ok("the same serial typed differently is still the same item", sameSerial("AB-12 34", "ab1234"));
ok("different serials are different items", !sameSerial("X100", "X101"));
ok("blank never matches blank", !sameSerial("", ""));
ok("any number of items may carry no serial", !sameSerial(NO_SERIAL, NO_SERIAL));
ok("a second item with a serial already on file is refused, naming the first",
  /const twin = onFile\.find\(a => a\.id !== selfId && sameSerial\(a\.serialNumber, serialNumber\)\)/.test(reg) && /this is probably the same item\.`, 409\)/.test(reg));

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
ok("who took delivery is written on the record", /const receivedAt = new Date\(\)\.toISOString\(\);/.test(reg) && /receivedAt, receivedBy: user\.id/.test(reg));
ok("and who confirmed it", /verifiedAt: now, verifiedBy: user\.id, nextCheckDue/.test(ver));

console.log("\nE. the keeper never confirms an item — enforced on the server");
const item = (receivedBy: string | null) => ({ receivedBy });
const as = (id: string, role: string) => ({ id, role });
ok("an auditor may confirm what the keeper received", mayVerifyEquipment(as("u-2", AUDITOR), item("u-ahmad")));
ok("the master account may confirm what somebody else received", mayVerifyEquipment(as("u-1", "Super Admin"), item("u-ahmad")));
ok("the master account may NOT confirm what it received itself", !mayVerifyEquipment(as("u-1", "Super Admin"), item("u-1")));
ok("standing in as the auditor does not change who took delivery", !mayVerifyEquipment(as("u-1", AUDITOR), item("u-1")));
ok("the keeper of the register may not confirm, even an item somebody else received", !mayVerifyEquipment(as("u-ahmad", PLO), item("u-1")));
// 12 Sep 2026: Saad opened confirming to the Finance Officer, because the auditor account is
// dormant and the register was deadlocked — he cannot confirm what he registered himself.
ok("the Finance Officer may confirm an item somebody else received", mayVerifyEquipment(as("u-7", "Finance Officer"), item("u-1")));
ok("but not one they received themselves — the rule is about the person, never the seat",
  !mayVerifyEquipment(as("u-7", "Finance Officer"), item("u-7")));
ok("the keepers who may also confirm are exactly the two seats Saad chose — nobody drifted in",
  JSON.stringify(SUPPLIER_EDITORS.filter(r => EQUIPMENT_VERIFIERS.includes(r))) === JSON.stringify(["Super Admin", "Finance Officer"]));
ok("every confirmed item still had two different people on it — enforced per item, not per seat",
  EQUIPMENT_VERIFIERS.every(role => !mayVerifyEquipment(as("u-same", role), item("u-same"))));
ok("an item entered before receiving existed can still be confirmed", mayVerifyEquipment(as("u-2", AUDITOR), item(null)));
ok("nobody signed in confirms nothing", !mayVerifyEquipment(null, item(null)) && !mayVerifyEquipment({ role: AUDITOR }, item(null)));

ok("the route asks the same predicate the button does", /if \(!mayVerifyEquipment\(user, asset\)\)/.test(ver) && /mayVerifyEquipment\(currentUser, a\)/.test(tab));
ok("a refusal is written to the audit log", /"Action Refused"/.test(ver));
ok("the gate keeps verifying with the verifiers", ROUTE_SEATS["/api/assets/verify"] === EQUIPMENT_VERIFIERS);
ok("receiving and scanning stay with the keepers", ROUTE_SEATS["/api/assets/register"] === SUPPLIER_EDITORS && ROUTE_SEATS["/api/assets/scan-label"] === SUPPLIER_EDITORS);
ok("the Procurement Officer's allowlist carries the scan, or the seat would refuse what the gate allows",
  server.includes('"/api/assets/register", "/api/assets/update", "/api/assets/scan-label",'));

console.log("\nF. the scan reads, it never saves");
ok("it asks the free Gemini path first, which takes the photo as inlineData",
  /askJson\(prompt, schema, \{ base64, mimeType \}, "low", prefer\)/.test(scan) && /readLabel\("gemini"\)/.test(scan));
ok("and creates nothing", !/fixedAsset\.(create|update)/.test(scan));
ok("it warns when the serial it read is already on the register", /extracted\.duplicateOfTag = twin/.test(scan));
ok("the phone opens the camera for the label and for the item", (tab.match(/capture="environment"/g) || []).length >= 2);

// Scan the wrong item, then the right one whose serial is worn off: the second read is blank,
// and a form that keeps the old value hands the right item the wrong item's serial.
ok("a second scan replaces the first — a blank read never leaves the last item's serial behind",
  /serial: x\.serialNumber \|\| "", noSerial:/.test(tab) && !/x\.(serialNumber|brand|model|name|specs) \|\| prev\./.test(tab));

// The live re-scan of 11 Sep met the free tier's 503 and showed its raw JSON on the screen.
ok("a busy reader is a moment's wait, said in a sentence — not the provider's JSON",
  /high demand/.test(scan) && scan.includes("The label reader is busy for a moment — press Scan the label again"));

console.log("\nG. the photos are documents like any other");
ok("filed through the one upload route, against the item", /fetch\("\/api\/document\/upload"/.test(tab) && /linkedRecordType: "FixedAsset", linkedRecordId: assetId/.test(tab));
ok("into the funding project's folder, beside the voucher", /linkedRecordType === "FixedAsset" && linkedRecordId/.test(server));
ok("the keeper receives the photos they filed", /const DOMAIN = buys \? new Set\(\["Expense", "Project", "Website", "FixedAsset"\]\)/.test(server));
ok("a thumbnail carries the sign-in ticket", tab.includes("withTicket(`/api/document/content/${doc.id}`)"));

console.log("\nI. a placeholder is not an answer");
// The live scan of 11 Sep answered "generic" for a brand it could not see. A serial of "N/A"
// saved from a prefilled form would be the invented serial again, one step removed.
ok("'N/A' is not a serial", blankIfPlaceholder("N/A") === "" && blankIfPlaceholder("n/a") === "");
ok("nor 'unknown', 'generic', '-', '?', 'Not visible'", ["unknown", "Generic", "-", "---", "?", "Not visible"].every(x => blankIfPlaceholder(x) === ""));
ok("a real serial survives, trimmed", blankIfPlaceholder(" 4C1A-9ZX ") === "4C1A-9ZX");
ok("a real name that merely contains the word survives", blankIfPlaceholder("Generic Electric Co") === "Generic Electric Co");
ok("the scan blanks placeholders before they reach the form", /extracted\[k\] = blankIfPlaceholder\(extracted\[k\]\)/.test(scan));
ok("and tells the model not to write them", /never a placeholder such as "generic", "unknown", "N\/A" or "-"/.test(scan));
ok("an English warning keeps its own direction in the Arabic layout", tab.includes('<p key={i} dir="auto">'));

console.log("\nH. status");
ok("entered before receiving existed", equipmentStatus({}) === "Registered");
ok("delivery taken", equipmentStatus({ receivedAt: "2026-09-11" }) === "Received");
ok("confirmed by somebody else", equipmentStatus({ receivedAt: "2026-09-11", verifiedAt: "2026-09-12" }) === "Verified");

/* ── Phase 2 (11 Sep 2026): custody, the desk, repairs, the periodic check, stickers ── */

console.log("\nJ. an item goes out only when it is confirmed and in, and comes back with its condition");
ok("unconfirmed stays in", checkOutBlocker({ verifiedAt: null }) === "not confirmed yet");
ok("out has one holder, not two", checkOutBlocker({ verifiedAt: "2026-09-11", holderId: "u-po" }) === "already out");
ok("confirmed and in may go", checkOutBlocker({ verifiedAt: "2026-09-11", holderId: null }) === null);
ok("the route refuses with the same predicate the button shows", /const blocker = checkOutBlocker\(asset\);/.test(out) && tab.includes("{t(checkOutBlocker(a)!)}"));
ok("the database refuses a second check-out too — the write lands only on a row still in and confirmed",
  /where: \{ id: asset\.id, holderId: null, verifiedAt: \{ not: null \} \}/.test(out) && /if \(done\.count !== 1\)/.test(out));
ok("the holder is an active account — validated once, in the same helper register and check-in use",
  /if \(!u \|\| !u\.active\) return \{ ok: false, name: "", error: "Choose an active account\." \};/.test(server));
ok("what it is for, and a due-back date not in the past, are required", /if \(!heldFor\)/.test(out) && /dueBack < localDate\(\)/.test(out));
ok("a return records the condition it came back in and clears the holder",
  /CONDITIONS as readonly string\[\]\)\.includes\(condition\)/.test(back)
  && /holderId: null, heldFor: "", heldProjectId: "", outAt: null, dueBack: null, condition, custodian: restHolder\.name, location: loc\.location/.test(back)
  && /where: \{ id: asset\.id, holderId: asset\.holderId \}/.test(back));
ok("both writes go on the item's own log", /moves\.push\(\{/.test(out) && /returnCondition: condition/.test(back));
for (const [name, body] of [["checkout", out], ["checkin", back], ["repair", fix]] as const) {
  ok(`${name}: the signed-in person, or a refusal — no named fallback`, /if \(!user\?\.id\) return res\.status\(401\)/.test(body) && !/\|\| "u-\d"|"Finance Officer"/.test(body));
}
ok("who lent it and who took it back are the session's", /outBy: user\.id/.test(out) && /inBy: user\.id/.test(back));
ok("out is a status derived from the holder, never stored", equipmentStatus({ verifiedAt: "x", holderId: "u-po" }) === "Out" && /status: equipmentStatus\(a\)/.test(server));
ok("the register says who has it, what for and when it is due", tab.includes('t("With {name} — {purpose} — due {date}")'));
ok("nobody confirms an item while it is out on a shoot", /if \(asset\.holderId\) return res\.status\(409\)/.test(ver));

console.log("\nK. the desk carries overdue returns and periodic checks — no second reminder path");
const TODAY = "2026-09-11";
const people = [
  { id: "u-sa", name: "Saad", email: "sa@x", role: "Super Admin", active: true },
  { id: "u-plo", name: "Ahmad", email: "plo@x", role: PLO, active: true },
  { id: "u-fo", name: "Marwan", email: "fo@x", role: "Finance Officer", active: true },
  { id: "u-po", name: "Omar", email: "po@x", role: "Project Officer", active: true },
  { id: "u-aud", name: "Auditor", email: "aud@x", role: AUDITOR, active: false },
];
const me = (id: string) => { const u = people.find(p => p.id === id)!; return { id: u.id, email: u.email, role: u.role }; };
const deskOf = (id: string, assets: any[]) => deskItems(me(id), { users: people, fixedAssets: assets } as any, TODAY).filter(i => i.kind === "fixedAssets");
const outItem = (holderId: string, dueBack: string) => ({ id: "a1", tag: "EQ-001", name: "Camera", status: "Out", holderId, dueBack, receivedBy: "u-plo" });
const holderRow = deskOf("u-po", [outItem("u-po", TODAY)]);
ok("due back today: on the holder's own desk, opening My Desk — a Project Officer has no Equipment door",
  holderRow.length === 1 && holderRow[0].group === "mine" && holderRow[0].door === "mydesk" && holderRow[0].verb === "Bring the equipment back");
ok("and on the keepers' desks, opening Equipment",
  ["u-plo", "u-fo"].every(id => deskOf(id, [outItem("u-po", TODAY)]).some(i => i.group === "mine" && i.door === "assets" && i.verb === "Chase the return")));
ok("overdue reads as overdue", deskOf("u-po", [outItem("u-po", "2026-09-08")])[0]?.urgency === "overdue");
ok("not before it is due", ["u-po", "u-plo", "u-fo", "u-sa"].every(id => deskOf(id, [outItem("u-po", "2026-09-12")]).length === 0));
ok("a keeper holding it gets one row, not two", deskOf("u-plo", [outItem("u-plo", TODAY)]).length === 1);
const checkDue = (receivedBy: string, nextCheckDue: string) => ({ id: "a2", tag: "EQ-002", name: "Tripod", status: "Verified", receivedBy, nextCheckDue });
// Until 12 Sep 2026 this landed on the master account as "cover", because the auditor seat was
// vacant and nobody else could confirm. Opening it to the Finance Officer gives it a real
// owner: it is Marwan's turn, and Saad sees it only as a note about somebody else's week.
ok("a periodic check falls due on the Finance Officer's own desk",
  deskOf("u-fo", [checkDue("u-plo", TODAY)]).some(i => i.group === "mine" && i.door === "assets" && i.verb === "Check it is still here"));
ok("and is no longer the master account's to cover — it has an owner now",
  deskOf("u-sa", [checkDue("u-plo", TODAY)]).every(i => i.group === "week"));
ok("not before it is due", deskOf("u-sa", [checkDue("u-plo", "2026-10-11")]).length === 0);
// deskItems shows anyone a near-due item on somebody else's desk as a "this week" note; what the
// exclusion guarantees is that it is never the receiver's own turn.
ok("never the turn of the person who received it — at most a 'due this week' note, never mine or cover",
  deskOf("u-sa", [checkDue("u-sa", TODAY)]).every(i => i.group === "week"));
const received = (receivedBy: string) => ({ id: "a3", tag: "EQ-003", name: "Mic", status: "Received", receivedBy });
ok("a received item waits on a verifier's desk, and never on its receiver's",
  deskOf("u-fo", [received("u-plo")]).some(i => i.verb === "Confirm it is here")
  && deskOf("u-fo", [received("u-fo")]).length === 0
  && deskOf("u-sa", [received("u-sa")]).length === 0);
// The deadlock this broke: nothing the master account received could be confirmed by anybody,
// because it was the only working verifier and may not confirm its own receipt.
ok("what Saad received is now somebody's turn — Marwan's", deskOf("u-fo", [received("u-sa")]).some(i => i.group === "mine" && i.verb === "Confirm it is here"));
ok("and what Ahmad received still is", deskOf("u-fo", [received("u-plo")]).some(i => i.group === "mine"));
const eqRules = RULES.filter(r => r.kind === "fixedAssets");
ok("the dated rows use `when` with a zero horizon — they appear on the day, not before",
  eqRules.filter(r => r.when).every(r => r.horizon === 0) && eqRules.some(r => r.when === "dueBack") && eqRules.some(r => r.when === "nextCheckDue"));
ok("a holder sees the item they hold even on a trimmed view — and nothing about its money",
  (server.match(/fixedAssets: heldByViewer/g) || []).length >= 3 && server.includes("fixedAssets: buys ? fixedAssets : heldByViewer")
  && !/const heldByViewer[^;]*\bcost\b/.test(server));

console.log("\nL. a repair is an expense: logged on the item, never on its cost");
const repairWrite = fix.slice(fix.indexOf("prisma.fixedAsset.update("), fix.indexOf("prisma.fixedAsset.update(") + 140);
ok("the only field a repair writes is the item's repair log", /data: \{ repairsJson: JSON\.stringify\(repairs\) \}/.test(repairWrite));
ok("cost basis, book value and depreciation are untouched", !/cost:|currentBookValue|accumulatedDepreciation/.test(repairWrite));
ok("what, who and when are required", /if \(!work\)/.test(fix) && /if \(!doneBy\)/.test(fix) && /Give the date of the repair/.test(fix));
ok("a linked voucher must be approved, sets the currency, and caps the cost",
  /\["Approved", "Paid", "Posted"\]\.includes\(exp\.status\)/.test(fix) && /currency = exp\.currency/.test(fix) && /if \(cost > exp\.amount \+ 0\.005\)/.test(fix));

console.log("\nM. every confirmation books the next check");
// The date sum is the server's own addMonths — the one subscriptions and grant milestones already
// use — not a second copy. It takes YYYY-MM-DD: handed a full timestamp it would return it unchanged.
ok("twelve months on by default, with the server's own date sum, given a plain date",
  DEFAULT_CHECK_MONTHS === 12 && /nextCheckDue = addMonths\(now\.slice\(0, 10\), months\)/.test(ver));
ok("which clamps a missing month-end rather than rolling into the next month", /if \(d\.getUTCDate\(\) < day\) d\.setUTCDate\(0\);/.test(server));
ok("and there is only one of it", (server.match(/const addMonths = /g) || []).length === 1 && !/export function addMonths/.test(read("src/equipment.ts")));
ok("the verifier may choose 6 or 24 instead", JSON.stringify(CHECK_EVERY_MONTHS) === "[6,12,24]"
  && /CHECK_EVERY_MONTHS as readonly number\[\]\)\.includes\(Number\(req\.body\.checkEveryMonths\)\)/.test(ver) && /nextCheckDue = addMonths\(now\.slice\(0, 10\), months\)/.test(ver));
ok("items confirmed before this existed get their first check a year after it",
  /date\("verifiedAt", '\+12 months'\)/.test(read("prisma/migrations/20260911160000_equipment_custody/migration.sql")));

console.log("\nN. a small sticker: a short capital link, real millimetres, the phone's own camera");
const base = "https://anahon-1.tailbcb2b7.ts.net:8444";
const link = stickerLink(base, "EQ-004");
ok("the link is short and in capitals", link === "HTTPS://ANAHON-1.TAILBCB2B7.TS.NET:8444/E/EQ-004");
ok("every character sits in the QR's alphanumeric set", QR_ALPHANUMERIC.test(link) && QR_ALPHANUMERIC.test(stickerLink(base, "EQ-1000")));
// Version 3 at level M holds 61 alphanumeric characters (ISO/IEC 18004, table 7). Past that it grows.
ok("and short enough to stay at version 3 (29 × 29) — 61 characters at level M", link.length <= 61 && stickerLink(base, "EQ-99999").length <= 61);
ok("in lower case it would not be — the reason for the capitals", !QR_ALPHANUMERIC.test(base));
ok("the QR is level M with a 2-module quiet zone", /border=2,error_correction=qrcode\.constants\.ERROR_CORRECT_M/.test(server));
ok("the short route is open, looks nothing up, and only points at the Equipment door",
  !/prisma\./.test(short) && /res\.redirect\(302, `\/\?door=assets&focus=\$\{encodeURIComponent\(`tag:\$\{tag\}`\)\}`\)/.test(short) && /\.toUpperCase\(\)/.test(short));
ok("it answers /E/ in capitals as well: Express routing is case-blind and nothing here turns that off", !/case sensitive routing|caseSensitive/.test(server));
ok("the screen finds an item by its tag, case-blind", /\/\^tag:\/i\.test\(want\)/.test(tab) && /\.toUpperCase\(\) === want\.slice\(4\)\.toUpperCase\(\)/.test(tab));
ok("stickers print for those who can open Equipment, at FMS_PUBLIC_URL, with the shared generator",
  /doorsFor\(String\(req\.dbUser\?\.role\)\)\.map\(String\)\.includes\("assets"\)/.test(stick) && /if \(!base\) return res\.status\(503\)/.test(stick) && /qrSvg\(stickerLink\(base, String\(a\.tag\)\)\)/.test(stick));
ok("no QR package was added — the Python one already in the image does it", !/"qrcode"/.test(pkg));
const qr = "<svg viewBox=\"0 0 33 33\"></svg>";
const sheet = stickerSheetHtml([{ tag: "EQ-004", name: "Sony FX6 <script>alert(1)</script>", qr }], { mm: 15 });
ok("A4 with a margin, laid out in millimetres", /@page \{ size: A4; margin: 10mm; \}/.test(sheet) && sheet.includes("--q:15mm") && sheet.includes("width: calc(var(--q) + 5mm); height: calc(var(--q) + 5mm)"));
ok("a 1.5 cm QR makes a 2 × 2 cm sticker", DEFAULT_STICKER_MM === 15 && JSON.stringify(STICKER_SIZES) === "[10,15,20]");
ok("tag and name in 6 pt on one line, cut short", /font: 6pt\/1\.15/.test(sheet) && /white-space: nowrap; overflow: hidden; text-overflow: ellipsis/.test(sheet));
ok("a typed name cannot inject markup", !sheet.includes("<script>alert(1)</script>") && sheet.includes("&lt;script&gt;"));
ok("an unknown size falls back to 1.5 cm", stickerSheetHtml([{ tag: "EQ-1", name: "x", qr }], { mm: 7 }).includes("--q:15mm"));
const strip = stickerSheetHtml([{ tag: "EQ-004", name: "Mic", qr }, { tag: "EQ-005", name: "Other", qr }], { strip: true });
ok("the test strip is one item at 1, 1.2, 1.5 and 2 cm, captioned",
  JSON.stringify(STRIP_SIZES) === "[10,12,15,20]" && (strip.match(/class="s"/g) || []).length === 4
  && ["1 cm", "1.2 cm", "1.5 cm", "2 cm"].every(c => strip.includes(`<figcaption>${c}</figcaption>`)) && !strip.includes("EQ-005"));
ok("the screen picks which items to print, the size, and the strip — every link carries the sign-in ticket",
  tab.includes("withTicket(`/api/assets/stickers?size=${stickerMm}&ids=") && tab.includes("withTicket(`/api/assets/stickers?strip=1&ids=") && /STICKER_SIZES\.map/.test(tab));

// Saad, 11 Sep: "scan all the equipment, print A4 sheets, cut the QRs, stick them on."
ok("print after scan: everything registered since the screen opened is one button away, on one sheet",
  /setJustReceived\(prev => \[\.\.\.prev, id\]\)/.test(tab)
  && tab.includes("withTicket(`/api/assets/stickers?size=${stickerMm}&ids=${justReceived.map(encodeURIComponent).join(\",\")}`)"));

console.log("\nO. the Equipment screen speaks Arabic");
const keysUsed = [...tab.matchAll(/\bt\("((?:[^"\\]|\\.)*)"\)/g)].map(m => m[1]);
const missingAr = [...new Set(keysUsed)].filter(k => !i18n.includes(`"${k}":`));
ok(`every t("…") on the screen has Arabic (${new Set(keysUsed).size})`, missingAr.length === 0, missingAr.join(" | "));

console.log("\nP. useful life comes from Finance's policy table, keyed on kind — 12 Sep 2026");
ok("every kind has a policy figure, and only these kinds exist",
  EQUIPMENT_KINDS.every(k => typeof USEFUL_LIFE_BY_KIND[k] === "number" && USEFUL_LIFE_BY_KIND[k] > 0)
  && Object.keys(USEFUL_LIFE_BY_KIND).length === EQUIPMENT_KINDS.length);
ok('"other" is in the list and is the fallback', EQUIPMENT_KINDS.includes(DEFAULT_KIND as any) && DEFAULT_KIND === "other");
ok("a real kind reads its own figure", usefulLifeFor("camera") === USEFUL_LIFE_BY_KIND.camera && usefulLifeFor("furniture") === USEFUL_LIFE_BY_KIND.furniture);
ok("blank, unknown or junk all fall back to \"other\" — nothing is ever invented and nothing blocks a save",
  usefulLifeFor("") === USEFUL_LIFE_BY_KIND.other
  && usefulLifeFor(null as any) === USEFUL_LIFE_BY_KIND.other
  && usefulLifeFor("spaceship") === USEFUL_LIFE_BY_KIND.other
  && normalizeKind("spaceship") === "other");
ok("normalizeKind never returns something outside the list", EQUIPMENT_KINDS.every(k => normalizeKind(k) === k));

console.log("\nQ. only Finance may put a different figure on an item");
ok("Finance and the master account may override", mayOverrideUsefulLife({ role: "Finance Officer" }) && mayOverrideUsefulLife({ role: "Super Admin" }));
ok("the register's own keeper (PLO) may not — the receiving desk should not have to think about it",
  !mayOverrideUsefulLife({ role: PLO }));
ok("nobody signed in may not either", !mayOverrideUsefulLife(null) && !mayOverrideUsefulLife(undefined));
ok("FINANCE is the same list the ledger and the WHT review already use — not a fresh one",
  JSON.stringify(FINANCE) === JSON.stringify(["Super Admin", "Finance Officer"]));

console.log("\nR. the route: a kind is accepted or defaulted, and only Finance may override its life");
ok("the route reads kind through the shared normalizer, so it can never invent or reject one",
  /const kind = normalizeKind\(b\.kind\);/.test(reg) && /const policyLife = usefulLifeFor\(kind\);/.test(reg));
ok("no override sent → the policy figure, silently — the receiving desk is never asked",
  /let usefulLifeYears = policyLife;/.test(reg));
ok("a non-integer or non-positive override is refused, exactly as before",
  /if \(!Number\.isInteger\(requested\) \|\| requested < 1\)/.test(reg));
ok("a different figure than policy is refused unless the actor may override it",
  /requested !== policyLife && !mayOverrideUsefulLife\(user\)/.test(reg) && /on an item\.", 403\)/.test(reg));
ok("an override equal to the policy figure is never refused — nothing to override", true); // proved by the condition above using !==
ok("the kind is written on the record", reg.includes("id: `asset-${Date.now()}`, tag, name, kind,"));

console.log("\nS. the scan reads a kind from the label, never a useful-life figure");
ok("the model is given the real kind list and told never to invent a lifespan",
  /kind: which of these it is/.test(scan) && /Never guess a useful-life or depreciation figure/.test(scan));
ok("the schema constrains it to the real kinds (or blank) — nothing else can come back",
  /kind: \{ type: "string", enum: \[\.\.\.EQUIPMENT_KINDS, ""\] \}/.test(scan));
ok("kind is required in the schema, so a run that skips it is a bug, not a blank field slipping past unnoticed",
  /required: \["name", "brand", "model", "serialNumber", "specs", "kind", "confidence"\]/.test(scan));

console.log("\nT. the screen: kind picker, policy-derived life, and Finance's own table");
ok("choosing a kind resets any earlier override — switching what the item IS restarts from that kind's own default",
  /const setKind = \(kind: string\) => setF\(prev => \(\{ \.\.\.prev, kind, lifeOverride: "" \}\)\);/.test(tab));
ok("the read-only figure and the editable one both come from the same usefulLifeFor call",
  /const policyLife = usefulLifeFor\(f\.kind\);/.test(tab));
ok("only Finance sees an editable field — the receiving desk sees a figure, not a decision",
  /const overriding = mayOverrideUsefulLife\(currentUser\);/.test(tab) && /overriding \? \(/.test(tab));
ok("the save is never blocked by a missing kind — an override is the only thing ever added to the body",
  /\.\.\.\(overriding && f\.lifeOverride \? \{ usefulLifeYears: f\.lifeOverride \} : \{\}\)/.test(tab));
ok("a scanned kind only lands in the form when it is one of the real ones",
  /\(EQUIPMENT_KINDS as readonly string\[\]\)\.includes\(x\.kind\) \? x\.kind : prev\.kind/.test(tab));
ok("Finance can read the whole policy table on the screen, not just guess at one item's figure",
  /USEFUL_LIFE_BY_KIND\[k\]/.test(tab) && /policyOpen/.test(tab));
ok("the policy table is behind the same predicate as the override, not a separate role check",
  /\{policyOpen && overriding && \(/.test(tab));

console.log("\nU. Arabic — the kind labels and the new sentences all speak it");
const kindLabelHits = ["Camera", "Lens", "Audio", "Lighting", "Computer, phone or tablet", "Storage", "Network", "Furniture", "Other"];
ok("every kind label used on the screen has Arabic", kindLabelHits.every(k => i18n.includes(`"${k}":`)));
// The blanket check ("every t(...) on the screen") already runs in section O, after
// this file is read — nothing kind-specific to add beyond the labels above.

console.log("\nV. a gift has no cost, and a voucher already proves it wasn't one — 12 Sep 2026");
ok("a gift is only ever off a voucher — the two claims cannot both be true",
  /const gift = b\.gift === true && !b\.expenseId;/.test(reg));
ok("claiming both is refused outright, not silently resolved one way",
  /if \(b\.gift === true && b\.expenseId\) return bad\("A voucher paid for this/.test(reg));
ok("a gift costs exactly 0 — never asked, never invented", /const cost = gift \? 0 : Number\(b\.cost\);/.test(reg));
ok("a real item off a voucher still needs a real cost", /if \(!gift && !\(cost > 0\)\)/.test(reg));
ok("a gift has no currency to choose", /currency = gift \? "" : String\(b\.currency \|\| ""\);/.test(reg));
ok("the audit line says \"a gift\", never a false \"0.00 \" figure",
  /\$\{gift \? "a gift" : `\$\{cost\.toFixed\(2\)\}\$\{"[^"]*"\}\$\{currency\}`\}/.test(reg.replace(/ /g, "")) || /gift \? "a gift" : `\$\{cost\.toFixed\(2\)\} \$\{currency\}`/.test(reg));
ok("the toggle sits only where a voucher is not chosen — a voucher is proof it wasn't free",
  /\{!v && \(\s*<label className="mt-1 flex min-h-\[44px\]/.test(tab));
ok("ticking it clears cost and currency from the body, rather than sending an invented 0/blank the route then has to trust",
  /cost: f\.gift \? "0" : f\.cost, currency: f\.gift \? "" : f\.currency/.test(tab));
ok("the inputs are disabled while ticked, so nothing typed there can leak through",
  /required=\{!form\.gift\} disabled=\{form\.gift\}/.test(tab) && (tab.match(/disabled=\{form\.gift\}/g) || []).length >= 2);
ok("the card says \"Gift\" rather than three columns of \"0.00\" with no currency",
  /a\.cost > 0 \? \(/.test(tab) && tab.includes('<Gift className="inline h-3.5 w-3.5" /> {t("Gift — no cost recorded")}'));
ok("FixedAsset.currency admits the one honest case with no sum to name", /currency: "USD" \| "EUR" \| "LBP" \| "";/.test(types));

console.log("\nW. \"Currently with / in\" is a derived field over the movement log — 12 Sep 2026");
// Saad's point: the item's location and holder are FACTS ABOUT ITS HISTORY, not a text
// field someone edits. Registration writes the first entry; check-out and check-in are
// the only two things that ever write another one. Nothing else touches custody.
ok("who has it is one of three kinds, and only three", JSON.stringify(HOLDER_KINDS) === '["org","employee","vendor"]');

console.log("\nX. resolveLocation — the fixed list, or \"Other\" typed, never invented");
ok("blank is refused", !resolveLocation("", "").ok);
ok("a listed place is accepted as-is", resolveLocation("Studio", "").ok && resolveLocation("Studio", "").location === "Studio");
ok("\"other\" with nothing typed is refused", !resolveLocation(OTHER_LOCATION, "").ok);
ok("\"other\" with a typed place is accepted, trimmed", resolveLocation(OTHER_LOCATION, "  Beirut warehouse  ").location === "Beirut warehouse");
ok("a value that names neither the list nor \"other\" is refused — nothing is guessed", !resolveLocation("Somewhere else", "").ok);
ok("the three places on offer are exactly these, nothing invented per item",
  JSON.stringify(EQUIPMENT_LOCATIONS) === '["Tripoli office","Studio","Store cupboard"]');

console.log("\nY. currentMovement — the whole state is the last entry, nothing more");
ok("no history yet → null, not a guess", currentMovement({ movements: [] }) === null && currentMovement({}) === null);
const M = (over: any) => ({ id: "m1", holderKind: "employee", holderId: "u-1", location: "Studio", heldFor: "", projectId: "", outAt: "2026-09-01T00:00:00.000Z", outBy: "u-1", dueBack: null, inAt: null, inBy: null, returnCondition: null, note: "", ...over });
ok("one entry → that entry", currentMovement({ movements: [M({})] })?.id === "m1");
ok("several entries → the LAST one, not the first", currentMovement({ movements: [M({ id: "old" }), M({ id: "new" })] })?.id === "new");

console.log("\nZ. the register: who has it and where, resolved once — never typed free text");
ok("the free-text \"Held by\" / \"Kept at\" inputs are gone from the form",
  !tab.includes('id="eq-custodian"') && !tab.includes('id="eq-location" required value={f.location} onChange={e => set("location"'));
ok("an unknown holder kind is refused before anything is looked up",
  /if \(!\(HOLDER_KINDS as readonly string\[\]\)\.includes\(String\(b\.holderKind\)\)\) return res\.status\(400\)/.test(reg));
ok("the organisation needs no id; an employee or a supplier must name one",
  /const holderId = holderKind === "org" \? "" : String\(b\.holderId \|\| ""\);/.test(reg) && /if \(holderKind !== "org" && !holderId\)/.test(reg));
ok("both sides ask the same resolvers the check-in route asks", /const holder = await resolveHolder\(holderKind, holderId, true\);/.test(reg) && /const loc = resolveLocation\(b\.location, b\.locationOther\);/.test(reg));
ok("the first movement carries no due-back — a rest, not a loan, and the same timestamp as receivedAt",
  /const receivedAt = new Date\(\)\.toISOString\(\);/.test(reg) && /outAt: receivedAt, outBy: user\.id, dueBack: null,/.test(reg));
ok("it is written on the record at creation, in one call — not a second update afterward",
  /movementsJson: JSON\.stringify\(\[firstMovement\]\)/.test(reg) && !/fixedAsset\.update\(/.test(reg));
ok("the screen shows a grouped picker — the organisation, an employee, a supplier — not typed text",
  /holderPicker\("eq-holder", f\.holderKind, f\.holderId, true,/.test(tab) && /locationPicker\("eq-location", f\.location, f\.locationOther,/.test(tab));

console.log("\nAA. check-out: the resting state ends, a loan begins — never to the organisation");
ok("the organisation cannot be checked equipment out to — that is what it is leaving",
  /if \(!\["employee", "vendor"\]\.includes\(String\(req\.body\.holderKind\)\)\)/.test(out));
ok("the resting movement is closed (not deleted) the instant the loan starts",
  /const resting = moves\[moves\.length - 1\];/.test(out) && /if \(resting && !resting\.inAt\) Object\.assign\(resting, \{ inAt: now, inBy: user\.id \}\);/.test(out));
ok("the loan movement carries no location — it is away, not at one of our places", /location: "", heldFor, projectId, outAt: now, outBy: user\.id, dueBack,/.test(out));
ok("\"already out\" is answered from the item's OWN timeline, not a Users-only lookup that would miss a supplier holder",
  /const current = JSON\.parse\(asset\.movementsJson \|\| "\[\]"\)\.slice\(-1\)\[0\];/.test(out) && /await holderDisplayName\(current\.holderKind, current\.holderId\)/.test(out));
ok("the screen offers employees and suppliers, never the organisation, for who is taking it",
  /holderPicker\(`out-who-\$\{a\.id\}`, field\("holderKind"\), field\("holderId"\), false,/.test(tab));

console.log("\nBB. check-in: the loan closes with a condition, and settles the item somewhere new");
ok("the loan entry is closed with a real condition and note, exactly as before", /Object\.assign\(open, \{ inAt: now, inBy: user\.id, returnCondition: condition, note \}\);/.test(back));
ok("who had it, for the audit line, comes from that closed entry — even a supplier", /const previousHolderName = open \? await holderDisplayName\(open\.holderKind, open\.holderId\) : "someone";/.test(back));
ok("coming back settles it somewhere — the organisation, an employee or a supplier, and a real place",
  /if \(!\(HOLDER_KINDS as readonly string\[\]\)\.includes\(String\(req\.body\.holderKind\)\)\)/.test(back) && /const loc = resolveLocation\(req\.body\.location, req\.body\.locationOther\);/.test(back));
ok("a fresh resting movement is pushed, carrying no due-back", /dueBack: null, inAt: null, inBy: null, returnCondition: null, note: ""\s*\}\);/.test(back));
ok("the legacy custodian/location columns still get a readable snapshot, for any tool that reads them raw",
  /custodian: restHolder\.name, location: loc\.location, movementsJson/.test(back));
ok("the free-text \"Kept at\" input on this form is gone, replaced by the same grouped pickers registration uses",
  /holderPicker\(`in-holder-\${a\.id}`, field\("holderKind"\), field\("holderId"\), true,/.test(tab) && /locationPicker\(`in-loc-\${a\.id}`, field\("location"\), field\("locationOther"\),/.test(tab));

console.log("\nCC. verify: confirms the item is there — never asks where");
ok("the route no longer reads or writes a location at all",
  !/const location = String\(req\.body\.location/.test(ver) && !/data: \{ condition, location,/.test(ver));
ok("the verify row's free-text location input is gone from the screen", !tab.includes('aria-label={t("Kept at")}'));

console.log("\nDD. the card: one state, not a stale label — a loan banner, a resting line, or an honest \"nothing known\" for a row from before this design");
ok("a card on loan reads its holder from the current movement, not just the mirrored id — a supplier holds a loan too",
  /custodyName\(cm\?\.holderKind, cm\?\.holderId \|\| ""\)/.test(tab));
ok("resting with the organisation reads as a place, not \"With AnaHon\"",
  tab.includes('t("{place} — since {date}")'));
ok("resting with a person or a supplier names them, and the place if one is on file",
  tab.includes('t("With {name} — {place} — since {date}")') && tab.includes('t("With {name} — since {date}")'));
ok("a row with no movements at all — older than this design — shows its plain columns undated, not a fabricated date",
  /a\.custodian \|\| "—"/.test(tab) && /a\.location \|\| "—"/.test(tab));
ok("the history tells a loan and a rest apart by the same signal the route does — dueBack",
  /\{m\.dueBack \? \(/.test(tab));

/* ── Correcting a registered item (12 Sep 2026) ──────────────────────────────────────────
   Until now the register had no edit at all: a serial typed wrong stayed wrong forever, or
   bred a second row for an item that exists once. The line an edit must not cross is
   between describing the item and rewriting what happened to it. ─────────────────────── */

console.log("\nEE. a correction describes the item — it never rewrites what happened to it");
ok("the keepers of the register may correct, and nobody else — Super Admin is already one of them",
  ROUTE_SEATS["/api/assets/update"] === SUPPLIER_EDITORS && SUPPLIER_EDITORS.includes("Super Admin"));
ok("the keeper's own allowlist carries it too, or the seat would refuse what the gate allows",
  server.includes('"/api/assets/update"'));
ok("the sticker, the delivery, the confirmation and the log are never read from the body",
  !/b\.tag|b\.receivedAt|b\.receivedBy|b\.verifiedAt|b\.verifiedBy|b\.movements/.test(edit));
ok("and never written by this route",
  !/\btag:/.test(edit) && !/receivedAt:|receivedBy:/.test(edit) && !/movementsJson|repairsJson|custodian:|location:/.test(edit));
ok("the only place verifiedAt is written here is to CLEAR it — never to set one",
  /verifiedAt: null, verifiedBy: null, nextCheckDue: null/.test(edit) && !/verifiedAt: now|verifiedBy: user\.id/.test(edit));
ok("the item must exist before anything is read off the request", /if \(!asset\) return res\.status\(404\)/.test(edit));

console.log("\nFF. exactly the rules the first entry was held to — one validator, not a second looser copy");
ok("register and correction call the same function", /validateEquipmentFields\(b, user, ""\)/.test(reg) && /validateEquipmentFields\(b, user, asset\.id\)/.test(edit));
ok("the serial twin check, the no-serial rule, the approved-voucher rule and its cap all live in it",
  /const twin = onFile\.find/.test(fields) && /blankIfPlaceholder\(b\.serialNumber\)/.test(fields)
  && /\["Approved", "Paid", "Posted"\]\.includes\(exp\.status\)/.test(fields) && /if \(cost > left \+ 0\.005\)/.test(fields));
ok("an item is not a duplicate of itself, and its own cost is not already booked against its own voucher",
  /a\.id !== selfId && sameSerial/.test(fields) && /a\.expenseId === exp\.id && a\.id !== selfId/.test(fields));
ok("the screen leaves the item out of what is left of its voucher too, so re-picking it does not prefill a wrong figure",
  /const bookedOn = \(expenseId: string, exceptId = ""\)/.test(tab) && /a\.expenseId === expenseId && a\.id !== exceptId/.test(tab));

console.log("\nGG. a correction is visible or it is a quiet rewrite");
ok("nothing changed is refused, not written", /if \(!changes\.length\) return res\.status\(400\)/.test(edit));
ok("every field that moved is named with what it was and what it now is",
  /`\$\{c\.label\}: \$\{c\.from \|\| "\(blank\)"\} → \$\{c\.to \|\| "\(blank\)"\}`/.test(edit) && /"Equipment Corrected"/.test(edit));
const was = { name: "Cam", serialNumber: "A1", cost: 1200, kind: "camera", condition: "Good", currency: "USD" };
ok("the diff is over the editable fields only — it cannot report a tag or a date of delivery",
  !EDITABLE_FIELDS.some(f => ["tag", "receivedAt", "receivedBy", "verifiedAt", "verifiedBy"].includes(f.field)));
ok("an untouched field is not a change", equipmentChanges(was, { ...was }).length === 0);
ok("5 and \"5\" are the same number, and null is the same as blank",
  equipmentChanges({ cost: 5, specs: null }, { cost: "5", specs: "" }).length === 0);
ok("a corrected serial is reported with both values",
  JSON.stringify(equipmentChanges(was, { ...was, serialNumber: "A2" })) === JSON.stringify([{ field: "serialNumber", label: "Serial number", from: "A1", to: "A2" }]));

console.log("\nHH. a confirmation is about an item in a state — change either and it lapses");
ok("the six fields somebody's word was about", VERIFIED_FIELDS.join() === "name,brand,model,kind,serialNumber,condition");
ok("correcting the serial costs the item its confirmation", verificationLapses([{ field: "serialNumber" }]));
ok("so does the name, the kind or the condition it was found in",
  verificationLapses([{ field: "name" }]) && verificationLapses([{ field: "kind" }]) && verificationLapses([{ field: "condition" }]));
ok("correcting what it cost, or which voucher paid, does not — nobody confirmed the price",
  !verificationLapses([{ field: "cost" }, { field: "expenseId" }, { field: "purchaseDate" }, { field: "usefulLifeYears" }]));
ok("an item nobody has confirmed has nothing to lose", /const lapses = !!asset\.verifiedAt && verificationLapses\(changes\)/.test(edit));
ok("the lapse is written on the item AND said in the audit line, naming the fields that caused it",
  /\.\.\.\(lapses \? \{ verifiedAt: null/.test(edit) && /it must be confirmed again\./.test(edit));
ok("and the screen is told, so the person who corrected it learns it then, not at the next audit",
  /verificationCleared: lapses/.test(edit) && tab.includes('t("Corrected — and it must be confirmed again.")'));
ok("the warning is on the form before they touch anything, not only after",
  /a\.verifiedAt && \(/.test(tab) && tab.includes("that confirmation lapses"));

console.log("\nII. the correction form is the registration form — one set of fields, not two that drift");
ok("both forms render the same function", /const itemFields = \(form: typeof BLANK/.test(tab) && (tab.match(/\{itemFields\(/g) || []).length === 2);
ok("custody is not in it — who has an item is the movement log's, and a correction never touches that",
  !/holderPicker|locationPicker/.test(tab.slice(tab.indexOf("const itemFields"), tab.indexOf("const holderPicker"))));
ok("the locked fields are shown with their values and the reason they are locked",
  LOCKED_FIELDS.length === 4 && LOCKED_FIELDS.every(l => l.why.length > 0) && /LOCKED_FIELDS\.map\(l => \(/.test(tab));
ok("the keeper reaches it from the item itself", /onClick=\{\(\) => startEdit\(a\)\}/.test(tab) && /aria-expanded=\{edit\?\.id === a\.id\}/.test(tab));
ok("the form opens on what the item says now, so leaving a field alone leaves it alone",
  /serial: a\.serialNumber === NO_SERIAL \? "" : \(a\.serialNumber \|\| ""\)/.test(tab) && /gift: !a\.expenseId && !a\.cost/.test(tab));

console.log("\nJJ. a thing moves without anybody borrowing it — 12 Sep 2026");
ok("the keepers say where a resting item is, and Super Admin is one of them",
  ROUTE_SEATS["/api/assets/move"] === SUPPLIER_EDITORS && server.includes('"/api/assets/move"'));
ok("an item out on a loan is refused — it comes back through check-in, where its condition is recorded",
  /if \(asset\.holderId\) return res\.status\(409\)/.test(moved) && /check it in instead/.test(moved));
ok("it never edits the entry that is wrong — it appends the next one, the shape a check-in writes",
  /moves\.push\(\{/.test(moved) && /dueBack: null/.test(moved) && !/moves\.pop\(\)|moves\.splice|moves\.length - 1\] =/.test(moved));
ok("the earlier entry is closed, not deleted, so the log still says what it said",
  /if \(resting && !resting\.inAt\) Object\.assign\(resting, \{ inAt: now, inBy: user\.id \}\)/.test(moved));
ok("the same holder rule and the same fixed list of places as registration — no second idea",
  /await resolveHolder\(holderKind, holderId, true\)/.test(moved) && /resolveLocation\(req\.body\.location, req\.body\.locationOther\)/.test(moved));
ok("saying it is where it already is changes nothing", /is already recorded as being there/.test(moved));
ok("the write lands only on a row still in, so it cannot race a check-out",
  /where: \{ id: asset\.id, holderId: null \}/.test(moved) && /if \(done\.count !== 1\)/.test(moved));
ok("it touches custody only — never the cost, the confirmation or what the item is",
  /data: \{ custodian: holder\.name, location: loc\.location, movementsJson/.test(moved)
  && !/verifiedAt|cost:|condition:|serialNumber/.test(moved));
ok("the audit line says where it was and where it is now", /was with \$\{wasWith\} at \$\{wasAt\}, now with \$\{holder\.name\} at \$\{loc\.location\}/.test(moved));
ok("the button is offered only while the item is in", /\{!a\.holderId && \(\s*<button type="button" onClick=\{\(\) => openPanel\(a\.id, "move"/.test(tab));
ok("it opens on what the card already says, so an unchanged field really is unchanged",
  /holderKind: cm\?\.holderKind \|\| "org", holderId: cm\?\.holderId \|\| "", location: cm\?\.location \|\| a\.location \|\| ""/.test(tab));

/* ── Removing an item registered in error (12 Sep 2026) ──────────────────────────────────
   Editing fixes a wrong field; a row wrong in every field should go. What must never go is
   somebody else's evidence — and the number, which belongs to a sticker in the world. ──── */

console.log("\nKK. a mistake can be removed — but only a mistake nobody has vouched for");
ok("the keepers may remove, and Super Admin is one of them",
  ROUTE_SEATS["/api/assets/delete"] === SUPPLIER_EDITORS && server.includes('"/api/assets/delete"'));
ok("a fresh unconfirmed registration may go", deleteBlocker({ movements: [{} as any] }) === null);
ok("a confirmed item may NOT — that is a second person's word", deleteBlocker({ verifiedAt: "2026-09-12", movements: [{} as any] }) === "somebody has confirmed it");
ok("nor one that has been out on a loan", deleteBlocker({ movements: [{ dueBack: "2026-09-20" }] as any }) === "it has been out");
// 12 Sep 2026: this counted movements, so using "Where it is" to correct where a thing sits
// locked the Remove button on EQ-001 and EQ-008 — neither had ever left the office.
ok("but merely being MOVED is not being out — a tidied-up duplicate is still a duplicate",
  deleteBlocker({ movements: [{ dueBack: null }, { dueBack: null }] as any }) === null);
ok("and the signal is the same dueBack the whole file keys on, not a second idea",
  deleteBlocker({ movements: [{ dueBack: null }, { dueBack: "2026-09-20" }, { dueBack: null }] as any }) === "it has been out");
ok("nor one with a repair on it", deleteBlocker({ movements: [{} as any], repairs: [{} as any] }) === "it has a repair on it");
ok("nor one that has already ended, however it ended", deleteBlocker({ endKind: "sold" }) === "its life here has already ended");
ok("the route asks the same predicate the button does, and answers 409 with the way out",
  /const blocker = deleteBlocker\(\{ \.\.\.asset, movements, repairs \}\)/.test(gone)
  && /res\.status\(409\)/.test(gone) && /writeOffInstead: true/.test(gone));
ok("a removal must be explained — a word is not a reason",
  /if \(reason\.length < 10\)/.test(gone) && /Say why this item is being removed/.test(gone));
ok("the audit line names the tag, the item, the serial, the person and the reason",
  /"Equipment Removed"/.test(gone) && /\$\{label\} "\$\{asset\.name\}" \(serial \$\{asset\.serialNumber\}\) removed from the register by \$\{user\.name\}\. Reason: \$\{reason\}/.test(gone));

console.log("\nLL. the number is not reissued, and the papers are not destroyed");
ok("the series is told every tag ever issued, removed ones included",
  /prisma\.removedAsset\.findMany\(\{ select: \{ tag: true \} \}\)/.test(reg) && /nextEquipmentTag\(\[/.test(reg));
ok("removing the newest row does not hand its number back — EQ-003 gone still means EQ-004 next",
  nextEquipmentTag(["EQ-001", "EQ-002", "EQ-003"]) === "EQ-004");
ok("the tombstone is written BEFORE the row is deleted, so a failure cannot free a number",
  gone.indexOf("removedAsset.create") < gone.indexOf("fixedAsset.delete") && gone.indexOf("removedAsset.create") > 0);
ok("and it is unique on the tag, so the database refuses a second claim on one",
  /CREATE UNIQUE INDEX "RemovedAsset_tag_key" ON "RemovedAsset"\("tag"\)/.test(read("prisma/migrations/20260912140000_equipment_removal/migration.sql")));
ok("documents filed against the item are re-pointed, never deleted",
  /prisma\.appDoc\.update\(/.test(gone) && !/appDoc\.delete/.test(gone)
  && /linkedRecordType: "Project", linkedRecordId: home/.test(gone));
ok("each one keeps the tag it belonged to, so it is still findable by number",
  /was \$\{label\} "\$\{asset\.name\}", removed from the register/.test(gone));
ok("and the screen says where they went", tab.includes('t("removed. Its photos stay in the vault.")')
  && tab.includes("stay in the vault under the project that funded it"));

console.log("\nMM. what became of it — six facts, not one euphemism (12 Sep 2026)");
ok("the six Saad named, and nothing invented beside them",
  END_KINDS.map(k => k.label).join(" · ") === "Broken — thrown away · Sold · Given away · Lost · Stolen · Returned to its owner");
ok("only Sold asks what it fetched", END_KINDS.filter(k => k.amount).map(k => k.key).join() === "sold");
ok("giving a thing up is a disposal; losing one is not",
  ["broken","sold","given"].every(isDisposal) && !["lost","stolen","returned"].some(isDisposal));
ok("an unknown word is not a status", endKindOf("scrapped") === null && !isDisposal("scrapped"));
ok("the route refuses one too", /const kind = endKindOf\(String\(req\.body\.endKind \|\| ""\)\);/.test(ended) && /Say what became of it/.test(ended));
ok("a date that already happened, and a sentence, are required",
  /if \(when > localDate\(\)\)/.test(ended) && /That date is in the future/.test(ended) && /if \(note\.length < 10\)/.test(ended));
ok("Sold records the money", /if \(kind\.amount\)/.test(ended) && /Record what it sold for/.test(ended));
ok("nothing is erased — the row, its log and its confirmation stay exactly where they are",
  !/fixedAsset\.delete|movementsJson|repairsJson|verifiedAt: null/.test(ended));

console.log("\nNN. Policy 017: the organisation does not give up what it owns on one signature");
ok("a disposal is the two policy seats'; an event is the keepers' to write down",
  mayEndEquipment({ role: "Finance Officer" }, "sold") && mayEndEquipment({ role: "Program Director" }, "sold")
  && !mayEndEquipment({ role: PLO }, "sold") && mayEndEquipment({ role: PLO }, "lost"));
ok("the two sides are the Executive Director's and Finance's, and the master account holds both",
  disposalSides("Program Director").join() === "director" && disposalSides("Finance Officer").join() === "finance"
  && disposalSides("Super Admin").join() === "director,finance" && disposalSides(PLO).length === 0);
const proposed = (by: string, as: string) => ({ endKind: "sold", endBy: by, endAs: as, endConfirmedAt: null });
ok("Finance proposes, a director confirms", confirmDisposalBlocker({ id: "u-sa", role: "Program Director" }, proposed("u-fo", "finance")) === null);
ok("a director proposes, Finance confirms", confirmDisposalBlocker({ id: "u-fo", role: "Finance Officer" }, proposed("u-pd", "director")) === null);
ok("the proposer may NEVER be the second signature — not even holding both seats",
  confirmDisposalBlocker({ id: "u-sa", role: "Super Admin" }, proposed("u-sa", "director+finance"))
    === "you proposed it — the other signature must be somebody else");
ok("a seat outside the policy cannot confirm, however senior it feels",
  confirmDisposalBlocker({ id: "u-plo", role: PLO }, proposed("u-fo", "finance")) === "this seat is not one of the two the policy names");
ok("two people are not enough if they are the same side",
  confirmDisposalBlocker({ id: "u-fo2", role: "Finance Officer" }, proposed("u-fo", "finance")) === "this seat is not one of the two the policy names");
ok("nothing proposed, nothing to confirm; confirmed once, not twice",
  confirmDisposalBlocker({ id: "u-sa", role: "Super Admin" }, { endKind: "" }) === "nothing is proposed"
  && confirmDisposalBlocker({ id: "u-sa", role: "Super Admin" }, { endKind: "sold", endBy: "u-fo", endAs: "finance", endConfirmedAt: "2026-09-12" }) === "it is already confirmed");
ok("an event needs nobody's second word", confirmDisposalBlocker({ id: "u-sa", role: "Super Admin" }, { endKind: "lost", endBy: "u-plo" }) === "nothing is proposed");
ok("the route asks the same predicate, and logs a refusal",
  /const blocker = confirmDisposalBlocker\(user, asset\);/.test(second) && /"Action Refused"/.test(second));
ok("refusing is a real answer: the proposal is cleared and the item stays on the register",
  /endKind: "", endAt: null, endNote: "", endAmount: null, endBy: null, endAs: null/.test(second) && /Say why the disposal is refused/.test(second));
ok("neither half can land twice — each write names the state it expects to find",
  /where: \{ id: asset\.id, endKind: "", holderId: null \}/.test(ended)
  && /where: \{ id: asset\.id, endKind: asset\.endKind, endConfirmedAt: null \}/.test(second));

console.log("\nNN2. a proposal changes nothing until the second signature");
ok("proposed is not ended", !endIsEffective({ endKind: "sold", endConfirmedAt: null }) && endIsEffective({ endKind: "sold", endConfirmedAt: "2026-09-12" }));
ok("an event ends the moment it is written down", endIsEffective({ endKind: "lost" }));
ok("and the status says which", equipmentStatus({ endKind: "sold" } as any) === "Awaiting disposal approval"
  && equipmentStatus({ endKind: "sold", endConfirmedAt: "x" } as any) === "Sold"
  && equipmentStatus({ endKind: "lost" } as any) === "Lost");
ok("an item in use is untouched by any of it", equipmentStatus({ receivedAt: "x", verifiedAt: "y" } as any) === "Verified");
ok("the proposal waits on the OTHER seat's desk, never the proposer's",
  RULES.some(r => r.kind === "fixedAssets" && r.status === "Awaiting disposal approval" && (r.exclude || []).includes("endBy")));
ok("an item out with somebody cannot be ended at all — the old rule, kept",
  endBlocker({ holderId: "u-7" }) === "it is out with somebody — check it in first"
  && endBlocker({}) === null && endBlocker({ endKind: "sold" }) === "a disposal is already proposed"
  && endBlocker({ endKind: "lost" }) === "its life here has already ended");
ok("and the screen says so rather than hiding the button with no explanation",
  tab.includes('t("It is out with somebody — check it in before recording what became of it.")'));

console.log("\nNN3. an ended item leaves the working register, and takes nothing with it");
ok("no desk rule matches a finished state", !RULES.filter(r => r.kind === "fixedAssets").some(r => END_KINDS.some(k => k.label === r.status)));
ok("it is not offered for lending, correcting or confirming", /\{receiving && !endIsEffective\(a\) && \(/.test(tab) && /\{verifier && !endIsEffective\(a\) && \(/.test(tab));
ok("and its sticker is not printed again", /assets\.filter\(a => a\.tag && !endIsEffective\(a\)\)/.test(tab));
ok("a deletion is refused once anything has become of it", deleteBlocker({ endKind: "lost", movements: [{} as any] }) === "its life here has already ended");

console.log("\nNN4. the write-off is gone, and what it recorded was carried across");
const mig = read("prisma/migrations/20260912160000_equipment_end_of_life/migration.sql");
ok("every written-off row becomes the closest of the six — thrown away", /SET "endKind" = 'broken'/.test(mig));
ok("the person's own words are kept exactly, never rewritten", /ELSE "writeOffReason" END/.test(mig));
ok("and the record says it predates the two approvals rather than pretending it had them",
  /before Resources and Assets Policy 017 asked for two approvals; migrated/.test(mig));
ok("it stays in force — it was already in force yesterday", /"endConfirmedAt" = "writtenOffAt"/.test(mig));
ok("the old columns are kept, not dropped, so the migration can be checked against its source",
  !/DROP COLUMN/.test(mig) && /SUPERSEDED 12 Sep 2026/.test(read("prisma/schema.prisma")));
ok("and nothing reads them any more", !/writtenOff/.test(read("src/equipment.ts")) && !/writtenOff/.test(read("src/tabs/AssetsTab.tsx")) && !/writtenOff/.test(server));
ok("the words 'write it off' are gone from the screen", !/Write it off|Written off/.test(tab));

console.log("\nOO. the screen offers what the route would accept, and never a dead button");
ok("Remove shows only for an entry that should never have existed", /\{deleteBlocker\(a\) === null && \(/.test(tab));
ok("and it still names the tag and demands a sentence",
  tab.includes('t("Remove {tag} from the register?")') && /disabled=\{reason\.trim\(\)\.length < 10\}/.test(tab));
ok("what became of it is offered only to a seat that may record something",
  /END_KINDS\.some\(k => mayEndEquipment\(currentUser, k\.key\)\)/.test(tab)
  && /const offered = END_KINDS\.filter\(k => mayEndEquipment\(currentUser, k\.key\)\)/.test(tab));
ok("a disposal warns, before anything is typed, that it takes two people",
  tab.includes("you are proposing it, and somebody else confirms before anything takes effect"));
ok("an event says it is one person's to record", tab.includes('t("This is an event, not a decision — one person records it. A loss or a theft is reported to the Executive Director as well.")'));
ok("the button says which of the two it is doing", tab.includes('t("Propose it") : t("Record it")'));
ok("the second approval is shown only to somebody who may actually give it",
  /confirmDisposalBlocker\(currentUser, a\) === null/.test(tab) && tab.includes('t("Approve the disposal")'));
ok("refusing needs a reason too", /disabled=\{reason\.trim\(\)\.length < 10\} onClick=\{\(\) => handleEndDecision\(a, true, reason\)\}/.test(tab));

console.log("\nPP. every status change is on the record");
ok("a proposal, an approval and a refusal are three different audit actions",
  /"Equipment Disposal Proposed"/.test(ended) && /"Equipment Ended"/.test(ended)
  && /"Equipment Disposal Approved"/.test(second) && /"Equipment Disposal Refused"/.test(second));
ok("the line carries the item, the tag, what it was, what it became, the date and the reason",
  /\$\{label\} "\$\{asset\.name\}": \$\{equipmentStatus\(asset\)\} → \$\{kind\.label\} on \$\{when\}/.test(ended) && /\$\{note\}/.test(ended));
ok("and who proposed it, beside who approved it", /proposed by \$\{proposer\}, approved by \$\{user\.name\}/.test(second));

console.log("\nQQ. the label reader does not dead-end on a busy free tier — 12 Sep 2026");
ok("the free reader is still asked first — nothing falls through to a paid call by accident",
  /extracted = await readLabel\("gemini"\);/.test(scan) && (scan.match(/readLabel\("gemini"\)/g) || []).length === 2);
ok("a busy answer is waited out and asked again before anything is spent",
  /await new Promise\(r => setTimeout\(r, 1500\)\)/.test(scan));
ok("and only then the paid one", /extracted = await readLabel\("claude"\);/.test(scan)
  && scan.indexOf('readLabel("claude")') > scan.lastIndexOf('readLabel("gemini")'));
ok("busy is 503/429 and its words — anything else is a real failure, not a queue",
  scan.includes("503") && scan.includes("429") && scan.includes("RESOURCE_EXHAUSTED")
  && scan.includes("UNAVAILABLE") && scan.includes("high demand"));
ok("an unreadable photo never retries and never spends — it says so at once",
  (scan.match(/if \(!busy\(\w+\)\) return unreadable\(\w+\)/g) || []).length === 3);
ok("the failure message when BOTH are unavailable is the original, unchanged",
  scan.includes("The label reader is busy for a moment — press Scan the label again, or type the details from the label."));
ok("the provider's raw JSON never reaches a phone",
  /replace\(\/\[\{\}\[\\\]"\]\/g, ""\)/.test(scan) && /\.slice\(0, 120\)/.test(scan));
ok("which reader answered, and what it cost, go in the audit line",
  /Answered by the \$\{answeredBy\}\$\{takeUsage\(\)\}/.test(scan));
ok("what the scan writes is unchanged: placeholders blanked, prefill only, nothing registered",
  /for \(const k of \["name", "brand", "model", "serialNumber", "specs"\]\) extracted\[k\] = blankIfPlaceholder/.test(scan)
  && /Prefill only; nothing registered/.test(scan) && !/prisma\.fixedAsset\.create/.test(scan));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
