/**
 * Related-party detection for disbursement vouchers.
 *
 * A voucher is related-party when the person who RAISED it is also the party being PAID.
 * That happens legitimately — a service provider who is also a project officer raises the
 * voucher that pays their own invoice — so it is never blocked here. §4.3 (enforced in
 * server.ts) already stops anyone approving their own request; this only makes the conflict
 * visible to whoever does approve it.
 *
 * The link is Vendor.userEmail, set deliberately per provider, rather than name matching:
 * the same person appears as "Omar Al-Abyad", "Omar Abiad" and "Omar Al Abiad" across the
 * vendor register, the vouchers and the vault.
 */
export type PartyRef = { vendorId?: string; requestorId?: string };
export type VendorRef = { id: string; name: string; userEmail?: string };
export type UserRef = { id: string; name: string; email?: string };

const norm = (s?: string) => (s || "").trim().toLowerCase();

/** The requesting user when they are also the payee, otherwise null. */
export function selfDealingRequester<U extends UserRef>(
  exp: PartyRef, vendors: VendorRef[], users: U[]
): U | null {
  const payeeEmail = norm(vendors.find(v => v.id === exp.vendorId)?.userEmail);
  if (!payeeEmail) return null; // ordinary supplier — no login linked
  const requester = users.find(u => u.id === exp.requestorId);
  return requester && norm(requester.email) === payeeEmail ? requester : null;
}
