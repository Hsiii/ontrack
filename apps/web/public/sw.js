const STATIONS_CACHE = 'api-stations-cache';
const SCHEDULE_CACHE = 'api-schedule-cache';
const KNOWN_CACHES = [STATIONS_CACHE, SCHEDULE_CACHE];
const SCHEDULE_TIMEOUT_MS = 3000;

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => !KNOWN_CACHES.includes(key))
                        .map((key) => caches.delete(key))
                )
            )
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET' || url.origin !== location.origin) {
        return;
    }

    if (url.pathname === '/api/stations') {
        event.respondWith(staleWhileRevalidate(event.request, STATIONS_CACHE));
        return;
    }

    if (url.pathname === '/api/schedule') {
        event.respondWith(networkFirst(event.request, SCHEDULE_CACHE));
    }
});

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fresh = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    });

    return cached || fresh;
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        const response = await withTimeout(fetch(request), SCHEDULE_TIMEOUT_MS);
        if (response.ok && response.status === 200) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw new Error('Schedule request failed and no cache is available.');
    }
}

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(
                () => reject(new Error('Request timed out.')),
                timeoutMs
            );
        }),
    ]);
}
