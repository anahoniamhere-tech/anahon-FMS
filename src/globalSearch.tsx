/**
 * One global search, used from two places.
 *
 * It was written inline in the desktop header, inside `hidden md:flex` — so on a phone it
 * did not exist at all, which is what Saad found in the installed app. Rather than write a
 * second one for the phone, the hit-building and the result list moved here and both
 * callers read them: the desktop header, and the doors screen below `md`.
 *
 * The phone's search is on the doors screen rather than in its header, and that was
 * measured rather than argued: at 375px a fourth right-hand button leaves the two header
 * groups flush and truncates "AnaHon MS" to "AnaHo…" with the door badge cut mid-word —
 * it would have broken the brand button that is the way home. See anahon-logo-goes-home.
 */
import React from "react";
import type { DatabaseState } from "./types";

export type Hit = { k: string; label: string; sub: string; go: () => void };

/** Everything a hit needs to be able to open the thing it names. */
export type SearchNav = {
  formatUSD: (n: number) => string;
  setSearchTerm: (s: string) => void;
  handleNavClick: (tab: string) => void;
  setSelectedProjectId: (id: string | null) => void;
  openDoc: (d: any) => void;
  setBankSearch: (s: string) => void;
  setBankFilterAcc: (s: string) => void;
};

/**
 * What the query matches, in the order a person scans: money first, then the project it
 * belongs to, then who and what it involved. Each kind is capped so one noisy match cannot
 * push the others off the list.
 */
export function searchHits(query: string, state: DatabaseState, nav: SearchNav): Hit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: Hit[] = [];
  (state.expenses || []).filter(e => (e.voucherNo + " " + e.title + " " + e.purpose).toLowerCase().includes(q)).slice(0, 4)
    .forEach(e => hits.push({ k: "Voucher", label: `${e.voucherNo} — ${e.title}`, sub: nav.formatUSD(e.convertedAmount), go: () => { nav.setSearchTerm(e.voucherNo); nav.handleNavClick("expenses"); } }));
  (state.projects || []).filter(p => (p.code + " " + p.name).toLowerCase().includes(q)).slice(0, 3)
    .forEach(p => hits.push({ k: "Project", label: `${p.code} — ${p.name}`, sub: p.status, go: () => { nav.setSelectedProjectId(p.id); nav.handleNavClick("projects"); } }));
  (state.vendors || []).filter(v => v.name.toLowerCase().includes(q)).slice(0, 3)
    .forEach(v => hits.push({ k: "Vendor", label: v.name, sub: v.category, go: () => nav.handleNavClick("vendors") }));
  (state.documents || []).filter(d => d.filename.toLowerCase().includes(q)).slice(0, 3)
    .forEach(d => hits.push({ k: "Document", label: d.filename, sub: d.category, go: () => nav.openDoc(d) }));
  (state.bankTransactions || []).filter(t => t.description.toLowerCase().includes(q)).slice(0, 3)
    .forEach(t => hits.push({ k: "Bank", label: t.description.slice(0, 64), sub: `${t.date} · ${t.type}`, go: () => { nav.setBankSearch(query); nav.setBankFilterAcc(""); nav.handleNavClick("banking"); } }));
  (state.employees || []).filter(emp => emp.name.toLowerCase().includes(q)).slice(0, 2)
    .forEach(emp => hits.push({ k: "Employee", label: emp.name, sub: emp.position, go: () => nav.handleNavClick("payroll") }));
  return hits;
}

/**
 * The result list. Picking one navigates and clears the query in the same action, so the
 * list closes itself — the desktop has always behaved this way and the phone now matches.
 */
export function SearchHits({ hits, query, onPick, t }: {
  hits: Hit[]; query: string; onPick: (h: Hit) => void; t: (s: string) => string;
}) {
  if (!hits.length) return <p className="px-3 py-2.5 text-xs text-slate-500">{t("No matches for")} “{query}”.</p>;
  return (
    <>
      {hits.map((h, i) => (
        <button key={i} onClick={() => onPick(h)}
          className="w-full text-start px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2 min-h-[44px]">
          <span className="text-[9px] font-bold uppercase w-16 shrink-0 text-slate-400">{t(h.k)}</span>
          <span className="text-xs font-medium flex-1 truncate">{h.label}</span>
          <span className="text-[10px] text-slate-400 shrink-0">{h.sub}</span>
        </button>
      ))}
    </>
  );
}
