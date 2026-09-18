// The official papers shelf: is it still honest, and still closed?
//
// Three things here are easy to break by accident and impossible to see once broken.
// A paper we do not hold must never be offered as a download — four of the twenty-two are a
// record with no file. The bytes must stay shut to everyone but the Executive Director and the
// Finance Officer, on every route that can serve them, including a borrowed seat. And a filed
// policy PDF must never be presented as current when the policy behind it has moved on.
// Run: npx tsx scripts/check-papers.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
const { readFileSync } = fs;
import {
  PAPERS, PAPERS_ZIP, POLICY_PDFS, PAPER_IDS, SHAREABLE_IDS, PAPER_GROUPS,
  mayOpenPapers, paperLinkExpiry, paperLinkName, LINK_DAYS, POLICY_LINK_CLASS, linkBlocker, policyPdfsFor,
  writePaperPdf, deletePaperPdf, paperOutboxName, paperShareUrl, PAPER_LINKS_UNSET, READING_CATEGORY,
} from "../src/officialPapers.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const gates = readFileSync(new URL("../src/gates.ts", import.meta.url), "utf8");
const shelf = readFileSync(new URL("../src/tabs/PapersShelf.tsx", import.meta.url), "utf8");

console.log("\nthe list itself");
ok("every paper names a document id and a reference number",
  PAPERS.every(p => /^doc-/.test(p.id) && /^ANH-DOC-\d{5}$/.test(p.ref)),
  PAPERS.filter(p => !/^doc-/.test(p.id) || !/^ANH-DOC-\d{5}$/.test(p.ref)).map(p => p.ref).join(", "));
ok("no paper is listed twice", new Set(PAPERS.map(p => p.id)).size === PAPERS.length);
ok("every paper sits in one of the shelf's groups", PAPERS.every(p => (PAPER_GROUPS as readonly string[]).includes(p.group)));
ok("the five unconfirmed lines are left empty, not guessed",
  PAPERS.filter(p => !p.proves).map(p => p.ref).join(",") === "ANH-DOC-00311,ANH-DOC-00798,ANH-DOC-00818,ANH-DOC-00819,ANH-DOC-00372",
  PAPERS.filter(p => !p.proves).map(p => p.ref).join(","));
ok("P1 to P11 each have a filed PDF in both languages",
  Array.from({ length: 11 }, (_, i) => `P${i + 1}`).every(no => {
    const pair = policyPdfsFor(no);
    return pair.length === 2 && pair[0].lang === "en" && pair[1].lang === "ar";
  }));
ok("every filed policy PDF names the live handbook it was rendered from",
  POLICY_PDFS.every(p => /^doc-hb-/.test(p.governs)));
ok("an Arabic PDF is checked against the Arabic handbook, not the English one",
  POLICY_PDFS.filter(p => p.lang === "ar").every(p => p.governs.startsWith("doc-hb-ar-")));

console.log("\nwhat may be sent out");
ok("the zip is a paper on the shelf but is never sent as a link",
  PAPER_IDS.has(PAPERS_ZIP.id) && !SHAREABLE_IDS.has(PAPERS_ZIP.id));
ok("the papers and the policy PDFs are", PAPERS.every(p => SHAREABLE_IDS.has(p.id)) && POLICY_PDFS.every(p => SHAREABLE_IDS.has(p.id)));
ok("a policy PDF is not one of the closed papers", POLICY_PDFS.every(p => !PAPER_IDS.has(p.id)));
ok("the link name is built from the reference number and ends .pdf", paperLinkName("ANH-DOC-00814") === "AnaHon-ANH-DOC-00814.pdf");
// The outbox file is named from the token, never from this; but the name lands in a URL
// and in the recipient's Downloads, so nothing that reads as a path may survive it.
ok("a reference number that starts with a path loses it",
  paperLinkName("../../etc/passwd") === "AnaHon-etc-passwd.pdf", paperLinkName("../../etc/passwd"));
ok("and one with a path buried in the middle does too",
  !/\.\./.test(paperLinkName("a/../b")), paperLinkName("a/../b"));
