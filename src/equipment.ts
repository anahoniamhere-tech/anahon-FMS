import { EQUIPMENT_VERIFIERS, FINANCE } from "./roles";
/**
 * Receiving equipment — the rules the server enforces and the screen shows, in one place.
 *
 * The same pattern as receipts.ts and supplierDocs.ts: a number series and a permission
 * that the route and the button must never disagree about, so neither keeps its own copy.
 */

/** What is recorded when the item genuinely carries no serial — said, never invented. */
export const NO_SERIAL = "No serial on item";

export const CONDITIONS = ["Excellent", "Good", "Needs Repair", "Damaged"] as const;
export const CURRENCIES = ["USD", "EUR", "LBP"] as const;

/**
 * Who currently has an item — the three kinds this register knows. "employee" is drawn
 * from the FMS's user accounts (the same list the loan picker already used): the two are
 * treated as one person everywhere else in this app (a login is how an employee is named
 * here), so there is no separate personnel roster to keep in step with this one.
 */
export const HOLDER_KINDS = ["org", "employee", "vendor"] as const;
export type HolderKind = typeof HOLDER_KINDS[number];

/**
 * Where an item currently sits, when it is at the organisation rather than out on loan —
 * a short list because a long one is a form nobody reads, plus "other" for anything that
 * does not fit. Change the list here; nothing else names a place.
 */
export const EQUIPMENT_LOCATIONS = ["Tripoli office", "Studio", "Store cupboard"] as const;
/** The picker's escape hatch — never the literal value stored on the record. */
export const OTHER_LOCATION = "other";

/**
 * A place typed or chosen, resolved and validated in one place so the register form and
 * the check-in form cannot each invent a different rule for what a location is.
 */
export function resolveLocation(location: unknown, other: unknown): { ok: boolean; location: string; error: string } {
  const loc = String(location ?? "").trim();
  if (!loc) return { ok: false, location: "", error: "Say where it is kept." };
  if (loc === OTHER_LOCATION) {
    const custom = String(other ?? "").trim();
    if (!custom) return { ok: false, location: "", error: "Type where it is kept." };
    return { ok: true, location: custom, error: "" };
  }
  if (!(EQUIPMENT_LOCATIONS as readonly string[]).includes(loc)) return { ok: false, location: "", error: "Choose a place from the list, or \"Other\" to type one." };
  return { ok: true, location: loc, error: "" };
}

/**
 * What kind of thing this is, and how many years it depreciates over — Finance's policy,
 * not a guess made at the receiving desk. One place, so a number changes once and every
 * item that reads it agrees. Proposed 12 Sep 2026, pending Marwan's confirmation of the
 * years; the kinds themselves are not in question.
 *
 * "other" is the fallback for anything that does not fit, and it is also what an unknown
 * or missing kind resolves to — a save is never blocked for want of a category.
 */
export const EQUIPMENT_KINDS = [
  "camera", "lens", "audio", "lighting", "computer", "storage", "network", "furniture", "other",
] as const;
export type EquipmentKind = typeof EQUIPMENT_KINDS[number];
export const DEFAULT_KIND: EquipmentKind = "other";

export const USEFUL_LIFE_BY_KIND: Record<EquipmentKind, number> = {
  computer: 3,   // laptops, phones, tablets
  camera: 5,
  lens: 5,
  audio: 5,
  lighting: 5,
  storage: 4,    // drives, cards, NAS units
  network: 4,    // routers, switches, access points
  furniture: 7,
  other: 5,
};

/** A kind the form or the scan actually offered, or the fallback — never blank, never invented. */
export function normalizeKind(k: string | null | undefined): EquipmentKind {
  return (EQUIPMENT_KINDS as readonly string[]).includes(String(k)) ? (k as EquipmentKind) : DEFAULT_KIND;
}

/** Finance's policy figure for a kind — the number the form fills in and explains itself with. */
export function usefulLifeFor(kind: string | null | undefined): number {
  return USEFUL_LIFE_BY_KIND[normalizeKind(kind)];
}

/**
 * Only Finance may put a different number than the policy table on an item — the receiving
 * desk should not have to think about depreciation at all, so the choice is closed to
 * everyone else, not merely hidden. The same list that reviews withholding tax and posts
 * the ledger; equipment life is exactly that kind of figure.
 */
