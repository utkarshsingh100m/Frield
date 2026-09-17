/**
 * sw.js — Frield Service Worker
 * Cache-first for static assets, network-first for API calls.
 */

const CACHE_NAME = 'frield-v3';
// Only pre-cache CSS + manifest. JS files are network-first so code updates are instant.
const STATIC_ASSETS = [
  '/css/styles.css',
  '/manifest.json'
];

// ── Install: pre-cache static shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route-based strategy ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for HTML pages — always get fresh HTML, fall back to cache offline
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Network-first for JS files — always get fresh code, fall back to cache offline
  if (url.pathname.startsWith('/js/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for API calls (XHR/fetch only — NOT browser navigation)
  // Excluding navigate mode ensures OAuth redirects like /google/callback pass through to the server
  const isApiCall = request.mode !== 'navigate' && ['/auth', '/emails', '/vault', '/passwords', '/google', '/subscription', '/score'].some(
    p => url.pathname.startsWith(p)
  );

  if (isApiCall) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(JSON.stringify({ error: 'You are offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful GET responses
        if (request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Return cached index.html for navigation requests (SPA fallback)
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// ── Background Sync Notification (optional future use) ──────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
