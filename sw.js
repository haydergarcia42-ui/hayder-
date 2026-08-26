const CACHE_NAME = '𝒽ℊ';

// 1. Instalar y activar inmediatamente (evita que se quede pegada la versión vieja)
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

// 2. Estrategia "Network First" (Red primero)
self.addEventListener('fetch', event => {
    // Excluimos algunas peticiones raras de navegadores
    if (event.request.method !== 'GET') return;

    event.respondWith(
        // Intenta descargar la versión más reciente de internet
        fetch(event.request).then(response => {
            // Si hay internet, guarda una copia nueva en la caché
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, response.clone());
                return response;
            });
        }).catch(() => {
            // Si NO hay internet (modo offline), usa la versión que guardó antes
            return caches.match(event.request);
        })
    );
});