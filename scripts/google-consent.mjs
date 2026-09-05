/**
 * The one-time Google consent, run on Saad's Mac.
 *
 *   node scripts/google-consent.mjs ~/Downloads/client_secret_*.json
 *   node scripts/google-consent.mjs <client-id> <client-secret>
 *
 * Google will only hand a refresh token to a browser session a human is sitting in, so
 * this cannot be done from the NAS. It opens the consent page, catches the redirect on
 * localhost, exchanges the code, and writes the three settings the server needs to ONE
 * file next to this repo — .google-calendar.env, readable by this user only. The token is
 * never printed: the file is copied to the server's .env and then deleted here.
 *
 * The scope asked for is calendar.events: permission to add, change and remove entries.
 * It cannot read anyone else's calendar and cannot touch calendar settings.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

let [clientId, clientSecret] = process.argv.slice(2);
if (clientId && !clientSecret && /\.json$/i.test(clientId)) {
  // The file Google's "Download JSON" button saves: { installed: { client_id, client_secret } }
  const j = JSON.parse(fs.readFileSync(clientId.replace(/^~/, os.homedir()), "utf8"));
  const c = j.installed || j.web || j;
  clientId = c.client_id; clientSecret = c.client_secret;
}
if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/google-consent.mjs <downloaded client JSON>   or   <client-id> <client-secret>");
  process.exit(1);
}

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".google-calendar.env");
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
     .end("<p style='font:16px system-ui;padding:2rem'>Done. You can close this tab.</p>");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  server.close();

  if (!j.refresh_token) {
    console.error("\nGoogle did not return a refresh token:", j.error_description || j.error || "no detail");
    console.error("If this account has consented before, revoke it at myaccount.google.com/permissions and run this again.");
    process.exit(1);
  }
  fs.writeFileSync(OUT, `GOOGLE_CLIENT_ID=${clientId}\nGOOGLE_CLIENT_SECRET=${clientSecret}\nGOOGLE_REFRESH_TOKEN=${j.refresh_token}\n`, { mode: 0o600 });
  console.log(`\nConsent granted. Settings written to ${OUT} (this user only). Nothing was printed.`);
});

server.listen(PORT, () => {
  console.log(`Opening Google's consent page. If it does not open, paste this into a browser:\n\n${url}\n`);
  exec(`open "${url}"`);
});
