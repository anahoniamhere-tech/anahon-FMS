/**
 * Quotation client links (16 Sep 2026, src/quoteShare.ts, QUOTATION-LINKS.md).
 * iContent only, never a Draft, a new token on every change, revoked when the offer closes,
 * written to the outbox with the expiry in the file's mtime. The FMS holds no key (Admin, 16 Sep).
 */
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { shareBlocker, shareExpiry, shareUrl, displayName, DISPLAY_NAME_PATTERN, outboxName, printedChange, liveShare, TOKEN_PATTERN, SHARE_ORIGIN } from "../src/quoteShare.js";
import { quotationHtml } from "../docgen.js";

const now = new Date("2026-09-16T10:00:00+03:00");
const token = crypto.randomBytes(16).toString("hex");

// A — the link itself.
assert.ok(TOKEN_PATTERN.test(token), "16 random bytes, lowercase hex");
assert.equal(shareUrl(token, "006/2026"), `https://icontent.studio/q/${token}/iContent-Studio-Quotation-006-2026.pdf`, "named form (Admin, 16 Sep)");
assert.ok(DISPLAY_NAME_PATTERN.test(displayName("006/2026")) && DISPLAY_NAME_PATTERN.test(displayName("12 / 2027 rev")), "the VPS name rule");
assert.ok(!/\/.*\//.test(displayName("a/b/c")), "a quote number never adds a path segment");
assert.equal(outboxName(token), `${token}.pdf`);
assert.throws(() => shareUrl("006-2026", "006/2026"), "a quote number is never a token");
assert.throws(() => outboxName("../etc/passwd" + "0".repeat(20)), "no path in a token");
assert.throws(() => outboxName(token.toUpperCase()), "the VPS route serves lowercase hex only");
assert.ok(!/anahon/i.test(SHARE_ORIGIN), "an iContent link never names AnaHon");

// B — who gets one.
const sent = { status: "Sent", issuedAs: "icontent", validUntil: "2026-09-30" };
assert.equal(shareBlocker(sent, now), null);
assert.ok(shareBlocker({ ...sent, status: "Draft" }, now), "never for a Draft");
assert.ok(shareBlocker({ ...sent, status: "Rejected" }, now));
assert.ok(shareBlocker({ ...sent, status: "Paid" }, now), "a settled quotation is no longer an offer");
assert.equal(shareBlocker({ ...sent, status: "Invoiced" }, now), null, "part paid: the balance message may still carry it");
assert.ok(shareBlocker({ ...sent, issuedAs: "anahon" }, now), "AnaHon quotations get no link (Saad, 16 Sep)");
assert.ok(shareBlocker({ ...sent, validUntil: "2026-09-15" }, now), "validity passed");

// C — expiry: the whole Beirut validity day; with no date, the same 15 days a new quotation gets.
assert.equal(shareExpiry("2026-09-30", now).toISOString(), "2026-09-30T21:59:59.000Z");
assert.equal(shareExpiry("", now).toISOString(), "2026-10-01T21:59:59.000Z", "no date: QUOTE_VALIDITY_DAYS, not a second number");
assert.equal(shareBlocker({ ...sent, validUntil: "2026-09-16" }, now), null, "valid until today is still live today");

// D — what counts as a change the client would read.
const q = { clientId: "c1", title: "VxV", amount: 750, itemsJson: "[]", status: "Sent", validUntil: "2026-09-30" };
assert.deepEqual(printedChange(q, { ...q, status: "Accepted" }), [], "a status move is not a new document");
assert.deepEqual(printedChange(q, { ...q, amount: 800 }), ["amount"]);
assert.deepEqual(printedChange(q, { ...q, validUntil: "2026-10-15" }), ["validUntil"], "a new date is a new link (and a new mtime)");

// E — the live link: not revoked, not expired, newest.
const row = (t: string, created: string, extra: any = {}) => ({ token: t, quotationId: "q1", createdAt: created, expiresAt: "2026-09-30T21:59:59.000Z", revokedAt: null, ...extra });
assert.equal(liveShare([], "q1", now), null, "no link until one is published");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z")], "q1", now)?.token, "a");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z", { revokedAt: "2026-09-16T09:00:00Z" })], "q1", now), null, "a revoked link is not offered");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z", { expiresAt: "2026-09-15T00:00:00Z" })], "q1", now), null, "an expired link is not offered");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z"), row("b", "2026-09-16T09:00:00Z")], "q1", now)?.token, "b");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z")], "q2", now), null, "per quotation");

