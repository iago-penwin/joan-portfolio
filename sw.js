// Service Worker para cacheo agresivo de imágenes
const CACHE_VERSION = 'v2';
const CACHE_NAME = `joan-portfolio-${CACHE_VERSION}`;

// Recursos críticos para cachear inmediatamente
const CRITICAL_ASSETS = [
    './',
    './fashion-portfolio.html',
    './DISSENYS-WEBP/main.webp',
    './DISSENYS-WEBP/1-diseño1.webp',
    './DISSENYS-WEBP/2-diseño1.webp'
];

// Instalación: cachear recursos críticos
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching critical assets');
            return cache.addAll(CRITICAL_ASSETS);
        }).then(() => {
            console.log('[SW] Skip waiting');
            return self.skipWaiting();
        })
    );
});

// Activación: limpiar cachés antiguos
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Claiming clients');
            return self.clients.claim();
        })
    );
});

// Estrategia de caché: Cache First para imágenes, Network First para HTML
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo cachear requests del mismo origen
    if (url.origin !== location.origin) {
        return;
    }

    // Estrategia para imágenes WebP: Cache First con actualización en background
    if (request.url.includes('.webp') || request.url.includes('.jpg')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    // Retornar caché inmediatamente si existe
                    if (cachedResponse) {
                        // Actualizar en background
                        fetch(request).then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(request, networkResponse.clone());
                            }
                        }).catch(() => {
                            // Network failed, but we have cache
                        });

                        return cachedResponse;
                    }

                    // Si no hay caché, fetch de red y cachear
                    return fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Para HTML y otros recursos: Network First con fallback a Cache
    if (request.url.includes('.html') || request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Si falla la red, usar caché
                    return caches.match(request);
                })
        );
        return;
    }

    // Para fuentes y otros assets: Cache First
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            });
        })
    );
});

// Precachear todas las imágenes WebP cuando el SW está idle
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PRECACHE_IMAGES') {
        const imagesToCache = event.data.urls;

        caches.open(CACHE_NAME).then((cache) => {
            imagesToCache.forEach((url) => {
                // Fetch y cachear en background
                fetch(url)
                    .then((response) => {
                        if (response && response.status === 200) {
                            cache.put(url, response);
                        }
                    })
                    .catch(() => {
                        // Ignore errors in background caching
                    });
            });
        });
    }
});
