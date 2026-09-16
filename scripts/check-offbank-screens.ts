/**
 * The Projects & funding side of Policy P5 §4.4.4 (Saad, 14 Sep 2026): every channel receives,
 * a project is "bank only" only when its agreement says so, and every receipt carries evidence.
 * Books owns the route and its refusals (check-offbank.ts); this pins the screens that call it.
 */
import assert from "assert";
import fs from "fs";
import { agreementDocs } from "../src/coreDocs.js";

const form = fs.readFileSync("src/tabs/ReceiveOffbankForm.tsx", "utf8");
const prod = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
const proj = fs.readFileSync("src/tabs/ProjectsTab.tsx", "utf8");
const server = fs.readFileSync("server.ts", "utf8");

// A — one form, one route, for both purposes.
assert.ok(form.includes('fetch("/api/offbank/receive"'), "the form records through /api/offbank/receive");
assert.ok(!prod.includes("/api/quotations/settle-offbank"), "the quotation screen no longer calls the settle-offbank alias");
assert.ok(/<ReceiveOffbankForm[\s\S]{0,200}purpose="quotation"/.test(prod), "a quotation's off-bank payment uses the shared form");
assert.ok(/<ReceiveOffbankForm[\s\S]{0,200}purpose="project"/.test(proj), "a project's further tranche uses the shared form");

// B — the channels offered: off-bank channels, active, never 1120, a quotation's own currency.
assert.ok(/a\.type === "Off-bank channel" && a\.active && a\.ledgerCode !== "1120" && \(!quotation \|\| a\.currency === quotation\.currency\)/.test(form), "channel list follows the rule");

// C — evidence: cash is an RC number picked from the quotation's own receipts, and a missing scan is said.
assert.ok(/offered\.map\(r => <option key=\{r\.receiptNo\}/.test(form), "cash on a quotation picks one of its issued receipts");
assert.ok(/chosenReceipt && !chosenReceipt\.signed/.test(form) && form.includes('t("Signed scan missing")'), "a receipt without its signed scan is flagged");
assert.ok(prod.includes('id="receipt-log"'), "the flag links to the receipt log where the scan is attached");
assert.ok(!/disabled=\{!ready\}[^>]*title=/.test(form), "the reason is in the label, not a tooltip");

// D — bank only cites an agreement on the project whose file exists; the server enforces it.
const doc = (o: any) => ({ filename: "x.pdf", created_at: "2026-01-01", linkedRecordType: "Project", linkedRecordId: "p1", ...o });
const docs = [
  doc({ refNo: "A1", category: "Grant Agreement" }),
  doc({ refNo: "A2", category: "Agreement", fileMissing: true }),
  doc({ refNo: "C1", category: "Contract" }),
  doc({ refNo: "A3", category: "Agreement", linkedRecordId: "p2" }),
];
assert.deepEqual(agreementDocs(docs as any, "p1").map(d => d.refNo), ["A1"], "only this project's agreements with a file on disk — never a contract");
assert.ok(server.includes('app.post("/api/projects/channel-rule"'), "the rule has a route");
assert.ok(/agreementDocs\(docs, project\.id\)\.find\(d => d\.refNo === String\(channelRuleSource/.test(server), "bank only must cite one of those agreements");
assert.ok(/MANAGERS_SEATS\.includes\(user\?\.role\)/.test(server), "only finance and directors set it");
assert.ok(proj.includes('proj.channelRule === "bank"'), "the rule is visible on the project card");

// E — unlinking a channel receipt says the money stays received.
assert.ok(prod.includes("unlinked — the money stays recorded as received through"), "unlink does not read as an undone payment");

console.log("✓ check-offbank-screens: one receive form for quotations and tranches, bank only cites an agreement, evidence required");
