/**
 * The help bot's grounding — one prompt, no retrieval.
 *
 * Staff ask four kinds of question: what the Q&A already answers, where to find
 * something, what they personally are allowed to do, and what an unclear row on their
 * desk means. Every one of those is already written down somewhere in this repository,
 * and the whole of it is about 850 lines — small enough to hand the model in full, so
 * there is no index, no embedding and no store to keep in step with the code.
 *
 * Two rules this file exists to hold:
 *
 * 1. **The answer is for the person asking.** Permissions are read from gates.ts — the
 *    table that actually refuses the call — resolved for the role in force (the worn
 *    seat when standing in, else their own). The bot cannot drift from the system's
 *    real behaviour because it is reading the enforcement table, not a description.
 *
 * 2. **The desk rows leave out the record.** The provider is the Gemini free tier and
 *    Google trains on what is submitted (Saad's call, 5 Sep 2026), so a row goes out as
 *    kind, status, verb, door and date and nothing else — never the title, the vendor or
 *    the amount. "A payment request is waiting on you, three days late" is answerable
 *    from that; who it is payable to is not, and does not need to be.
 */
import { HELP } from "./help";
import { NAV, visibleNav } from "./nav";
import { RULES, type DeskItem } from "./workflow";
import { ROUTE_SEATS, ACTION_SEATS, ANY } from "./gates";
import { ALL_ROLES } from "./roles";

/** A desk row stripped to what a question can be answered from. Nothing identifying. */
export type SafeRow = { kind: string; status: string; verb: string; door: string; when: string | null };

/**
 * The projection that keeps the record out of the prompt. `title`, `record`, `recordId`
 * and `id` are dropped on purpose — scripts/check-helpbot.ts fails if they come back.
 */
export const safeRows = (items: DeskItem[]): SafeRow[] =>
  items.map(i => ({ kind: String(i.kind), status: i.status, verb: i.verb, door: i.door, when: i.when }));

const seatList = (seats: readonly string[]) =>
  seats === ANY || seats[0] === "*any" ? "any signed-in account" : seats.join(", ");

/** The four sources, rendered flat. Same order every call so the text is diffable. */
export function corpus(): string {
  const qa = HELP.map(h => `[${h.id}] (${h.area})\n  Q: ${h.q.en}\n  A: ${h.a.en}\n  س: ${h.q.ar}\n  ج: ${h.a.ar}`).join("\n");

  const doors = NAV.map(s =>
    `${s.section}${s.roles ? ` — section open to: ${s.roles.join(", ")}` : ""}\n` +
    s.items.map(i => `  ${i.navKey} = "${i.label}"${i.roles ? ` (roles: ${i.roles.join(", ")})` : ""}`).join("\n")
  ).join("\n");

  const desk = RULES.map(r =>
    `${String(r.kind)} / "${r.status}" → door ${r.door}, the holder ${r.verb || "(nothing — this row is closed)"}` +
    `${r.seat ? `, seat: ${r.seat.join(", ")}` : ""}${r.person ? `, or whoever is named in ${r.person}` : ""}` +
    `${r.when ? `, dated by ${r.when}` : ""}`
  ).join("\n");

  const routes = Object.entries(ROUTE_SEATS)
    .map(([path, seats]) => `${path}: ${seatList(seats)}`).join("\n");
  const steps = Object.entries(ACTION_SEATS).flatMap(([path, m]) =>
    Object.entries(m).map(([action, seats]) => `${path} — step "${action}": ${seatList(seats)}`)).join("\n");

  return [
    `## Roles in this system\n${ALL_ROLES.join(", ")}`,
    `## Questions and answers already written down (English then Arabic)\n${qa}`,
    `## Doors (screens). The navKey is on the left; a person only sees the doors their role allows.\n${doors}`,
    `## Desk rules — which record, in which status, lands on whose desk, behind which door\n${desk}`,
    `## Who may call what (this is the table that actually refuses the call)\n${routes}`,
    `## Steps within a route (a route listed here accepts only these steps)\n${steps}`,
  ].join("\n\n");
}

export type Asker = { role: string; ownRole: string; doors: string[]; rows: SafeRow[]; today: string };

/** The person asking, in the terms the corpus is written in. */
export const askerBlock = (a: Asker): string => [
  `## The person asking`,
  `Role in force: ${a.role}${a.role !== a.ownRole ? ` (they are a ${a.ownRole} standing in for the ${a.role} seat — answer for the seat they are wearing)` : ""}`,
  `Doors they can open, by navKey: ${a.doors.join(", ") || "(none)"}`,
  `Today is ${a.today}.`,
  a.rows.length
    ? `Rows on their desk right now (the record itself is deliberately not included — you know the kind, the status, what the holder does, the door and the date, and nothing more):\n` +
      a.rows.map(r => `  - ${r.kind} / "${r.status}" → ${r.verb}, door ${r.door}, due ${r.when || "no date"}`).join("\n")
    : `Their desk is empty right now.`,
].join("\n");

export const RULES_FOR_THE_BOT = `## How to answer
You are the help desk inside AnaHon's management system. Everything you know is above.
- Answer the person asking, for the role in force. "Can I approve this?" is a question about THEIR seat: check the route table and say yes or no plainly, and when it is no, name the seats that may.
- Keep it to a few sentences. No preamble, no restating the question.
- When a door would take them to the answer, put its navKey in "door" — but only a navKey from the list of doors they can open. Otherwise "door" must be null. Never invent a navKey.
- When the material above does not answer it, say so in one sentence and name the seat to ask (from the role list) in "askSeat". Do not guess, do not reason from what systems usually do, and do not describe a screen or a button that is not written down above.
- Never state or invent a record's title, vendor, amount or reference — you have not been given them, by design. Speak about a row by its kind, status and date only.
- Reply in the same language the question is written in: English question, English answer; Arabic question, Arabic answer.

Reply as JSON only: {"answer": "...", "door": "navKey or null", "askSeat": "role name or null"}`;

export function helpPrompt(question: string, a: Asker): string {
  return [corpus(), askerBlock(a), RULES_FOR_THE_BOT, `## The question\n${question}`].join("\n\n");
}

export const REPLY_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    door: { type: ["string", "null"] },
    askSeat: { type: ["string", "null"] },
  },
  required: ["answer"],
  additionalProperties: false,
};

/**
 * What the model sent back, made safe to render. A door it invented — or one this
 * person cannot open — is dropped rather than shown as a button that would bounce them.
 */
export function parseReply(raw: any, doors: string[]): { answer: string; door: string | null; askSeat: string | null } {
  const answer = String(raw?.answer || "").trim();
  const door = typeof raw?.door === "string" && doors.includes(raw.door) ? raw.door : null;
  const askSeat = typeof raw?.askSeat === "string" && ALL_ROLES.includes(raw.askSeat) ? raw.askSeat : null;
  return { answer, door, askSeat };
}

/** The doors a role can open, as navKeys — the same reading the sidebar makes. */
export const doorsFor = (role: string): string[] =>
  visibleNav(role).flatMap(s => s.items.map(i => i.navKey));
