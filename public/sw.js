const SHELL_CACHE = "nuesa-library-shell-v1";
const DATA_CACHE = "nuesa-library-data-v1";

const PRECACHE_ROUTES = [
  "/",
  "/resources",
  "/saved",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_ROUTES.map((route) =>
            fetch(route, { cache: "reload" }).then((res) => {
              if (res.ok) return cache.put(route, res);
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
            .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache Google Fonts stylesheets & font binaries for offline typography
  if (
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Only handle same-origin requests below
  if (url.origin !== self.location.origin) return;

  // Do not intercept binary download streams (handled by IndexedDB offline-vault)
  if (url.pathname.endsWith("/download") || url.pathname.startsWith("/api/uploads")) {
    return;
  }

  // 1. Static assets (_next/static, icons, images): Cache-First, fallback to network
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 2. Read-only catalog/saved API JSON: Network-First with cache fallback for offline resilience
  if (
    url.pathname === "/api/resources" ||
    url.pathname.startsWith("/api/resources/") ||
    url.pathname === "/api/saved" ||
    url.pathname.startsWith("/api/departments")
  ) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached =
            (await cache.match(request)) || (await cache.match(url.pathname));
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: { code: "OFFLINE", message: "Browser is currently offline." },
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      })
    );
    return;
  }

  // 3. App Router RSC payloads & HTML page navigations: Network-First with App Shell fallback
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (request.mode === "navigate" || isRsc) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            cache.put(request, fresh.clone());
            if (request.mode === "navigate") {
              cache.put(url.pathname, fresh.clone());
            }
          }
          return fresh;
        } catch {
          const exact = await cache.match(request);
          if (exact) return exact;

          if (request.mode === "navigate") {
            const byPath = await cache.match(url.pathname);
            if (byPath) return byPath;

            if (url.pathname.startsWith("/saved")) {
              const savedShell = await cache.match("/saved");
              if (savedShell) return savedShell;
            }

            const resourcesShell = await cache.match("/resources");
            if (resourcesShell) return resourcesShell;

            const homeShell = await cache.match("/");
            if (homeShell) return homeShell;
          }

          return Response.error();
        }
      })
    );
  }
});

