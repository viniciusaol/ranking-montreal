/* ====================================================================
   MONTREAL TÊNIS CLUBE - SERVICE WORKER (PWA READY)
   ==================================================================== */

const CACHE_NAME = 'montreal-ranking-v1.6.8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/logo_montreal_branco.png',
  './assets/logo_simbolo_branco.png',
  './css/variables.css',
  './css/reset.css',
  './css/components.css',
  './css/views.css',
  './js/config.js',
  './js/supabase.js',
  './js/utils.js',
  './js/state.js',
  './js/auth.js',
  './js/router.js',
  './js/app.js',
  './js/views/admin.js',
  './js/views/ranking.js',
  './js/views/profile.js',
  './js/views/game-create.js',
  './js/views/my-games.js',
  './js/views/game-detail.js',
  './js/views/retrospective.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora requisições de APIs externas (Supabase / Matchpoint)
  if (event.request.url.includes('supabase.co') || event.request.url.includes('matchpoint.com.es')) {
    return;
  }

  // Network-first com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
