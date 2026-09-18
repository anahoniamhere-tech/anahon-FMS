// The official papers shelf: is it still honest, and still closed?
//
// Three things here are easy to break by accident and impossible to see once broken.
// A paper we do not hold must never be offered as a download — four of the twenty-two are a
// record with no file. The bytes must stay shut to everyone but the Executive Director and the
// Finance Officer, on every route that can serve them, including a borrowed seat. And a filed
// policy PDF must never be presented as current when the policy behind it has moved on.
// Run: npx tsx scripts/check-papers.ts
import { readFileSync } from "node:fs";
import {
  PAPERS, PAPERS_ZIP, POLICY_PDFS, PAPER_IDS, SHAREABLE_IDS, PAPER_GROUPS,
  mayOpenPapers, paperLinkExpiry, paperLinkName, PAPER_LINK_DAYS, policyPdfsFor,
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
ok(`a link lasts ${PAPER_LINK_DAYS} days`, (() => {
  const now = new Date("2026-09-18T09:00:00Z");
  const days = (paperLinkExpiry(now).getTime() - now.getTime()) / 86_400_000;
  return days > PAPER_LINK_DAYS - 0.2 && days < PAPER_LINK_DAYS + 1;
})());

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
ok("revoking deletes the file from the outbox", /revokePaperShares[\s\S]{0,400}?deleteSharePdf\(r\.token\)/.test(server));
ok("a paper we do not hold cannot be sent", /no file — nothing to send/.test(server));

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
ok("the shelf is not drawn for anyone else",
  /const mayOpen = \["Super Admin", "Finance Officer"\]\.includes/.test(shelf) && /if \(!mayOpen \|\| !shelf\) return null;/.test(shelf));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
