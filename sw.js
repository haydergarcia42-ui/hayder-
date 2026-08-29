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

// Reconstruye una respuesta parcial (206) a partir de una respuesta completa
// guardada en caché, respetando el encabezado "Range" que pide el <audio>.
async function respuestaConRango(request, cachedResponse) {
    const rangeHeader = request.headers.get('range');
    if (!rangeHeader) return cachedResponse;

    const buffer = await cachedResponse.clone().arrayBuffer();
    const totalLength = buffer.byteLength;
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!match) return cachedResponse;

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
    const slice = buffer.slice(start, end + 1);

    return new Response(slice, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
            'Content-Type': cachedResponse.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Range': `bytes ${start}-${end}/${totalLength}`,
            'Content-Length': slice.byteLength,
            'Accept-Ranges': 'bytes'
        }
    });
}

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
    // Así, si ya está guardado, se reproduce al instante sin esperar
    // a que falle un intento de red (eso es lo que causaba el corte
    // al pasar de canción sin conexión).
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return respuestaConRango(request, cachedResponse);
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