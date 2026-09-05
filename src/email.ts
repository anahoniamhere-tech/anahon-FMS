/**
 * One spelling of an address, so one person is one account.
 *
 * Gmail ignores dots and +tags in the local part, so a single mailbox has many spellings
 * and Google's sign-in token reports whichever one the person registered. Matching the
 * stored address exactly meant a real member of staff could authenticate perfectly and
 * still be told they have no account. Everywhere else — anahon.org, hotmail — the dots
 * are part of the address and are left alone.
 */
export function canonEmail(email: string): string {
  const addr = String(email || "").trim().toLowerCase();
  const [local, domain] = addr.split("@");
  if (!domain) return addr;
  if (!["gmail.com", "googlemail.com"].includes(domain)) return `${local}@${domain}`;
  return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
}
