// NUESApedia Service Worker v5 — Privacy-Preserving Offline Caching (Zero Shared-PC Session Leaks)
const SHELL_CACHE = "nuesapedia-shell-v5";
const DATA_CACHE = "nuesapedia-public-data-v5";

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
];

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Offline — NUESApedia</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #FAFAFA; color: #0C3B2E; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; text-align: center; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 24px; max-width: 460px; width: 100%; padding: 40px 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #0C3B2E; }
    p { font-size: 13px; color: #64748B; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-flex; align-items: center; justify-content: center; background: #00875A; color: #FFFFFF; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: 700; transition: background 0.15s; }
    .btn:hover { background: #00734c; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are currently offline</h1>
    <p>Your network connection appears unavailable. Downloaded PDFs in your Offline Vault remain accessible.</p>
    <a href="/saved" class="btn">Open Saved Materials &amp; Vault</a>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          STATIC_ASSETS.map((url) =>
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

  // Navigation requests: Network-first, fallback to clean offline HTML.
  // CRITICAL: We NEVER cache user-navigated dynamic HTML in SHELL_CACHE, preventing
  // session/profile data leakage across different students on shared university PCs.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(OFFLINE_FALLBACK_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
    );
  }
});
