/**
 * A small iCalendar (RFC 5545) reader — enough of the spec to render a personal Google
 * Calendar feed, and no more.
 *
 * Why hand-rolled: the app has no calendar dependency and this needs ~150 lines. What it
 * deliberately does NOT do is listed under "ceiling" below, so nobody assumes it is a
 * full implementation.
 *
 * ponytail: no VTIMEZONE database. Times carrying a TZID are read as wall-clock in the
 * viewer's own zone, and only trailing-Z times are converted from UTC. For a Beirut user
 * reading a Beirut calendar this is exact; for an event pinned to another zone it can be
 * off by the offset. Swap in a tz library if the desk ever shows other people's calendars.
 * ponytail: RRULE covers DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY
 * and EXDATE — the shapes Google Calendar actually emits for personal events. BYSETPOS,
 * BYMONTHDAY and RDATE are ignored; such a series yields only its first occurrence.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  location: string;
  description: string;
  start: string;   // ISO local, "2026-08-24T09:00" — or "2026-08-24" when all-day
  end: string;
  allDay: boolean;
}

/** RFC 5545 §3.1: a CRLF followed by a space or tab is a line continuation, not a break. */
function unfold(raw: string): string[] {
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = (d: Date) => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Parse a DTSTART/DTEND value into a Date plus whether it is a date-only (all-day) value. */
function parseWhen(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  const dateOnly = params.VALUE === "DATE" || /^\d{8}$/.test(v);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (dateOnly) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  if (z) {
    // UTC instant — let the runtime put it in the viewer's local zone.
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +(ss || 0))), allDay: false };
  }
  // Floating or TZID-qualified: read the digits as local wall-clock time (see ceiling).
  return { date: new Date(+y, +mo - 1, +d, +hh, +mm, +(ss || 0)), allDay: false };
}

interface RawProp { name: string; params: Record<string, string>; value: string }

function parseLine(line: string): RawProp | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Expand a recurrence rule into start dates, bounded by `horizon` and a hard cap. */
function expand(start: Date, rrule: string, exdates: Set<string>, horizon: Date): Date[] {
  const r: Record<string, string> = {};
  for (const kv of rrule.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) r[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
  }
  const freq = (r.FREQ || "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return [start];

  const interval = Math.max(1, parseInt(r.INTERVAL || "1", 10));
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  const until = r.UNTIL ? parseWhen(r.UNTIL, {})?.date : undefined;
  const byday = (r.BYDAY || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const wanted = new Set(byday.map(b => DAY_CODES.indexOf(b.replace(/^[+-]?\d+/, ""))).filter(i => i >= 0));

  const out: Date[] = [];
  // COUNT bounds the occurrences the RULE generates, not the ones that survive: an
  // EXDATE cancels one of the N, it does not pull an extra one in from beyond the series.
  let generated = 0;
  const cur = new Date(start);
  // 750 iterations covers ~2 years of daily events; the horizon normally stops it far sooner.
  for (let i = 0; i < 750 && generated < count; i++) {
    if (cur > horizon) break;
    if (until && cur > until) break;

    const emit = (d: Date) => {
      if (generated >= count) return;
      if (until && d > until) return;
      if (d > horizon) return;
      generated++;
      if (exdates.has(fmtDate(d))) return;
      out.push(new Date(d));
    };

    if (freq === "WEEKLY" && wanted.size) {
      // Walk the seven days of this week and take the ones the rule names.
      const weekStart = new Date(cur);
      weekStart.setDate(cur.getDate() - cur.getDay());
      for (let k = 0; k < 7; k++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + k);
        d.setHours(start.getHours(), start.getMinutes(), 0, 0);
        if (wanted.has(d.getDay()) && d >= start) emit(d);
      }
    } else {
      emit(cur);
    }

    if (freq === "DAILY") cur.setDate(cur.getDate() + interval);
    else if (freq === "WEEKLY") cur.setDate(cur.getDate() + 7 * interval);
    else if (freq === "MONTHLY") cur.setMonth(cur.getMonth() + interval);
    else cur.setFullYear(cur.getFullYear() + interval);
  }
  return out;
}

/**
 * Parse an .ics document into concrete, dated events between `from` and `to`.
 * Recurring series are expanded; cancelled instances (EXDATE) are dropped.
 */
export function parseIcs(raw: string, from: Date, to: Date): IcsEvent[] {
  const lines = unfold(raw);
  const events: IcsEvent[] = [];
  let cur: RawProp[] | null = null;

  for (const line of lines) {
    const t = line.trim();
    if (t === "BEGIN:VEVENT") { cur = []; continue; }
    if (t === "END:VEVENT") {
      if (cur) events.push(...buildEvents(cur, from, to));
      cur = null;
      continue;
    }
    if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

function buildEvents(props: RawProp[], from: Date, to: Date): IcsEvent[] {
  const get = (n: string) => props.find(p => p.name === n);
  const dtstart = get("DTSTART");
  if (!dtstart) return [];
  const s = parseWhen(dtstart.value, dtstart.params);
  if (!s) return [];

  const dtend = get("DTEND");
  const e = dtend ? parseWhen(dtend.value, dtend.params) : null;
  const durationMs = e ? Math.max(0, e.date.getTime() - s.date.getTime()) : (s.allDay ? 86400000 : 3600000);

  const status = get("STATUS")?.value?.toUpperCase();
  if (status === "CANCELLED") return [];

  const exdates = new Set<string>();
  for (const p of props.filter(p => p.name === "EXDATE")) {
    for (const v of p.value.split(",")) {
      const d = parseWhen(v, p.params);
      if (d) exdates.add(fmtDate(d.date));
    }
  }

  const rrule = get("RRULE")?.value;
  const starts = rrule ? expand(s.date, rrule, exdates, to) : [s.date];

  const uid = get("UID")?.value || "";
  const summary = unescapeText(get("SUMMARY")?.value || "(no title)");
  const location = unescapeText(get("LOCATION")?.value || "");
  const description = unescapeText(get("DESCRIPTION")?.value || "");

  const out: IcsEvent[] = [];
  for (const st of starts) {
    const en = new Date(st.getTime() + durationMs);
    if (en < from || st > to) continue;
    out.push({
      uid: `${uid}:${st.getTime()}`,
      summary, location, description,
      allDay: s.allDay,
      start: s.allDay ? fmtDate(st) : fmtDateTime(st),
      end: s.allDay ? fmtDate(en) : fmtDateTime(en),
    });
  }
  return out;
}