ok("an everyday link lasts 7 days", (() => {
  const now = new Date("2026-09-18T09:00:00Z");
  const days = (paperLinkExpiry(now, "week").getTime() - now.getTime()) / 86_400_000;
  return days > LINK_DAYS.week - 0.2 && days < LINK_DAYS.week + 1;
})());
ok("a one-time link lasts 24 hours from the moment it is made, not to the end of a day", (() => {
  const now = new Date("2026-09-18T09:00:00Z");
  return paperLinkExpiry(now, "once").getTime() - now.getTime() === 86_400_000;
})());

console.log("\nSaad's classes, 18 Sep 2026");
const ofRef = (r: string) => PAPERS.find(p => p.ref === r)?.link;
ok("the statute is never sent as a link", ["ANH-DOC-00814", "ANH-DOC-00794", "ANH-DOC-00395"].every(r => ofRef(r) === "none"));
ok("the registration and tax set is one-time",
  ["ANH-DOC-00309","ANH-DOC-00310","ANH-DOC-00311","ANH-DOC-00394","ANH-DOC-00796","ANH-DOC-00817","ANH-DOC-00821","ANH-DOC-00822","ANH-DOC-00816","ANH-DOC-00371","ANH-DOC-00372","ANH-DOC-00383"].every(r => ofRef(r) === "once"));
ok("premises and the website set are a week",
  ["ANH-DOC-00815","ANH-DOC-00818","ANH-DOC-00819","ANH-DOC-00795","ANH-DOC-00797","ANH-DOC-00820"].every(r => ofRef(r) === "week"));
ok("the one paper Saad did not classify is not offered as a link", ofRef("ANH-DOC-00798") === "none");
ok("every paper has a class, and the policy PDFs travel as a week",
  PAPERS.every(p => ["none", "once", "week"].includes(p.link)) && POLICY_LINK_CLASS === "week");
ok("a 'none' paper is refused with a reason a reader can act on", /attach the file to the email yourself/.test(linkBlocker("none")));
ok("a one-time link is refused while the serving side cannot take it down", (() => {
  delete process.env.PAPER_LINK_ONCE;
  return linkBlocker("once").includes("not switched on yet");
})());
ok("and allowed once it can", (() => {
  process.env.PAPER_LINK_ONCE = "1";
  const r = linkBlocker("once") === "";
  delete process.env.PAPER_LINK_ONCE;
  return r;
})());
ok("a week link is never blocked", linkBlocker("week") === "");
ok("the route asks the class before it writes anything", (() => {
  const i = server.indexOf("const blocked = linkBlocker(cls);");
  return i > 0 && i < server.indexOf("issuePaperShare(doc, ref");
})());
ok("and the card says why there is no button", /!row\.share && row\.noLink && <p/.test(shelf));

console.log("\nwho may open a paper");
const SA = { role: "Super Admin", active: true }, FO = { role: "Finance Officer", active: true };
ok("the Executive Director, as themselves", mayOpenPapers(SA, ""));
ok("the Finance Officer, as themselves", mayOpenPapers(FO, ""));
ok("NOT while acting as another seat", !mayOpenPapers(SA, "Finance Officer") && !mayOpenPapers(FO, "Super Admin"));
ok("not a Program Director, not a Project Lead", !mayOpenPapers({ role: "Program Director", active: true }, "") && !mayOpenPapers({ role: "Project Lead", active: true }, ""));
ok("not a closed account", !mayOpenPapers({ role: "Super Admin", active: false }, ""));
ok("not a signed-out browser", !mayOpenPapers(null, ""));

console.log("\nevery route that can serve the bytes asks");
// Four routes reach a document's bytes. Three go through docOnDisk; /content serves the file
// itself and asks inline. Miss one and the papers are open to the whole organisation through a
// URL nobody had to be shown.
for (const route of ['app.get("/api/document/:id/pdf"', 'app.get("/api/document/content/:id"', 'app.get("/api/document/pages/:id"', 'app.get("/api/document/page/:id/:n"']) {
  const start = server.indexOf(route);
  const body = start < 0 ? "" : server.slice(start, server.indexOf("\n});", start));
  ok(`${route.slice(9)} refuses a paper`, Boolean(body) && /officialPaperBlocked|docOnDisk\([\s\S]*?actingSeat\(req\)\)/.test(body), start < 0 ? "route not found" : "neither the blocker nor an acting-aware docOnDisk");
}
ok("docOnDisk itself asks, so a new route inherits the refusal",
  /async function docOnDisk[\s\S]{0,700}?officialPaperBlocked/.test(server));
