/**
 * Files lost from the vault — the list behind the "Missing documents" drawer (Books, 11 Oct 2026).
 *
 * A document record whose file is gone is not a filed paper (Admin's vault sweep, 3020df0). The state
 * load already stats each document and sends `fileMissing`; this only reads that flag and groups it, so
 * a scan put back at the record's path leaves the list on the next load without anyone editing a thing.
 * It deliberately does NOT read the "File missing" note the nightly check writes: the note lags by up
 * to a day, the flag does not.
 *
 * Grouped by project: a project's own papers by their link, a voucher's scan by the voucher's project.
 * Anything with no project (editorial references, meeting recordings) is grouped last, never dropped.
 * `vouchers` counts distinct POSTED vouchers whose scan is lost — the figure Finance reads first.
 */
export interface LostDoc {
  id: string; refNo?: string | null; filename: string; category: string;
  linkedRecordType: string; linkedRecordId: string; fileMissing?: boolean;
}
export interface LostVoucher { id: string; voucherNo: string; projectId: string; status?: string }
export interface LostRow {
  id: string; refNo: string; filename: string; category: string;
  /** What opening the line does: the voucher's drawer, the project's page, or the document itself. */
  opens: "voucher" | "project" | "document"; recordId: string; voucherNo: string;
}
export interface LostGroup { projectId: string; rows: LostRow[] }

export function lostFiles(docs: LostDoc[], vouchers: LostVoucher[], projectIds: Set<string>) {
  const voucherOf = new Map(vouchers.map(v => [v.id, v]));
  const by = new Map<string, LostRow[]>();
  const posted = new Set<string>();
  for (const d of docs) {
    if (!d.fileMissing) continue;
    const v = d.linkedRecordType === "Expense" ? voucherOf.get(d.linkedRecordId) : undefined;
    const pid = d.linkedRecordType === "Project" ? d.linkedRecordId : v?.projectId || "";
    const group = projectIds.has(pid) ? pid : "";
    const opens: LostRow["opens"] = v ? "voucher" : d.linkedRecordType === "Project" && group ? "project" : "document";
    if (v && v.status === "Posted") posted.add(v.id);
    const row: LostRow = {
      id: d.id, refNo: d.refNo || d.id, filename: d.filename, category: d.category, opens,
      recordId: opens === "voucher" ? v!.id : opens === "project" ? group : d.id, voucherNo: v?.voucherNo || ""
    };
    by.set(group, [...(by.get(group) || []), row]);
  }
  const groups: LostGroup[] = [...by.entries()]
    .map(([projectId, rows]) => ({ projectId, rows: rows.sort((a, b) => a.refNo.localeCompare(b.refNo)) }))
    // Largest first; the "no project" group always last so the named projects read as the answer.
    .sort((a, b) => (a.projectId === "" ? 1 : 0) - (b.projectId === "" ? 1 : 0) || b.rows.length - a.rows.length || a.projectId.localeCompare(b.projectId));
  return { total: groups.reduce((s, g) => s + g.rows.length, 0), vouchers: posted.size, groups };
}
