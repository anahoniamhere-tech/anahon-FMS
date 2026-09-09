import { useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { searchHits, SearchHits } from "../globalSearch";
import { SharedProps } from "./shared";
import { deskItems, localToday } from "../workflow";
import { visibleNav } from "../nav";
import Info from "../Info";

/**
 * The home screen — the grid of doors this seat opens, and nothing else.
 *
 * Signing in lands here (nav.tsx LANDING). Every screen the role may open is one tile,
 * grouped under the sidebar's section names, My Desk among them. The number on a tile's
 * corner is the same count My Desk shows in its lists: red is what waits on this person
 * behind that door, pink what is due this week on someone else's desk there. Nothing is
 * computed here that src/workflow.ts does not already answer.
 */
const WELL: Record<string, string> = {
  "Home": "bg-[#6D1A1A]/10 text-[#6D1A1A]",
  "Editorial": "bg-[#6D1A1A]/10 text-[#6D1A1A]",
  "Books": "bg-[#6D1A1A]/10 text-[#6D1A1A]",
  "Website & systems": "bg-[#E23B3B]/10 text-[#B72E2E]",
  "People": "bg-[#E23B3B]/10 text-[#B72E2E]",
  "Projects & funding": "bg-[#F88888]/25 text-[#8F2020]",
  "Buying & paying": "bg-[#4A1010]/10 text-[#4A1010]",
  "Admin": "bg-slate-200/70 text-slate-700",
};
const BADGE = "absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ring-2 ring-white";

export default function DoorsTab({ state, currentUser, t, lang, rtl, handleNavClick, isSelfService, globalQuery, setGlobalQuery, searchNav }: SharedProps) {
  const today = localToday();
  const sections = useMemo(() => visibleNav(currentUser?.role || ""), [currentUser]);
  // The same reading My Desk makes: only rows on doors this person can open, then counted
  // per door. A row nobody can open is a lie on the landing page.
  const byDoor = useMemo(() => {
    const m = new Map<string, { owed: number; week: number }>();
    if (!currentUser) return m;
    const doors = new Set(sections.flatMap(s => s.items.map(i => i.navKey)));
    for (const i of deskItems(currentUser, state, today).filter(i => doors.has(i.door))) {
      const c = m.get(i.door) || { owed: 0, week: 0 };
      if (i.group === "week") c.week++; else c.owed++;
      m.set(i.door, c);
    }
    return m;
  }, [state, currentUser, today, sections]);

  const hits = searchHits(globalQuery, state, searchNav);
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        {t("All of AnaHon, one desk.")}
        <Info id="doors" lang={lang} />
      </h2>

      {/* Search, on the phone only.
          The desktop keeps its search in the header; this header cannot hold it. Measured
          at 375px: a fourth right-hand button leaves the two groups flush and truncates
          "AnaHon MS" to "AnaHo…" with the door badge cut mid-word, which would break the
          brand button that is the way home.
          It is an ordinary field in the page rather than a sheet or a dropdown, and that is
          the point: the keyboard takes half a phone screen, and a fixed surface then fights
          it for the remaining half. A field in normal flow just scrolls. */}
      {!isSelfService && (
        <div className="mt-3 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={globalQuery}
              onChange={e => setGlobalQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setGlobalQuery(""); searchRef.current?.blur(); } }}
              type="search"
              enterKeyHint="search"
              placeholder={t("Search vouchers, projects, suppliers, documents…")}
              aria-label={t("Search vouchers, projects, suppliers, documents…")}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white ps-9 pe-11 text-sm text-slate-900 placeholder-slate-400 focus:border-[#6D1A1A] focus:outline-none"
            />
            {globalQuery && (
              <button
                onClick={() => { setGlobalQuery(""); searchRef.current?.focus(); }}
                aria-label={t("Clear search")}
                className="absolute end-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {globalQuery.trim().length >= 2 && (
            <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <SearchHits hits={hits} query={globalQuery} t={t}
                onPick={h => { h.go(); setGlobalQuery(""); }} />
            </div>
          )}
        </div>
      )}
      {sections.map(s => {
        const tiles = s.items.filter(d => d.navKey !== "doors");
        if (!tiles.length) return null;
        return (
          <div key={s.section} className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t(s.section)}</p>
            <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {tiles.map(d => {
                const c = byDoor.get(d.navKey);
                return (
                  <button
                    key={d.navKey}
                    onClick={() => handleNavClick(d.navKey)}
                    title={c?.owed ? `${c.owed} ${t("waiting")}` : c?.week ? `${c.week} ${t("this week")}` : undefined}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-4 text-center shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#6D1A1A]/15"
                  >
                    <span className={`relative flex h-13 w-13 items-center justify-center rounded-[14px] ${WELL[s.section] || WELL.Admin} [&>svg]:h-6 [&>svg]:w-6 [&>span]:h-auto [&>span]:w-auto [&>span]:text-2xl [&>span]:leading-none`}>
                      {d.icon}
                      {/* The count is a <b>, not a <span>: the well's [&>span] variant sizes the
                          glyph icons and would outscore the badge's own size and colour. */}
                      {c?.owed ? (
                        <b className={`${BADGE} bg-[#DC3838] text-white`}>{c.owed}</b>
                      ) : c?.week ? (
                        <b className={`${BADGE} bg-[#F88888] text-[#4A1010]`}>{c.week}</b>
                      ) : null}
                    </span>
                    <span className="min-h-[30px] text-[12px] font-bold leading-tight text-slate-900">{t(d.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
