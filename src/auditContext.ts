import { AsyncLocalStorage } from "async_hooks";

/**
 * Which seat the caller is standing in, for the length of one request.
 *
 * Set by the auth middleware when a Super Admin sends X-Acting-As, read by
 * createAuditLog. Keeping it here rather than inline in server.ts is what lets the
 * stamping be tested: it is the one piece that must never quietly stop working, because
 * an unstamped line is a line that claims someone else did the work.
 */
export type ActingSeat = { actingAs: string; ownRole: string; vacant: boolean };

export const actingContext = new AsyncLocalStorage<ActingSeat>();

/** The seat worn right now, or null when the person is acting as themselves. */
export function currentSeat(): ActingSeat | null {
  return actingContext.getStore() ?? null;
}

/** The audit line, with the hat named. Unchanged when no seat is being worn. */
export function stampDetails(details: string, seat: ActingSeat | null = currentSeat()): string {
  if (!seat) return details;
  const standing = seat.vacant ? "seat vacant" : "seat also held by someone else";
  return `${details} [acting as ${seat.actingAs} — ${standing}; own role ${seat.ownRole}]`;
}

/** The value for AuditLog.actingAs. Null means the person acted as themselves. */
export function stampActingAs(seat: ActingSeat | null = currentSeat()): string | null {
  return seat?.actingAs ?? null;
}
