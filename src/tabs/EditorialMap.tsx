import React, { useMemo, useState } from "react";
import { Lock, AlertTriangle, ChevronDown } from "lucide-react";
import { editorialStations, livePositions, stationStanding, standingRequirements, AFTER_PUBLICATION, MAP_KIND } from "../editorialMap";
import { deskItems } from "../workflow";

/**
 * How a piece travels — the editorial chain, drawn from the rules that run it.
 *
 * Stage 1 of the visual builder: READ-ONLY. Nothing on this screen writes, and nothing on it is
 * typed out by hand — every station, seat, verb, lock and blocker comes from editorialMap.ts,
 * which derives them from workflow.ts and editorialGates.ts. A station this map draws is a
 * station the system really has; one it does not draw does not exist.
 *
 * The live position costs no query: the pieces are already in the state this tab receives, and
 * deskItems() is the same pure function My Desk runs in the browser, so the map and the desk
 * cannot disagree about whose turn it is.
 *
 * Two steps are drawn LOCKED because policy fixes them — the fact-check by a named person who is
 * not the author (005), and two approvals held by two different people (002). Stage 2 may open
 * deadline offsets and channels; it may never open these.
 */
const INK = "#6D1A1A";                                   // the brand maroon, as on the Figures panel
const HUMAN = (f: string) => f.replace(/([A-Z])/g, " $1").replace(/User Id|Id$/, "").trim().toLowerCase();

const Pill = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" | "red" | "emerald" }) => (
  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
    tone === "amber" ? "bg-amber-50 text-amber-800" : tone === "red" ? "bg-red-50 text-red-800"
    : tone === "emerald" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{children}</span>
);

