// Editorial rehearsal (11 Sep 2026) — one person walks the whole chain by standing in several seats.
//
// The real chain refuses that, correctly: separation compares PEOPLE, and "Act as…" changes only the
// seat. This check pins the two halves together so neither can drift:
//   1. a rehearsal compares SEATS, walks every gate, and never leaves the FMS;
//   2. a REAL piece is exactly as strict as before — nothing here loosened it.
// Run: npx tsx scripts/check-rehearsal.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { CONTENT_CHECKS, publishBlockers, socialPostBlockers, rehearsalSeatClash, rehearsalSeatsBlockers, REHEARSAL_TAG } from "../src/editorialGates";
import { deskItems } from "../src/workflow";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const server = read("../server.ts");
let n = 0; const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); n++; };
const eq = (a: unknown, b: unknown, msg: string) => { assert.deepStrictEqual(a, b, msg); n++; };

/* ── 1. the seat rules ─────────────────────────────────────────────────────── */
const seats = { assigneeAs: "Reporter", factCheckerAs: "Content Creator", pmApprovedAs: "", pdApprovedAs: "" };
ok(rehearsalSeatClash(seats, "factcheck", "Reporter"), "the author's seat may not be named fact-checker");
eq(rehearsalSeatClash(seats, "factcheck", "Content Creator"), "", "any other seat may be");
ok(rehearsalSeatClash(seats, "pass", "Reporter"), "only the named checker seat may pass");
eq(rehearsalSeatClash(seats, "pass", "Content Creator"), "", "the named checker seat passes");
ok(rehearsalSeatClash(seats, "pm", "Reporter"), "the author's seat may not approve");
ok(rehearsalSeatClash(seats, "pm", "Content Creator"), "the checker's seat may not approve");
eq(rehearsalSeatClash(seats, "pm", "Production Manager"), "", "a fresh seat may approve");
ok(rehearsalSeatClash({ ...seats, pmApprovedAs: "Production Manager" }, "pd", "Production Manager"),
  "the seat holding one approval may not take the other — Policy 002's two approvers");
eq(rehearsalSeatClash({ ...seats, pmApprovedAs: "Production Manager" }, "pd", "Program Director"), "", "a second seat may");
ok(rehearsalSeatClash(seats, "pm", ""), "no seat is refused, never waved through");

/* ── 2. the publish gate: seats on a rehearsal, PEOPLE on a real piece ─────── */
const allChecks = JSON.stringify(Object.fromEntries(CONTENT_CHECKS.map(([k]) => [k, true])));
const cleared = { status: "Approved", factCheckPassedAt: "x", legalFlag: false, legalReviewedBy: "", checksJson: allChecks, contentLabel: "News" };
// One person (u-1) in four seats.
const rehearsal = { ...cleared, rehearsal: true, pmApprovedBy: "u-1", pdApprovedBy: "u-1",
  assigneeAs: "Reporter", factCheckerAs: "Content Creator", pmApprovedAs: "Production Manager", pdApprovedAs: "Program Director" };
eq(publishBlockers(rehearsal), [], "a rehearsal with four different seats publishes, though one person did it all");
ok(publishBlockers({ ...rehearsal, pdApprovedAs: "Production Manager" }).some(b => /different seat/.test(b)),
  "…but not when the same seat approved twice");
ok(publishBlockers({ ...rehearsal, factCheckerAs: "Reporter" }).some(b => /different seat/.test(b)),
  "…nor when the author's seat checked it");
ok(publishBlockers({ ...rehearsal, assigneeAs: "" }).some(b => /no seat recorded/.test(b)), "…nor with a seat missing");
eq(rehearsalSeatsBlockers(rehearsal), [], "four distinct seats, no blocker");
// THE assertion this whole feature must never break: a REAL piece still compares people.
const real = { ...rehearsal, rehearsal: false };
ok(publishBlockers(real).some(b => /same person/.test(b)),
  "a REAL piece with one person in both approval slots is STILL refused — recorded seats change nothing");
eq(publishBlockers({ ...real, pdApprovedBy: "u-2" }), [], "a real piece with two people publishes as before");
ok(publishBlockers({ ...real, rehearsal: undefined }).some(b => /same person/.test(b)), "no flag at all means real");

