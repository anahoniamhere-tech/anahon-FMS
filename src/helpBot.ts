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
import { ALL_ROLES, roleLabel } from "./roles";

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
  `Role in force: ${roleLabel(a.role)}${a.role !== a.ownRole ? ` (they are a ${roleLabel(a.ownRole)} standing in for the ${roleLabel(a.role)} seat — answer for the seat they are wearing)` : ""}`,
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
- When they ask about something on their desk, answer from the rows listed above — those are their actual rows. If nothing there matches what they describe, say so plainly in your first sentence ("nothing on your desk is in that state right now") and stop. Do not explain what the status would have meant as though the row were there: they asked about their desk, not about the rule.
- When a door would take them to the answer, put its navKey in "door" — but only a navKey from the list of doors they can open. Otherwise "door" must be null. Never invent a navKey.
- "mydesk" is a destination only for a question about the desk as a whole. For a question about one record, the door is the one that record opens — they are already looking at their desk, so sending them back to it helps nobody.
- When the material above does not answer it, say so in one sentence and name the seat to ask (from the role list) in "askSeat". Do not guess, do not reason from what systems usually do, and do not describe a screen or a button that is not written down above. This holds for the policy manual too: "that is not in the policies" is a complete and correct answer, and far better than an answer built from what such a policy usually says.
- When you answer from the policies, cite the policy by its number, as it is written in the chapter heading — "Policy 020, Section 7.2". The number is what the software enforces and what a staff member can ask about again, so it must survive in every answer even though the number no longer names its own file. You may also say which handbook carries that chapter — "Policy 020, in the Finance and Controls Handbook" — but the number is the citation; the handbook name is only ever in addition to it.
- **Each handbook opens with an "Editor's note" recording where its own wording does not yet match how AnaHon works** — a seat that is vacant, a committee that does not exist, a recipient still to be named, a target never set. This is part of the text now, not a separate warning: when a question touches something a note flags, give the policy's own rule first — that is still what governs — and then say plainly, in your own words, that the note flags it as open. Do not present the note as if it overrode the rule, and do not raise a note the question did not touch.
- Never state or invent a record's title, vendor, amount or reference — you have not been given them, by design. Speak about a row by its kind, status and date only.
- Reply in the same language the question is written in: English question, English answer; Arabic question, Arabic answer.

Reply as JSON only: {"answer": "...", "door": "navKey or null", "askSeat": "role name or null"}`;

/* ── Selecting the live policy text ──────────────────────────────────────────
 * 12 Sep 2026, twice in one day. First the nineteen numbered policy files were compiled
 * into six handbook documents that quoted the same text a second time — fixed by reading
 * only the numbered files and excerpting the handbooks' editor's notes. Then AnaHon
 * retired the numbered files for real: they moved to vault/GENERAL/Handbooks/Superseded/
 * and the five compiled documents (six counting the index, seven counting Policy 010,
 * which stands alone) became the only governing text. The first fix now had it backwards
 * — it would have read the retired copies and skipped the ones actually in force.
 *
 * So the filter is not "is this a compilation" any more, it is "is this retired" — read
 * from the record's own pointer (`AppDoc.base64`, a `file://` path), never a filename
 * guess, and true regardless of which folder a future reorganisation uses for "current"
 * as long as retired copies keep moving to one named "Superseded". A live document is
 * ingested whole, editor's note and all: the note is no longer a separate excerpt sitting
 * beside a numbered original, it is simply where the document's own text says the wording
 * is unsettled, and the bot may quote it like any other paragraph.
 */

/** True for a document's own pointer once it has been moved to Superseded — it no longer governs. */
export const isSupersededPointer = (pointer: string): boolean => pointer.includes("/Superseded/");

/** A document's heading in the prompt, from its filename. */
export const policyHeading = (filename: string): string =>
  filename.replace(/\.(docx|pdf)$/i, "").replace(/_/g, " ");

export function helpPrompt(question: string, a: Asker, policies = ""): string {
  // `policies` is the live handbooks (and Policy 010, which sits outside all of them),
  // each ingested whole — editor's notes included, since those are now simply part of the
  // document's own text rather than a separate excerpt. Quoted rather than paraphrased,
  // and it sits after the system's own tables — see RULES_FOR_THE_BOT.
  const manual = policies.trim()
    ? `## The policies — AnaHon's live handbooks, in full\n${policies.trim()}`
    : "";
  return [corpus(), manual, askerBlock(a), RULES_FOR_THE_BOT, `## The question\n${question}`]
    .filter(Boolean).join("\n\n");
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
