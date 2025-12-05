/**
 * Flux PWA Service Worker
 * Production version with caching strategies
 */

const CACHE_NAME = 'flux-v2.0.0';
const STATIC_CACHE = 'flux-static-v2.0.0';
const API_CACHE = 'flux-api-v2.0.0';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/config.js',
  '/api-service.js',
  '/components/analyzer-ui.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Yandex Cloud Function endpoints (not cached by default)
const API_ENDPOINTS = [
  'https://functions.yandexcloud.net/'
];

// Install event
self.addEventListener('install', event => {
  console.log('🛠 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker installation failed:', error);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('🧹 Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients
      self.clients.claim()
    ])
    .then(() => {
      console.log('✅ Service Worker activated');
    })
    .catch(error => {
      console.error('❌ Service Worker activation failed:', error);
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle API requests
  if (API_ENDPOINTS.some(endpoint => url.href.startsWith(endpoint))) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Handle static asset requests
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }
  
  // Handle other requests (network first)
  event.respondWith(handleNetworkFirstRequest(event.request));
});

/**
 * Handle API requests (network only, no caching)
 */
async function handleApiRequest(request) {
  try {
    // Always try network first for API requests
    const response = await fetch(request);
    
    // Clone response for potential caching (if needed)
    const responseClone = response.clone();
    
    // You could cache successful API responses here if needed
    // But for analysis API, we usually want fresh data
    
    return response;
    
  } catch (error) {
    console.error('API request failed:', error);
    
    // For API requests, don't fall back to cache
    // Return a meaningful error response
    return new Response(
      JSON.stringify({
        error: 'Network error',
        message: 'Please check your internet connection',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Handle static asset requests (cache first)
 */
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      updateCacheInBackground(request);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the new response
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
    
  } catch (error) {
    console.error('Static request failed:', error);
    
    // For HTML requests, return offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    
    // For other static assets, return generic error
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Handle network-first requests
 */
async function handleNetworkFirstRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, return offline response
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'You are offline and this resource is not cached'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Update cache in background
 */
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response);
    }
  } catch (error) {
    // Silent fail for background updates
  }
}

/**
 * Handle push notifications
 */
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New notification from Flux',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'flux-notification',
    data: data.data || {},
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Flux', options)
  );
});

/**
 * Handle notification click
 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

/**
 * Handle background sync
 */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-analyses') {
    event.waitUntil(syncPendingAnalyses());
  }
});

/**
 * Sync pending analyses
 */
async function syncPendingAnalyses() {
  // Implement background sync logic here
  // This would sync any pending analyses when network is restored
  console.log('Background sync triggered');
}

/**
 * Handle periodic sync (if supported)
 */
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-cache') {
      event.waitUntil(updateStaticCache());
    }
  });
}

/**
 * Update static cache periodically
 */
async function updateStaticCache() {
  const cache = await caches.open(STATIC_CACHE);
  const requests = await cache.keys();
  
  for (const request of requests) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response);
      }
    } catch (error) {
      // Continue with next request
    }
  }
}

// Log service worker events
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle errors
self.addEventListener('error', error => {
  console.error('Service Worker error:', error);
});
