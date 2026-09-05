/**
 * Documents open through <img>, <iframe> and download links, which cannot carry the
 * sign-in token. So after sign-in the browser asks the server for a ticket signed for
 * this user (12 hours) and appends it to those URLs. fetch() calls still send the token
 * and never need it. A uid in a URL is no longer honoured by the server.
 */
let ticket = "";

export async function refreshDocTicket(): Promise<void> {
  try {
    const r = await fetch("/api/document/ticket");
    if (r.ok) ticket = (await r.json()).t || "";
  } catch { /* stays empty; the server will answer 403 and the page shows it */ }
}

export function withTicket(url: string): string {
  if (!ticket) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(ticket)}`;
}
