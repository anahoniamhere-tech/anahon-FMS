// The Live editor's Navigation panel (src/tabs/SitePanel.tsx → NavPanel) — the actual shipped
// component, rendered into a real DOM and clicked, not curled. Saad has no test account and we
// never sign in as him, so this is the strongest proof available short of his own first click:
// the real component tree, a real click event, a real re-render, the real fetch call it makes.
//
// Pairing (22 Sep 2026): one row per key, one click hides both languages. Tested here:
// About Us specifically — its Arabic slug (/ar/من-نحن/) does not match its English one
// (/about-us/), the exact case href-pairing would have broken — and Investigations, English
// only, which must render and toggle as a single-language row, not error or grow a phantom
// Arabic entry. A pre-diverged row (one language already hidden, the other not — the shape a
// single-language override, or a stale flag from before the rework, would leave) must be shown
// as a mismatch, not silently resolved into one state.
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

const NAV_EN = [
  { label: "Home", href: "/", key: "home" },
  { label: "About Us", href: "/about-us/", key: "about" },
  { label: "Transparency", href: "/transparency/", key: "transparency" },
  { label: "Investigations", href: "/investigations/", key: "investigations" },
  // pre-diverged, on purpose: a state a single-language override (or a leftover from before
  // pairing existed) could leave. English hidden, Arabic not.
  { label: "Podcasts", href: "/podcasts/", key: "podcasts", hidden: true },
];
const NAV_AR = [
  { label: "الرئيسية", href: "/ar/", key: "home" },
  { label: "من نحن", href: "/ar/من-نحن/", key: "about" }, // deliberately NOT /ar/about-us/ — the mismatch href-pairing would have hit
  { label: "الشفافية", href: "/ar/transparency/", key: "transparency" },
  // no "investigations" entry — English-only, on purpose
  { label: "بودكاست", href: "/ar/بودكاست/", key: "podcasts" }, // not hidden — the other half of the divergence
];

let calls: { url: string; body: any }[] = [];
(globalThis as any).fetch = async (url: string, opts?: any) => {
  if (url === "/api/website/content") return { json: async () => ({ i18n: { ui: { en: { nav: NAV_EN }, ar: { nav: NAV_AR } } } }) } as any;
  if (url === "/api/website/nav") {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    return { json: async () => ({ success: true, touched: [], refreshed: { invalidated: 1 } }) } as any;
  }
  throw new Error(`unmocked fetch: ${url}`);
};

const toasts: [string, string?][] = [];
const tellCalls: any[] = [];
const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
// The button sits inside a flex row; the outer card (which also carries the diverged note, a
// SIBLING of that flex row, not a descendant) is its grandparent.
const rowOf = (label: string) => {
  const btn = [...container.querySelectorAll("button")].find((b) => b.closest("div")?.textContent?.includes(label));
  return btn?.parentElement?.parentElement as HTMLElement | undefined;
};
const buttonOf = (label: string) => rowOf(label)?.querySelector("button") as HTMLElement | undefined;

root.render(React.createElement(NavPanel, { canEdit: true, t: (s: string) => s, triggerToast: (m: string, k?: string) => toasts.push([m, k]), tell: (m: any) => tellCalls.push(m) }));
await waitFor(() => container.textContent!.includes("Transparency"));

console.log("\na paired row, in both languages, one toggle");
ok(container.textContent!.includes("Transparency") && container.textContent!.includes("الشفافية"), "the Transparency row shows both languages' labels together");
ok(buttonOf("Transparency")?.textContent === "Hide", `it shows a "Hide" button (saw: ${buttonOf("Transparency")?.textContent})`);
buttonOf("Transparency")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 1);
ok(calls[0].url === "/api/website/nav" && calls[0].body.key === "transparency" && calls[0].body.hidden === true && calls[0].body.lang === undefined,
  `one click sends one paired request, no lang — both languages together (saw: ${JSON.stringify(calls[0])})`);
await waitFor(() => buttonOf("Transparency")?.textContent === "Show");
ok(/Hidden/.test(rowOf("Transparency")?.textContent || ""), "the row stays listed, marked “Hidden”, not removed");
ok(toasts.some(([m]) => m === "Hidden from the navigation"), `a toast confirmed it (saw: ${JSON.stringify(toasts)})`);
// Front desk, 22 Sep 2026: the preview iframe stayed on 10 tabs after Saad hid five, until he
// switched pages and back — the parent never told the framed page to reload, so a toggle on
// the CURRENT page left it showing pre-toggle DOM. live-edit.js already listens for exactly
// this ({type:'reload'} -> location.reload()); NavPanel just never sent it.
ok(tellCalls.some((m) => m.type === "reload"), `a successful toggle tells the framed preview to reload, so the same page shows the change without switching away and back (saw: ${JSON.stringify(tellCalls)})`);
buttonOf("Transparency")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 2);
ok(calls[1].body.key === "transparency" && calls[1].body.hidden === false, `showing it again asks to un-hide, same key (saw: ${JSON.stringify(calls[1])})`);
await waitFor(() => buttonOf("Transparency")?.textContent === "Hide");
ok(true, "the button is back to “Hide”");

console.log("\nAbout Us — the exact case href-pairing would have broken (/about-us/ vs /ar/من-نحن/)");
ok(container.textContent!.includes("About Us") && container.textContent!.includes("من نحن"), "both languages' labels render despite the mismatched hrefs");
buttonOf("About Us")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 3);
ok(calls[2].body.key === "about" && calls[2].body.hidden === true, `hides by key, not by href (saw: ${JSON.stringify(calls[2])})`);
await waitFor(() => buttonOf("About Us")?.textContent === "Show");
buttonOf("About Us")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 4);

console.log("\nInvestigations — English only, no Arabic twin");
ok(!rowOf("Investigations")?.textContent?.match(/[؀-ۿ]/), "its row has no Arabic label — a missing twin renders as a single-language row, not an error");
ok(buttonOf("Investigations")?.textContent === "Hide", "it still gets its own toggle");
buttonOf("Investigations")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 5);
ok(calls[4].body.key === "investigations" && calls[4].body.hidden === true && calls[4].body.lang === undefined, `same request shape as a paired row — the server, not the UI, decides there is no Arabic side to touch (saw: ${JSON.stringify(calls[4])})`);
await waitFor(() => buttonOf("Investigations")?.textContent === "Show");
ok(!/don't match/.test(rowOf("Investigations")?.textContent || ""), "an unpaired item hiding is not reported as a language mismatch");

console.log("\na pre-diverged row (Podcasts: English hidden, Arabic shown) is shown as a mismatch, not silently resolved");
const podRow = rowOf("Podcasts")?.textContent || "";
ok(/don't match/.test(podRow), `the row says English and Arabic don't match (saw: ${JSON.stringify(podRow)})`);
ok(/English hidden/.test(podRow) && /Arabic shown/.test(podRow), "and says which is which");
ok(buttonOf("Podcasts")?.textContent === "Hide", "the button treats \"not fully shown\" as the hidden state — clicking it will finish hiding, not partially show");

console.log("\ncanEdit=false: a reader can never change the live site");
root.render(React.createElement(NavPanel, { canEdit: false, t: (s: string) => s, triggerToast: () => {} }));
// Same mounted root, same nav already in state (the fetch effect only runs once) — just a
// prop change, so give React one tick to commit it and no more.
await new Promise((r) => setTimeout(r, 20));
ok(container.querySelectorAll("button").length === 0, "with canEdit=false, no toggle buttons render at all");

root.unmount();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nnav panel UI checks passed");