/* ── 3. nothing leaves the FMS ─────────────────────────────────────────────── */
ok(socialPostBlockers({ status: "Published", retractedAt: "", rehearsal: true }).length === 1, "social refuses a rehearsal");
eq(socialPostBlockers({ status: "Published", retractedAt: "" }), [], "…and still takes a real published piece");
for (const fn of ["notifySite", "notifySiteUnpublish", "releaseSocialDrafts"]) {
  const body = server.slice(server.indexOf(`async function ${fn}(`), server.indexOf(`async function ${fn}(`) + 260);
  ok(/if \(await isRehearsal\(/.test(body), `${fn} must refuse a rehearsal at its own door`);
}
const bridge = read("../../website/scripts/editorial-lib.mjs");
ok(/status = 'Published' AND rehearsal = 0/.test(bridge),
  "the website build reads Published rows straight from the FMS database — it must skip rehearsals itself");
ok(/if \(item\.rehearsal\) throw/.test(bridge), "…and the single-item publish path must refuse one");
ok(/status: "Published", retractedAt: "", rehearsal: false/.test(server),
  "the proposal brain must never offer a funder a rehearsal as track record");
ok(/NOT: \{ status: "Published" \}, rehearsal: false/.test(server), "the office calendar feed skips rehearsals");

/* ── 4. the flag is set once, at birth, by the master account ──────────────── */
// `select: { rehearsal: true }` in isRehearsal is a READ; every other occurrence would be a write.
eq((server.match(/rehearsal: true/g) || []).length - (server.match(/select: \{ rehearsal: true \}/g) || []).length, 1,
  "exactly one place writes rehearsal: true — the create branch");
ok(/const wantsRehearsal = !existing && rehearsal === true;/.test(server), "…and only when there is no existing item");
ok(/wantsRehearsal && \(req as any\)\.dbUser\?\.role !== "Super Admin"/.test(server), "…and only for the master account");
// Anchored inside the save route: an earlier route also opens `const data = {\n      title,`.
const saveAt = server.indexOf('app.post("/api/content/save"');
const saveData = server.slice(server.indexOf("    const data = {\n      title,", saveAt), server.indexOf("    const item = existing\n", saveAt));
ok(saveData.length > 100 && !/rehearsal/.test(saveData), "the update payload never carries the flag, so no edit can flip it");

/* ── 5. real pieces are exactly as strict as before ────────────────────────── */
ok(/if \(factCheckerUserId === item\.assigneeUserId\)/.test(server), "real: the checker is still never the author, by person");
ok(/if \(user\?\.id !== item\.factCheckerUserId\)/.test(server), "all: only the named person passes a fact-check");
ok(/if \(!item\.rehearsal && user\?\.id === item\.assigneeUserId\)/.test(server), "real: the author still cannot approve");
ok(/if \(!item\.rehearsal && other === user\?\.id\)/.test(server), "real: one person still cannot hold both slots");
ok(/item\.status === "Published" && !item\.rehearsal/.test(server), "real published pieces still cannot be deleted");

/* ── 6. every audit line on a rehearsal is marked ──────────────────────────── */
ok(new RegExp(`item\\?\\.rehearsal \\? \`\\$\\{REHEARSAL_TAG\\} \\$\\{details\\}\``).test(server), "itemAudit prefixes the tag");
eq(REHEARSAL_TAG, "[REHEARSAL]", "the tag reads [REHEARSAL]");
for (const route of ["save", "start", "submit-factcheck", "factcheck-log", "factcheck-pass", "return", "approve",
                     "legal-record", "publish", "retract", "correction", "delete", "draft-save", "draft-delete"]) {
  const at = server.indexOf(`app.post("/api/content/${route}"`);
  const body = server.slice(at, server.indexOf("\napp.", at + 10));
  ok(at > 0 && !/createAuditLog\(user\?\.id, user\?\.name/.test(body), `/api/content/${route} must audit through itemAudit`);
}

/* ── 7. never on a desk ────────────────────────────────────────────────────── */
const st = (rehearsalFlag: boolean) => ({
  users: [{ id: "u-1", email: "s@x", role: "Super Admin", active: true }],
  contentItems: [{ id: "c1", title: "t", status: "Assigned", assigneeUserId: "u-1", dueDate: "2026-09-12", rehearsal: rehearsalFlag }],
} as any);
const me = { id: "u-1", email: "s@x", role: "Super Admin" };
eq(deskItems(me, st(true), "2026-09-11").filter(i => i.kind === "contentItems").length, 0, "a rehearsal is never anyone's turn");
ok(deskItems(me, st(false), "2026-09-11").some(i => i.kind === "contentItems"), "…while the same real piece is");

/* ── 8. the screens ────────────────────────────────────────────────────────── */
const tab = read("../src/tabs/EditorialTab.tsx");
// [\s\S] not [^>]: the button's onClick is an arrow function, and its `=>` contains a ">".
ok(/\{isMaster && \([\s\S]{0,300}?rehearsal: true/.test(tab), "New rehearsal is offered to the master account only");
ok(/\{ic\(Drama, "h-3 w-3"\)\}\{t\("REHEARSAL"\)\}/.test(tab), "a rehearsal wears its band");
ok(/!c\.rehearsal && c\.publishedAt/.test(tab), "a rehearsal is not counted as published this week");
ok(/!i\.rehearsal/.test(read("../src/tabs/SocialTab.tsx")), "the social composer never offers a rehearsal");
ok(/filter\(\(c: any\) => !c\.rehearsal\)/.test(read("../src/tabs/EditorialMap.tsx")), "the map counts real pieces only");

console.log(`check-rehearsal: all ${n} assertions passed — rehearsals compare seats and stay inside; real pieces compare people.`);
