// The Live editor's Navigation panel (src/tabs/SitePanel.tsx → NavPanel) — the actual shipped
// component, rendered into a real DOM and clicked, not curled. Saad has no test account and we
// never sign in as him, so this is the strongest proof available short of his own first click:
// the real component tree, a real click event, a real re-render, the real fetch call it makes.
//
// Only fetch is mocked (there is no live server to hit in isolation); NavPanel itself, its
// event handlers and React's own reconciliation all run for real.
// Run: npx tsx scripts/check-nav-panel-ui.tsx
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
// Node 24 ships its own read-only globalThis.navigator; jsdom's must replace it, not assign onto it.
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { NavPanel } = await import("../src/tabs/SitePanel.js");

let failed = 0;
const ok = (cond: boolean, what: string) => { console.log(cond ? "ok  " : "FAIL", what); if (!cond) failed++; };
// A single setTimeout(0) isn't reliably enough ticks for React 19's own scheduler to run an
// effect's fetch().then(setState) through to a committed re-render under jsdom; poll instead.
const waitFor = async (pred: () => boolean, ms = 1000) => {
  const start = Date.now();
  while (!pred()) { if (Date.now() - start > ms) throw new Error("timed out waiting for the UI to update"); await new Promise((r) => setTimeout(r, 10)); }
};

const NAV_EN = [{ label: "Home", href: "/" }, { label: "Programs", href: "/programs/" }, { label: "Transparency", href: "/transparency/" }];
const NAV_AR = [{ label: "الرئيسية", href: "/ar/" }, { label: "برامجنا", href: "/ar/programs/" }, { label: "الشفافية", href: "/ar/transparency/" }];

let calls: { url: string; body: any }[] = [];
(globalThis as any).fetch = async (url: string, opts?: any) => {
  if (url === "/api/website/content") return { json: async () => ({ i18n: { ui: { en: { nav: NAV_EN }, ar: { nav: NAV_AR } } } }) } as any;
  if (url === "/api/website/nav") {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    return { json: async () => ({ success: true, refreshed: { invalidated: 1 } }) } as any;
  }
  throw new Error(`unmocked fetch: ${url}`);
};

const toasts: [string, string?][] = [];
const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
const findRow = (label: string) => [...container.querySelectorAll("button")].find((b) => b.closest("div")?.textContent?.includes(label));

root.render(React.createElement(NavPanel, { canEdit: true, t: (s: string) => s, triggerToast: (m: string, k?: string) => toasts.push([m, k]) }));
await waitFor(() => container.textContent!.includes("Transparency"));

ok(container.textContent!.includes("Programs") && container.textContent!.includes("برامجنا"), "both languages' nav lists rendered from the real fetch");
ok(!!container.querySelector('[dir="rtl"]'), "the Arabic list renders right-to-left");

ok(findRow("Transparency")?.textContent === "Hide", `the visible "Transparency" row shows a "Hide" button (saw: ${findRow("Transparency")?.textContent})`);

// The actual click a real user's mouse produces — not calling the handler prop directly.
findRow("Transparency")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 1);

ok(calls[0].url === "/api/website/nav" && calls[0].body.lang === "en" && calls[0].body.href === "/transparency/" && calls[0].body.hidden === true,
  `the click POSTed the right request (saw: ${JSON.stringify(calls[0])})`);
await waitFor(() => findRow("Transparency")?.textContent === "Show");
ok(true, "the button now reads \"Show\"");
ok(/Hidden/.test(findRow("Transparency")?.closest("div")?.textContent || ""), "the row is visibly marked “Hidden”, not just removed from the list");
ok(toasts.some(([m]) => m === "Hidden from the navigation"), `a toast confirmed it (saw: ${JSON.stringify(toasts)})`);

// Click again — it must come back, and the fetch it sends must ask to un-hide, not hide again.
findRow("Transparency")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 2);
ok(calls[1].body.hidden === false, `showing it again POSTed hidden:false (saw: ${JSON.stringify(calls[1])})`);
await waitFor(() => findRow("Transparency")?.textContent === "Hide");
ok(true, "the button is back to “Hide”");

// canEdit=false: a reader must never see a button that would change the live site.
// Same mounted root, same nav already in state (the fetch effect only runs once) — just a
// prop change, so give React one tick to commit it and no more.
root.render(React.createElement(NavPanel, { canEdit: false, t: (s: string) => s, triggerToast: () => {} }));
await new Promise((r) => setTimeout(r, 20));
ok(container.querySelectorAll("button").length === 0, "with canEdit=false, no toggle buttons render at all");

root.unmount();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nnav panel UI checks passed");
