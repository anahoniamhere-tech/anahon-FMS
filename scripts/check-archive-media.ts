/**
 * The Media archive preview reads bytes out of the Meta export zips (src/archiveMedia.ts).
 * Pins: a post's file is found by the id the item carries and its bytes come out exactly;
 * a file in a private folder (messages) is never indexed; byte ranges parse as a browser sends them.
 * Run: npx tsx scripts/check-archive-media.ts
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { buildMediaIndex, mediaForItem, dataOffset, parseRange, mediaKind } from "../src/archiveMedia.js";

let failed = 0;
const ok = (cond: boolean, what: string) => { if (!cond) { failed++; console.error("FAIL", what); } else console.log("ok  ", what); };

const root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-media-"));
const dir = path.join(root, "instagram", "acct", "2026-08-14");
fs.mkdirSync(dir, { recursive: true });
const video = Buffer.from("fake-mp4-" + "x".repeat(5000));
execFileSync("python3", ["-c", `
import zipfile,sys
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_STORED) as z:
    z.writestr("media/reels/202601/18130759321724974.mp4", sys.argv[2])
    z.writestr("your_instagram_activity/messages/inbox/someone/17999999999999999.jpg", "private")
`, path.join(dir, "export.zip"), video.toString()]);

const index = buildMediaIndex(root);
const item = { id: "ig-18130759321724974", url: "https://www.instagram.com/reel/X/" };
const hit = mediaForItem(item, index);
ok(!!hit && mediaKind(hit) === "video", "a reel is found by the id on the library item");
ok(!index.has("17999999999999999"), "a file under messages/ is never indexed");
ok(mediaForItem({ id: "ig-17999999999999999" }, index) === null, "an item cannot reach a private file by naming its id");
if (hit) {
  const fd = fs.openSync(hit.zip, "r");
  const buf = Buffer.alloc(hit.size);
  fs.readSync(fd, buf, 0, hit.size, dataOffset(hit));
  fs.closeSync(fd);
  ok(buf.equals(video), "the bytes read at the data offset are the file's bytes");
}
ok(JSON.stringify(parseRange("bytes=0-", 100)) === "[0,99]", "open-ended range");
ok(JSON.stringify(parseRange("bytes=10-19", 100)) === "[10,19]", "bounded range");
ok(JSON.stringify(parseRange("bytes=-10", 100)) === "[90,99]", "suffix range");
ok(JSON.stringify(parseRange("bytes=50-500", 100)) === "[50,99]", "range past the end is clamped");
ok(parseRange("bytes=200-", 100) === null, "a range that starts past the end is refused");
ok(parseRange(undefined, 100) === undefined, "no Range header means the whole file");

fs.rmSync(root, { recursive: true, force: true });
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("archive media checks passed");
