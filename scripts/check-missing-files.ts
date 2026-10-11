// Does a document whose file is gone say so on the record, and stop saying so once it is back?
// Runs the real sweep on scratch records in memory and a temporary folder: no database, no vault.
// Run: npx tsx scripts/check-missing-files.ts
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepMissingFiles, isMarked, MISSING_MARK } from "../src/missingFiles.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

const vault = mkdtempSync(join(tmpdir(), "missing-files-"));
writeFileSync(join(vault, "here.pdf"), "x");
const rows = [
  { id: "d1", refNo: "SCRATCH-1", base64: "file://gone.pdf", note: "" },
  { id: "d2", refNo: "SCRATCH-2", base64: "file://gone-too.pdf", note: "Signed by the donor, 3 May." },
  { id: "d3", refNo: "SCRATCH-3", base64: "file://here.pdf", note: "Present all along." },
  { id: "d4", refNo: "SCRATCH-4", base64: "JVBERi0xLjQK", note: "" },                       // legacy inline bytes
];
const db = {
  appDoc: {
    findMany: async () => rows.map(r => ({ ...r })),
    update: async ({ where, data }: any) => { Object.assign(rows.find(r => r.id === where.id)!, data); },
  },
};
const resolve = (ptr: string) => (ptr.startsWith("file://") ? join(vault, ptr.slice(7)) : null);
const note = (id: string) => rows.find(r => r.id === id)!.note;

console.log("\nfirst pass: the backlog");
let r = await sweepMissingFiles(db, resolve, existsSync, "11 Oct 2026");
ok("both missing files are marked", r.marked.join() === "SCRATCH-1,SCRATCH-2", r.marked.join());
ok("the note says what was checked and when", note("d1").startsWith(`${MISSING_MARK} (checked 11 Oct 2026).`));
ok("an existing note is kept, under the new line", note("d2").endsWith("\nSigned by the donor, 3 May.") && isMarked(note("d2")));
ok("a present file is left alone", note("d3") === "Present all along.");
ok("a document with its bytes inline is never called missing", note("d4") === "");
ok("this was the first run (nothing carried the mark before)", r.firstRun === true);
ok("still missing: 2", r.stillMissing === 2);

console.log("\nsecond pass: nothing new");
r = await sweepMissingFiles(db, resolve, existsSync, "12 Oct 2026");
ok("nothing is marked twice", r.marked.length === 0 && note("d1").split(MISSING_MARK).length === 2);
ok("…and the original date stays", note("d1").includes("checked 11 Oct 2026"));
ok("no longer a first run, so a new loss would be news", r.firstRun === false);

console.log("\na file goes missing later, another comes back");
writeFileSync(join(vault, "gone.pdf"), "rescanned");
rows.push({ id: "d5", refNo: "SCRATCH-5", base64: "file://lost-tonight.pdf", note: "" });
r = await sweepMissingFiles(db, resolve, existsSync, "13 Oct 2026");
ok("the newly lost file is marked", r.marked.join() === "SCRATCH-5");
ok("the re-attached file clears", r.cleared.join() === "SCRATCH-1" && !isMarked(note("d1")));
ok("…to a dated re-attached line", note("d1") === "File re-attached 13 Oct 2026.");
ok("the other one stays marked", isMarked(note("d2")));

console.log("\nthe nightly run");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
ok("server.ts runs the sweep", /sweepMissingFiles\(prisma,/.test(server));
ok("…once a day, early", /nightlyMissingFiles/.test(server) && /setInterval\(nightlyMissingFiles/.test(server));
ok("a new loss puts a task on Saad's desk, the backlog does not",
  /if \(r\.marked\.length && !r\.firstRun\)[\s\S]{0,400}prisma\.complianceTask\.create/.test(server));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
