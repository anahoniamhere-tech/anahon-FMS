/**
 * Server-side verification of Firebase ID tokens.
 *
 * The client has always authenticated properly — Firebase checks the password. What was
 * missing is that the SERVER believed whatever email the browser claimed, so anyone who
 * could reach the port could POST an email and be handed an identity. This module makes
 * the server check the signature instead of taking the client's word.
 *
 * Done with node's own crypto rather than firebase-admin: the whole job is verifying an
 * RS256 JWT against Google's published certificates, and that is a dependency-free
 * ~60 lines. Certificates are cached in memory and mirrored to disk, so a machine that is
 * briefly offline can still verify — this is a local-only system and losing the network
 * must not lock the finance team out of their own books.
 *
 * ponytail: verifies the ID token on every request rather than minting a second session
 * token. RSA verification against a cached cert is microseconds and there is no extra
 * secret to store or rotate. Swap in a session table only if request volume ever justifies it.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "anahon-financial";
const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CERT_CACHE = path.join(os.homedir(), ".anahon-fms-google-certs.json");
const REFRESH_MS = 6 * 60 * 60 * 1000;   // Google rotates roughly daily; 6h is comfortable

let certs: Record<string, string> | null = null;
let fetchedAt = 0;

function loadDiskCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CERT_CACHE, "utf8"));
    if (raw && raw.certs) { certs = raw.certs; fetchedAt = raw.at || 0; }
  } catch { /* no cache yet */ }
}

async function googleCerts(): Promise<Record<string, string>> {
  if (!certs) loadDiskCache();
  if (certs && Date.now() - fetchedAt < REFRESH_MS) return certs;
  try {
    const r = await fetch(CERT_URL);
    if (!r.ok) throw new Error(`cert fetch HTTP ${r.status}`);
    certs = await r.json() as Record<string, string>;
    fetchedAt = Date.now();
    try { fs.writeFileSync(CERT_CACHE, JSON.stringify({ at: fetchedAt, certs }), { mode: 0o600 }); } catch { /* cache is optional */ }
  } catch (err) {
    // Offline: keep using what we have rather than locking everyone out. An expired-but-
    // cached cert still proves the token was signed by Google at some point; the token's
    // own exp claim is checked separately and is what bounds the risk.
    if (!certs) throw err;
  }
  return certs!;
}

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export type VerifiedToken = { uid: string; email: string; emailVerified: boolean; name: string };

/** Throws if the token is not a currently-valid Firebase ID token for this project. */
export async function verifyIdToken(idToken: string): Promise<VerifiedToken> {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token.");
  const header = JSON.parse(b64url(parts[0]).toString("utf8"));
  const payload = JSON.parse(b64url(parts[1]).toString("utf8"));

  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm.");
  const cert = (await googleCerts())[header.kid];
  if (!cert) throw new Error("Unknown signing key.");

  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey(cert), b64url(parts[2]));
  if (!ok) throw new Error("Token signature does not verify.");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error("Token issued for a different project.");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error("Unexpected token issuer.");
  if (!payload.sub) throw new Error("Token carries no subject.");
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("Token has expired.");
  if (typeof payload.iat === "number" && payload.iat > now + 300) throw new Error("Token issued in the future.");
  if (!payload.email) throw new Error("Token carries no email.");

  return {
    uid: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    emailVerified: !!payload.email_verified,
    name: String(payload.name || payload.email).trim()
  };
}

/** Pulls the bearer token off a request. Returns "" when there is none. */
export function bearerToken(req: any): string {
  const h = String(req.headers?.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}
