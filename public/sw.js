// NUESApedia Service Worker v4 — Public-Only Offline Caching (Zero Private Account Leakage)
const SHELL_CACHE = "nuesapedia-shell-v4";
const DATA_CACHE = "nuesapedia-public-data-v4";

const APP_SHELL_URLS = [
  "/",
  "/resources",
  "/saved",
  "/logo.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL_URLS.map((url) =>
            fetch(url, { cache: "reload" }).then((res) => {
              if (res.ok) return cache.put(url, res);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_USER_CACHE") {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
});

function isPublicCatalogApi(pathname) {
  // Strictly cache ONLY public read-only catalog listings — NEVER /api/saved, /api/auth, /api/moderation, or signed /view /download redirects
  if (pathname === "/api/resources" || pathname === "/api/courses" || pathname === "/api/departments") {
    return true;
  }
  if (pathname.startsWith("/api/departments/")) {
    return true;
  }
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept authenticated, user-scoped, or signed redirect APIs
  if (url.pathname.startsWith("/api/")) {
    if (!isPublicCatalogApi(url.pathname)) {
      return;
    }

    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: { code: "OFFLINE", message: "You are currently offline." },
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }

  // Static Next.js assets: Cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Public page navigations (exclude private /profile and /moderation from shared SW HTML cache)
  if (
    request.mode === "navigate" &&
    !url.pathname.startsWith("/profile") &&
    !url.pathname.startsWith("/moderation")
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const exact = await caches.match(request);
          if (exact) return exact;
          const fallback = await caches.match("/saved") || (await caches.match("/"));
          return fallback || Response.error();
        })
    );
  }
});
