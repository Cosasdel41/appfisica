
const CACHE_NAME = 'pfisica-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=3',
  './script.js?v=3',
  './materias.json',
  './manifest.webmanifest',
  './icons/android-chrome-192x192.png',
  './icons/android-chrome-512x512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Stale-while-revalidate strategy for all GET requests
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(networkRes => {
      // Only cache successful basic responses
      if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
        cache.put(req, networkRes.clone());
      }
      return networkRes;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
