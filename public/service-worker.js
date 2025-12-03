// Flux PWA Service Worker - Production Version
const CACHE_NAME = 'flux-pwa-v1.0.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

const DYNAMIC_CACHE_NAME = 'flux-dynamic-v1.0.0';

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Установка');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Кэширование статических ресурсов');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Установка завершена');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[ServiceWorker] Ошибка установки:', error);
            })
    );
});

// Активация - очистка старых кэшей
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Активация');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                        console.log('[ServiceWorker] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('[ServiceWorker] Активация завершена');
            return self.clients.claim();
        })
    );
});

// Обработка fetch запросов
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Пропускаем не-GET запросы
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Для аудиофайлов - особая стратегия
    if (event.request.url.match(/\.(mp3|wav|ogg|flac)$/i)) {
        event.respondWith(audioCacheStrategy(event));
        return;
    }
    
    // Для остального - Cache First, затем Network
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Обновляем кэш в фоне
                    fetchAndCache(event.request);
                    return cachedResponse;
                }
                
                return fetchAndCache(event.request);
            })
            .catch(() => {
                // Fallback для HTML страниц
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                
                return new Response('Офлайн-контент не доступен', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                });
            })
    );
});

// Стратегия для аудиофайлов
function audioCacheStrategy(event) {
    return caches.open(DYNAMIC_CACHE_NAME)
        .then(cache => {
            return cache.match(event.request)
                .then(response => {
                    if (response) {
                        fetchAndCache(event.request, DYNAMIC_CACHE_NAME);
                        return response;
                    }
                    
                    return fetchWithProgress(event, cache);
                });
        });
}

// Загрузка с отслеживанием прогресса
function fetchWithProgress(event, cache) {
    return fetch(event.request)
        .then(response => {
            const responseClone = response.clone();
            
            if (response.status === 200) {
                cache.put(event.request, responseClone)
                    .catch(error => {
                        console.warn('[ServiceWorker] Ошибка кэширования аудио:', error);
                    });
            }
            
            return response;
        })
        .catch(error => {
            console.error('[ServiceWorker] Ошибка загрузки аудио:', error);
            throw error;
        });
}

// Загрузка и кэширование ресурса
function fetchAndCache(request, cacheName = CACHE_NAME) {
    return fetch(request)
        .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }
            
            const responseToCache = response.clone();
            
            caches.open(cacheName)
                .then(cache => {
                    cache.put(request, responseToCache);
                });
            
            return response;
        })
        .catch(error => {
            console.error('[ServiceWorker] Ошибка загрузки:', error);
            throw error;
        });
}

// Push-уведомления
self.addEventListener('push', event => {
    console.log('[ServiceWorker] Push-уведомление получено');
    
    let data = {};
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body || 'Flux AI Mixer',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Flux', options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
    console.log('[ServiceWorker] Клик по уведомлению');
    
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url || '/');
                }
            })
    );
});