ok("and it is handed the seat the caller is borrowing",
  /async function docOnDisk\(id: string, uid = "", actingAs = ""\)/.test(server));
ok("the three shelf routes are gated", ['"/api/papers/shelf"', '"/api/papers/share"', '"/api/papers/share/revoke"'].every(r => gates.includes(r)));
ok("to the Executive Director and the Finance Officer", (() => {
  const seg = gates.slice(gates.indexOf('"/api/papers/shelf"'), gates.indexOf('"/api/papers/share/revoke"') + 60);
  return (seg.match(/FINANCE/g) || []).length === 3;
})());
ok("opening a document is written to the audit log", (() => {
  const seg = server.slice(server.indexOf("const READ_AUDIT"), server.indexOf("];", server.indexOf("const READ_AUDIT")));
  return ["document\\/content", "document\\/pages", "\\/pdf"].every(p => seg.includes(p.replace(/\\\\/g, "\\")));
})());
ok("issuing and revoking a link is too",
  /createAuditLog\([^)]*"Paper Link Issued"/.test(server) && /createAuditLog\([^)]*"Paper Link Revoked"/.test(server));
ok("a new link retires the old one, and only after the new file exists",
  server.indexOf("writeSharePdf(token, fs.readFileSync(vp), expiresAt)") < server.indexOf('revokePaperShares(doc.id, "replaced by a new link"'));
ok("a paper we do not hold cannot be sent", /no file — nothing to send/.test(server));

console.log("\nthe reading behind the papers");
// Gated by category, not by a list of ids, so the rule exists BEFORE the rows are filed. With an
// id list there is a window between filing and gating where the documents seat can read them —
// and these say FY2024/25 are unfiled and the 2023 proof is lost.
ok("the gate covers the reading category, not only the listed papers",
  /String\(doc\?\.category \|\| ""\) !== READING_CATEGORY/.test(server));
ok("and the refusal is the same one the papers get",
  /officialPaperBlocked[\s\S]{0,600}?return !mayOpenPapers\(viewer, actingAs\)/.test(server));
ok("the shelf lists whatever is filed there, with no second list to keep in step",
  /where: \{ category: READING_CATEGORY \}/.test(server));
ok("they are never sent as links — no id of theirs can be", (() => {
  // SHAREABLE_IDS is built from PAPERS and POLICY_PDFS only; a reading document is in neither.
  const shelfSrc = readFileSync(new URL("../src/officialPapers.ts", import.meta.url), "utf8");
  const block = shelfSrc.slice(shelfSrc.indexOf("export const SHAREABLE_IDS"), shelfSrc.indexOf("export const PAPER_IDS"));
  return !block.includes("READING") && /PAPERS\.map\(p => p\.id\), \.\.\.POLICY_PDFS\.map\(p => p\.id\)/.test(block);
})());
ok("a reading row leads with its note, not its filename — 'Draft_Letter_to_Lawyer' does not say it was never sent",
  /note: d\.note \|\| ""/.test(server) && /\{r\.note \|\| r\.filename\}/.test(shelf));
ok("the reading is not a card in the papers groups", !PAPERS.some(p => String(p.id).includes("reading")) && READING_CATEGORY === "Official_Papers_Reading");

console.log("\nthe papers outbox is not the quotation one");
// Admin, 18 Sep 2026: client-facing iContent material never names AnaHon, and a statute is not a
// quotation. The paper code must not be able to reach the quotation outbox even by accident.
const paperBlock = server.slice(server.indexOf("/* ---- Official papers, and the filed PDFs"), server.indexOf('app.get("/api/quotations/:id/pdf"'));
ok("the paper code never writes to or deletes from the quotation outbox",
  !/QUOTE_OUTBOX|writeSharePdf|deleteSharePdf|quoteOutboxReady/.test(paperBlock));
