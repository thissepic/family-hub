// Service Worker - Family Hub
// Build ID: __BUILD_ID__ (auto-injected at build time — DO NOT EDIT sw.js directly, edit sw.template.js)
//
// Caching strategy:
//   Navigation requests  → Network-only (always fresh HTML)
//   /_next/static/*      → Cache-first (filenames contain content hashes, immutable)
//   Other static assets  → Network-first with cache fallback
//   API / Socket.IO      → Passthrough (no caching)

const BUILD_ID = "__BUILD_ID__";
const CACHE_NAME = `family-hub-${BUILD_ID}`;

const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
];

// ─── Install ──────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  // Delete ALL caches that don't match the current build
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────

// Next.js hashed assets under /_next/static/ are immutable — safe to cache forever
const NEXT_HASHED = /^\/_next\/static\/.+/;

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Non-GET requests: passthrough
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Socket.IO: passthrough
  if (url.pathname.startsWith("/socket.io")) return;

  // API routes: passthrough (no caching for mutations/data)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: Network-only, fallback to offline page
  // This ensures users always get the latest HTML after a deployment
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline"))
    );
    return;
  }

  // Next.js hashed assets (/_next/static/*): Cache-first
  // These filenames contain content hashes so they're inherently versioned
  if (NEXT_HASHED.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest, fonts, etc.): Network-first, cache fallback
  // This avoids serving stale non-hashed assets after a deployment
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ─── Web Push ─────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Family Hub", message: event.data.text() };
  }

  const options = {
    body: data.message,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    tag: data.tag || "family-hub",
    data: { linkUrl: data.linkUrl || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const linkUrl = event.notification.data?.linkUrl || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(linkUrl);
          return;
        }
      }
      return self.clients.openWindow(linkUrl);
    })
  );
});
