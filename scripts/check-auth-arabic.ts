// Auth-middleware refusals speak Arabic too (Admin room, 6 Oct 2026).
// Pure static checks on server.ts / gateText.ts / App.tsx text — never opens any database.
// Run: npx tsx scripts/check-auth-arabic.ts
//
// Companion to scripts/check-editorial-gates.ts's "every refusal speaks Arabic" block, which
// covers the editorial routes (route.*). This covers the two app.use() gates that run before
// ANY route, plus /api/auth/sync — the ones an unauthenticated or wrongly-scoped caller meets
// FIRST, so a regression here is the first English sentence a user sees, not a buried one.
import assert from "node:assert";
import { readFileSync } from "node:fs";

const srv = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

/* ── Every auth.* key is both declared and actually called ──────────────────────────────── */
{
  const { GATE_TEXT, untranslated } = await import("../src/gateText");
  assert.deepStrictEqual(untranslated(), [], "every gate refusal has Arabic, auth.* included");

  const authKeys = Object.keys(GATE_TEXT).filter(k => k.startsWith("auth."));
  // 18 middleware sites + 4 /api/auth/sync sites = 22. A key removed from the table or from
  // server.ts without removing the other half would move this number — catch it either way.
  assert.strictEqual(authKeys.length, 22, `expected 22 auth.* refusals, found ${authKeys.length}`);

  // A key declared but never sent is dead text that will quietly drift from what the server
  // really says. A key sent but never declared throws at request time (gm() guarantees that),
  // but only for the caller unlucky enough to hit that exact branch — so check it here, once,
  // for every branch, rather than waiting for someone to find it live.
  for (const k of authKeys) assert.ok(srv.includes(`gm("${k}"`), `server.ts must send "${k}"`);
  for (const match of srv.matchAll(/\bgm\("(auth\.[^"]+)"/g))
    assert.ok(GATE_TEXT[match[1]], `server.ts sends "${match[1]}", which the table must define`);
}

/* ── THE REGRESSION CHECK: none of the old raw, un-keyed sentences survive at the TWO SPANS
 * this task converted — the shared middleware and /api/auth/sync. This is the one that must
 * fail on purpose before the conversion and pass after it — a literal English sentence with
 * no errorKey beside it is exactly what silently regresses if someone reverts one call site
 * by hand while touching the shared middleware later.
 *
 * Scoped to these two spans ON PURPOSE, not the whole file: server.ts is 14,000+ lines and
 * other routes (equipment, calendar, /api/state, documents — each a different room's door)
 * write their OWN "Sign in to…" / "…deactivated" sentences as a belt-and-suspenders re-check
 * after the shared middleware already ran. Those are real, but they are each route's own
 * text, not the middleware's — out of this task's scope, and a plain whole-file substring
 * ban would wrongly flag them as a "regression" the moment their wording coincides with one
 * of these, which it already does once (/api/state's own verify-failed sentence). */
{
  const middleware = srv.slice(srv.indexOf('app.use(async (req: any, res, next) => {'), srv.indexOf("// Master document vault"));
  const syncRoute = srv.slice(srv.indexOf('app.post("/api/auth/sync"'), srv.indexOf('app.post("/api/users/create"'));
  assert.ok(middleware.length > 1000 && syncRoute.length > 100, "both anchors must have been found");

  const MIDDLEWARE_RAW = [
    'res.status(401).json({ error: "Sign in to read this." })',
    'res.status(403).json({ error: "This user account is deactivated." })',
    'res.status(401).json({ error: "This action requires a signed-in user." })',
    'res.status(403).json({ error: `${verified.email} authenticated, but has no account in this system. An administrator must create one first.` })',
    'res.status(401).json({ error: `Sign-in could not be verified (${err.message}). Sign in again.` })',
    'res.status(403).json({ error: "Only a Super Admin may act in another role." })',
    'res.status(400).json({ error: `"${wanted}" is not a role in this system.` })',
    'res.status(400).json({ error: "That is already your own role." })',
    'res.status(403).json({ error: `The ${wanted} seat cannot do this. Stop acting to use your own authority.` })',
    'res.status(403).json({ error: "Project Officers can raise purchase requests and upload evidence only — this action needs the Finance Officer or master account." })',
    'res.status(403).json({ error: "The Procurement and Logistics seat buys and raises requests — it does not approve, pay, or post." })',
    'res.status(403).json({ error: "The Digital Officer seat runs the website, archive, social and tools — nothing financial or editorial." })',
    'res.status(403).json({ error: "Editorial seats act on the pipeline and the site — nothing financial." })',
    'res.status(403).json({ error: "The auditor\'s account is read-only." })',
    'res.status(403).json({ error: "A self-service account files its own timesheet and papers only." })',
    'res.status(403).json({ error: "Content-team accounts act on the editorial pipeline only — this action needs an editor or finance role." })',
  ];
  for (const raw of MIDDLEWARE_RAW) assert.ok(!middleware.includes(raw), `the middleware must no longer send this un-keyed: ${raw.slice(0, 70)}…`);

  const SYNC_RAW = [
    'res.status(400).json({ error: "Sign-in token required." })',
    'res.status(401).json({ error: `Sign-in could not be verified: ${err.message}` })',
    'res.status(403).json({ error: `${verified.email} signed in successfully, but has no account in AnaHon FMS. Ask a Super Admin to create one.` })',
    'res.status(403).json({ error: `${verified.email} has an account here, but it has been deactivated. If you have another address, sign in with that one; otherwise ask a Super Admin.` })',
  ];
  for (const raw of SYNC_RAW) assert.ok(!syncRoute.includes(raw), `/api/auth/sync must no longer send this un-keyed: ${raw.slice(0, 70)}…`);

  // refuseWith is the only shape a converted site should use — it always sends error+errorKey+errorArgs.
  assert.match(srv, /const refuseWith = \(res: any, code: number, msg: Msg\) =>\s*\n\s*res\.status\(code\)\.json\(\{ error: msg\.en, errorKey: msg\.key, errorArgs: msg\.args \}\);/,
    "refuseWith still sends the English sentence AND its key AND its values");
}

/* ── The sentences themselves render, and English stays the source of truth ─────────────── */
{
  const { GATE_TEXT: GT, sayResponse } = await import("../src/gateText");
  assert.strictEqual(sayResponse("ar", { error: "plain" }), "plain", "no key → the English sentence");
  assert.match(sayResponse("ar", { error: "x", errorKey: "auth.required" }), /[؀-ۿ]/, "a known key → Arabic");
  assert.match(sayResponse("ar", { error: "x", errorKey: "auth.no-account", errorArgs: ["a@b.com"] }), /a@b\.com/, "…with the value still in it");
  assert.strictEqual(sayResponse("en", { error: "x", errorKey: "auth.required" }), GT["auth.required"].en, "English stays the stored sentence");
  // The dynamic seat-list key: a real multi-seat join still renders, args survive untranslated
  // (deliberate — see the comment in gateText.ts above the auth.* section).
  assert.match(sayResponse("ar", { error: "x", errorKey: "auth.seat-required", errorArgs: ["Finance Officer or Digital Officer"] }),
    /Finance Officer or Digital Officer/, "a joined seat list is not split or lost in Arabic");
}

/* ── The sign-in screen itself renders through the same helper, not a raw error string ──── */
{
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(/import \{ sayResponse \} from "\.\/gateText";/.test(app), "App.tsx imports sayResponse");
  assert.ok(/setAuthError\(sayResponse\(lang, problem, t\)/.test(app),
    "the sign-in screen renders its refusal in the reader's language, not problem.error raw");
}

console.log("check-auth-arabic: all assertions passed — 22 auth-middleware refusals carry both languages,",
  "no un-keyed form survives, and the sign-in screen renders through sayResponse.");
