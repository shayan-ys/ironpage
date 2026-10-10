// Ironpage service worker — makes the app open and run with no signal.
//
// Strategy:
//  - Navigations (HTML) and RSC payloads: network-first, fall back to the
//    cached page, then to a cached shell. Lets a dead-zone gym still open the
//    app after one online visit.
//  - Same-origin GET static (Next chunks, css, icons): stale-while-revalidate.
//  - Everything else (POST, /api writes): straight to network, never cached —
//    the app's own localStorage outbox owns offline writes and their sync.
//
// RSC payloads must never come from cache first. A client-side navigation to a
// `force-dynamic` page (the overview) fetches `/?_rsc=…` rather than an HTML
// document, so `req.mode` is not "navigate" — without the check below those
// land in stale-while-revalidate and get served indefinitely from cache. That
// is what kept a finished workout showing "Resume" on the overview: the page
// was re-rendered from a payload captured while the session was still open.
const CACHE = "gymlog-v2";

/** True for React Server Component payload requests, which Next marks both ways. */
function isRscRequest(req, url) {
  return url.searchParams.has("_rsc") || req.headers.get("rsc") === "1";
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never serve stale API reads; those must hit the server when online.
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate" || isRscRequest(req, url)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(req)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
