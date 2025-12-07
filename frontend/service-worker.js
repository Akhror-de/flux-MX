const APP_VERSION = '3.0.1';
const CACHE_NAME = `flux-pwa-v${APP_VERSION}`;

// ОСНОВНЫЕ ФАЙЛЫ ДЛЯ КЭШИРОВАНИЯ
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/config.js',
  '/api-service.js',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml'
];

// ИКОНКИ ДЛЯ КЭШИРОВАНИЯ
const APP_ICONS = [
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// УСТАНОВКА - КЭШИРУЕМ ОСНОВНЫЕ ФАЙЛЫ
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install v' + APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll([...APP_SHELL, ...APP_ICONS]);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Install failed:', error);
      })
  );
});

// АКТИВАЦИЯ - УДАЛЯЕМ СТАРЫЕ КЭШИ
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate v' + APP_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем все старые версии кэшей
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// FETCH - СЕТЬ ПРИОРИТЕТНЕЕ КЭША
self.addEventListener('fetch', (event) => {
  // Пропускаем API запросы и аналитику
  const url = new URL(event.request.url);
  
  if (
    url.hostname.includes('yandexcloud.net') ||
    url.pathname.includes('analytics') ||
    url.pathname.includes('track')
  ) {
    return;
  }
  
  // Для HTML файлов - сеть с fallback на кэш
  if (event.request.mode === 'navigate' || 
      event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Кэшируем только успешные ответы
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // В офлайн режиме - отдаем из кэша
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Если нет в кэше - отдаем заглушку
            return caches.match('/index.html');
          });
        })
    );
    return;
  }
  
  // Для статических ресурсов - кэш с fallback на сеть
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Обновляем кэш в фоне
          fetch(event.request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
            })
            .catch(() => {
              // Игнорируем ошибки при обновлении
            });
          return cachedResponse;
        }
        
        // Если нет в кэше - загружаем из сети
        return fetch(event.request)
          .then((response) => {
            // Кэшируем только успешные ответы
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Для CSS/JS файлов возвращаем пустой ответ
            if (event.request.url.endsWith('.css')) {
              return new Response('', { 
                headers: { 'Content-Type': 'text/css' } 
              });
            }
            if (event.request.url.endsWith('.js')) {
              return new Response('// Offline', { 
                headers: { 'Content-Type': 'application/javascript' } 
              });
            }
          });
      })
  );
});

// BACKGROUND SYNC (для будущих функций)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analyses') {
    console.log('[ServiceWorker] Background sync started');
  }
});

// PUSH УВЕДОМЛЕНИЯ (для будущих функций)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'New analysis completed',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Flux Analyzer', options)
  );
});

// КЛИК ПО УВЕДОМЛЕНИЮ
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
