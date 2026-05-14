/**
 * LocalSeat service worker — offline shell caching for the canvassing screen.
 *
 * STRATEGY:
 * - Static assets (Next.js bundles, icons, manifest): cache-first with
 *   background network update. These rarely change during a canvassing session.
 * - Navigation requests (HTML pages including /canvassing): network-first,
 *   falling back to the cached shell so the screen loads offline.
 * - API routes and server action POST requests: NOT intercepted. Server actions
 *   are POST requests and are handled entirely at the app layer via the
 *   IndexedDB offline queue (src/lib/offline-queue.ts).
 *
 * NOTE: This service worker provides a cached shell so the canvassing UI loads
 * when offline. It does NOT cache data responses from the server — all
 * data-bearing requests (queue loading, person details) still require a network
 * connection. The queue data itself is stored in IndexedDB by the app layer.
 */

const CACHE_NAME = "localseat-1778772100000";

const PRECACHE_URLS = [
  "/manifest.json",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Notify all open tabs that a new version is active so they can reload
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
        });
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never intercept non-GET requests.
  // Server actions are POST — they must reach the server or be queued by the
  // app layer. The SW must not attempt to intercept or replay them.
  if (request.method !== "GET") return;

  // Never intercept API routes — these must always reach the server.
  if (url.pathname.startsWith("/api/")) return;

  // Never intercept Next.js internal requests (RSC payloads, prefetch).
  if (url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/_next/data/")) return;

  // ── Cache-first: Next.js static assets ──────────────────────────────────
  // These are content-hashed by Next.js, so cache-first is safe.
  if (
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE_URLS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Network-first: navigation requests (HTML pages) ──────────────────────
  // Falls back to cache so the canvassing screen shell loads when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ── Network-only: all other GET requests ─────────────────────────────────
  // Do NOT cache these — they include Next.js RSC payloads and prefetch
  // responses. Serving stale versions causes React hydration error #300.
  // Let them pass through to the network without interception.
});
