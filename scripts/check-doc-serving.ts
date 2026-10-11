// Can a stored upload ever act as a page inside the FMS? (11 Oct 2026)
// Pins src/docServe.ts and that every route sending stored uploads uses it.
// Run: npx tsx scripts/check-doc-serving.ts
import { readFileSync } from "node:fs";
import { docHeaders, DOC_SANDBOX } from "../src/docServe.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

console.log("\nthe rule");
const html = docHeaders("PV-IC2-4.3_reconstructed.html", "text/html");
ok("an HTML document still opens in place", html.disposition === "inline" && html.type.startsWith("text/html"));
ok("…under the sandbox", html.csp === DOC_SANDBOX);
ok("the sandbox never allows scripts", !/allow-scripts/.test(DOC_SANDBOX) && /^sandbox\b/.test(DOC_SANDBOX));
ok("…keeps the origin and the print dialog, so the viewer's Print button works", /allow-same-origin/.test(DOC_SANDBOX) && /allow-modals/.test(DOC_SANDBOX));
ok("…and loads nothing from outside", /default-src 'none'/.test(DOC_SANDBOX) && !/https?:/.test(DOC_SANDBOX));
ok("an SVG is sandboxed too", docHeaders("logo.svg", "image/svg+xml").csp === DOC_SANDBOX);
ok("plain text and markdown are sandboxed", docHeaders("notes.md", "text/markdown").csp === DOC_SANDBOX && docHeaders("a.txt").csp === DOC_SANDBOX);
const pdf = docHeaders("contract.pdf", "application/pdf");
ok("a PDF opens in place, unsandboxed (the browser's viewer needs that)", pdf.disposition === "inline" && pdf.type === "application/pdf" && !pdf.csp);
ok("an image keeps an image type", docHeaders("receipt.jpg", "image/jpeg").type === "image/jpeg");
ok("the extension decides, not the declared type", docHeaders("photo.png", "text/html").type === "image/png" && !docHeaders("photo.png", "text/html").csp);
ok("no extension → a download, whatever was declared", docHeaders("page", "text/html").disposition === "attachment" && docHeaders("page", "text/html").type === "application/octet-stream");
ok("an unknown extension → a download", docHeaders("tool.exe", "application/x-msdownload").disposition === "attachment");
ok("Word and Excel files are downloads", docHeaders("a.docx").disposition === "attachment" && docHeaders("b.xlsx").disposition === "attachment");
ok("a recording keeps its declared audio type", docHeaders("meeting.webm", "audio/x-m4a").type === "audio/x-m4a");
ok("…but a page type declared on a recording is ignored", docHeaders("meeting.webm", "text/html").type === "audio/webm");

console.log("\nthe routes");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const route = (p: string) => { const i = server.indexOf(`app.get("${p}"`); return i < 0 ? "" : server.slice(i, server.indexOf("\napp.", i + 10)); };
for (const p of ["/api/document/content/:id", "/api/sources/:id/document/:docId"]) {
  const body = route(p);
  ok(`${p} exists`, body.length > 0);
  ok(`${p} sends through setDocHeaders`, /setDocHeaders\(res,/.test(body));
  ok(`${p} no longer trusts the declared type`, !/setHeader\("Content-Type", *doc\.mimeType/.test(body));
}
ok("nothing in server.ts sends a stored upload with its declared type", !/setHeader\("Content-Type", *doc\.mimeType/.test(server));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