export function mayOverrideUsefulLife(viewer: { role?: string } | null | undefined): boolean {
  return FINANCE.includes(String(viewer?.role));
}

/** EQ-007 → 7; anything else → null. */
export function parseTag(tag: string | null | undefined): number | null {
  const m = /^EQ-(\d+)$/.exec(String(tag || "").trim());
  return m ? Number(m[1]) : null;
}

/**
 * The next sticker number: the highest tag already issued, plus one — the way the RC
 * receipt series numbers itself. Never a count of rows: a removed item must not free its
 * number, or two stickers in the office end up saying the same thing.
 */
export function nextEquipmentTag(tags: (string | null | undefined)[]): string {
  const highest = tags.reduce<number>((max, t) => Math.max(max, parseTag(t) ?? 0), 0);
  return `EQ-${String(highest + 1).padStart(3, "0")}`;
}

export type EquipmentStatus = "Registered" | "Received" | "Verified" | "Out";

/**
 * Out = somebody has it; otherwise Verified, Received or Registered by what has been
 * recorded. Derived in loadState and never stored: the desk keys its rules on it, and a
 * stored copy would be one more thing to disagree with the facts it is read from.
 */
export function equipmentStatus(a: { receivedAt?: string | null; verifiedAt?: string | null; holderId?: string | null }): EquipmentStatus {
  return a.holderId ? "Out" : a.verifiedAt ? "Verified" : a.receivedAt ? "Received" : "Registered";
}

/**
 * May this person, in the seat they hold right now, confirm this item physically?
 *
 * Two conditions, and the second is the one that bites. The seat must be a verifier's —
 * the keepers of the register (SUPPLIER_EDITORS) are not. And the PERSON must not be the
 * one who took delivery: the master account sits in both lists, and standing in another
 * seat changes the role, never the id, so one person wearing two hats is still one
 * person and cannot confirm their own receipt.
 */
export function mayVerifyEquipment(
  viewer: { id?: string; role?: string } | null | undefined,
  asset: { receivedBy?: string | null }
): boolean {
  if (!viewer?.id || !EQUIPMENT_VERIFIERS.includes(String(viewer.role))) return false;
  return !asset.receivedBy || asset.receivedBy !== viewer.id;
}

/**
 * Two serials name the same item when they match ignoring case, spaces and hyphens —
 * people type "ab-12 34" for "AB1234". The same item scanned twice is the commonest way a
 * register double-counts. "No serial on item" never matches anything, however many there are.
 */
export function sameSerial(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => String(s || "").toUpperCase().replace(/[\s-]+/g, "");
  const x = n(a);
  return !!x && x === n(b) && x !== n(NO_SERIAL);
}

/**
 * What a model — or a hurried person — writes when nothing is printed: "N/A", "unknown",
 * "generic", "-". Saved as a serial it is an invented serial by another name, so it counts
 * as blank wherever a serial, brand or model is read. The live scan on 11 Sep answered
 * "generic" for a brand it could not see; that is the case this exists for.
 */
export function blankIfPlaceholder(s: string | null | undefined): string {
  const t = String(s ?? "").trim();
  return /^(n\/?a|none|nil|null|unknown|generic|unbranded|not (visible|legible|printed|available)|-+|\?+|\.+)$/i.test(t) ? "" : t;
}

/* ── Phase 2: custody, the sticker, repairs, the periodic check ───────────────── */

/**
 * One entry in the item's custody timeline, oldest first — a resting assignment ("with
 * Ahmad, at the Tripoli office") or a loan ("with Ahmad, for the Beirut shoot, due back
 * Friday"), told apart by `dueBack`: null for a rest, a date for a loan. `outAt`/`outBy`
 * are when this state began and who recorded it; `inAt`/`inBy` are when it ended — closed
 * either by an actual return (`returnCondition`/`note` filled in) or simply superseded by
 * the next entry starting (a resting assignment ending because the item was checked out).
 * "Currently with / in" (12 Sep 2026) reads the LAST entry — see `currentMovement` — so
 * check-out and check-in are the only ways custody ever changes; nothing edits a field.
 */
export type Movement = {
  id: string; holderKind: HolderKind; holderId: string; location: string;
  heldFor: string; projectId: string;
  outAt: string; outBy: string; dueBack: string | null;
  inAt: string | null; inBy: string | null; returnCondition: string | null; note: string;
};

