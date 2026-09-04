import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Plane, CheckCircle2, AlertTriangle, Clock, FileText, Lock, Upload, ChevronRight, Undo2 } from "lucide-react";
import { SharedProps } from "./shared";
import { PERSONNEL_CATEGORIES, isPersonnelDoc } from "../personnelDocs";

/**
 * My Desk — the Executive Director's own view of the system.
 *
 * Everything here already exists elsewhere in the app; this tab answers one question the
 * other tabs cannot: "what does Saad personally have to do, and by when". It is read-mostly,
 * with the single write the register already supports (mark a task done), so nothing new can
 * go wrong in the books from this screen.
 */
export default function MyDeskTab({ state, currentUser, formatUSD, refreshState, triggerToast, handleNavClick, openDoc }: SharedProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [upCat, setUpCat] = useState<string>("CV");
  const fileRef = useRef<HTMLInputElement>(null);
  // Task ids whose full note is showing. Several tasks carry a page of context each, so
  // the desk reads as a list by default and opens one on demand rather than all at once.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // The task ticked most recently this session, so a mis-click has an undo in reach
  // instead of vanishing from the list.
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
  const toggleNote = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayIso = iso(today);
  const daysTo = (d: string) => Math.round((new Date(d + "T00:00:00").getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86400000);

  const open = useMemo(
    () => (state.complianceTasks || []).filter(t => t.status !== "Done").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.complianceTasks]
  );
  const done = useMemo(
    () => (state.complianceTasks || []).filter(t => t.status === "Done").sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [state.complianceTasks]
  );
  // Two trips are in the air at once and both file their steps under category "Travel", so
  // the category alone counted Istanbul's steps as Brussels progress. The id prefix is what
  // actually separates them.
  const brussels = useMemo(
    () => (state.complianceTasks || [])
      .filter(t => (t.category as string) === "Travel" && /^tr-bru/.test(String(t.id)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.complianceTasks]
  );
  const brusselsDone = brussels.filter(t => t.status === "Done").length;
  const brusselsOpen = brussels.filter(t => t.status !== "Done");

  const overdue = open.filter(t => daysTo(t.dueDate) < 0);
  const soon = open.filter(t => daysTo(t.dueDate) >= 0 && daysTo(t.dueDate) <= 7);
  const later = open.filter(t => daysTo(t.dueDate) > 7);

  // Editorial work that names this user personally — author or independent fact-checker.
  const mine = (state.contentItems || []).filter(
    c => c.status !== "Published" && (c.assigneeUserId === currentUser?.id || c.factCheckerUserId === currentUser?.id)
  );

  const apptIn = daysTo("2026-09-02");    // TLScontact Beirut, booked 2 Sep 11:00
  const flyIn = daysTo("2026-09-30");     // departure for Brussels

  /** Tick a task, or put it back. Both directions go through here so the two can never
   *  drift apart, and both leave their own line in the audit trail. */
  const setDone = async (taskId: string, title: string, done: boolean) => {
    setBusy(taskId);
    try {
      const r = await fetch(`/api/compliance/${done ? "complete" : "reopen"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, user: currentUser }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not update the task.");
      setJustDone(done ? { id: taskId, title } : null);
      triggerToast(done ? `Done: ${title.slice(0, 44)} — undo below` : `Reopened: ${title.slice(0, 44)}`);
      await refreshState();
    } catch (e: any) {
      triggerToast(e.message);
    } finally {
      setBusy(null);
    }
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
  useEffect(() => { loadCalendar(); }, []);

  const connectCalendar = async () => {
    setBusy("cal");
    try {
      const r = await fetch("/api/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: icsInput.trim(), label: icsLabel.trim(), user: currentUser }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not connect the calendar.");
      setIcsInput(""); setIcsLabel(""); setAddingCal(false);
      triggerToast(`Calendar connected — read-only. ${(d.calendars || []).length} now feeding the desk.`);
      await loadCalendar();
    } catch (e: any) {
      triggerToast(e.message);
    } finally {
      setBusy(null);
    }
  };

  /** Notes longer than this are worth a click; anything shorter reads fine inline and
   *  collapsing it would only add a control for no gain. */
  const NOTE_PREVIEW = 150;

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
    return e.allDay ? `${day} · all day` : `${day} · ${e.start.slice(11)}`;
  };

  /* ── Month grid ──────────────────────────────────────────────────────────────────
   * One surface for both halves of the question "what is coming up": diary entries from
   * Google, and the deadlines the register already tracks. They are different kinds of
   * thing — an appointment happens to you, a task is owed by you — so they keep distinct
   * colours rather than being merged into one undifferentiated list of "items".
   */
  type DayItem = { kind: "event" | "task"; id: string; label: string; time?: string; tone: string; task?: any; calendar?: string };

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
    for (const t of open) {
      const d = daysTo(t.dueDate);
      push(t.dueDate, {
        kind: "task", id: t.id, label: t.title, task: t,
        tone: d < 0 ? "bg-[#E23B3B]" : d <= 7 ? "bg-[#F88888]" : "bg-slate-400",
      });
    }
    return m;
  }, [cal, open]);

  const monthCursor = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset, todayIso]);

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

  const row = (t: any) => {
    const d = daysTo(t.dueDate);
    const tone = d < 0 ? "text-red-700 bg-red-50 border-red-200" : d <= 2 ? "text-amber-800 bg-amber-50 border-amber-200" : "text-slate-600 bg-slate-50 border-slate-200";
    const notes = String(t.notes || "");
    const long = notes.length > NOTE_PREVIEW;
    const isOpen = expanded.has(t.id);
    // The row itself is the control — click anywhere on it to open the full note, click
    // again to close. The tick button sits inside it, so it stops the click from
    // bubbling; otherwise marking a task done would also toggle the note underneath it.
    return (
      <div
        key={t.id}
        onClick={() => long && toggleNote(t.id)}
        role={long ? "button" : undefined}
        tabIndex={long ? 0 : undefined}
        onKeyDown={e => { if (long && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleNote(t.id); } }}
        className={`flex items-start gap-3 rounded-lg border-b border-slate-100 px-1 py-2.5 last:border-0 ${long ? "cursor-pointer hover:bg-slate-50" : ""} ${isOpen ? "bg-slate-50" : ""}`}
      >
        <button
          onClick={e => { e.stopPropagation(); setDone(t.id, t.title, true); }}
          disabled={busy === t.id}
          title="Mark done"
          className="mt-0.5 shrink-0 rounded-full border border-slate-300 p-1 hover:border-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-slate-900">
            {t.title}
            {long && (
              <ChevronRight className={`ml-1 inline h-3 w-3 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            )}
          </p>
          {notes && (
            <p className={`mt-0.5 text-[11px] leading-relaxed text-slate-500 ${isOpen ? "whitespace-pre-line" : ""}`}>
              {long && !isOpen ? `${notes.slice(0, NOTE_PREVIEW).trimEnd()}…` : notes}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>
          {d < 0 ? `${Math.abs(d)}d late` : d === 0 ? "today" : `${d}d`}
        </span>
      </div>
    );
  };

  // Brand palette: Maroon #6D1A1A, Maroon Dark #4A1010, Signal Red #E23B3B, Coral #F88888.
  // Colour carries meaning here — red only when something is actually late.
  const TONES: Record<string, { bar: string; value: string; chip: string }> = {
    red:    { bar: "bg-[#E23B3B]", value: "text-[#E23B3B]", chip: "bg-[#E23B3B]/10 text-[#8f2020]" },
    coral:  { bar: "bg-[#F88888]", value: "text-[#b8474a]", chip: "bg-[#F88888]/20 text-[#8f2020]" },
    maroon: { bar: "bg-[#6D1A1A]", value: "text-[#6D1A1A]", chip: "bg-[#6D1A1A]/10 text-[#4A1010]" },
    ink:    { bar: "bg-[#0B0B0B]", value: "text-[#1a1212]", chip: "bg-slate-200 text-slate-700" },
  };

  const Card = ({ label, value, sub, tone = "maroon", icon }: { label: string; value: string; sub?: string; tone?: string; icon?: any }) => {
    const c = TONES[tone] || TONES.maroon;
    const Icon = icon;
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#E6D3CA] bg-white p-3.5 shadow-sm">
        <div className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          {Icon && <span className={`rounded-full p-1 ${c.chip}`}><Icon className="h-3 w-3" /></span>}
        </div>
        <p className={`mt-1.5 text-2xl font-bold leading-none ${c.value}`}>{value}</p>
        {sub && <p className="mt-1 text-[10px] text-slate-500">{sub}</p>}
      </div>
    );
  };

  const cash = (state.bankAccounts || []).filter(a => a.type === "Bank").reduce((s, a) => s + (a.balance || 0), 0);

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
      if (!r.ok) throw new Error(d.error || "Upload failed.");
      triggerToast(d.duplicate ? "Already on file — no second copy made." : `${upCat} filed to your personnel file.`);
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
              <h2 className="text-lg font-bold leading-tight">{currentUser?.name || "My Desk"}</h2>
              <p className="text-[11px] text-white/70">
                {currentUser?.role} · {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {overdue.length > 0 && (
              <span className="rounded-full bg-[#E23B3B] px-3 py-1 text-[11px] font-bold shadow">
                {overdue.length} overdue
              </span>
            )}
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide">
              {brussels.length > 0 ? `BRUSSELS IN ${flyIn}D` : "ON TRACK"}
            </span>
          </div>
        </div>
      </div>

      {justDone && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="min-w-0 text-[12px] text-emerald-900">
            <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
            Marked done: <span className="font-semibold">{justDone.title}</span>
          </p>
          <button
            onClick={() => setDone(justDone.id, justDone.title, false)}
            disabled={busy === justDone.id}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Undo2 className="mr-1 inline h-3 w-3" /> Undo
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Overdue" value={String(overdue.length)} sub="needs action now" tone={overdue.length ? "red" : "ink"} icon={AlertTriangle} />
        <Card label="Due this week" value={String(soon.length)} sub="next 7 days" tone={soon.length ? "coral" : "ink"} icon={Clock} />
        <Card label="Open in total" value={String(open.length)} sub={`${(state.complianceTasks || []).length} registered`} tone="maroon" icon={CalendarDays} />
        <Card label="Bank" value={formatUSD(cash)} sub="across bank accounts" tone="ink" icon={FileText} />
      </div>

      {brussels.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-red-900">
              <Plane className="h-4 w-4" /> Brussels visa — everything due at the TLScontact counter
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className={apptIn < 7 ? "text-red-700" : "text-slate-600"}>TLScontact 2 Sep 11:00 · {apptIn}d</span>
              <span className="text-slate-500">departure · {flyIn}d</span>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-red-100">
            <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${(brusselsDone / brussels.length) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-600">{brusselsDone} of {brussels.length} steps complete · {brusselsOpen.length} still open</p>
          {/* Every open step, not a preview: this is the list he works down before 2 September,
              and a truncated checklist is worse than none. */}
          <div className="mt-2">
            {brusselsOpen.map(row)}
          </div>
        </div>
      )}

      {/* Calendar — what is actually in the diary, next to what is on the checklist.
          Read-only: the feed cannot be written to, so nothing here can change the real calendar. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <CalendarDays className="h-4 w-4 text-[#6D1A1A]" /> Calendar
          </h3>
          {cal?.connected && (
            <div className="flex flex-wrap items-center gap-2">
              {(cal.calendars || []).map(name => (
                <span key={name} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${calColour(name)}`} /> {name}
                </span>
              ))}
              <button
                onClick={() => setAddingCal(v => !v)}
                className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:border-[#6D1A1A] hover:text-[#6D1A1A]"
              >
                + calendar
              </button>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">read-only</span>
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                {(["month", "list"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCalView(v)}
                    className={`px-2.5 py-1 text-[11px] font-bold capitalize ${calView === v ? "bg-[#6D1A1A] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {v}
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
                <div key={d} className="bg-slate-50 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">{d}</div>
              ))}
              {monthGrid.flat().map((d, i) => {
                if (!d) return <div key={`b${i}`} className="min-h-[62px] bg-slate-50/60" />;
                const key = isoOf(d);
                const items = byDay.get(key) || [];
                const isToday = key === todayIso;
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
                      {items.slice(0, 4).map(it => (
                        <span key={it.id} title={it.label} className={`h-1.5 w-1.5 rounded-full ${it.tone}`} />
                      ))}
                      {items.length > 4 && <span className="text-[8px] font-bold text-slate-400">+{items.length - 4}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
              {(cal?.calendars || []).map(name => (
                <span key={name} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${calColour(name)}`} /> {name}</span>
              ))}
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#E23B3B]" /> overdue</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F88888]" /> due this week</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> later</span>
            </div>

            {pickedDay && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  {new Date(`${pickedDay}T00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {(byDay.get(pickedDay) || []).length === 0 && <p className="text-xs text-slate-400">Nothing on this day.</p>}
                {(byDay.get(pickedDay) || []).map(it => (
                  <div key={it.id} className="flex items-start gap-2 border-b border-slate-200 py-1.5 last:border-0">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${it.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-snug text-slate-800">{it.label}</p>
                      <p className="text-[10px] text-slate-500">
                        {it.kind === "event"
                          ? `${it.calendar || "Diary"}${it.time ? ` · ${it.time}` : " · all day"}`
                          : "Task due"}
                      </p>
                    </div>
                    {it.kind === "task" && (
                      <button
                        onClick={() => setDone(it.task.id, it.task.title, true)}
                        disabled={busy === it.task.id}
                        title="Mark done"
                        className="shrink-0 rounded-full border border-slate-300 p-1 hover:border-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!cal && <p className="text-xs text-slate-400">Loading…</p>}

        {cal && (!cal.connected || addingCal) && (
          <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] leading-relaxed text-slate-600">
              Paste the <span className="font-semibold">secret address in iCal format</span> from Google Calendar
              (Settings → your calendar → Integrate calendar). It is held on this machine only, never shown again,
              and never sent to the browser. The feed is read-only — nothing here can alter your calendar.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={icsLabel}
                onChange={e => setIcsLabel(e.target.value)}
                placeholder="Name (e.g. Fellowship)"
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
                {busy === "cal" ? "Checking…" : "Connect"}
              </button>
            </div>
          </div>
        )}

        {cal?.connected && cal.error && <p className="text-[11px] text-red-700">{cal.error}</p>}

        {cal?.connected && !cal.error && calView === "list" && cal.events.length === 0 && (
          <p className="text-xs text-slate-500">Nothing in the diary for the next six months.</p>
        )}

        {cal?.connected && calView === "list" && cal.events.map((e: any) => {
          const d = new Date(`${e.start}${e.allDay ? "T00:00" : ""}`);
          const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
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
                {days < 0 ? "ongoing" : days === 0 ? "today" : days === 1 ? "tomorrow" : `${days}d`}
              </span>
            </div>
          );
        })}
      </div>

      {(overdue.length > 0 || soon.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Needs you now
          </h3>
          {[...overdue, ...soon].map(row)}
        </div>
      )}

      {mine.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileText className="h-4 w-4 text-slate-500" /> Editorial work in your name
          </h3>
          {mine.map(c => (
            <button
              key={c.id}
              onClick={() => handleNavClick("editorial")}
              className="flex w-full items-center justify-between border-b border-slate-100 py-2 text-left last:border-0 hover:bg-slate-50"
            >
              <span className="text-[13px] text-slate-800">{c.title}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{c.status}</span>
            </button>
          ))}
        </div>
      )}

      {me && (
        <div className="rounded-xl border border-[#E23B3B]/25 bg-gradient-to-br from-[#E23B3B]/[0.04] to-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="h-4 w-4 text-[#8f2020]" /> My papers — personnel file
            </h3>
            <span className="rounded-full bg-[#E23B3B]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#8f2020]">
              RESTRICTED · you, HR / Payroll, Executive Director
            </span>
          </div>

          {myPapers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Nothing on file yet. Add your passport, ID or CV below.</p>
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
              <Upload className="h-3.5 w-3.5" /> {busy === "upload" ? "Filing…" : "Add document"}
            </button>
            <p className="text-[10px] text-slate-500">
              Filed to the vault under PERSONNEL / {me.name}. Never leaves this machine.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
          <CalendarDays className="h-4 w-4 text-slate-500" /> Later
        </h3>
        {later.length === 0 && <p className="text-xs text-slate-500">Nothing scheduled beyond this week.</p>}
        {later.slice(0, 12).map(row)}
        {later.length > 12 && (
          <button onClick={() => handleNavClick("compliance")} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-red-700 hover:underline">
            <Clock className="h-3 w-3" /> {later.length - 12} more in the Compliance Control Desk
          </button>
        )}
      </div>

      {/* Done tasks leave the list above but not the register. Kept collapsed so the desk
          stays about what is outstanding, and one click puts anything back. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <button
          onClick={() => setShowDone(v => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Done
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{done.length}</span>
          </h3>
          <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${showDone ? "rotate-90" : ""}`} />
        </button>

        {showDone && (
          <div className="mt-2">
            {done.length === 0 && <p className="text-xs text-slate-500">Nothing ticked off yet.</p>}
            {done.map(t => (
              <div key={t.id} className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-500 line-through decoration-slate-300">{t.title}</p>
                <button
                  onClick={() => setDone(t.id, t.title, false)}
                  disabled={busy === t.id}
                  className="shrink-0 rounded-lg border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:border-[#6D1A1A] hover:text-[#6D1A1A] disabled:opacity-50"
                >
                  <Undo2 className="mr-1 inline h-3 w-3" /> Reopen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
