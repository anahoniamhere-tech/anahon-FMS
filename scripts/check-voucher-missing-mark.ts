/**
 * A voucher's attachment whose file is gone says so on its own line (Saad's missing-receipts rule,
 * 11 Oct 2026). The server sends `fileMissing` per document on every state load; the voucher card
 * listed a lost scan like any other. Read-only: the row stays, and nothing here re-uploads —
 * a second upload would make a second record beside the one that already exists.
 * Run: npx tsx scripts/check-voucher-missing-mark.ts
 */
import assert from "assert";
import fs from "fs";
import { AR } from "../src/i18n.js";

const tab = fs.readFileSync("src/tabs/ExpensesTab.tsx", "utf8");
const server = fs.readFileSync("server.ts", "utf8");

// The voucher card's attachment list, from its guard to the audit trail below it.
const list = tab.slice(tab.indexOf("{expDocs.length > 0 && ("), tab.indexOf("Audit Trail Timeline"));
assert.ok(list.length > 400 && list.includes("expDocs.map(d =>"), "found the voucher's attachment list");

assert.ok(/\{d\.fileMissing && \(/.test(list), "an attachment with fileMissing carries a mark on its line");
assert.ok(/\{t\("File missing"\)\}/.test(list), "the mark reads File missing");
const tip = "Re-attach the scan at this record's own place (the Admin room does it). A new upload creates a second record.";
assert.ok(list.includes(`title={t("${tip}")}`), "the tooltip says where to re-attach and why not to re-upload");
// One wording for the whole system: the Papers list already uses this key.
assert.equal(AR["File missing"], "الملف مفقود");
assert.ok(AR[tip], "the tooltip has Arabic");

// Read-only: no control was added beside the mark.
assert.ok(!/fileMissing[\s\S]{0,400}(<button|<input|onClick)/.test(list), "the mark adds no button, upload or click of its own");

// The flag is the server's, per document, and not recomputed in the browser.
assert.ok(/fileMissing: \(\(\) => \{ const f = vaultPathFromPointer/.test(server), "the server decides whether a file is missing");
assert.ok(!/fs\.existsSync/.test(tab), "the browser never checks the disk itself");

console.log("all checks passed");
