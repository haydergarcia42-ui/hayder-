const CACHE_NAME = 'hg-music-v3';

// Forzar activación inmediata de nuevas versiones
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia blindada para celulares y PC
self.addEventListener('fetch', event => {
    const request = event.request;

    // Si es la página principal (HTML), OBLIGATORIAMENTE va a internet primero
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Solo si el dispositivo está 100% sin internet, usa la caché
                    return caches.match(request);
                })
        );
        return;
    }

    // Para el resto de archivos
    event.respondWith(
        fetch(request)
            .then(response => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, response.clone());
                    return response;
                });
            })
            .catch(() => {
                return caches.match(request);
            })
    );
});