/* Beast Quest PWA Service Worker
   Scope: GitHub Pages subpath (e.g., /beastquest/)
   Strategy: App Shell (offline index.html) + cache-first for static assets
*/

const APP_VERSION = 'bq-2025-09-14-01';
const CACHE_NAME  = `beastquest-${APP_VERSION}`;

/* Precache: use relative paths so they resolve under the SW scope (/beastquest/) */
const APP_ASSETS = [
  './',                 // start URL
  './index.html',
  './assets/styles.css',
  './app/main.js',
  './app/ui.js',
  './app/stats.js',
  './app/state.js',
  // External CDN (opaque response is fine; cached for offline)
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add same-origin normally; add cross-origin with no-cors requests
      const toAdd = APP_ASSETS.map((url) => {
        try {
          const u = new URL(url, self.registration.scope);
          const isExternal = u.origin !== self.location.origin;
          return isExternal ? new Request(url, { mode: 'no-cors' }) : url;
        } catch {
          return url;
        }
      });
      return cache.addAll(toAdd);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean up old caches
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('beastquest-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* Helper: HTML navigation detection */
function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' &&
          request.headers.get('accept') &&
          request.headers.get('accept').includes('text/html'));
}

/* Fetch strategy:
   - Navigations: network-first, fallback to cached index.html (app shell).
   - Static assets: cache-first, update cache in background.
   - Others: pass-through.
*/
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Update cached index.html if we navigated to it
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('./index.html');
        return cached || new Response('<h1>Offline</h1><p>Content is unavailable offline.</p>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200
        });
      }
    })());
    return;
  }

  // For assets (CSS/JS/CDN), do cache-first and update in background
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchAndUpdate = fetch(req).then((res) => {
      // Only cache successful or opaque responses
      if (res && (res.status === 200 || res.type === 'opaque')) {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);

    // If we have cached, return it immediately; also kick off update
    if (cached) {
      // Update cache in background (no await)
      event.waitUntil(fetchAndUpdate);
      return cached;
    }

    // Else try network, fallback to cached index for same-origin JS/CSS if truly offline
    const fresh = await fetchAndUpdate;
    if (fresh) return fresh;

    // Last-ditch: return something graceful
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});
