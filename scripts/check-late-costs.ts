/**
 * Costs recorded into a submitted donor report's period (15 Sep 2026). What was submitted stays
 * as submitted; late costs are shown beside it; the unknowable is said, never guessed.
 */
import assert from "assert";
import fs from "fs";
import { lateCosts, freezeSubmission, submissionBlocker, shareFor, endOfBeirutDay, inReportCurrency, usdEquivalent } from "../src/lateCosts.js";

const sub = { id: "s1", projectId: "p1", periodStart: "2026-02-10", periodEnd: "2026-06-30", submittedOn: "2026-07-10" };
const v = (o: any) => ({ id: o.id, voucherNo: o.id.toUpperCase(), projectId: "p1", budgetLineId: "bl", status: "Posted", convertedAmount: 100, transactionDate: "2026-05-01", created_at: "2026-09-16T08:00:00.000Z", ...o });

// A — the rule: true date inside the period AND recorded after the submission day.
const r = lateCosts(sub, [
  v({ id: "late" }),
  v({ id: "insub", created_at: "2026-07-01T08:00:00.000Z" }),                 // recorded before submission
  v({ id: "sameday", created_at: "2026-07-10T20:00:00.000Z" }),               // on the submission day itself
  v({ id: "outside", transactionDate: "2026-07-05" }),                        // true date after the period
  v({ id: "draft", status: "Pending" }),                                      // not spent
  v({ id: "other", projectId: "p2" }),                                        // another project
  v({ id: "legacy", transactionDate: "", created_at: "2026-05-01T12:00:00Z" }), // backfilled: recording time unknowable
  v({ id: "split", projectId: "p9", convertedAmount: 300, allocationsJson: JSON.stringify([{ projectId: "p1", amount: 120 }, { projectId: "p9", amount: 180 }]) }),
]);
assert.deepEqual(r.late.map(x => x.id).sort(), ["late", "split"], "only costs dated in the period and recorded after the submission day");
assert.equal(r.lateUSD, 220, "a co-funded voucher counts by this project's share, not in full");
assert.equal(r.unjudged, 1, "a voucher with no true date is counted as cannot-be-judged — never as late, never silently dropped");
assert.equal(shareFor(v({ id: "x", projectId: "p2" }), "p1"), 0);
assert.ok(endOfBeirutDay("2026-07-10") > Date.parse("2026-07-10T20:59:59Z"), "the whole submission day in Beirut is not late");

// B — freezing what a report submitted today contains.
const f = freezeSubmission("p1", "2026-02-10", "2026-06-30", [v({ id: "a" }), v({ id: "b", transactionDate: "" }), v({ id: "c", transactionDate: "2026-08-01" })]);
assert.equal(f.asSubmittedUSD, 100);
assert.deepEqual(f.asSubmittedJson.voucherIds, ["a"], "only true-dated vouchers inside the period are frozen");

// C — what may be recorded.
const ok = { periodStart: "2026-02-10", periodEnd: "2026-06-30", submittedOn: "2026-07-10", today: "2026-09-15", evidence: "ANH-DOC-00001", basis: "entered from the filed report", currency: "USD", asSubmittedNative: 10020.04 };
assert.equal(submissionBlocker(ok), "");
assert.ok(submissionBlocker({ ...ok, submittedOn: "2026-09-20" }), "no future submission date");
assert.ok(submissionBlocker({ ...ok, periodEnd: "2026-01-01" }), "period must run forwards");
assert.ok(submissionBlocker({ ...ok, evidence: " " }), "evidence required");
assert.ok(submissionBlocker({ ...ok, basis: "guessed" }), "the basis is stated");