/**
 * The current custody state — who has it and where — is simply the last entry on the
 * item's own timeline; there is nothing else to derive it from. A row that predates this
 * design has no timeline at all (`movements` empty), and this returns null for it rather
 * than guessing — the caller falls back to whatever plain text its old columns still hold.
 */
export function currentMovement(a: { movements?: Movement[] }): Movement | null {
  const list = a.movements || [];
  return list.length ? list[list.length - 1] : null;
}
/**
 * Correcting a registered item (12 Sep 2026).
 *
 * A serial typed wrong, a name that says "camera" for a lens, a cost booked on the wrong
 * voucher: before this there was no way to fix any of it — the register had no edit at all,
 * and the only cure for a typo was a second row for an item that exists once.
 *
 * What a correction may touch is a description OF the item. What it may never touch is the
 * record itself: the sticker number (it is on the item, in the world), when it arrived and
 * who took delivery, who confirmed it and when, and the movement log. Those are what the
 * register is FOR — if they can be edited afterwards, none of them is evidence of anything.
 */
export const EDITABLE_FIELDS: { field: string; label: string }[] = [
  { field: "name", label: "Item" },
  { field: "brand", label: "Brand" },
  { field: "model", label: "Model" },
  { field: "specs", label: "Specifications" },
  { field: "kind", label: "What kind of equipment" },
  { field: "serialNumber", label: "Serial number" },
  { field: "condition", label: "Condition" },
  { field: "cost", label: "Cost" },
  { field: "currency", label: "Currency" },
  { field: "purchaseDate", label: "Bought on" },
  { field: "fundingProjectId", label: "Funded by project" },
  { field: "expenseId", label: "Bought on payment request" },
  { field: "usefulLifeYears", label: "Useful Life (Years)" },
];

/** Said in the interface, so the reason a field is greyed out is on the screen and not
 *  only in a refusal nobody sees until they try. */
export const LOCKED_FIELDS: { label: string; why: string }[] = [
  { label: "Sticker", why: "it is printed and stuck on the item" },
  { label: "Received by", why: "who took delivery, and when, is the record" },
  { label: "Confirmed by", why: "somebody's word that they saw it" },
  { label: "History", why: "every check-out and return, as it happened" },
];

/**
 * The fields a physical confirmation was ABOUT. Somebody stood in front of an item and said
 * this one, this state. Change the serial or the name afterwards and their word is about a
 * different item; change the condition and it is about a different state. So the
 * confirmation lapses and the item goes back to needing one — it is never silently kept.
 */
export const VERIFIED_FIELDS = ["name", "brand", "model", "kind", "serialNumber", "condition"];

/** What actually changed, in the register's own order, compared as text so 5 and "5" are
 *  the same number and a null is the same as a blank. */
export function equipmentChanges(
  before: Record<string, any>, after: Record<string, any>
): { field: string; label: string; from: string; to: string }[] {
  const out: { field: string; label: string; from: string; to: string }[] = [];
  for (const { field, label } of EDITABLE_FIELDS) {
    const from = String(before[field] ?? "");
    const to = String(after[field] ?? "");
    if (from !== to) out.push({ field, label, from, to });
  }
  return out;
}

/** Does this correction cost the item its confirmation? */
export function verificationLapses(changed: { field: string }[]): boolean {
  return changed.some(c => VERIFIED_FIELDS.includes(c.field));
}

/** One repair. It is an expense: it never changes the item's cost basis. */
export type Repair = {
  id: string; date: string; work: string; doneBy: string;
  cost: number; currency: string; expenseId: string; loggedBy: string; loggedAt: string;
};

/**
 * Why this item may not go out now, or null when it may. The route refuses with it and the
 * button carries it as its label, so the two cannot disagree. Something nobody has
 * confirmed is here cannot be lent, and an item already out has one holder, not two.
 */
export function checkOutBlocker(a: { holderId?: string | null; verifiedAt?: string | null }): "already out" | "not confirmed yet" | null {
  if (a.holderId) return "already out";
  if (!a.verifiedAt) return "not confirmed yet";
  return null;
}

/** How often an item is physically checked again, in months — 12 unless the verifier says otherwise. */
export const CHECK_EVERY_MONTHS = [6, 12, 24] as const;
export const DEFAULT_CHECK_MONTHS = 12;

