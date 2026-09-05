// The service worker exists so the browser will offer "Install" — nothing more.
//
// ponytail: it caches exactly one file, the offline notice. The app bundle is
// deliberately NOT cached: the client and the server on the NAS must match, and a
// stale shell served from a phone's cache is a bug nobody can see. Everything except
// a page navigation goes straight to the network, untouched. Add a shell cache only
// when someone actually needs to work with no network at all.
const CACHE = "anahon-offline-v1";
const PAGE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(PAGE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // API calls, documents, images: not our business
  e.respondWith(
    fetch(e.request).catch(async () => (await caches.match(PAGE)) || Response.error())
  );
});

/* ── "It is your turn" ────────────────────────────────────────────────────────
 * The server sends one notification per desk item that newly became this person's
 * turn. Nothing here is cached and nothing is fetched: the payload carries every
 * word shown, so a notification cannot arrive stale or leak a request to a phone
 * that is off the tailnet.
 *
 * The click opens the app at the door the item lives behind — /?door=expenses&
 * focus=expenses:e-12 — which App.tsx reads once on load. An app window that is
 * already open is focused and navigated rather than a second one being opened.
 */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = d.title || "AnaHon";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || title,          // a re-send for the same item replaces, never stacks
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "navigate" in c) return c.navigate(url).then((w) => w && w.focus());
      }
      return self.clients.openWindow(url);
    })
  );
});
