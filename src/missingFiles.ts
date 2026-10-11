/**
 * Documents whose file is gone (Saad's standing rule, 11 Oct 2026: always check for missing
 * receipts and documents, and say so on the record).
 *
 * A document row points at a vault file. When nothing is at that path, the row's own note field
 * gets a first line saying so, and whatever note it already had stays underneath. When a file is
 * back at that path, the line is replaced by "File re-attached <date>." so the history stays
 * readable. The wording only claims what this code can see: the vault at the record's own path.
 * Whether the file also exists in a NAS snapshot is the Admin room's check, made from the host.
 *
 * Re-attaching means putting the scan back AT THE RECORD'S PATH. A fresh upload is a new row,
 * which leaves the old one marked, truthfully, until someone repoints or retires it.
 */
export const MISSING_MARK = "File missing — nothing in the vault at this record's path";
export const missingLine = (date: string) => `${MISSING_MARK} (checked ${date}). Original to be scanned and re-attached.`;
export const reattachedLine = (date: string) => `File re-attached ${date}.`;

const lines = (note: string) => String(note || "").split("\n");
export const isMarked = (note: string) => lines(note).some(l => l.startsWith(MISSING_MARK));
export const markNote = (note: string, date: string) =>
  isMarked(note) ? note : note ? `${missingLine(date)}\n${note}` : missingLine(date);
export const clearNote = (note: string, date: string) =>
  lines(note).map(l => (l.startsWith(MISSING_MARK) ? reattachedLine(date) : l)).join("\n");

type Db = {
  appDoc: {
    findMany(args: any): Promise<{ id: string; refNo: string | null; base64: string; note: string }[]>;
    update(args: { where: { id: string }; data: { note: string } }): Promise<unknown>;
  };
};

/**
 * One pass over every document. `resolve` turns a stored pointer into an absolute vault path
 * (null for legacy inline documents, which carry their bytes and cannot go missing).
 * `firstRun` is true when no row carried the mark before this pass: the known backlog, which
 * should be reported once, not raised as tonight's news.
 */
export async function sweepMissingFiles(db: Db, resolve: (ptr: string) => string | null,
  exists: (abs: string) => boolean, date: string) {
  const docs = await db.appDoc.findMany({ select: { id: true, refNo: true, base64: true, note: true } });
  const firstRun = !docs.some(d => isMarked(d.note));
  const marked: string[] = [], cleared: string[] = [];
  for (const d of docs) {
    const abs = resolve(d.base64 || "");
    if (!abs) continue;
    const gone = !exists(abs);
    if (gone && !isMarked(d.note)) {
      await db.appDoc.update({ where: { id: d.id }, data: { note: markNote(d.note, date) } });
      marked.push(d.refNo || d.id);
    } else if (!gone && isMarked(d.note)) {
      await db.appDoc.update({ where: { id: d.id }, data: { note: clearNote(d.note, date) } });
      cleared.push(d.refNo || d.id);
    }
  }
  const stillMissing = docs.filter(d => { const a = resolve(d.base64 || ""); return a && !exists(a); }).length;
  return { marked, cleared, firstRun, stillMissing };
}
