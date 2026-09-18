/**
 * The instalment request letter (18 Sep 2026, src/instalments.ts): the schedule has to add up to the
 * grant, the account comes from the signed agreement, and the letter says which instalment of how
 * many it is asking for.
 */
import assert from "assert";
import fs from "fs";
import { requestRef, instalmentNo, nextInstalment, instalmentBlocker, shareLabel, type Instalment } from "../src/instalments.js";
import { instalmentRequestHtml } from "../docgen.js";
import { SKF_FSTP_WORKPLAN as SKF } from "./seed-skf-fstp-workplan.js";

const sched: Instalment[] = (SKF as any).instalments;
const bank = (SKF as any).bank;

// A — the reference.
assert.equal(requestRef("ANH-2026-SKF-BM-01", 1), "ANH-2026-SKF-BM-01/INST-1");
assert.throws(() => requestRef("", 1), "a request needs a project code");
assert.throws(() => requestRef("X", 0), "and an instalment number");

// B — the schedule as the agreement sets it.
assert.deepEqual(sched.map(i => i.percent), [30, 50, 20]);
assert.deepEqual(sched.map(i => i.amount), [3600, 6000, 2400]);
assert.equal(sched.reduce((s, i) => s + i.amount, 0), 12000, "the instalments are the whole grant");
assert.equal(instalmentNo(sched, 2)?.amount, 6000);
assert.equal(instalmentNo(sched, 9), null);
assert.equal(nextInstalment(sched)?.no, 1, "nothing asked for yet");
assert.equal(nextInstalment(sched.map(i => (i.no === 1 ? { ...i, status: "received" } : i)))?.no, 2, "after the first lands, the next is 2");

// C — what stops a letter going out. Money arithmetic, not judgement.
assert.equal(instalmentBlocker(sched, 1, 12000, bank), null);
assert.ok(instalmentBlocker(sched, 4, 12000, bank), "no such instalment");
assert.ok(instalmentBlocker(sched, 1, 12000, null), "no account on the record, no letter");
assert.ok(instalmentBlocker(sched, 1, 12000, { ...bank, iban: "", accountNo: "" }), "an account name alone is not an account");
assert.ok(instalmentBlocker(sched, 1, 15000, bank), "a schedule that does not add up to the grant");
assert.ok(instalmentBlocker(sched.map(i => (i.no === 1 ? { ...i, percent: 40 } : i)), 1, 12000, bank), "percentages must make 100");
assert.ok(instalmentBlocker(sched.map(i => (i.no === 1 ? { ...i, status: "received" } : i)), 1, 12000, bank), "never ask twice for money already in");
assert.equal(shareLabel(sched[0], "EUR", 12000), "30% of EUR 12,000");

// D — the account is the agreement's, character for character (read from the PDF on 18 Sep 2026).
assert.equal(bank.accountName, "ANA HON - CIVIL COMPANY");
assert.equal(bank.bankName, "BLOM BANK SAL");
assert.equal(bank.iban, "LB 10 0014 0000 0402 3532 3437 9417");
assert.equal(bank.swift, "BLOMLBBX");
assert.ok(/ANH-DOC-00829/.test(bank.source), "the letter can say where the account came from");

// E — the letter.
const html = instalmentRequestHtml({
  ref: requestRef(SKF.projectCode, 1), date: "2026-09-18", projectName: SKF.projectName, projectCode: SKF.projectCode,
  agreementNo: SKF.agreementNo, donorName: (SKF as any).donorName, attention: (SKF as any).attention,
  donorAddress: (SKF as any).donorAddress, cc: (SKF as any).cc, currency: "EUR", grantAmount: 12000,
  instalment: sched[0], schedule: sched, bank, basis: (SKF as any).basis,
  preparedBy: "Saad Matar", preparedByTitle: "Executive Director", signatureNote: "Signed copy to follow on request.",
});
assert.ok(html.includes("REQUEST FOR PAYMENT") && html.includes("ANAHON MEDIA PLATFORM"), "AnaHon letterhead");
assert.ok(html.includes("civil company no. 90/2023") && !/civic non-profit/i.test(html), "the corrected company line");
assert.ok(html.includes("Instalment 1 of 3"), "the donor sees which one of how many");
assert.ok(html.includes("ANH-2026-SKF-BM-01/INST-1"), "the request reference");
assert.ok(html.includes("EUR 3,600.00") && html.includes("30% of") , "the amount and the share");
assert.ok(html.includes("LB 10 0014 0000 0402 3532 3437 9417") && html.includes("Recipient Bank Account Details"), "the account, and where it came from");
assert.ok(html.includes("20 December 2026") && html.includes("31 March 2027"), "instalments 2 and 3 are listed for reference");
assert.equal((html.match(/requested by this letter/g) || []).length, 1, "exactly one row is the one being asked for");
assert.ok(html.includes("Jihane Abdallah") && html.includes("cc: Nadine Moubarak"), "addressed and copied as Saad asked");
assert.ok(html.includes("Executive Director") && html.includes("Signed copy to follow"), "a signature line, since in-app signing is not built");

// F — the route and its gate.
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/app\.post\("\/api\/projects\/instalment-request"/.test(server), "the route exists");
assert.ok(/category: "Instalment Requests"/.test(server), "filed beside the project's other papers");
assert.ok(/const src = await workplanSource\(projectId, opportunityId\)/.test(server), "same record resolver as the workplan: a project or an awarded opportunity");
assert.ok(/"\/api\/projects\/instalment-request": MANAGERS/.test(fs.readFileSync("src/gates.ts", "utf8")), "managers only");

console.log("check-instalment-request: all passed");
