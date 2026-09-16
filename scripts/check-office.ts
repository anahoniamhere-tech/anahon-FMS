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

// 16 Sep 2026: a phone open across a redeploy reused a cached index.html naming asset hashes
// the next build had already removed — the fallback route served index.html AS the JS file
// and the app never booted (seen on Saad's iPhone, VPS log). Fixed on the server: index.html
// is never cached, content-hashed assets are cached forever (their filename IS the cache key).
console.log("\na phone open across a deploy never boots a stale build");
const staticBlock = server.slice(server.indexOf('const distPath = path.join(process.cwd(), "dist")'), server.indexOf('app.get("*"'));
ok("index.html is never cached", /filePath\.endsWith\(".html"\)\s*\?\s*"no-store"/.test(staticBlock));
ok("hashed assets are cached as immutable", /"public, max-age=31536000, immutable"/.test(staticBlock));
ok("the catch-all (index.html for every other path) matches", /res\.setHeader\("Cache-Control", "no-store"\);\s*\n\s*res\.sendFile\(path\.join\(distPath, "index\.html"\)\);/.test(server));

// iOS: a frame sized in dvh resizes with the sliding toolbar, and every resize of the WebGL
// canvas inside leaks memory in WebKit. The frame is sized in svh, with a vh fallback.
console.log("\nthe office frame holds still on an iPhone");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const frame = css.slice(css.indexOf(".office-frame {"), css.indexOf("}", css.indexOf(".office-frame {")));
ok("OfficeTab uses the office-frame class", /className="office-frame /.test(tab));
ok("its height is svh, after a vh fallback, and never dvh", /height: calc\(100vh - 9rem\);\s*height: calc\(100svh - 9rem\);/.test(frame) && !/dvh/.test(frame));

// 16 Sep 2026: an iPhone's first open spent 24 of 30 seconds on the 2 MB village script, because
// every byte crosses the office's upload link to the VPS door. Scripts and styles leave gzipped.
console.log("\nscripts leave the NAS compressed");
const gz = server.slice(server.indexOf("const gzipped = new Map"), server.indexOf("app.use(express.static(distPath"));
ok("js and css are gzipped when the browser accepts it", /app\.get\(\/\\\.\(js\|css\)\$\//.test(gz) && /zlib\.gzipSync\(/.test(gz) && /"Content-Encoding", "gzip"/.test(gz) && /\\bgzip\\b/.test(gz));
ok("only files inside dist can be read", /if \(!file\.startsWith\(distPath \+ path\.sep\)\) return next\(\);/.test(gz));
ok("caches know the answer depends on encoding", /"Vary", "Accept-Encoding"/.test(gz));
ok("a file that isn't there falls through to the normal handlers", /catch \{ return next\(\); \}/.test(gz));

console.log(failed ? `\n${failed} FAILED\n` : "\nall green\n");
process.exit(failed ? 1 : 0);
