/**
 * What a search query matches, with no idea of what happens next. The header search
 * (globalSearch.tsx) turns these into buttons; Anna's `search` tool (src/anna.ts) turns
 * them into rows. One matcher, so the two cannot drift apart.
 *
 * In the order a person scans: money first, then the project it belongs to, then who and
 * what it involved. Each kind is capped so one noisy match cannot push the others off.
 */
export type MatchKind = "Voucher" | "Project" | "Vendor" | "Document" | "Bank" | "Team member";
export type Match = { k: MatchKind; row: any };

export function searchMatches(query: string, state: any): Match[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const take = (k: MatchKind, rows: any[] | undefined, text: (r: any) => string, n: number): Match[] =>
    (rows || []).filter(r => text(r).toLowerCase().includes(q)).slice(0, n).map(row => ({ k, row }));
  return [
    ...take("Voucher", state.expenses, e => e.voucherNo + " " + e.title + " " + e.purpose, 4),
    ...take("Project", state.projects, p => p.code + " " + p.name, 3),
    ...take("Vendor", state.vendors, v => v.name, 3),
    ...take("Document", state.documents, d => d.filename, 3),
    ...take("Bank", state.bankTransactions, t => t.description, 3),
    ...take("Team member", state.employees, emp => emp.name, 2),
  ];
}
