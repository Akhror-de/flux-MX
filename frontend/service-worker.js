const CACHE_NAME = 'flux-v3-' + Date.now(); // НОВОЕ ИМЯ КЭША

const CORE_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/config.js',
  '/api-service.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// УДАЛИТЬ ВСЕ СТАРЫЕ КЭШИ ПРИ АКТИВАЦИИ
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate - deleting old caches');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем ВСЕ старые кэши
          console.log('[ServiceWorker] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// КЭШИРУЕМ ТОЛЬКО ПРИ УСТАНОВКЕ
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install - caching core files');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CORE_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// СЕТЬ ПРИОРИТЕТНЕЕ КЭША
self.addEventListener('fetch', event => {
  // ПРОПУСКАЕМ API запросы
  if (event.request.url.includes('yandexcloud.net')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Кэшируем только успешные GET запросы
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Офлайн режим
        return caches.match(event.request);
      })
  );
});
