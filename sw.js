const CACHE = 'asogic29-v151';

const PRECACHE = [
  'index.html',
  'app.js',
  'styles.css',
  'data/program.json',
  'manifest.webmanifest',
  'icons/asogic-logo.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith('asogic29-') && key !== CACHE)
          .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(cacheThenNetwork(req));
});

async function cacheThenNetwork(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true }) || await caches.match(req, { ignoreSearch: true });
  const network = fetch(req)
    .then(async (res) => {
      if (res && res.ok && res.type === 'basic') {
        try { await cache.put(req, res.clone()); } catch (e) {}
      }
      return res;
    })
    .catch(() => null);
  if (cached) {
    network.then(() => {});
    return cached;
  }
  const res = await network;
  if (res) return res;
  if (req.mode === 'navigate') {
    const shell = await cache.match('index.html');
    if (shell) return shell;
  }
  return Response.error();
}
