/**
 * Quotation share links — a client opens the quotation PDF from a WhatsApp message.
 *
 * The FMS stays tailnet-only and holds no key. It writes the rendered PDF into an outbox that
 * Admin's NAS syncer mirrors to the VPS, where the presence of /srv/quotations/<token>.pdf is the
 * whole permission check (contract: QUOTATION-LINKS.md). Expiry rides in the file's mtime (the
 * syncer prunes it, the VPS cron is the backstop); revoke = delete from the outbox.
 *
 * Saad's rules (16 Sep 2026): only iContent Studio quotations get a link (the route exists only
 * on icontent.studio, and client-facing iContent paper never names AnaHon); never for a Draft;
 * an edited quotation gets a NEW token and the old link dies, so nobody sees a price change
 * silently at an address they already hold.
 */

import { QUOTE_VALIDITY_DAYS } from "./constants";

export const SHARE_ORIGIN = "https://icontent.studio";
/** Statuses where the client is still meant to read the offer (Invoiced = part paid, balance still owed). */
export const SHAREABLE_STATUSES = ["Sent", "Accepted", "Invoiced"];

export const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/** The name the client's browser saves the file under (the VPS never reads it; only the token counts). */
export const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
export function displayName(quoteNo: string): string {
  const name = `iContent-Studio-Quotation-${String(quoteNo || "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")}.pdf`;
  if (!DISPLAY_NAME_PATTERN.test(name)) throw new Error("Not a display name.");
  return name;
}

/** The address a client is sent: /q/<token>/<display name>. Built from the token, so an older bare
 *  /q/<token>.pdf row (the one hand-issued link, 006/2026) is offered in the named form too. */
export function shareUrl(token: string, quoteNo: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("Not a share token.");
  return `${SHARE_ORIGIN}/q/${token}/${displayName(quoteNo)}`;
}

/** The file name in the outbox (and on the VPS). Nothing but a well-formed token ever becomes a path. */
export function outboxName(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("Not a share token.");
  return `${token}.pdf`;
}

/**
 * When the link dies: the end of the validity day in Beirut (quotations are dated there),
 * or — with no date on the quotation — the same QUOTE_VALIDITY_DAYS a new quotation gets, so a link
 * never outlives the offer it carries.
 * Beirut is UTC+2 in winter and +3 in summer; taking 23:59:59 at +02:00 keeps a link alive
 * for the whole Beirut day either way (in summer it lives one hour past midnight).
 */
export function shareExpiry(validUntil: string, now: Date): Date {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(validUntil || "") ? validUntil
    : new Date(now.getTime() + QUOTE_VALIDITY_DAYS * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${day}T23:59:59+02:00`);
}

type QuoteLike = { status: string; issuedAs: string; validUntil: string };

/** Why this quotation cannot get a link now, or null. */
export function shareBlocker(q: QuoteLike, now: Date): string | null {
  if (q.issuedAs !== "icontent") return "Only iContent Studio quotations can be shared by link. Send AnaHon quotations as the PDF.";
  if (!SHAREABLE_STATUSES.includes(q.status)) return `A link is only for a quotation the client is meant to read (Sent, Accepted or part paid); this one is ${q.status}.`;
  if (shareExpiry(q.validUntil, now).getTime() <= now.getTime()) return "This quotation's validity has passed. Extend the valid-until date first.";
  return null;
}

/**
 * The fields that change what the client reads. A save that changes any of them while a link is
 * live re-issues the link under a new token. Status is not here: a status move is handled by
 * shareBlocker (Draft/Rejected/… revoke).
 */
export const PRINTED_FIELDS = [
  "clientId", "title", "description", "amount", "currency", "date", "validUntil", "notes",
  "itemsJson", "termsJson", "issuedAs", "discountAmount", "discountLabel",
] as const;

export function printedChange(before: Record<string, any>, after: Record<string, any>): string[] {
  return PRINTED_FIELDS.filter(f => String(before[f] ?? "") !== String(after[f] ?? ""));
}

export type ShareRow = { token: string; quotationId: string; createdAt: string; expiresAt: string; revokedAt: string | null };

/** The link a client may be sent today: not revoked, not expired, newest first. */
export function liveShare<T extends ShareRow>(rows: T[], quotationId: string, now: Date): T | null {
  return rows
    .filter(r => r.quotationId === quotationId && !r.revokedAt && new Date(r.expiresAt).getTime() > now.getTime())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}
