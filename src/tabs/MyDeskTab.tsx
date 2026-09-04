import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Lock, Upload, ChevronRight, Undo2, Inbox, Users, Clock } from "lucide-react";
import { SharedProps } from "./shared";
import { PERSONNEL_CATEGORIES, isPersonnelDoc } from "../personnelDocs";
import { deskItems, localToday, DeskItem } from "../workflow";
import { DIRECTORS } from "../roles";
import { NAV, visibleNav } from "../nav";
import Info from "../Info";

/**
 * My Desk — the first screen for everyone: what is waiting on me, by when.
 *
 * Nothing here is a task list of its own. src/workflow.ts answers "whose turn is it?"
 * for every record that already carries a status, and this screen lists the answers for
 * the person signed in. Act on the record (approve the voucher, pass the fact-check,
 * tick the statutory task) and it leaves the desk. The one write this screen makes is
 * the compliance tick the register already supports.
 */
const DOORS = NAV.flatMap(s => s.items);
const CAP = 12;            // rows shown before "n more"
const NOTE_PREVIEW = 150;  // notes longer than this are worth a click

export default function MyDeskTab({
  state, currentUser, t, lang, refreshState, triggerToast, handleNavClick, openDoc,
  setDrawerExpenseId, setSelectedProjectId, setFocusId,
}: SharedProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [upCat, setUpCat] = useState<string>("CV");
  const fileRef = useRef<HTMLInputElement>(null);
  // Task ids whose full note is showing; groups whose full list is showing.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  // The task ticked most recently this session, so a mis-click has an undo in reach.
  const [justDone, setJustDone] = useState<{ id: string; title: string } | null>(null);
  const [showDone, setShowDone] = useState(false);
  // Calendar events come from their own endpoint rather than app state: the feed address
  // is a credential the server keeps to itself, and only the events cross to the browser.
  const [cal, setCal] = useState<{ connected: boolean; events: any[]; calendars?: string[]; error?: string } | null>(null);
  const [icsInput, setIcsInput] = useState("");
  const [icsLabel, setIcsLabel] = useState("");
  const [addingCal, setAddingCal] = useState(false);
  const [calView, setCalView] = useState<"month" | "list">("month");
  const [monthOffset, setMonthOffset] = useState(0);   // months forward from the current one
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const toggle = (set: (f: (p: Set<string>) => Set<string>) => void, id: string) =>
    set(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  // One reading of "today" for the whole screen, in the office's local date — the same as
  // the server's localDate(), so an item never sits in two buckets around midnight.
  const today = localToday();
  const now = new Date();
  const daysTo = (d: string) => Math.round((new Date(d + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  const isDirector = DIRECTORS.includes(currentUser?.role || "");

  // Only rows on doors this person can open: the server may ship a record to a role that has
  // no screen for it (the Digital Officer receives the content board, the crew their own
  // timesheets), and a row nobody can open is a lie on the landing page.
  const doors = useMemo(() => new Set(visibleNav(currentUser?.role || "").flatMap(s => s.items.map(i => i.navKey))), [currentUser]);
  const items = useMemo(() => (currentUser ? deskItems(currentUser, state, today).filter(i => doors.has(i.door)) : []), [state, currentUser, today, doors]);
  const mine = items.filter(i => i.group === "mine");
  const cover = items.filter(i => i.group === "cover");
  const week = items.filter(i => i.group === "week");
  const overdueCount = items.filter(i => i.urgency === "overdue" && i.group !== "week").length;

  const done = useMemo(
    () => (state.complianceTasks || []).filter(x => x.status === "Done").sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [state.complianceTasks]
  );

  /** Tick a task, or put it back. Both directions go through here so the two can never
   *  drift apart, and both leave their own line in the audit trail. */
  const setDone = async (taskId: string, title: string, isDone: boolean) => {
    setBusy(taskId);
    try {
      const r = await fetch(`/api/compliance/${isDone ? "complete" : "reopen"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, user: currentUser }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("Could not update the task."));
      setJustDone(isDone ? { id: taskId, title } : null);
      triggerToast(isDone ? `${t("Done")}: ${title.slice(0, 44)} — ${t("undo below")}` : `${t("Reopened")}: ${title.slice(0, 44)}`);
      await refreshState();
    } catch (e: any) {
      triggerToast(e.message);
    } finally {
      setBusy(null);
    }
  };

  /** Open the record behind a row on its own door. Compliance rows are acted on in place. */
  const open = (i: DeskItem) => {
    if (i.kind === "complianceTasks") return;
    if (i.kind === "expenses") setDrawerExpenseId(i.recordId);                      // App-owned voucher drawer
    if (i.kind === "projectActivities") setSelectedProjectId(i.record.projectId);  // project workspace
    if (i.kind === "contentItems") setFocusId(i.recordId);                          // Editorial desk opens the piece
    // ponytail: door-level focus for the other doors; wire focusId into a tab when someone asks for it
    handleNavClick(i.door);
  };

  const loadCalendar = async () => {
    try {
      // Six months, so the month grid has something to show when you page forward.
      const r = await fetch("/api/calendar/events?days=180");
      setCal(await r.json());
    } catch {
      setCal({ connected: false, events: [] });
    }
  };
  // The diary is the director's; the server refuses everyone else, so nobody else asks.
  useEffect(() => { if (isDirector) loadCalendar(); }, [isDirector]);

  const connectCalendar = async () => {
    setBusy("cal");
    try {
      const r = await fetch("/api/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: icsInput.trim(), label: icsLabel.trim(), user: currentUser }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("Could not connect the calendar."));
      setIcsInput(""); setIcsLabel(""); setAddingCal(false);
      triggerToast(`${t("Calendar connected — read-only.")} ${(d.calendars || []).length}`);
      await loadCalendar();
    } catch (e: any) {
      triggerToast(e.message);
    } finally {
      setBusy(null);
    }
  };

  /** Each connected calendar gets a stable colour from its position in the list, so a
   *  fellowship session never reads as an AnaHon commitment. */
  const CAL_COLOURS = ["bg-[#6D1A1A]", "bg-[#2f6d8f]", "bg-[#6d5a1a]", "bg-[#4a1a6d]"];
  const calColour = (name?: string) => {
    const i = (cal?.calendars || []).indexOf(String(name));
    return i >= 0 ? CAL_COLOURS[i % CAL_COLOURS.length] : "bg-[#6D1A1A]";
  };

  /** "Thu 24 Sep · 14:00" — or just the date for an all-day entry. */
  const whenLabel = (e: any) => {
    const d = new Date(`${e.start}${e.allDay ? "T00:00" : ""}`);
    const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return e.allDay ? `${day} · ${t("all day")}` : `${day} · ${e.start.slice(11)}`;
  };

  /* ── Month grid ────────────────────────────────────────────────────────────
   * One surface for both halves of the question "what is coming up": diary entries from
   * Google, and the dated items the desk already lists. They are different kinds of thing —
   * an appointment happens to you, an item is owed by someone — so they keep distinct colours.
   */
  type DayItem = { kind: "event" | "item"; id: string; label: string; time?: string; tone: string; item?: DeskItem; calendar?: string };
  const URGENCY_TONE = { overdue: "bg-[#E23B3B]", week: "bg-[#F88888]", waiting: "bg-slate-400" };

  const byDay = useMemo(() => {
    const m = new Map<string, DayItem[]>();
    const push = (day: string, item: DayItem) => {
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(item);
    };
    for (const e of cal?.events || []) {
      push(String(e.start).slice(0, 10), {
        kind: "event", id: e.uid, label: e.summary, calendar: e.calendar,
        time: e.allDay ? "" : String(e.start).slice(11),
        tone: calColour(e.calendar),
      });
    }
    for (const i of items) {
      if (i.when) push(i.when, { kind: "item", id: i.id, label: `${t(i.verb)} · ${i.title}`, item: i, tone: URGENCY_TONE[i.urgency] });
    }
    return m;
  }, [cal, items, lang]);

  const monthCursor = useMemo(() => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1), [monthOffset, today]);

  /** Calendar weeks for the visible month, Monday-first, padded to whole weeks. */
  const monthGrid = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const last = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const lead = (first.getDay() + 6) % 7;            // Monday = 0
    const cells: (Date | null)[] = Array(lead).fill(null);
    for (let n = 1; n <= last.getDate(); n++) cells.push(new Date(first.getFullYear(), first.getMonth(), n));
    while (cells.length % 7) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [monthCursor]);

  const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /** One desk row. Compliance rows tick in place and unfold their note; every other row opens its door. */
  const deskRow = (i: DeskItem) => {
    const d = i.when ? daysTo(i.when) : null;
    const chip = d === null ? { text: t("no date"), cls: "text-slate-500 bg-slate-50 border-slate-200" }
      : d < 0 ? { text: `${Math.abs(d)}d ${t("late")}`, cls: "text-red-700 bg-red-50 border-red-200" }
      : d === 0 ? { text: t("today"), cls: "text-amber-800 bg-amber-50 border-amber-200" }
      : { text: `${d}d`, cls: d <= 7 ? "text-[#8f2020] bg-[#F88888]/20 border-[#F88888]" : "text-slate-600 bg-slate-50 border-slate-200" };
    const isTask = i.kind === "complianceTasks";
    const notes = isTask ? String(i.record.notes || "") : "";
    const long = notes.length > NOTE_PREVIEW;
    const isOpen = expanded.has(i.id);
    const door = DOORS.find(x => x.navKey === i.door);
    const clickable = isTask ? long : true;
    const act = () => (isTask ? long && toggle(setExpanded, i.id) : open(i));
    return (
      <div
        key={i.id}
        onClick={act}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={e => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); act(); } }}
        className={`flex items-start gap-3 rounded-lg border-b border-slate-100 px-1 py-2.5 last:border-0 ${clickable ? "cursor-pointer hover:bg-slate-50" : ""} ${isOpen ? "bg-slate-50" : ""}`}
      >
        {isTask && isDirector ? (
          <button
            onClick={e => { e.stopPropagation(); setDone(i.recordId, i.title, true); }}
            disabled={busy === i.recordId}
            title={t("Mark done")}
            className="mt-0.5 shrink-0 rounded-full border border-slate-300 p-1 hover:border-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          </button>
        ) : (
          <span className="mt-1 shrink-0 text-slate-400">{door?.icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-slate-900">
            {i.verb && <span className="font-semibold">{t(i.verb)} · </span>}
            {i.title}
            {long && <ChevronRight className={`ml-1 inline h-3 w-3 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {door && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{t(door.label)}</span>}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{t(i.status)}</span>
            {i.seats.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">{t("seat")}: {i.seats.map(x => t(x)).join(", ")}</span>
            )}
          </p>
          {notes && (
            <p className={`mt-0.5 text-[11px] leading-relaxed text-slate-500 ${isOpen ? "whitespace-pre-line" : ""}`}>
              {long && !isOpen ? `${notes.slice(0, NOTE_PREVIEW).trimEnd()}…` : notes}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>{chip.text}</span>
      </div>
    );
  };

  /** A group card: heading, count, optional ⓘ, the rows, and "n more" past the cap. */
  const group = (key: string, title: string, icon: any, list: DeskItem[], opts: { sub?: string; info?: string; empty?: string } = {}) => {
    const Icon = icon;
    const all = showAll.has(key);
    // Everything late or due this week is always shown; only the undated tail is capped.
    const shown = all ? list : list.slice(0, Math.max(CAP, list.filter(i => i.urgency !== "waiting").length));
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Icon className="h-4 w-4 text-[#6D1A1A]" /> {title}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{list.length}</span>
            {opts.info && <Info id={opts.info} lang={lang} />}
          </h3>
        </div>
        {opts.sub && <p className="mb-2 text-[11px] text-slate-500">{opts.sub}</p>}
        {list.length === 0 && opts.empty && <p className="text-xs text-slate-500">{opts.empty}</p>}
        {shown.map(deskRow)}
        {list.length > CAP && (
          <button onClick={() => toggle(setShowAll, key)} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-red-700 hover:underline">
            <Clock className="h-3 w-3" /> {all ? t("Show less") : `${list.length - CAP} ${t("more")}`}
          </button>
        )}
      </div>
    );
  };

  // The employee record behind this login — matched on userEmail, the same field
  // self-service timesheets key on. Without it there is no personnel file to show.
  const me = useMemo(
    () => (state.employees || []).find(e => (e.userEmail || "").trim().toLowerCase() === (currentUser?.email || "").trim().toLowerCase()),
    [state.employees, currentUser]
  );
  const myPapers = useMemo(
    () => (state.documents || []).filter(d => d.partyId === me?.id && isPersonnelDoc(d)),
    [state.documents, me]
  );

  const uploadPaper = async (file: File) => {
    if (!me) return;
    setBusy("upload");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const r = await fetch("/api/document/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, mimeType: file.type, sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          base64, category: upCat, partyId: me.id, user: currentUser,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("Upload failed."));
      triggerToast(d.duplicate ? t("Already on file — no second copy made.") : `${upCat} ${t("filed to your personnel file.")}`);
      await refreshState();
    } catch (e: any) {
      triggerToast(e.message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4A1010] via-[#6D1A1A] to-[#4A1010] px-5 py-4 text-white shadow-md">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#E23B3B]/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-[#F88888]/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/assets/images/anahon_logo.png" alt="" className="h-10 w-auto drop-shadow" />
            <div>
              <h2 className="text-lg font-bold leading-tight">{currentUser?.name || t("My Desk")}</h2>
              <p className="text-[11px] text-white/70">
                {t(currentUser?.role || "")} · {now.toLocaleDateString(lang === "ar" ? "ar-LB" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          {overdueCount > 0 && (
            <span className="rounded-full bg-[#E23B3B] px-3 py-1 text-[11px] font-bold shadow">
              {overdueCount} {t("overdue")}
            </span>
          )}
        </div>
      </div>

      {justDone && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="min-w-0 text-[12px] text-emerald-900">
            <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
            {t("Marked done")}: <span className="font-semibold">{justDone.title}</span>
          </p>
          <button
            onClick={() => setDone(justDone.id, justDone.title, false)}
            disabled={busy === justDone.id}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Undo2 className="mr-1 inline h-3 w-3" /> {t("Undo")}
          </button>
        </div>
      )}

      {group("mine", t("Waiting on you"), Inbox, mine, { info: "my-desk", empty: t("Nothing is waiting on you.") })}

      {currentUser?.role === "Super Admin" && group("cover", t("Seats I cover"), Users, cover, {
        sub: t("Items owed to a seat nobody holds yet. Use Act as… to take them."),
        empty: t("Every seat with something owed is held."),
      })}

      {week.length > 0 && group("week", t("Due this week"), Clock, week)}

      {/* Calendar — what is actually in the diary, next to what the desk owes. Directors only:
          the merged feed carries personal commitments. Read-only: nothing here can change the real calendar. */}
      {isDirector && <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <CalendarDays className="h-4 w-4 text-[#6D1A1A]" /> {t("Calendar")}
          </h3>
          {cal?.connected && (
            <div className="flex flex-wrap items-center gap-2">
              {(cal.calendars || []).map(name => (
                <span key={name} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${calColour(name)}`} /> {name}
                </span>
              ))}
              {isDirector && (
                <button
                  onClick={() => setAddingCal(v => !v)}
                  className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:border-[#6D1A1A] hover:text-[#6D1A1A]"
                >
                  + {t("calendar")}
                </button>
              )}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("read-only")}</span>
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                {(["month", "list"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCalView(v)}
                    className={`px-2.5 py-1 text-[11px] font-bold capitalize ${calView === v ? "bg-[#6D1A1A] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {t(v)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {cal?.connected && !cal.error && calView === "month" && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                onClick={() => setMonthOffset(o => Math.max(0, o - 1))}
                disabled={monthOffset === 0}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                ‹
              </button>
              <p className="text-[12px] font-bold text-slate-800">
                {monthCursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </p>
              <button
                onClick={() => setMonthOffset(o => Math.min(5, o + 1))}
                disabled={monthOffset === 5}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="bg-slate-50 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">{t(d)}</div>
              ))}
              {monthGrid.flat().map((d, i) => {
                if (!d) return <div key={`b${i}`} className="min-h-[62px] bg-slate-50/60" />;
                const key = isoOf(d);
                const dayItems = byDay.get(key) || [];
                const isToday = key === today;
                const isPicked = key === pickedDay;
                return (
                  <button
                    key={key}
                    onClick={() => setPickedDay(isPicked ? null : key)}
                    className={`min-h-[62px] bg-white p-1 text-left align-top transition-colors hover:bg-slate-50 ${isPicked ? "ring-2 ring-inset ring-[#6D1A1A]" : ""}`}
                  >
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isToday ? "bg-[#6D1A1A] text-white" : "text-slate-600"}`}>
                      {d.getDate()}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-0.5">
                      {dayItems.slice(0, 4).map(it => (
                        <span key={it.id} title={it.label} className={`h-1.5 w-1.5 rounded-full ${it.tone}`} />
                      ))}
                      {dayItems.length > 4 && <span className="text-[8px] font-bold text-slate-400">+{dayItems.length - 4}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
              {(cal?.calendars || []).map(name => (
                <span key={name} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${calColour(name)}`} /> {name}</span>
              ))}
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#E23B3B]" /> {t("overdue")}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F88888]" /> {t("Due this week")}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> {t("later")}</span>
            </div>

            {pickedDay && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  {new Date(`${pickedDay}T00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {(byDay.get(pickedDay) || []).length === 0 && <p className="text-xs text-slate-400">{t("Nothing on this day.")}</p>}
                {(byDay.get(pickedDay) || []).map(it => (
                  <div key={it.id} className="flex items-start gap-2 border-b border-slate-200 py-1.5 last:border-0">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${it.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-snug text-slate-800">{it.label}</p>
                      <p className="text-[10px] text-slate-500">
                        {it.kind === "event"
                          ? `${it.calendar || t("Diary")}${it.time ? ` · ${it.time}` : ` · ${t("all day")}`}`
                          : it.item?.seats.length ? `${t("seat")}: ${it.item.seats.map(x => t(x)).join(", ")}` : t(it.item?.status || "")}
                      </p>
                    </div>
                    {it.kind === "item" && it.item?.kind === "complianceTasks" && isDirector && (
                      <button
                        onClick={() => setDone(it.item!.recordId, it.item!.title, true)}
                        disabled={busy === it.item.recordId}
                        title={t("Mark done")}
                        className="shrink-0 rounded-full border border-slate-300 p-1 hover:border-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                    {it.kind === "item" && it.item && it.item.kind !== "complianceTasks" && (
                      <button onClick={() => open(it.item!)} className="shrink-0 text-[10px] font-bold text-red-700 hover:underline">{t("Open")}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!cal && <p className="text-xs text-slate-400">{t("Loading…")}</p>}

        {/* Connecting a feed is a director's act: the server refuses everyone else. */}
        {cal && (!cal.connected || addingCal) && (
          <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] leading-relaxed text-slate-600">
              {t("Paste the secret iCal address from Google Calendar (Settings → your calendar → Integrate calendar). It is held on this machine only, never shown again, and never sent to the browser. The feed is read-only — nothing here can alter your calendar.")}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={icsLabel}
                onChange={e => setIcsLabel(e.target.value)}
                placeholder={t("Name (e.g. Fellowship)")}
                className="w-40 shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-[11px]"
              />
              <input
                type="password"
                value={icsInput}
                onChange={e => setIcsInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-[11px]"
              />
              <button
                onClick={connectCalendar}
                disabled={busy === "cal" || !icsInput.trim()}
                className="rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4A1010] disabled:opacity-40"
              >
                {busy === "cal" ? t("Checking…") : t("Connect")}
              </button>
            </div>
          </div>
        )}

        {cal?.connected && cal.error && <p className="text-[11px] text-red-700">{cal.error}</p>}

        {cal?.connected && !cal.error && calView === "list" && cal.events.length === 0 && (
          <p className="text-xs text-slate-500">{t("Nothing in the diary for the next six months.")}</p>
        )}

        {cal?.connected && calView === "list" && cal.events.map((e: any) => {
          const d = new Date(`${e.start}${e.allDay ? "T00:00" : ""}`);
          const days = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86400000);
          return (
            <div key={e.uid} className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${calColour(e.calendar)}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-900">{e.summary}</p>
                <p className="text-[11px] text-slate-500">
                  {whenLabel(e)}{e.location ? ` · ${e.location}` : ""}
                  {(cal?.calendars || []).length > 1 && e.calendar ? ` · ${e.calendar}` : ""}
                </p>
              </div>
              {/* A multi-week project block started before today but is still running —
                  "-111d" would be nonsense, so say what it actually is. */}
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {days < 0 ? t("ongoing") : days === 0 ? t("today") : days === 1 ? t("tomorrow") : `${days}d`}
              </span>
            </div>
          );
        })}
      </div>}

      {me && (
        <div className="rounded-xl border border-[#E23B3B]/25 bg-gradient-to-br from-[#E23B3B]/[0.04] to-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="h-4 w-4 text-[#8f2020]" /> {t("My papers — personnel file")}
            </h3>
            <span className="rounded-full bg-[#E23B3B]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#8f2020]">
              {t("Restricted: you, HR / Payroll, Executive Director")}
            </span>
          </div>

          {myPapers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">{t("Nothing on file yet. Add your passport, ID or CV below.")}</p>
          ) : (
            <div className="mt-2">
              {myPapers.map(d => (
                <button
                  key={d.id}
                  onClick={() => openDoc(d)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 py-2 text-left last:border-0 hover:bg-white/70"
                >
                  <span className="w-36 shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#8f2020]">{d.category}</span>
                  <span className="flex-1 truncate text-[13px] text-slate-800">{d.filename}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">{d.refNo}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
            <select
              value={upCat}
              onChange={e => setUpCat(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              {PERSONNEL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPaper(f); }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy === "upload"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4A1010] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {busy === "upload" ? t("Filing…") : t("Add document")}
            </button>
            <p className="text-[10px] text-slate-500">
              {t("Filed to the vault under")} {`PERSONNEL / ${me.name}.`} {t("Never leaves this machine.")}
            </p>
          </div>
        </div>
      )}

      {/* Done tasks leave the list above but not the register. Kept collapsed so the desk
          stays about what is outstanding, and one click puts anything back. */}
      {isDirector && (state.complianceTasks || []).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <button
            onClick={() => setShowDone(v => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t("Done")}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{done.length}</span>
            </h3>
            <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${showDone ? "rotate-90" : ""}`} />
          </button>

          {showDone && (
            <div className="mt-2">
              {done.length === 0 && <p className="text-xs text-slate-500">{t("Nothing ticked off yet.")}</p>}
              {done.map(x => (
                <div key={x.id} className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-500 line-through decoration-slate-300">{x.title}</p>
                  <button
                    onClick={() => setDone(x.id, x.title, false)}
                    disabled={busy === x.id}
                    className="shrink-0 rounded-lg border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:border-[#6D1A1A] hover:text-[#6D1A1A] disabled:opacity-50"
                  >
                    <Undo2 className="mr-1 inline h-3 w-3" /> {t("Reopen")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
