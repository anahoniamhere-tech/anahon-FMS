/**
 * Quotation client links (16 Sep 2026, src/quoteShare.ts, QUOTATION-LINKS.md).
 * iContent only, never a Draft, a new token on every change, revoked when the offer closes,
 * and pushed with the expiry in the file's mtime.
 */
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { shareBlocker, shareExpiry, shareUrl, remotePath, printedChange, liveShare, TOKEN_PATTERN, SHARE_ORIGIN } from "../src/quoteShare.js";
import { quotationHtml } from "../docgen.js";

const now = new Date("2026-09-16T10:00:00+03:00");
const token = crypto.randomBytes(16).toString("hex");

// A — the link itself.
assert.ok(TOKEN_PATTERN.test(token), "16 random bytes, lowercase hex");
assert.equal(shareUrl(token), `https://icontent.studio/q/${token}.pdf`);
assert.equal(remotePath(token), `/srv/quotations/${token}.pdf`);
assert.throws(() => shareUrl("006-2026"), "a quote number is never a token");
assert.throws(() => remotePath("../etc/passwd" + "0".repeat(20)), "no path in a token");
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

// C — expiry: the whole Beirut validity day, or 30 days.
assert.equal(shareExpiry("2026-09-30", now).toISOString(), "2026-09-30T21:59:59.000Z");
assert.equal(shareExpiry("", now).getTime() - now.getTime(), 30 * 86_400_000);
assert.equal(shareBlocker({ ...sent, validUntil: "2026-09-16" }, now), null, "valid until today is still live today");

// D — what counts as a change the client would read.
const q = { clientId: "c1", title: "VxV", amount: 750, itemsJson: "[]", status: "Sent", validUntil: "2026-09-30" };
assert.deepEqual(printedChange(q, { ...q, status: "Accepted" }), [], "a status move is not a new document");
assert.deepEqual(printedChange(q, { ...q, amount: 800 }), ["amount"]);
assert.deepEqual(printedChange(q, { ...q, validUntil: "2026-10-15" }), ["validUntil"], "a new date is a new link (and a new mtime)");

// E — the live link: not revoked, not expired, newest.
const row = (t: string, created: string, extra: any = {}) => ({ token: t, quotationId: "q1", createdAt: created, expiresAt: "2026-09-30T21:59:59.000Z", revokedAt: null, revokePending: false, ...extra });
assert.equal(liveShare([], "q1", now), null, "no link until one is published");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z")], "q1", now)?.token, "a");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z", { revokedAt: "2026-09-16T09:00:00Z" })], "q1", now), null, "a revoked link is not offered");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z", { expiresAt: "2026-09-15T00:00:00Z" })], "q1", now), null, "an expired link is not offered");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z"), row("b", "2026-09-16T09:00:00Z")], "q1", now)?.token, "b");
assert.equal(liveShare([row("a", "2026-09-16T08:00:00Z")], "q2", now), null, "per quotation");

// F — the server wiring (read, not assumed).
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(server.includes('await run("rsync", ["-a", "--chmod=F640"'), "rsync -a keeps the mtime");
assert.ok(/fs\.utimesSync\(local, expiresAt, expiresAt\)/.test(server), "mtime = expiry");
assert.ok(server.includes('"StrictHostKeyChecking=yes"') && server.includes('"BatchMode=yes"'), "pinned host key, no prompts");
assert.ok(server.includes('const token = crypto.randomBytes(16).toString("hex");'), "CSPRNG token");
assert.ok(!/run\("scp"/.test(server.slice(server.indexOf("async function pushSharePdf"), server.indexOf("async function deleteSharePdf"))), "never a plain scp");
assert.ok(/await pushSharePdf\(token, pdf, expiresAt\);\s*\/\/ Retire the old link only once/.test(server), "the old link is retired only after the new one is pushed");
assert.ok(/await revokeShares\(id, "quotation deleted"/.test(server), "deleting a quotation revokes its link");
assert.ok(/!SHAREABLE_STATUSES\.includes\(status\)\) await revokeShares\(id,/.test(server), "settling in full revokes");
assert.ok(/await issueShare\(quote, \(req as any\)\.dbUser, `quotation changed/.test(server), "an edit re-issues");
assert.ok(/quotation changed and the new link failed/.test(server), "a failed re-issue still kills the old price");
assert.equal((server.match(/await quotationPdf\(quote, client, /g) || []).length, 2, "the download and the link render through one function");
const gates = fs.readFileSync("src/gates.ts", "utf8");
assert.ok(/"\/api\/quotations\/share": MANAGERS/.test(gates) && /"\/api\/quotations\/share\/revoke": MANAGERS/.test(gates), "ED/managers only");

// G — the bytes a client reads carry no AnaHon.
const html = quotationHtml({ quoteNo: "006/2026", date: "2026-09-15", validUntil: "2026-09-30", preparedBy: "Saad Matar — Executive Director", clientName: "Maroun Asmar", clientContact: "", clientPhone: "", clientTaxId: "",
  currency: "USD", total: 750, items: [{ service: "Brand", description: "", output: "", unitPrice: 750, qty: 1 }], terms: {}, notes: "", issuedAs: "icontent", discountAmount: 0, discountLabel: "", title: "VxV" });
assert.ok(!/anahon|أنا هون|ANH-/i.test(html.replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g, "")), "iContent PDF names AnaHon");

// H — rsync -a really carries the mtime (the mistake QUOTATION-LINKS.md warns about).
// GNU rsync (the container's) only; macOS ships openrsync, which rejects --chmod=F640.
const gnu = (() => { try { const v = execFileSync("rsync", ["--version"]).toString(); return /^rsync\s+version/m.test(v) && !/openrsync/.test(v); } catch { return false; } })();
if (!gnu) console.log("check-quote-share: H skipped — no GNU rsync here; run it in the container");
else {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qshare-"));
try {
  const src = path.join(dir, "a.pdf"), dst = path.join(dir, "out");
  fs.writeFileSync(src, "x"); fs.mkdirSync(dst);
  const exp = shareExpiry("2026-09-30", now);
  fs.utimesSync(src, exp, exp);
  execFileSync("rsync", ["-a", "--chmod=F640", src, `${dst}/${token}.pdf`]);
  const st = fs.statSync(`${dst}/${token}.pdf`);
  assert.equal(Math.floor(st.mtimeMs / 1000), Math.floor(exp.getTime() / 1000), "mtime survived the copy");
  assert.equal(st.mode & 0o777, 0o640, "F640");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log("check-quote-share: all passed");
