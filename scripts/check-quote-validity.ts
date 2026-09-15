/**
 * Quotation validity and the revision clause (Saad, 14 Sep 2026).
 * A new quotation defaults to issue date + 15 days; existing quotations keep their dates;
 * every quotation PDF carries the one revision clause, from one constant.
 */
import assert from "assert";
import fs from "fs";
import { QUOTE_VALIDITY_DAYS, defaultValidUntil, QUOTE_REVISION_CLAUSE, QUOTE_REVISION_CLAUSE_AR, QUOTE_REVISION_CLAUSE_ICONTENT, QUOTE_REVISION_CLAUSE_ICONTENT_AR } from "../src/constants.js";
import { quotationHtml } from "../docgen.js";
import { deskItems } from "../src/workflow.js";

// A — the default, from one constant.
assert.equal(QUOTE_VALIDITY_DAYS, 15);
assert.equal(defaultValidUntil("2026-09-14"), "2026-09-29");
assert.equal(defaultValidUntil("2026-12-20"), "2027-01-04", "crosses a year");
assert.equal(defaultValidUntil(""), "", "no issue date, no guessed expiry");
const tab = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
assert.ok(/validUntil: defaultValidUntil\(/.test(tab), "a new quotation prefills its expiry");
assert.ok(/!quoteForm\.id && /.test(tab), "a saved quotation's expiry is never moved by the form");
for (const f of ["src/tabs/ProductionTab.tsx", "server.ts", "docgen.ts"]) assert.ok(!/(setUTCDate|setDate)\([^)]*\+ ?15\b/.test(fs.readFileSync(f, "utf8")), `${f}: the 15 lives only in QUOTE_VALIDITY_DAYS`);
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/validUntil: validUntil \|\| ""/.test(server), "the server does not backfill an expiry — 005/2026 stays open");

// B — the clause is on the PDF, once, from the constant.
const html = quotationHtml({ quoteNo: "T/2026", date: "2026-09-14", validUntil: "", preparedBy: "x", clientName: "C", clientContact: "", clientPhone: "", clientTaxId: "", currency: "USD", total: 1, items: [], terms: {} as any, notes: "" } as any);
assert.equal(html.split(QUOTE_REVISION_CLAUSE).length - 1, 1, "the revision clause appears exactly once on the quotation");
assert.ok(!fs.readFileSync("docgen.ts", "utf8").includes("AnaHon may revise"), "the wording lives only in the constant");
assert.ok(QUOTE_REVISION_CLAUSE_AR.includes("خطّياً"), "the Arabic carries the same condition");
// Saad, 15 Sep: the Arabic clause prints too — its own RTL block, directly under the English line.
assert.equal(html.split(QUOTE_REVISION_CLAUSE_AR).length - 1, 1, "the Arabic clause appears exactly once on the quotation");
assert.ok(/<p dir="rtl" lang="ar"[^>]*>[^<]*يحقّ لأنا هون/.test(html), "the Arabic clause is an isolated rtl block, marked as Arabic");
assert.ok(html.indexOf(QUOTE_REVISION_CLAUSE) < html.indexOf(QUOTE_REVISION_CLAUSE_AR), "the Arabic sits under the English line");
assert.ok(!/monospace/.test(html.slice(html.indexOf('lang="ar"') - 20, html.indexOf(QUOTE_REVISION_CLAUSE_AR))), "not in a monospace face");
// iContent variant (Saad, 15 Sep 2026): same rule, iContent Studio as the party; the AnaHon wording must not appear.
const icHtml = quotationHtml({ quoteNo: "T/2026", date: "2026-09-14", validUntil: "", preparedBy: "x", clientName: "C", clientContact: "", clientPhone: "", clientTaxId: "", currency: "USD", total: 1, items: [], terms: {} as any, notes: "", issuedAs: "icontent" } as any);
assert.equal(icHtml.split(QUOTE_REVISION_CLAUSE_ICONTENT).length - 1, 1, "the iContent clause appears exactly once on an iContent quotation");
assert.ok(!icHtml.includes(QUOTE_REVISION_CLAUSE) && !icHtml.includes(QUOTE_REVISION_CLAUSE_AR), "an iContent quotation does not carry the AnaHon clause");
assert.equal(QUOTE_REVISION_CLAUSE_ICONTENT.replace("iContent Studio", "AnaHon"), QUOTE_REVISION_CLAUSE, "same wording, only the subject differs");
const icAr = QUOTE_REVISION_CLAUSE_ICONTENT_AR.replace("{ICONTENT}", '<span dir="ltr">iContent Studio</span>');
assert.equal(icHtml.split(icAr).length - 1, 1, "the Arabic iContent clause prints once, the name in an LTR span");
assert.equal(QUOTE_REVISION_CLAUSE_ICONTENT_AR.replace("يحقّ لـ {ICONTENT}", "يحقّ لأنا هون"), QUOTE_REVISION_CLAUSE_AR, "Arabic: same wording, only the subject differs");
assert.ok(/Valid until: —/.test(html), "a quotation with no expiry still prints the dash, not an invented date");

// C — the desk rule that chases a Sent quotation, with 15-day validity (workflow.ts is read, not edited).
const me = { id: "u-1", email: "a@b", role: "Super Admin" };
const sent = (validUntil: string) => ({ quotations: [{ id: "q", quoteNo: "T/2026", status: "Sent", validUntil, title: "t", clientId: "c", amount: 1, currency: "USD" }] }) as any;
const chase = (issued: string, today: string) => deskItems(me, sent(defaultValidUntil(issued)), today).filter((i: any) => i.kind === "quotations").length;
assert.equal(chase("2026-09-14", "2026-09-21"), 0, "day 7 after issue: nothing to chase yet");
assert.equal(chase("2026-09-14", "2026-09-22"), 1, "day 8: expiry is 7 days away, the chase appears");
assert.equal(chase("2026-09-14", "2026-10-05"), 1, "after expiry it stays until someone moves the quotation (no lapses)");
// Saad, 15 Sep 2026: a quotation sent with no expiry (like 005/2026) is chased once the standard
// validity has run from its issue date — workflow.ts, quotations/Sent with emptyField validUntil.
const noExpiry = (today: string) => deskItems(me, { quotations: [{ ...sent("").quotations[0], date: "2026-09-14" }] } as any, today).filter((i: any) => i.kind === "quotations");
assert.equal(noExpiry("2026-09-28").length, 0, "no expiry: nothing before 15 days from issue");
assert.equal(noExpiry("2026-09-29").length, 1, "no expiry: chased from day 15 after issue");
assert.ok(noExpiry("2026-09-29")[0].verb.includes("no expiry"), "and the chase says the quotation has no expiry date");

console.log("✓ check-quote-validity: 15-day default, clause once on every PDF, Sent chase from day 8, no-expiry chase from day 15");
