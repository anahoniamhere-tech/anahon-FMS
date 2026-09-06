// Does the Live editor tell the truth about what it can edit, and does it survive a phone?
//
// Website & systems room, 6 Sep 2026. Three editors touch the site's files — Site content (a
// form), the Live editor (click the page), and Archive › Website home (a form for the home
// widgets). Articles belong to none of them: their words live in the Editorial desk, and the
// site's article pages carry the desk record's id so a click can hand it over instead of
// failing with a message about "the site's code". This pins that hand-off end to end, that
// the library panel (drag-and-drop, a mouse gesture) steps aside below md, and that every
// string the two tabs show has an Arabic twin.
// Run: npx tsx scripts/check-live.ts
import { readFileSync } from "node:fs";
import { AR } from "../src/i18n";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const text = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const site = (f: string) => readFileSync(new URL(`../../website/${f}`, import.meta.url), "utf8");

const live = text("src/tabs/LiveTab.tsx"), web = text("src/tabs/SitePanel.tsx"), widget = text("src/tabs/WidgetPanel.tsx"), gates = text("src/gates.ts"), nav = text("src/nav.tsx");
const shared = text("src/tabs/shared.ts"), app = text("src/App.tsx"), server = text("server.ts"), help = text("src/help.ts");
const page = site("src/layouts/ArticlePage.astro"), script = site("src/lib/live-edit.js"), schema = site("src/content.config.ts");

console.log("\nan article page names its desk record, and a click hands it over");
ok("the content schema carries fmsId", /fmsId:\s*z\.string\(\)\.optional\(\)/.test(schema));
ok("ArticlePage.astro puts it on <article>", /<article[^>]*data-fms-id=\{\(article\.data as any\)\.fmsId\}/.test(page));
ok("live-edit.js reads it once", /const articleId = document\.querySelector\('article\[data-fms-id\]'\)/.test(script));
const click = script.slice(script.indexOf("document.addEventListener('click'"), script.indexOf("// --- images"));
ok("a click on an article sends the record instead of starting a text edit",
  click.indexOf("send({ type: 'article'") > -1 && click.indexOf("send({ type: 'article'") < click.indexOf("textNodeAt(e.clientX"));
