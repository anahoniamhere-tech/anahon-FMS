// The Virtual Office (the village at /village) against the real FMS. Run: npx tsx scripts/check-office.ts
//
// The village is ~/AnaHon/agent-village, built into public/village; its own side (one GET, no
// writes, cards open the FMS) is pinned by that repo's scripts/check-board.mjs. This pins the
// FMS side: GET /api/office/board is read-only, sits behind sign-in, shows staff only their
// own cards, and the door is just a same-origin frame of /village/.
import { readFileSync, existsSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const server = strip(readFileSync(new URL("../server.ts", import.meta.url), "utf8"));
const start = server.indexOf('app.get("/api/office/board"');
const route = start < 0 ? "" : server.slice(start, server.indexOf("\n});", start));

console.log("\nthe board route reads and writes nothing");
ok("the route exists", route.length > 0);
ok("no record is written", !/prisma\.\w+\.(create|update|upsert|delete)\w*\(|stallRow\(|createAuditLog\(|deliverPush\(|webpush/.test(route), (route.match(/prisma\.\w+\.(create|update|upsert|delete)\w*|stallRow|createAuditLog|deliverPush|webpush/) || [""])[0]);
ok("it is behind sign-in (not an open GET)", !/OPEN_GETS = new Set\([^)]*\/api\/office/.test(server));

console.log("\nstaff see their own cards; directors see everyone's");
ok("cards only for a director or the person themself", /const seesCards = director \|\| person\.id === viewer\.id/.test(route) && /cards: seesCards \?/.test(route));
ok("director comes from the signed-in user's role", /const director = isDirector\(viewer\.role\)/.test(route) && /const viewer = \(req as any\)\.dbUser/.test(route));
ok("who has notifications off is the director's", /notificationsOff: director \?/.test(route));
ok("mail: the director's, or assigned to the viewer", /director \|\| m\.assigneeUserId === viewer\.id/.test(route));
ok("turns are the shadow office's own reading", /await turnsOf\(person, true\)/.test(route));

console.log("\nthe door is the village, framed");
const tab = strip(readFileSync(new URL("../src/tabs/OfficeTab.tsx", import.meta.url), "utf8"));
ok("OfficeTab frames /village/ and nothing else", /src="\/village\/"/.test(tab) && !/fetch\(|href=/.test(tab));
const page = new URL("../public/village/index.html", import.meta.url);
ok("the built village is in public/village", existsSync(page));
if (existsSync(page)) ok("its assets load from /village/", /src="\/village\/assets\//.test(readFileSync(page, "utf8")));

console.log(failed ? `\n${failed} FAILED\n` : "\nall green\n");
process.exit(failed ? 1 : 0);
