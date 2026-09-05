/**
 * The one-time Google consent, run on Saad's Mac.
 *
 *   node scripts/google-consent.mjs <client-id> <client-secret>
 *
 * Google will only hand a refresh token to a browser session a human is sitting in, so
 * this cannot be done from the NAS. It opens the consent page, catches the redirect on
 * localhost, exchanges the code, and prints the refresh token — which is then put in the
 * server's .env on the NAS as GOOGLE_REFRESH_TOKEN. The token is printed once and stored
 * nowhere by this script.
 *
 * The scope asked for is calendar.events: permission to add, change and remove entries.
 * It cannot read anyone else's calendar and cannot touch calendar settings.
 */
import http from "node:http";
import { exec } from "node:child_process";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/google-consent.mjs <client-id> <client-secret>");
  console.error("Both come from the OAuth client you create in Google Cloud Console (type: Desktop app).");
  process.exit(1);
}

const PORT = 8737;
const redirect = `http://localhost:${PORT}`;
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirect,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/calendar.events",
  access_type: "offline",
  prompt: "consent",                 // force a refresh token even on a repeat consent
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) { res.writeHead(400).end("No code in that redirect."); return; }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
     .end("<p style='font:16px system-ui;padding:2rem'>Done. Close this tab and look at the terminal.</p>");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  server.close();

  if (!j.refresh_token) {
    console.error("\nGoogle did not return a refresh token:", j.error_description || j.error || JSON.stringify(j));
    console.error("If this account has consented before, revoke it at myaccount.google.com/permissions and run this again.");
    process.exit(1);
  }
  console.log("\nRefresh token (put this on the NAS, do not paste it into a chat):\n");
  console.log(`GOOGLE_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${j.refresh_token}`);
  console.log("\nAdd those three lines to /mnt/mainpool/anahon/fms/src/.env on the NAS, then rebuild the container.");
});

server.listen(PORT, () => {
  console.log(`Opening Google's consent page. If it does not open, paste this into a browser:\n\n${url}\n`);
  exec(`open "${url}"`);
});
