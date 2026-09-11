import { EQUIPMENT_VERIFIERS } from "./roles";
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

export type EquipmentStatus = "Registered" | "Received" | "Verified";

/** Registered = entered before receiving existed; Received = delivery taken; Verified = confirmed by someone else. */
export function equipmentStatus(a: { receivedAt?: string | null; verifiedAt?: string | null }): EquipmentStatus {
  return a.verifiedAt ? "Verified" : a.receivedAt ? "Received" : "Registered";
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
