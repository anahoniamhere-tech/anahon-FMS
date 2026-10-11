/**
 * A project paper whose file is gone says so on its line (Saad's missing-receipts rule, 11 Oct 2026).
 * The server sends `fileMissing` per document on every state load; the Papers list has to show it.
 * Run: npx tsx scripts/check-papers-missing-mark.ts [path-to-ProjectsTab.tsx]
 */
import assert from "assert";
import fs from "fs";
import { AR } from "../src/i18n.js";

const tab = fs.readFileSync(process.argv[2] || "src/tabs/ProjectsTab.tsx", "utf8");
// The Papers list: from its heading to the next folder.
const list = tab.slice(tab.indexOf("1. Project papers — every document filed against this project"), tab.indexOf("Folder B: Procurement"));
assert.ok(list.length > 1000 && list.includes("shown.map(doc =>"), "found the Papers list");

assert.ok(/\{doc\.fileMissing && \(/.test(list), "a paper with fileMissing carries a mark on its line");
assert.ok(/\{t\("File missing"\)\}/.test(list), "the mark reads File missing");
const tip = "Re-attach the scan at this record's own place (the Admin room does it). A new upload creates a second record.";
assert.ok(list.includes(`title={t("${tip}")}`), "the tooltip says where to re-attach and why not to re-upload");
assert.equal(AR["File missing"], "الملف مفقود");
assert.ok(AR[tip], "the tooltip has Arabic");
// Read-only: the mark adds no control.
const mark = list.slice(list.indexOf("{doc.fileMissing && ("), list.indexOf("{t(\"File missing\")}"));
assert.ok(!/<button|<input|<select|onClick/.test(mark), "the mark is a label, not a control");

console.log("check-papers-missing-mark: all passed");
