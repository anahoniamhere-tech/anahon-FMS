/**
 * The desk as a calendar feed.
 *
 * One all-day event per dated item that is somebody's turn, so a phone that subscribes
 * shows the same answer the desk shows. Pure text: no I/O, no clock — the caller passes
 * the items and the stamp, so scripts/check-desk-ics.ts can read every line back.
 */
import type { DeskItem } from "./workflow";

const esc = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const day = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => new Date(new Date(`${d}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, "");
/** RFC 5545 caps a line at 75 octets; continuations start with one space. */
const fold = (line: string) => line.match(/.{1,73}/g)?.join("\r\n ") ?? line;

export function deskIcs(personName: string, items: DeskItem[], stamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AnaHon//Desk//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`AnaHon — ${personName}`)}`,
    "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const i of items) {
    if (!i.when || !/^\d{4}-\d{2}-\d{2}$/.test(i.when)) continue;   // undated work is not a calendar entry
    lines.push(
      "BEGIN:VEVENT",
      // Stable per item, so an edited event updates in place instead of duplicating.
      `UID:desk-${i.id.replace(/[^A-Za-z0-9:_-]/g, "-")}@anahon`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(i.when)}`,
      `DTEND;VALUE=DATE:${nextDay(i.when)}`,
      fold(`SUMMARY:${esc(`${i.verb}: ${i.title}`)}`),
      fold(`DESCRIPTION:${esc([`Status: ${i.status}`, i.seats.length ? `Seat: ${i.seats.join(", ")}` : "", "Open it in the system to act."].filter(Boolean).join("\n"))}`),
      `CATEGORIES:${esc(i.door)}`,
      i.urgency === "overdue" ? "PRIORITY:1" : "PRIORITY:5",
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
