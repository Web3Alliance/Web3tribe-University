// Web3tribe University Service Worker
// Provides a basic offline-first cache for static assets and a network-first
// strategy for navigations, so the app shell loads even with poor connectivity
// (a real-world constraint for much of the platform's target audience).
//
// v2: fixed a bug where a failed network request with nothing in cache
// resolved event.respondWith() with `undefined` instead of a real Response —
// which is invalid and crashes with "Failed to convert value to 'Response'."
// That single bug broke page loads sitewide any time a request had a
// transient failure (slow connection, brief Netlify hiccup, anything),
// which is exactly the scenario this service worker was supposed to make
// MORE resilient, not less. Every code path below now always resolves to an
// actual Response. Also now explicitly bypasses all Next.js internal
// (/_next/) requests — those are framework-managed, versioned by build
// hash already, and don't need (or benefit from) this cache layer; the
// previous version's generic caching of unmatched GET requests reached
// these too, adding risk with no upside.

const CACHE_NAME = "web3tribe-cache-v2";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/", OFFLINE_URL, "/manifest.json"];

// A last-resort Response for when there's truly nothing else to give back —
// respondWith() must always get a real Response, never undefined.
function fallbackResponse() {
  return new Response("You're offline and this page isn't available yet. Reconnect and try again.", {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API routes, Supabase calls, or Next.js's own internal
  // asset/data routes — always let those go straight to the network
  // untouched by this cache layer.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.hostname.includes("supabase.co")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
        const root = await caches.match("/");
        if (root) return root;
        return fallbackResponse();
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached || fallbackResponse());
    })
  );
});