// F — the server wiring (read, not assumed).
const server = fs.readFileSync("server.ts", "utf8");
const block = server.slice(server.indexOf("// ---- Quotation share links"), server.indexOf('app.post("/api/quotations/share", async'));
assert.ok(block.length > 500, "found the share block");
assert.ok(!/\b(ssh|rsync|scp)\b["\s]*,|execFile|QUOTE_LINK_SSH/.test(block), "the FMS holds no key and runs no ssh/rsync");
assert.ok(/fs\.utimesSync\(part, expiresAt, expiresAt\);\s*fs\.renameSync\(part, final\)/.test(block), "mtime = expiry, set before the file becomes visible");
assert.ok(block.includes("`.${outboxName(token)}.part`"), "written under a dot-name first");
assert.ok(server.includes('const token = crypto.randomBytes(16).toString("hex");'), "CSPRNG token, 16 bytes hex");
assert.ok(/writeSharePdf\(token, pdf, expiresAt\);\s*\/\/ Retire the old link only once/.test(server), "the old link is retired only after the new one is written");
assert.ok(/if \(!quoteOutboxReady\(\)\) return res\.status\(503\)/.test(server), "no outbox, no link");
assert.ok(/await revokeShares\(id, "quotation deleted"/.test(server), "deleting a quotation revokes its link");
assert.ok(/!SHAREABLE_STATUSES\.includes\(status\)\) await revokeShares\(id,/.test(server), "settling in full revokes");
assert.ok(/await issueShare\(quote, \(req as any\)\.dbUser, `quotation changed/.test(server), "an edit re-issues");
assert.ok(/quotation changed and the new link failed/.test(server), "a failed re-issue still kills the old price");
assert.ok(server.includes("url: shareUrl(token, quote.quoteNo),"), "new links are issued in the named form");
const tab = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
assert.ok(!/\.url\b/.test(tab.slice(tab.indexOf("The client link (src/quoteShare.ts)"), tab.indexOf("Message the client")) ) && /link: shared \? shareUrl\(shared\.token, q\.quoteNo\)/.test(tab), "the screen and the WhatsApp text build the named form from the token, never the stored url");
assert.equal((server.match(/await quotationPdf\(quote, client, /g) || []).length, 2, "the download and the link render through one function");
const gates = fs.readFileSync("src/gates.ts", "utf8");
assert.ok(/"\/api\/quotations\/share": MANAGERS/.test(gates) && /"\/api\/quotations\/share\/revoke": MANAGERS/.test(gates), "ED/managers only");

// G — the bytes a client reads carry no AnaHon.
const html = quotationHtml({ quoteNo: "006/2026", date: "2026-09-15", validUntil: "2026-09-30", preparedBy: "Saad Matar — Executive Director", clientName: "Maroun Asmar", clientContact: "", clientPhone: "", clientTaxId: "",
  currency: "USD", total: 750, items: [{ service: "Brand", description: "", output: "", unitPrice: 750, qty: 1 }], terms: {}, notes: "", issuedAs: "icontent", discountAmount: 0, discountLabel: "", title: "VxV" });
assert.ok(!/anahon|أنا هون|ANH-/i.test(html.replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g, "")), "iContent PDF names AnaHon");

// H — the outbox write: mtime survives the rename and a revoked file is gone.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qshare-"));
try {
  const exp = shareExpiry("2026-09-30", now);
  const part = path.join(dir, `.${outboxName(token)}.part`), final = path.join(dir, outboxName(token));
  fs.writeFileSync(part, "x", { mode: 0o640 }); fs.utimesSync(part, exp, exp); fs.renameSync(part, final);
  assert.equal(Math.floor(fs.statSync(final).mtimeMs / 1000), Math.floor(exp.getTime() / 1000), "mtime = expiry after the rename");
  assert.deepEqual(fs.readdirSync(dir), [outboxName(token)], "no part file left behind");
  fs.rmSync(final, { force: true });
  assert.deepEqual(fs.readdirSync(dir), [], "revoke = gone");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log("check-quote-share: all passed");
