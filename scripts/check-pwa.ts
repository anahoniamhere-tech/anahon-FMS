// Can Saad put the system on his home screen, and does it stay honest when he does?
//
// Mobile app room, 5 Sep 2026. Installing a web app is a browser feature, not a second
// codebase — a manifest, two icons and a service worker with a fetch handler. The trap
// is the service worker: cache the app shell and a phone quietly runs last week's client
// against this week's server. So this pins both halves — that the app IS installable, and
// that the worker caches nothing but the offline notice.
// Run: npx tsx scripts/check-pwa.ts
import { readFileSync, existsSync } from "node:fs";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const root = (f: string) => new URL(`../${f}`, import.meta.url);
const text = (f: string) => readFileSync(root(f), "utf8");

const html = text("index.html");
const sw = text("public/sw.js");
const manifest = JSON.parse(text("public/manifest.webmanifest"));

// A PNG says its own size in the IHDR chunk; trusting the filename is how you ship a
// 194×292 logo as a "512×512" icon and get it rejected on the phone.
const pngSize = (f: string) => {
  const b = readFileSync(root(f));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), png: b.subarray(1, 4).toString() === "PNG" };
};

console.log("\nthe page offers itself for install");
ok("index.html links the manifest", /<link rel="manifest" href="\/manifest\.webmanifest" \/>/.test(html));
ok("and names a theme colour", /<meta name="theme-color" content="#6D1A1A" \/>/.test(html));
ok("it registers the worker at the root, so its scope is the whole app", /navigator\.serviceWorker\.register\("\/sw\.js"\)/.test(html));
ok("registration is guarded — an insecure origin has no navigator.serviceWorker", /"serviceWorker" in navigator/.test(html));
ok("a failed registration is reported, not swallowed", /\.catch\(\(e\) =>\s*\n?\s*console\.warn\("Service worker not registered:"/.test(html));

console.log("\nthe manifest says what a browser needs to hear");
ok("a name and a short name", manifest.name === "AnaHon Management System" && manifest.short_name === "AnaHon");
ok("it opens at the desk", manifest.start_url === "/" && manifest.scope === "/");
ok("standalone, or it is just a bookmark", manifest.display === "standalone");
ok("brand colours match src/index.css", manifest.theme_color === "#6D1A1A" && manifest.background_color === "#F7F1EC");
for (const size of [192, 512]) {
  const icon = manifest.icons.find((i: any) => i.sizes === `${size}x${size}`);
  ok(`a ${size}px icon is declared`, !!icon && icon.type === "image/png");
  ok(`  it survives Android's circular crop`, !!icon && String(icon.purpose).includes("maskable"));
  const file = `public${icon?.src}`;
  ok(`  the file exists`, !!icon && existsSync(root(file)));
  if (icon && existsSync(root(file))) {
    const { w, h, png } = pngSize(file);
    ok(`  it really is a ${size}×${size} PNG`, png && w === size && h === size, `found ${w}×${h}`);
  }
}

console.log("\nthe worker cannot serve a stale app");
ok("it has a fetch handler at all (Chrome will not offer Install without one)", /addEventListener\("fetch"/.test(sw));
ok("anything that is not a page navigation goes straight to the network", /if \(e\.request\.mode !== "navigate"\) return;/.test(sw));
ok("navigations are network-first", /e\.respondWith\(\s*fetch\(e\.request\)\.catch\(/.test(sw));
ok("exactly one file is ever cached", (sw.match(/c\.add\(|cache\.add|addAll/g) || []).length === 1 && sw.includes("c.add(PAGE)"));
ok("and it is the offline notice, not the bundle", /const PAGE = "\/offline\.html"/.test(sw) && existsSync(root("public/offline.html")));
ok("no response is ever written into the cache", !/cache\.put|caches\.open\([^)]*\)\.then\(\(c\) => c\.put/.test(sw));
ok("old caches are cleared when the version changes", /keys\.filter\(\(k\) => k !== CACHE\)\.map\(\(k\) => caches\.delete\(k\)\)/.test(sw));

console.log("\nnothing here goes through the sign-in guard");
const server = text("server.ts");
ok("the GET guard only covers /api/, so these files serve to a signed-out phone", /req\.method === "GET" && req\.path\.startsWith\("\/api\/"\)/.test(server));
ok("the offline notice leaks nothing — it is a static page with no data", !/state|token|api\//.test(text("public/offline.html")));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