ok("and never borrows the quotation address", !/(?<![A-Z_])SHARE_ORIGIN/.test(paperBlock));
ok("a paper link is served from /p/, not the quotation /q/", (() => {
  process.env.PAPER_SHARE_ORIGIN = "https://papers.example";
  const u = paperShareUrl("a".repeat(32), "ANH-DOC-00814");
  delete process.env.PAPER_SHARE_ORIGIN;
  return u === "https://papers.example/p/" + "a".repeat(32) + "/AnaHon-ANH-DOC-00814.pdf";
})());
ok("with no address set, no link can be built", (() => {
  delete process.env.PAPER_SHARE_ORIGIN;
  try { paperShareUrl("a".repeat(32), "ANH-DOC-00814"); return false; } catch { return true; }
})());
ok("with no outbox set, nothing is written — and it refuses for that reason, not by accident", (() => {
  // Asserting the message, not merely that it threw: a silent fallback to some other directory
  // would also throw here (that path does not exist on this machine) and would have passed.
  try { writePaperPdf(fs, "", "a".repeat(32), Buffer.from("x"), new Date()); return false; }
  catch (e: any) { return String(e.message) === PAPER_LINKS_UNSET; }
})());
ok("and the route refuses before it tries", /if \(!paperLinksReady\(\)\) return res\.status\(503\)/.test(server));
ok("both settings are required, and neither has a default",
  /const dir = paperOutboxDir\(\);\s*\n\s*if \(!dir \|\| !process\.env\.PAPER_SHARE_ORIGIN\) return false;/.test(server)
  && /process\.env\.PAPER_OUTBOX \|\| ""/.test(readFileSync(new URL("../src/officialPapers.ts", import.meta.url), "utf8")));
ok("a revoke deletes only tokens this table issued, and never lists the directory",
  /deletePaperPdf\(fs, paperOutboxDir\(\), r\.token\)/.test(server) && !/readdirSync|globSync/.test(paperBlock));

console.log("\nthe file contract, written and removed for real");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-outbox-"));
  const token = "b".repeat(32);
  const expires = new Date("2026-09-25T20:59:59.000Z");
  writePaperPdf(fs, dir, token, Buffer.from("%PDF-1.4 test"), expires);
  const file = path.join(dir, `${token}.pdf`);
  ok("the file lands under the token's name", fs.existsSync(file));
  ok("its mtime IS the expiry", Math.abs(fs.statSync(file).mtimeMs - expires.getTime()) < 1000, String(fs.statSync(file).mtime));
  ok("no half-written .part is left behind", fs.readdirSync(dir).length === 1, fs.readdirSync(dir).join(","));
  deletePaperPdf(fs, dir, token);
  ok("revoking removes it", !fs.existsSync(file) && fs.readdirSync(dir).length === 0);
  ok("a token that is not one cannot name a file", (() => {
    try { paperOutboxName("../../etc/passwd"); return false; } catch { return true; }
  })());
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log("\nwhat the shelf shows");
ok("a missing file gets the record-only strip, never a download",
  /Record only — the file is missing/.test(shelf) && /if \(!row\.held\) \{[\s\S]{0,600}?return \(/.test(shelf));
ok("the Download link is only reachable past that guard",
  shelf.indexOf("Record only — the file is missing") < shelf.indexOf('href={withTicket(`/api/document/content/${row.id}`)}'));
ok("a stale policy PDF says so, with both dates",
  /rows\.some\(r => r\.stale\)/.test(shelf) && /the policy changed on/.test(shelf));
ok("staleness is read from the two files themselves, not from a date anyone has to remember",
  /function fileMoment[\s\S]{0,200}?statSync\(vp\)\.mtimeMs/.test(server) && !/POLICY_PACK_DATE/.test(server));
ok("and compares their moments, not their days — the change that found this was 11 hours after the pack",
  /stale: Boolean\(filed && changed && changed > filed\)/.test(server));
ok("the day a reader is shown is the Beirut day, not UTC",
  /toLocaleDateString\("en-CA", \{ timeZone: "Asia\/Beirut" \}\)/.test(server));
ok("with links not set up, the Send button is not drawn at all",
  /\{!row\.share && shelf\.linksReady && !row\.noLink && \(/.test(shelf) && /linksReady: paperLinksReady\(\)/.test(server));
ok("the shelf is not drawn for anyone else",
  /const mayOpen = \["Super Admin", "Finance Officer"\]\.includes/.test(shelf) && /if \(!mayOpen \|\| !shelf\) return null;/.test(shelf));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
