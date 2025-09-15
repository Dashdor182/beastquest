/* Beast Quest PWA Service Worker */

const APP_VERSION = 'bq-2025-09-15-01';
const CACHE_NAME  = `beastquest-${APP_VERSION}`;

const APP_ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './app/main.js',
  './app/ui.js',
  './app/stats.js',
  './app/state.js',
  './app/achievements.js',   // NEW
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
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
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('beastquest-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' &&
          request.headers.get('accept') &&
          request.headers.get('accept').includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
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

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchAndUpdate = fetch(req).then((res) => {
      if (res && (res.status === 200 || res.type === 'opaque')) {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(fetchAndUpdate);
      return cached;
    }

    const fresh = await fetchAndUpdate;
    if (fresh) return fresh;

    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});