export default function EditorialMap({ state, currentUser, t, rtl }: { state: any; currentUser: any; t: (s: string) => string; rtl: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const stations = useMemo(() => editorialStations(), []);
  const requirements = useMemo(() => standingRequirements(), []);
  // The same reading My Desk makes, for the signed-in viewer. Pure, over state we already hold.
  const desk = useMemo(() => {
    try {
      return deskItems({ id: currentUser?.id, email: currentUser?.email, role: currentUser?.role }, state)
        .filter(d => d.kind === (MAP_KIND as any));
    } catch { return []; }
  }, [state, currentUser]);
  const live = useMemo(() => livePositions(state?.contentItems || [], desk), [state, desk]);
  const standings = useMemo(() => stations.map(s => stationStanding(s, state?.users || [])), [stations, state]);
  const inFlight = stations.filter(s => !s.terminal).reduce((n, s) => n + (live[s.status]?.length || 0), 0);
  const trouble = stations.map((s, i) => ({ s, st: standings[i] })).filter(x => x.st.vacant || x.st.understaffed);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-bold text-slate-900">{t("How a piece travels")}</h3>
        <p className="text-[11px] text-slate-500">
          {t("Drawn live from the rules that run the pipeline. Read-only — this screen changes nothing.")}
        </p>
      </div>

      {/* The finding that matters most today: a station nobody active can serve. */}
      {trouble.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t("The chain cannot run end to end today")}
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-red-800">
            {trouble.map(({ s, st }) => (
              <li key={s.status}>
                <b>{t(s.status)}</b>{" — "}
                {st.vacant
                  ? t("no active account holds any of its seats.")
                  : `${t("needs")} ${s.slots.length} ${t("different people, and only these hold a seat:")} ${st.holders.map(h => h.name).join(", ") || "—"}.`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-red-700">
            {t("A piece would reach this station and stop. Filling the seat is People's to do, not this screen's.")}
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        {inFlight === 0
          ? t("Nothing is in the pipeline right now, so the map shows the chain empty.")
          : `${inFlight} ${t("piece(s) in flight — shown at the station each one is standing at.")}`}
      </p>

      {/* The chain. A vertical spine: six detailed stations never fit across a phone, and a
          column needs no arrow glyph, which would point the wrong way in Arabic. */}
      <ol className="relative space-y-2 ps-6">
        <span aria-hidden className="absolute bottom-4 top-4 w-px bg-slate-200" style={{ [rtl ? "right" : "left"]: "0.6rem" } as any} />
        {stations.map((s, i) => {
          const here = live[s.status] || [];
          const st = standings[i];
          const isOpen = open === s.status;
          return (
            <li key={s.status} className="relative">
              <span aria-hidden className="absolute top-3 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white"
                style={{ [rtl ? "right" : "left"]: "-1.5rem", background: s.terminal ? "#64748b" : INK } as any} dir="ltr">{i + 1}</span>
              <div className={`rounded-lg border bg-white p-3 ${st.vacant || st.understaffed ? "border-red-200" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{t(s.status)}</h4>
                  {s.locks.length > 0 && <Pill tone="amber"><Lock className="me-0.5 inline h-3 w-3" />{t("fixed by policy")}</Pill>}
                  {s.terminal && <Pill tone="emerald">{t("end of the chain")}</Pill>}
                  {here.length > 0 && <Pill tone={here.some(p => p.turn === "mine" || p.turn === "cover") ? "amber" : "slate"}>
                    <span dir="ltr">{here.length}</span> {t("here now")}
                  </Pill>}
                  <button onClick={() => setOpen(isOpen ? null : s.status)} className="ms-auto text-[11px] text-red-700 underline">
                    {isOpen ? t("less") : t("what governs this")}
                    <ChevronDown className={`ms-0.5 inline h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="uppercase tracking-wide text-slate-400">{t("Waiting on")}</dt>
                    <dd className="text-slate-700" dir="auto">
                      {s.terminal ? t("nothing — it is published")
                        : s.personField ? `${t("the named")} ${t(HUMAN(s.personField))}`
                        : s.seats.map(r => t(r)).join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-400">{t("Whose turn")}</dt>
                    <dd className={st.vacant || st.understaffed ? "font-bold text-red-700" : "text-slate-700"} dir="auto">
                      {s.terminal ? "—"
                        : s.personField && !s.seats.length ? t("whoever was named on the piece")
                        : st.holders.length ? st.holders.map(h => h.name).join(", ")
                        : t("nobody active")}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-400">{t("Moves on when")}</dt>
                    <dd className="text-slate-700" dir="auto">{s.verbs.map(v => t(v)).join(" + ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-400">{t("Still blocking publication")}</dt>
                    <dd className="text-slate-700">
                      {s.terminal ? "—" : <><span dir="ltr">{s.outstanding.length}</span> {t("of")} <span dir="ltr">{stations[0].outstanding.length}</span></>}
                    </dd>
                  </div>
                </dl>

                {/* Pieces standing here, with the desk's own reading of whose turn each is. */}
                {here.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {here.map(p => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px]">
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800" dir="auto">{p.title}</span>
                        {p.when && <span className={p.urgency === "overdue" ? "font-bold text-red-700" : "text-slate-500"} dir="ltr">{p.when}</span>}
                        {p.turn === "mine" && <Pill tone="amber">{t("your turn")}</Pill>}
                        {p.turn === "cover" && <Pill tone="amber">{t("you are covering this seat")}</Pill>}
                        {p.openSlots.length > 0 && <Pill>{p.openSlots.map(f => t(HUMAN(f))).join(", ")} {t("still open")}</Pill>}
                      </li>
                    ))}
                  </ul>
                )}

                {isOpen && (
                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-[11px]">
                    {s.locks.map(l => (
                      <p key={l.policy} className="flex gap-1.5 rounded bg-amber-50 p-2 text-amber-900">
                        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                        <span><b>{t("Fixed")}:</b> {t(l.rule)} <span className="opacity-80">— {l.policy}</span></span>
                      </p>
                    ))}
                    {s.slots.length > 0 && (
                      <div>
                        <p className="uppercase tracking-wide text-slate-400">{t("The slots")}</p>
                        <ul className="mt-0.5 space-y-0.5 text-slate-700">
                          {s.slots.map(sl => (
                            <li key={sl.emptyField} dir="auto">
                              <b>{t(sl.verb)}</b> — {sl.seat.map(r => t(r)).join(" · ")}
                              {sl.excludes.length > 0 && <span className="text-slate-500"> · {t("never")}: {sl.excludes.map(f => t(HUMAN(f))).join(" · ")}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.clears.length > 0 && (
                      <div>
                        <p className="uppercase tracking-wide text-slate-400">{t("Clears here")}</p>
                        <ul className="mt-0.5 list-disc space-y-0.5 ps-4 text-slate-700">
                          {s.clears.map(b => <li key={b} dir="auto">{b}</li>)}
                        </ul>
                      </div>
                    )}
                    <p className="text-slate-400">
                      {t("From")} <code>src/workflow.ts</code> ({s.rules.length} {t("rule(s) on this status")})
                      {s.dateField && <> · {t("dated by")} <code>{s.dateField}</code></>}
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Not stations — see the note in editorialMap.ts. Drawn apart so the chain stays honest. */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <p className="text-xs font-bold text-slate-800">{t("After publication — not stations, but not the end either")}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {t("The rules stop at the last station, so these have no seat and no turn. They are what the system can still do to a published piece.")}
        </p>
        <ul className="mt-1.5 space-y-1">
          {AFTER_PUBLICATION.map(a => (
            <li key={a.action} className="rounded border border-slate-200 bg-white p-2 text-[11px]">
              <b className="text-slate-800">{t(a.action)}</b>
              <span className="text-slate-600"> — {t(a.what)}</span>
              <span className="block text-slate-400">{a.policy}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The standards are not a station's job: they can be ticked at any point and block until they are. */}
      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-xs font-bold text-slate-800">
          {t("Standing requirements, at every station")} <span className="font-normal text-slate-500">
            (<span dir="ltr">{requirements.standards.length}</span> {t("standards, plus two that apply only when flagged")})</span>
        </summary>
        <ul className="mt-2 space-y-1 text-[11px]">
          {requirements.standards.map(r => (
            <li key={r.label} dir="auto"><b className="text-slate-800">{r.label}</b> <span className="text-slate-500">— {r.sentence}</span></li>
          ))}
          {requirements.conditional.map(c => (
            <li key={c} className="text-amber-800" dir="auto">{c}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