// C2 — currency (Saad, 15 Sep 2026): kept as reported; converted only at the rate the REPORT states.
assert.equal(usdEquivalent(22585.48, "EUR", null), null, "no stated rate, no invented USD equivalent");
assert.equal(usdEquivalent(100, "EUR", 1.1), 110);
assert.equal(usdEquivalent(10020.04, "USD"), 10020.04);
assert.equal(inReportCurrency(110, { currency: "EUR", usdPerUnit: 1.1 }), 100, "late USD vouchers expressed in the report's currency at its own rate");
assert.equal(inReportCurrency(110, { currency: "EUR", usdPerUnit: null }), null, "no rate: not converted");
const eur = { ...sub, currency: "EUR", usdPerUnit: 1.25 };
assert.equal(lateCosts(eur, [v({ id: "late" })]).lateNative, 80, "the late total in EUR at the report's rate");
assert.equal(lateCosts({ ...eur, usdPerUnit: null }, [v({ id: "late" })]).lateNative, null, "no rate: the screen shows both currencies instead");
assert.equal(lateCosts({ ...eur, usdPerUnit: null }, [v({ id: "late" })]).lateUSD, 100, "the USD total is always there");
assert.ok(submissionBlocker({ ...ok, currency: "CHF" }), "an unknown currency is refused");
assert.ok(submissionBlocker({ ...ok, currency: "EUR", usdPerUnit: 0 }), "a zero rate is refused");
assert.equal(submissionBlocker({ ...ok, currency: "EUR", asSubmittedNative: 22585.48, usdPerUnit: null }), "", "a EUR report with no stated rate may be recorded");
assert.ok(submissionBlocker({ ...ok, basis: "frozen", currency: "EUR", usdPerUnit: null }), "freezing a EUR report from USD vouchers needs its stated rate");
const tabSrc = fs.readFileSync("src/tabs/ReportSubmissions.tsx", "utf8");
assert.ok(tabSrc.includes("formatIn(s.asSubmittedNative, s.currency)"), "the native figure is what is shown");
assert.ok(tabSrc.includes("and states no rate, so they are not converted"), "with no rate, both currencies are shown and the screen says why");
assert.ok(/"currency" TEXT NOT NULL DEFAULT 'USD'/.test(fs.readFileSync("prisma/migrations/20260915150000_report_submission_currency/migration.sql", "utf8")), "currency is stored");

// C3 — an unknown amount (filed report lost, or on the donor's platform only) is null with a reason — never 0.
assert.equal(submissionBlocker({ ...ok, asSubmittedNative: null, note: "corrected workbook lost in the August 2026 vault incident" }), "", "unknown with a reason may be recorded");
assert.ok(submissionBlocker({ ...ok, asSubmittedNative: null, note: " " }), "unknown with no reason is refused");
assert.ok(submissionBlocker({ ...ok, asSubmittedNative: "", note: "" }), "a blank amount with no reason is refused");
assert.equal(usdEquivalent(null, "USD"), null, "no amount, no USD equivalent");
const route = fs.readFileSync("server.ts", "utf8");
assert.ok(/if \(activity && completesObligation\) await prisma\.projectActivity\.update/.test(route), "a part-submission leaves its obligation open");
assert.ok(/const completesObligation = completesIn !== false;/.test(route), "completing is the default");
assert.ok(/asSubmittedNative Float\?/.test(fs.readFileSync("prisma/schema.prisma", "utf8")), "the amount column may be null");

// D — append-only, and the server never recomputes a submitted figure.
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(server.includes('app.post("/api/reports/submission"'), "a submission is recorded through one route");
assert.ok(!/donorReportSubmission\.(update|delete|deleteMany|updateMany|upsert)\(/.test(server), "no route edits or deletes a submission");
assert.ok(/"\/api\/reports\/submission": MANAGERS/.test(fs.readFileSync("src/gates.ts", "utf8")), "the route has its seat");
const migration = fs.readFileSync("prisma/migrations/20260915120000_donor_report_submission/migration.sql", "utf8");
assert.ok(/CREATE TABLE "DonorReportSubmission"/.test(migration));

// E — the seed correction: a due date is never written as a submission date.
const seed = fs.readFileSync("scripts/apply-donor-deadlines.ts", "utf8");
assert.ok(!/completedOn:\s*o\.done\s*\?\s*o\.due/.test(seed), "the donor-deadline seed no longer writes the due date as completedOn");

// F — the screen says the scope and the unknowable.
const tab = fs.readFileSync("src/tabs/ReportSubmissions.tsx", "utf8");
assert.ok(tab.includes("payroll, journal-only and bank-only costs are not yet included"), "v1 scope stated on screen");
assert.ok(tab.includes("cannot be judged"), "unknowable recording times are said");
assert.ok(tab.includes("The submitted figure is unchanged"), "late costs are shown beside the submitted figure");

console.log("✓ check-late-costs: late = dated in the period and recorded after the submission day; append-only; legacy vouchers never judged");
