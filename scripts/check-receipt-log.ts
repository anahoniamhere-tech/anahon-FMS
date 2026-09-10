/**
 * The receipt series and the receipt log.
 *
 * What must hold: a number comes from the receipts, never from a file count; the signed
 * scan is the same receipt (same number, one log row); and the attach control on the
 * quotations screen can file a receipt as a receipt.
 */
import assert from "assert";
import fs from "fs";
import { nextReceiptNo, receiptNoOf, receiptLog, receiptGaps, parseReceiptNo } from "../src/receipts.js";

const doc = (o: any) => ({ id: o.id, refNo: null, filename: o.filename || "", category: o.category || "Cash Receipt", linkedRecordId: o.q || "q1", created_at: o.at || "2026-09-10T00:00:00Z", ...o });

// A — the number is the highest issued plus one, not a count of files.
assert.equal(nextReceiptNo([], 2026), "RC-001/2026");
const two = [doc({ id: "a", receiptNo: "RC-001/2026" }), doc({ id: "b", receiptNo: "RC-002/2026" })];
assert.equal(nextReceiptNo(two, 2026), "RC-003/2026");
// Delete the first one: the series must NOT rewind onto a number already used.
assert.equal(nextReceiptNo(two.slice(1), 2026), "RC-003/2026", "a deleted receipt must not free its number");
// Something else landing in the category cannot move the series either.
assert.equal(nextReceiptNo([...two, doc({ id: "junk", filename: "scan.pdf" })], 2026), "RC-003/2026");
// A new year restarts.
assert.equal(nextReceiptNo(two, 2027), "RC-001/2027");

// B — receipts issued before the column existed still count, read from the filename.
assert.equal(receiptNoOf(doc({ id: "old", filename: "2026_RECEIPT_RC-004-2026_Zeina_200.html" })), "RC-004/2026");
assert.equal(nextReceiptNo([doc({ id: "old", filename: "2026_RECEIPT_RC-004-2026_Zeina_200.html" })], 2026), "RC-005/2026");

// C — the signed scan is the SAME receipt: one row, signed column set. Saad's correction.
const withSigned = [...two, doc({ id: "b-signed", receiptNo: "RC-002/2026", receiptSigned: true, filename: "signed.pdf" })];
const rows = receiptLog(withSigned);
assert.equal(rows.length, 2, "a signed scan must never appear as a second receipt");
assert.equal(rows[0].receiptNo, "RC-002/2026", "newest first");
assert.equal(rows[0].signed, true);
assert.equal(rows[0].docId, "b", "the row opens the issued receipt, not the scan");
assert.equal(rows[0].signedDocId, "b-signed");
assert.equal(rows[1].signed, false);
// …and it must not take a number of its own.
assert.equal(nextReceiptNo(withSigned, 2026), "RC-003/2026");

// D — a quotation settled in tranches carries several receipts.
const tranched = receiptLog([doc({ id: "t1", receiptNo: "RC-001/2026", q: "qX" }), doc({ id: "t2", receiptNo: "RC-002/2026", q: "qX" })]);
assert.equal(tranched.length, 2);
assert.equal(new Set(tranched.map(r => r.quotationId)).size, 1);

// E — holes in the series are visible.
assert.deepEqual(receiptGaps(receiptLog([doc({ id: "x", receiptNo: "RC-003/2026" })])), ["RC-001/2026", "RC-002/2026"]);
assert.deepEqual(receiptGaps(receiptLog(two)), []);
assert.equal(parseReceiptNo("not a receipt"), null);

// F — the server numbers from the receipts, and no longer counts documents.
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(server.includes("nextReceiptNo(priorReceipts"), "issue-receipt must number from the receipts themselves");
assert.ok(!/appDoc\.count\(\{\s*where:\s*\{\s*category:\s*"Cash Receipt"/.test(server), "the count-based receipt number must be gone");
assert.ok(/receiptNo\n?\s*\}\)|receiptNo,/.test(server), "the issued receipt must store its number");
// …and only the people who may issue a receipt may file its signed copy.
assert.ok(/signedReceipt[\s\S]{0,300}RECEIPT_ISSUERS/.test(server), "filing a signed receipt must be restricted like issuing one");

// F2 — a signed scan already on file byte-for-byte must still be marked signed,
// or the log keeps calling the money unproven while the proof sits in the vault.
assert.ok(/if \(signedReceipt && !dupe\.receiptSigned\)/.test(server), "dedupe must not swallow the signed-copy fact");

// F3 — a receipt cannot be filed as a signed quotation. This is the mistake that
// actually happened on 10 Sep: both signed receipts went in through the quotation row.
assert.ok(/category === "Quotation \(Signed\)" && parseReceiptNo\(filename/.test(server), "a file named as a receipt must be refused as a signed quotation");

// G — the attach control is no longer hardcoded to the quotation category.
const tab = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
assert.ok(tab.includes("receiptNo ? RECEIPT_CATEGORY : \"Quotation (Signed)\""), "the attach control must be able to file a receipt as a receipt");
assert.ok(tab.includes("receiptLog("), "the quotations door must show the receipt log");
assert.ok(/d\.category === "Quotation \(Signed\)"/.test(tab), "a receipt filed against a quotation is not a signed quotation");
// Two chips reading the same bare word "signed" is what confused Saad — say which is which.
assert.ok(tab.includes('t("signed quote")'), "the quotation row's chip must say it is a signed QUOTATION");
assert.ok(!/>✓signed</.test(tab), "the unlabelled signed chip must be gone");

console.log("✓ check-receipt-log: series numbers from the receipts, one row per receipt, signed copy tracked");
