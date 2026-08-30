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

    // Para audio, portadas y demás archivos descargados: CACHÉ PRIMERO.
    // Se devuelve el archivo cacheado tal cual (sin tocar sus bytes),
    // porque si viene de otro dominio (Google Drive, Dropbox, etc.)
    // el navegador no deja que el service worker lea su contenido,
    // y cualquier intento de "recortarlo" produce silencio.
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(request));
        })
    );
});