ok("the ready message carries articleId", /type: 'ready', url: location\.pathname, lang, articleId/.test(script));
ok("the banner speaks Arabic on Arabic pages", /NOTE_ARTICLE = lang === 'ar'/.test(script) && /NOTE = lang === 'ar'/.test(script));
ok("LiveTab keeps the record from ready", /setArticleId\(String\(d\.articleId \|\| ""\)\)/.test(live));
ok("LiveTab opens the Editorial desk on it", /d\.type === "article"\) \{ if \(d\.id\) openDoor\("editorial", String\(d\.id\)\)/.test(live));
ok("LiveTab shows the way out while editing an article", /edit && articleId && \(/.test(live) && /openDoor\("editorial", articleId\)/.test(live));

console.log("\none shared way to open another door");
ok("SharedProps declares openDoor", /openDoor: \(door: string, focus\?: string\) => void;/.test(shared));
ok("App.tsx provides it through the redirect guard (setActiveTab, not a literal tab list)", /openDoor: \(door: string, focus\?: string\) => \{ if \(focus\) setFocusId\(focus\); setActiveTab\(door\); \}/.test(app));

console.log("\nthe refusal says what is true");
const refusal = server.slice(server.indexOf('app.post("/api/website/edit"'), server.indexOf('app.get("/api/website/library"'));
ok("no 'assistant' in the message", !/assistant/i.test(refusal));
ok("it names the Editorial desk for articles", /Articles are edited in the Editorial desk/.test(refusal));
ok("the help entry says the same, in both languages", /Editorial desk — clicking one there opens it/.test(help) && /مكتب التحرير/.test(help.slice(help.indexOf('id: "live-editor"'), help.indexOf('id: "publish-site"'))));

console.log("\nthe phone gets a usable page");
ok("the side panel is hidden below md", /<aside className=\{`hidden shrink-0 flex-col[^`]*md:flex \$\{panel === "section" \? "w-96" : "w-64"\}`\}/.test(live));
ok("the phone is told what it can and cannot do", /md:hidden">\{t\("On a phone you can tap text to edit it/.test(live));
ok("no physical direction class crept in", !/\b(ml|mr|pl|pr|left|right|border-l|border-r|text-left|text-right)-/.test(live + web));

console.log("\nthe Articles page has widgets of its own");
const index = site("src/components/ArticlesIndex.astro"), archive = text("src/tabs/ArchiveTab.tsx");
ok("ArticlesIndex reads home.json › articlesPage", /import homeCfg from '..\/data\/home.json'/.test(index) && /\(homeCfg as any\)\.articlesPage/.test(index));
ok("pins come first, removals are hidden, the title can be overridden", /\[\.\.\.pinned, \.\.\.all\.filter\(\(a\) => !removed\.has\(a\.data\.slug\)/.test(index) && /cfg\.title_ar : cfg\.title_en/.test(index));
ok("the grid is a widget frame and each card names its slug", /class="articles-grid" data-widget-frame="articlesPage"/.test(index) && /data-item=\{article\.data\.slug\}/.test(index));
ok("the server accepts the key", /\["hero", "articles", "episodes"[^\]]*"articlesPage"[^\]]*\]\.includes\(k\)/.test(server));
ok("the Live editor labels it", /articlesPage: "Articles page"/.test(widget));
ok("the Archive form edits it (pins by article, not from the media picker)", /<Widget k="articlesPage"/.test(archive) && /k !== "articlesPage" && <button/.test(archive) && /k === "articlesPage" && \(/.test(archive));

console.log("\nthe Podcasts page has widgets of its own");
const pod = site("src/components/Podcasts.astro");
ok("Podcasts.astro reads home.json › podcastsPage", /import homeCfg from '..\/data\/home.json'/.test(pod) && /\(homeCfg as any\)\.podcastsPage/.test(pod));
ok("pins lead, removals hide, the featured player follows the curated list", /const pods = \[\.\.\.pinned, \.\.\.all\.filter\(\(p\) => !removed\.has\(p\.id\)/.test(pod) && /const featured = pods\.find\(\(p\) => p\.embed\) \?\? pods\[0\];/.test(pod) && pod.indexOf("const pods = [...pinned") < pod.indexOf("const featured ="));
ok("the list is a widget frame and each episode names its id", /class="eps-list" data-widget-frame="podcastsPage"/.test(pod) && /data-item=\{e\.id\}/.test(pod));
ok("the server accepts the key", /"articlesPage", "podcastsPage"\]\.includes\(k\)/.test(server));
ok("the Live editor labels it", /podcastsPage: "Podcasts page"/.test(widget));
ok("the Archive form edits it (media picker is right for episodes)", /<Widget k="podcastsPage"[^>]*hasPins/.test(archive));

console.log("\none website editor: the page in front, the section beside it");
ok("the Site content door is gone from the sidebar", !/navKey: "website"/.test(nav) && !/WebsiteTab/.test(app));
ok("SitePanel exports the form and the panel", /export function Field\(/.test(web) && /export function SectionsPanel\(/.test(web));
ok("the Live editor mounts it as the Section tab", /import \{ SectionsPanel, Focus \} from "\.\/SitePanel"/.test(live) && /panel === "section" && \(focusWidget/.test(live) && /: <SectionsPanel canEdit/.test(live));
ok("a click on the page reports what was clicked", /send\(\{ type: 'select', text: norm\(n\.nodeValue\), lang/.test(script));
ok("the server answers where it lives, without writing", /app\.post\("\/api\/website\/locate"/.test(server) && /res\.json\(\{ paths: findInContent\("text", want, lang\) \}\)/.test(server) && !/writeFileSync/.test(server.slice(server.indexOf('app.post("/api/website/locate"'), server.indexOf('app.post("/api/website/edit"'))));
ok("edit and locate share one walker", /const hits = findInContent\(kind, want, lang, to\);/.test(server));
ok("the gate knows the route", /"\/api\/website\/locate": SITE_EDITORS/.test(gates));
ok("the panel opens that section", /d\.type === "select"/.test(live) && /setFocus\(\{ file, section \}\); setPanel\("section"\)/.test(live) && /if \(focus && content\[focus\.file\]\?\.\[focus\.section\] !== undefined\)/.test(web));
ok("desktop / tablet / phone preview widths", /\["desktop", "tablet", "phone"\] as const/.test(live) && /maxWidth: device === "tablet" \? 768 : device === "phone" \? 390/.test(live));

console.log("\nevery widget is a list in the panel");
ok("a click inside a widget reports its entries in page order, not an inline edit", /const wf = e\.target\.closest && e\.target\.closest\('\[data-widget-frame\]'\);\s*if \(wf\) \{ sendWidget\(wf\); return; \}/.test(script) && /items: \[\.\.\.f\.querySelectorAll\('\[data-item\]'\)\]\.map\(\(n\) => n\.dataset\.item\)/.test(script));
ok("the page answers widget-items and reload", /d\.type === 'widget-items'/.test(script) && /d\.type === 'reload'\) location\.reload\(\)/.test(script));
ok("widgets are outlined in edit mode; the note no longer covers the nav", /\[data-le-on\] \[data-widget-frame\] \{ outline/.test(script) && /#le-note \{ position: fixed; bottom:/.test(script));
ok("LiveTab opens the WidgetPanel and re-asks after a reload", /d\.type === "widget-select"/.test(live) && /if \(widgetRef\.current\) tell\(\{ type: "widget-items", widget: widgetRef\.current \}\)/.test(live) && /focusWidget\s*\? <WidgetPanel/.test(live));
ok("the Sections list starts with the widgets and navigates to their page", /onWidget\(w\)/.test(web) && /const openWidget = \(w: string\)/.test(live) && /WIDGET_PAGE\[w\]\?\.\[pageLang\]/.test(live));
ok("Save writes pinned = the visible order and keeps removals; Back to automatic clears pins", /pinned: order, removed: \[\.\.\.new Set/.test(widget) && /save\(\{ \.\.\.cfg, pinned: \[\], removed: cfg\.removed \|\| \[\] \}\)/.test(widget) && /post\("\/api\/archive\/home", \{ widgets: \{ \[widget\]: next \} \}\)/.test(widget));
ok("every widget the site renders has a label, a page and a pool", ["hero", "articles", "episodes", "articlesPage", "podcastsPage"].every(w => new RegExp(`\\b${w}: "`).test(widget) && new RegExp(`\\b${w}: \\{ en:`).test(widget)));

console.log("\nevery string the two tabs show has an Arabic twin");
const keys = new Set<string>();
for (const src of [live, web, widget]) for (const m of src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"\)/g)) keys.add(m[1].replace(/\\'/g, "'"));
for (const k of ["Home hero slider", "Latest episodes", "Latest articles", "Articles page", "Podcasts page", "Pages & sections", "Navigation, footer & labels", "Programs & mission", "Home — hero", "Funding register", "Registration details"]) keys.add(k);
const missing = [...keys].filter(k => !(k in AR));
ok(`${keys.size} strings, all translated`, missing.length === 0, missing.slice(0, 5).join(" | "));

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