/** Sticker sizes, as the QR's side in millimetres: 15 is a 2 × 2 cm sticker, 10 is for a small microphone. */
export const STICKER_SIZES = [10, 15, 20] as const;
export const DEFAULT_STICKER_MM = 15;
/** The test strip: one item at each size on one row, to find the smallest a phone still opens. */
export const STRIP_SIZES = [10, 12, 15, 20] as const;

/** The characters a QR code's alphanumeric mode carries. Anything else forces byte mode. */
export const QR_ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]+$/;

/**
 * What a sticker's QR carries: a short link, all in capitals —
 * HTTPS://ANAHON-1.TAILBCB2B7.TS.NET:8444/E/EQ-004. Capitals keep it inside the QR's
 * alphanumeric mode, which holds this 48-character link to version 3 (29 × 29 modules); the
 * same link in lower case needs byte mode and version 4 (33 × 33), and at 1.5 cm every module
 * counts. Scheme and host are case-blind, and the server matches /e/ case-blind. The phone's
 * own camera reads it — there is no scanner in the app — so the base is FMS_PUBLIC_URL, the
 * address a phone actually reaches.
 */
export function stickerLink(base: string, tag: string): string {
  return `${String(base).replace(/\/$/, "")}/E/${tag}`.toUpperCase();
}

/**
 * A printable page of stickers: each the QR and, under it on one line in 6 pt, the tag and
 * the item's name — cut short, never wrapped. Real millimetres on A4, printed at 100%: a
 * sticker is the QR plus 2.5 mm each side (the QR's own 2-module quiet zone sits inside it),
 * so a 1.5 cm QR makes a 2 × 2 cm sticker. `strip` prints the first item once at every
 * STRIP_SIZE on one row. Anything a person typed is escaped — an item's name is typed.
 */
export function stickerSheetHtml(items: { tag: string; name: string; qr: string }[], opts: { mm?: number; strip?: boolean } = {}): string {
  const esc = (x: string) => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const mm = (STICKER_SIZES as readonly number[]).includes(Number(opts.mm)) ? Number(opts.mm) : DEFAULT_STICKER_MM;
  const sticker = (i: { tag: string; name: string; qr: string }, q: number, caption = "") =>
    `<figure><div class="s" style="--q:${q}mm"><div class="q">${i.qr}</div><div class="c" dir="auto"><b dir="ltr">${esc(i.tag)}</b> ${esc(i.name)}</div></div>${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  const strip = !!opts.strip && items.length > 0;
  const body = strip ? STRIP_SIZES.map(q => sticker(items[0], q, `${q / 10} cm`)).join("") : items.map(i => sticker(i, mm)).join("");
  const note = !items.length ? "No item carries a tag yet — receive one on the Equipment screen first."
    : strip ? `Test strip for ${esc(items[0].tag)}: the same QR at 1, 1.2, 1.5 and 2 cm. Print at 100% (actual size), then try each with a phone's own camera — the smallest it opens every time is the size to use.`
    : `${items.length} sticker${items.length === 1 ? "" : "s"}, QR ${mm / 10} cm. Print at 100% (actual size) — never “fit to page” — and cut on the dotted lines. Test with a phone's own camera on the paper, not on this screen.`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Equipment stickers</title><style>
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; margin: 0; }
body { font-family: "DejaVu Sans", Arial, sans-serif; color: #000; }
.sheet { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 2mm; }
figure { break-inside: avoid; }
.s { width: calc(var(--q) + 5mm); height: calc(var(--q) + 5mm); padding: 1.2mm 2.5mm 0; outline: 0.1mm dashed #aaa; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
.q { width: var(--q); height: var(--q); flex: none; }
.q svg { width: 100%; height: 100%; display: block; }
.c { width: 100%; margin-top: 0.4mm; font: 6pt/1.15 "DejaVu Sans", Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
.c b { font-family: "DejaVu Sans Mono", Menlo, monospace; }
figcaption { font: 7pt Arial, sans-serif; color: #555; text-align: center; margin-top: 1mm; }
.note { font: 13px/1.4 system-ui, sans-serif; padding: 10px 14px; margin-bottom: 10px; background: #fff7e6; border: 1px solid #f0d9a8; }
@media screen { body { padding: 10mm; } }
@media print { .note { display: none; } }
</style></head><body><p class="note">${note}</p><div class="sheet">${body}</div></body></html>`;
}
