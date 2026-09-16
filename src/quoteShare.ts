/**
 * Quotation share links — a client opens the quotation PDF from a WhatsApp message.
 *
 * The FMS stays tailnet-only. It pushes the rendered PDF to the VPS, where the presence of
 * /srv/quotations/<token>.pdf is the whole permission check (contract: QUOTATION-LINKS.md,
 * Admin's half). Expiry rides in the file's mtime and the VPS cron deletes it; revoke = delete.
 *
 * Saad's rules (16 Sep 2026): only iContent Studio quotations get a link (the route exists only
 * on icontent.studio, and client-facing iContent paper never names AnaHon); never for a Draft;
 * an edited quotation gets a NEW token and the old link dies, so nobody sees a price change
 * silently at an address they already hold.
 */

export const SHARE_ORIGIN = "https://icontent.studio";
export const SHARE_DIR = "/srv/quotations";
/** A quotation with no validity date: the link lives this long. */
export const SHARE_DEFAULT_DAYS = 30;
/** Statuses where the client is still meant to read the offer (Invoiced = part paid, balance still owed). */
export const SHAREABLE_STATUSES = ["Sent", "Accepted", "Invoiced"];

export const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function shareUrl(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("Not a share token.");
  return `${SHARE_ORIGIN}/q/${token}.pdf`;
}

export function remotePath(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("Not a share token.");
  return `${SHARE_DIR}/${token}.pdf`;
}

/**
 * When the link dies: the end of the validity day in Beirut (quotations are dated there),
 * or SHARE_DEFAULT_DAYS from now when the quotation carries no date.
 * Beirut is UTC+2 in winter and +3 in summer; taking 23:59:59 at +02:00 keeps a link alive
 * for the whole Beirut day either way (in summer it lives one hour past midnight).
 */
export function shareExpiry(validUntil: string, now: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(validUntil || "")) return new Date(`${validUntil}T23:59:59+02:00`);
  return new Date(now.getTime() + SHARE_DEFAULT_DAYS * 86_400_000);
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

/** revokedAt = when the link stopped being offered; revokePending = the VPS delete has not yet succeeded. */
export type ShareRow = { token: string; quotationId: string; createdAt: string; expiresAt: string; revokedAt: string | null; revokePending: boolean };

/** The link a client may be sent today: not revoked, not expired, newest first. */
export function liveShare<T extends ShareRow>(rows: T[], quotationId: string, now: Date): T | null {
  return rows
    .filter(r => r.quotationId === quotationId && !r.revokedAt && new Date(r.expiresAt).getTime() > now.getTime())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}
