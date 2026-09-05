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
