/**
 * The Media archive's own copies: the Facebook and Instagram exports on the NAS
 * (ARCHIVE_DIR/archive/raw/<platform>/<account>/<date>/*.zip, 32 GB, never extracted).
 *
 * Every media file in those exports is STORED (no compression), so a file's bytes sit in the
 * zip as-is: serving it, and any byte range of it, is an offset into the zip. Only the central
 * directory is read here (a few MB for all 27 zips); nothing is unpacked.
 *
 * An export file is named by the platform's media id (videos/892158263439313.mp4,
 * media/reels/202607/18130759321724974.mp4), and a library item carries the same id in its
 * id, url or thumbnail. That is the whole mapping.
 *
 * Only post media is reachable: the exports also hold messages and other private folders, so
 * a file must sit under one of MEDIA_FOLDERS and be claimed by a library item.
 */
import fs from "fs";
import path from "path";

export type ZipMedia = { zip: string; name: string; size: number; localHeader: number };

const MEDIA_FOLDERS = [/^this_profile's_activity_across_facebook\/posts\/media\//, /^media\/(reels|posts|other)\//];
const MEDIA_FILE = /(?:^|\/)(\d{8,})\.(mp4|jpe?g|png|webp)$/i;
export const MEDIA_TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Stored entries of one zip, from its central directory. */
export function storedEntries(file: string): ZipMedia[] {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) return [];
    const count = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16);
    // ponytail: no zip64. The exports are under 4 GB each (largest 2.9 GB); a larger one is skipped, not misread.
    if (cdOff === 0xffffffff || count === 0xffff) return [];
    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOff);
    const out: ZipMedia[] = [];
    for (let i = 0, p = 0; i < count && p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50; i++) {
      const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
      const n = cd.readUInt16LE(p + 28), m = cd.readUInt16LE(p + 30), k = cd.readUInt16LE(p + 32);
      const name = cd.toString("utf8", p + 46, p + 46 + n);
      if (method === 0 && csize === usize) out.push({ zip: file, name, size: usize, localHeader: cd.readUInt32LE(p + 42) });
      p += 46 + n + m + k;
    }
    return out;
  } finally { fs.closeSync(fd); }
}

const zipsUnder = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? zipsUnder(path.join(dir, d.name)) : d.name.endsWith(".zip") ? [path.join(dir, d.name)] : []);
};

/** media id → its file inside an export. First export wins (the same export was downloaded twice). */
export function buildMediaIndex(rawRoot: string): Map<string, ZipMedia> {
  const index = new Map<string, ZipMedia>();
  for (const zip of zipsUnder(rawRoot).sort()) {
    for (const e of storedEntries(zip)) {
      const m = e.name.match(MEDIA_FILE);
      if (m && MEDIA_FOLDERS.some(re => re.test(e.name)) && !index.has(m[1])) index.set(m[1], e);
    }
  }
  return index;
}

/** The export file a library item points at, if we hold one. */
export function mediaForItem(item: { id: string; url?: string; thumb?: string }, index: Map<string, ZipMedia>): ZipMedia | null {
  for (const id of `${item.id} ${item.url || ""} ${item.thumb || ""}`.match(/\d{8,}/g) || []) {
    const hit = index.get(id);
    if (hit) return hit;
  }
  return null;
}

export const mediaKind = (e: ZipMedia) => (/\.mp4$/i.test(e.name) ? "video" : "image");
export const mediaType = (e: ZipMedia) => MEDIA_TYPES[e.name.split(".").pop()!.toLowerCase()];

/** Where the file's bytes start inside the zip (after its local header). */
export function dataOffset(e: ZipMedia): number {
  const fd = fs.openSync(e.zip, "r");
  try {
    const h = Buffer.alloc(30);
    fs.readSync(fd, h, 0, 30, e.localHeader);
    if (h.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip local header");
    return e.localHeader + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
  } finally { fs.closeSync(fd); }
}

/** `Range: bytes=a-b` → [start, end] inclusive, or null for a range we cannot satisfy. */
export function parseRange(header: string | undefined, size: number): [number, number] | null | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start: number, end: number;
  if (!m[1]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
  return start <= end && start < size ? [start, end] : null;
}
