import { useMemo } from "react";
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

export default function DoorsTab({ state, currentUser, t, lang, handleNavClick }: SharedProps) {
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

  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        {t("All of AnaHon, one desk.")}
        <Info id="doors" lang={lang} />
      </h2>
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
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white px-2 py-4 text-center shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#6D1A1A]/15"
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
