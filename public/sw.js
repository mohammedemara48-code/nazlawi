// Nazlawi service worker: app shell + recently viewed pages/listings + offline fallback.
const VERSION = "v5";
const SHELL = `nz-shell-${VERSION}`;
const PAGES = `nz-pages-${VERSION}`;
const ASSETS = `nz-assets-${VERSION}`;
const MAX_PAGES = 40;
const SHELL_URLS = ["/", "/en", "/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest", "/village-hero.jpg", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nz-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

const PRIVATE = /^\/(en\/)?(dashboard|admin|settings|login|signup|forgot-password|reset-password|verify|confirm-email|dev)(\/|$)/;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Static assets & uploaded images: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/api/uploads/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  // Public listing API: network-first, fall back to cache.
  if (/^\/api\/(listings|stores|promotions)(\/|$|\?)/.test(url.pathname) && !url.pathname.includes("/images")) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || Response.json({ error: { code: "OFFLINE", message: "offline" } }, { status: 503 }))),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  // Other static files (icons, manifest, hero image, fonts): cache, then network.
  if (req.mode !== "navigate") {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  // Page navigations: network-first; cache public pages; offline fallback by language.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok && !PRIVATE.test(url.pathname)) {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES));
        }
        return res;
      }).catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        return (await caches.match("/offline.html")) || new Response("Offline", { status: 503 });
      }),
    );
  }
});
