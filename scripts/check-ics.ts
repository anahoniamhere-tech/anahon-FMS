/**
 * Self-check for the iCalendar reader. Pure asserts on synthetic feeds — opens no DB,
 * makes no network call.
 *
 *   npx tsx scripts/check-ics.ts
 */
import assert from "assert";
import { parseIcs } from "../src/ics.js";

const FROM = new Date(2026, 7, 1);   // 1 Aug 2026
const TO = new Date(2026, 11, 31);   // 31 Dec 2026

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;

// 1. A timed event, with line folding and escaped text.
{
  const ics = wrap(
    "BEGIN:VEVENT\r\nUID:a1\r\nSUMMARY:Coaching session with Sabine\r\n" +
    "LOCATION:Tripoli\\, Lebanon\r\nDESCRIPTION:First of four sessions.\r\n Continues on the next line.\r\n" +
    "DTSTART:20260910T140000\r\nDTEND:20260910T153000\r\nEND:VEVENT"
  );
  const [e] = parseIcs(ics, FROM, TO);
  assert.equal(e.summary, "Coaching session with Sabine");
  assert.equal(e.location, "Tripoli, Lebanon", "escaped comma should unescape");
  assert.ok(e.description.includes("Continues on the next line."), "folded line should rejoin");
  assert.equal(e.start, "2026-09-10T14:00");
  assert.equal(e.end, "2026-09-10T15:30");
  assert.equal(e.allDay, false);
}

// 2. An all-day event keeps date-only values.
{
  const ics = wrap("BEGIN:VEVENT\r\nUID:a2\r\nSUMMARY:Brussels trip\r\nDTSTART;VALUE=DATE:20260930\r\nDTEND;VALUE=DATE:20261004\r\nEND:VEVENT");
  const [e] = parseIcs(ics, FROM, TO);
  assert.equal(e.allDay, true);
  assert.equal(e.start, "2026-09-30");
}

// 3. A weekly series bounded by COUNT yields exactly COUNT occurrences.
{
  const ics = wrap("BEGIN:VEVENT\r\nUID:a3\r\nSUMMARY:Weekly training\r\nDTSTART:20260903T100000\r\nDTEND:20260903T110000\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEND:VEVENT");
  const out = parseIcs(ics, FROM, TO);
  assert.equal(out.length, 4, `expected 4 occurrences, got ${out.length}`);
  assert.equal(out[0].start, "2026-09-03T10:00");
  assert.equal(out[3].start, "2026-09-24T10:00");
}

// 4. EXDATE removes a cancelled instance from the series.
{
  const ics = wrap("BEGIN:VEVENT\r\nUID:a4\r\nSUMMARY:Weekly training\r\nDTSTART:20260903T100000\r\nDTEND:20260903T110000\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE:20260910T100000\r\nEND:VEVENT");
  const out = parseIcs(ics, FROM, TO);
  assert.equal(out.length, 3, "the excluded date should be dropped");
  assert.ok(!out.some(e => e.start.startsWith("2026-09-10")), "10 Sep must not appear");
}

// 5. UNTIL stops the series.
{
  const ics = wrap("BEGIN:VEVENT\r\nUID:a5\r\nSUMMARY:Daily standup\r\nDTSTART:20260901T090000\r\nDTEND:20260901T091500\r\nRRULE:FREQ=DAILY;UNTIL=20260905T000000Z\r\nEND:VEVENT");
  const out = parseIcs(ics, FROM, TO);
  assert.ok(out.length >= 4 && out.length <= 5, `UNTIL should bound the series, got ${out.length}`);
  assert.ok(out.every(e => e.start <= "2026-09-05"), "nothing past UNTIL");
}

// 6. Cancelled events never surface.
{
  const ics = wrap("BEGIN:VEVENT\r\nUID:a6\r\nSUMMARY:Called off\r\nSTATUS:CANCELLED\r\nDTSTART:20260915T100000\r\nDTEND:20260915T110000\r\nEND:VEVENT");
  assert.equal(parseIcs(ics, FROM, TO).length, 0);
}

// 7. Events outside the window are filtered out.
{
  const ics = wrap("BEGIN:VEVENT\r\nUID:a7\r\nSUMMARY:Last year\r\nDTSTART:20250101T100000\r\nDTEND:20250101T110000\r\nEND:VEVENT");
  assert.equal(parseIcs(ics, FROM, TO).length, 0);
}

// 8. A malformed feed yields nothing rather than throwing.
{
  assert.equal(parseIcs("not a calendar at all", FROM, TO).length, 0);
  assert.equal(parseIcs(wrap("BEGIN:VEVENT\r\nUID:bad\r\nEND:VEVENT"), FROM, TO).length, 0, "no DTSTART = no event");
}

console.log("check-ics: all 8 checks passed");
