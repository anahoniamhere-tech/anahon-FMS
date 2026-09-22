// The Live editor's Page sections panel (src/tabs/SitePanel.tsx → PageSectionsPanel) — the
// actual shipped component, rendered into a real DOM and clicked, not curled. Same standard as
// the Navigation panel: Saad has no test account and we never sign in as him, so this is the
// strongest proof available short of his own first click.
//
// Decoupled from the nav on purpose (Saad, 22 Sep 2026): hiding "Our Programs" here must never
// touch the nav's own Programs entry, and must reload the framed preview the same way a nav
// toggle does — the exact staleness bug found live tonight, now guarded against in a second
// panel before it can repeat there.
//
// Only fetch is mocked (there is no live server to hit in isolation); PageSectionsPanel itself,
// its click handler and React's own reconciliation all run for real.
// Run: npx tsx scripts/check-page-sections-ui.tsx
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { PageSectionsPanel, PAGE_SECTIONS } = await import("../src/tabs/SitePanel.js");

let failed = 0;
const ok = (cond: boolean, what: string) => { console.log(cond ? "ok  " : "FAIL", what); if (!cond) failed++; };
const waitFor = async (pred: () => boolean, ms = 1000) => {
  const start = Date.now();
  while (!pred()) { if (Date.now() - start > ms) throw new Error("timed out waiting for the UI to update"); await new Promise((r) => setTimeout(r, 10)); }
};

console.log("PAGE_SECTIONS registry");
ok(PAGE_SECTIONS.Home?.length === 10, `Home carries all ten wrapped sections (saw: ${PAGE_SECTIONS.Home?.length})`);
ok(PAGE_SECTIONS.Home?.every((s: any) => /^home\.[a-z]+$/.test(s.id)), "every id is namespaced by page, so ids can never collide across files later");
ok(new Set(PAGE_SECTIONS.Home?.map((s: any) => s.id)).size === 10, "no duplicate ids");

let calls: { url: string; body: any }[] = [];
let tellCalls: any[] = [];
// "Numbers" (home.stats) starts pre-hidden — proves the panel reads existing state, not just writes it.
(globalThis as any).fetch = async (url: string, opts?: any) => {
  if (url === "/api/website/content") return { json: async () => ({ i18n: { sections: { "home.stats": true } } }) } as any;
  if (url === "/api/website/sections") {
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
const rowOf = (label: string) => [...container.querySelectorAll("button")].find((b) => b.closest("div")?.textContent?.includes(label))?.closest("div") as HTMLElement | undefined;
const buttonOf = (label: string) => rowOf(label)?.querySelector("button") as HTMLElement | undefined;

root.render(React.createElement(PageSectionsPanel, { canEdit: true, pageLabel: "Home", t: (s: string) => s, triggerToast: (m: string, k?: string) => toasts.push([m, k]), tell: (m: any) => tellCalls.push(m) }));
// Section LABELS render on the very first synchronous pass (PAGE_SECTIONS is a static import,
// not fetched) — only the hidden STATE is async. Wait for that specifically, or every
// assertion below race-starts before the fetch has actually been applied.
await waitFor(() => buttonOf("Numbers")?.textContent === "Show");

console.log("\nall ten of Home's sections render, in order, from the real fetch");
ok(PAGE_SECTIONS.Home.every((s: any) => container.textContent!.includes(s.label)), "every labeled section appears");
const order = [...container.querySelectorAll("div > span")].map((el) => el.textContent).filter((t) => PAGE_SECTIONS.Home.some((s: any) => t?.startsWith(s.label)));
ok(JSON.stringify(order.map((o) => o?.replace("Hidden", ""))) === JSON.stringify(PAGE_SECTIONS.Home.map((s: any) => s.label)), `rows keep the page's own top-to-bottom order (saw: ${JSON.stringify(order)})`);

console.log("\npre-hidden state is read correctly (Numbers, home.stats)");
ok(buttonOf("Numbers")?.textContent === "Show", `a section already hidden shows "Show" on load (saw: ${buttonOf("Numbers")?.textContent})`);
ok(/Hidden/.test(rowOf("Numbers")?.textContent || ""), "and is marked Hidden");
ok(buttonOf("Our Programs")?.textContent === "Hide", "an untouched section shows \"Hide\"");

console.log("\nhiding a section — the exact case Saad asked for tonight");
buttonOf("Our Programs")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 1);
ok(calls[0].url === "/api/website/sections" && calls[0].body.id === "home.programs" && calls[0].body.hidden === true,
  `the click POSTs the section's own id, decoupled from nav (saw: ${JSON.stringify(calls[0])})`);
await waitFor(() => buttonOf("Our Programs")?.textContent === "Show");
ok(tellCalls.some((m) => m.type === "reload"), `it tells the framed preview to reload — no dropdown-switch workaround needed (saw: ${JSON.stringify(tellCalls)})`);
ok(/Hidden/.test(rowOf("Our Programs")?.textContent || ""), "the row stays listed, marked Hidden, not removed from the panel");
ok(toasts.some(([m]) => m === "Hidden from the page"), `a toast confirmed it, worded for a section not a nav item (saw: ${JSON.stringify(toasts)})`);

console.log("\nshowing it again — un-hides that section only");
buttonOf("Our Programs")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 2);
ok(calls[1].body.id === "home.programs" && calls[1].body.hidden === false, `showing it again asks to un-hide, same id (saw: ${JSON.stringify(calls[1])})`);
await waitFor(() => buttonOf("Our Programs")?.textContent === "Hide");
ok(buttonOf("Numbers")?.textContent === "Show", "the pre-hidden Numbers row is untouched by toggling a different section");

console.log("\nshowing the pre-hidden section un-hides it, independently");
buttonOf("Numbers")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => calls.length === 3);
ok(calls[2].body.id === "home.stats" && calls[2].body.hidden === false, `un-hides the right id (saw: ${JSON.stringify(calls[2])})`);
await waitFor(() => buttonOf("Numbers")?.textContent === "Hide");

console.log("\na page with no registered sections yet");
root.render(React.createElement(PageSectionsPanel, { canEdit: true, pageLabel: "Contact", t: (s: string) => s, triggerToast: () => {}, tell: () => {} }));
await new Promise((r) => setTimeout(r, 20));
ok(container.textContent!.includes("no labeled sections"), "says so plainly rather than showing an empty list or crashing");
ok(container.querySelectorAll("button").length === 0, "and offers no toggle for a page with nothing registered");

console.log("\ncanEdit=false: a reader can never change the live site");
root.render(React.createElement(PageSectionsPanel, { canEdit: false, pageLabel: "Home", t: (s: string) => s, triggerToast: () => {}, tell: () => {} }));
await waitFor(() => container.textContent!.includes("Our Programs"));
ok(container.querySelectorAll("button").length === 0, "with canEdit=false, no toggle buttons render at all");

root.unmount();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\npage sections UI checks passed");
