const SW_VERSION = '2.0.0'; // Major update: Strict whitelist only

// Cache names
const STATIC_CACHE = 'drive-static-v1';
const RUNTIME_CACHE = 'drive-images-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/favicon.ico',
    '/favicon.svg',
    '/favicon-96x96.png',
    '/apple-touch-icon.png',
    '/manifest.json',
    '/login.png',
    '/og-image.png',
    '/og-share.png',
    '/register.png',
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing SW version:', SW_VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[SW] Failed to cache some static assets:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating SW version:', SW_VERSION);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            self.clients.claim();
            // Notify clients
            self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.postMessage({ type: 'SW_READY' }));
            });
        })
    );
});

self.addEventListener('fetch', (event) => {
    let url;
    try {
        url = new URL(event.request.url);
    } catch (e) {
        return;
    }

    // 1. Handle Video Streaming (Keep this logic)
    if (url.pathname.startsWith('/stream/')) {
        event.respondWith(handleStreamRequest(event));
        return;
    }

    // 2. Handle Static Assets (Images, Fonts, CSS, JS, Next.js static)
    // STRICTLY ONLY GET requests
    if (event.request.method === 'GET') {
        const isStaticAsset =
            url.pathname.startsWith('/_next/static/') ||
            url.pathname.match(/\.(css|js|woff2?|png|jpg|jpeg|svg|ico|gif|webp)$/);

        if (isStaticAsset) {
            event.respondWith(
                caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(response => {
                        // Only cache valid responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone and Cache
                        const responseToCache = response.clone();
                        caches.open(RUNTIME_CACHE).then(cache => {
                            cache.put(event.request, responseToCache).catch(err => {
                                console.warn('[SW] Cache put failed:', err);
                            });
                        });

                        return response;
                    }).catch(() => {
                        // Fallback? usually not needed for static assets unless offline
                        // But for now we just fail if network fails
                        return new Response('Network error', { status: 408 });
                    });
                })
            );
            return;
        }
    }

    // 3. EVERYTHING ELSE: Do nothing. Browser handles it.
    // APIs, HTML pages (unless in static cache), etc. will go to network.
    return;
});

// Stream Handler (Preserved)
async function handleStreamRequest(event) {
    const parts = new URL(event.request.url).pathname.split('/');
    const fileId = parts[2];

    if (!fileId) return new Response('Invalid stream URL', { status: 400 });

    const clientId = event.clientId;
    let client = clientId ? await self.clients.get(clientId) : null;

    const rangeHeader = event.request.headers.get('Range');
    let start = 0;
    let end = null;

    if (rangeHeader) {
        const range = rangeHeader.replace(/bytes=/, "").split("-");
        start = parseInt(range[0], 10);
        if (range[1]) end = parseInt(range[1], 10);
    }

    // console.log(`[SW] Stream request for ${fileId}, range: ${start}-${end || ''}`);

    return new Promise(async (resolve, reject) => {
        const requestId = crypto.randomUUID();
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(new Response('Stream request timed out', { status: 504 }));
            }
        }, 10000);

        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const targetClients = client ? [client, ...allClients.filter(c => c.id !== client.id)] : allClients;

        if (targetClients.length > 0) {
            targetClients.forEach(c => {
                const chan = new MessageChannel();

                chan.port1.onmessage = (msgEvent) => {
                    if (resolved) return;
                    const data = msgEvent.data;

                    if (data.error || !data.success) return;

                    resolved = true;
                    clearTimeout(timeout);

                    const totalSize = data.totalSize;
                    const chunkStart = data.start;
                    const chunkEnd = data.end;
                    const content = data.content;

                    const headers = new Headers({
                        "Content-Type": data.mimeType || "application/octet-stream",
                        "Content-Length": content.byteLength,
                        "Accept-Ranges": "bytes",
                        "Content-Range": `bytes ${chunkStart}-${chunkEnd}/${totalSize}`,
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "X-Content-Duration": data.duration || ""
                    });

                    resolve(new Response(content, { status: 206, headers }));
                };

                c.postMessage({
                    type: 'STREAM_REQUEST',
                    requestId,
                    fileId,
                    start,
                    end
                }, [chan.port2]);
            });
        } else {
            resolved = true;
            clearTimeout(timeout);
            resolve(new Response('No active client to serve stream', { status: 503 }));
        }
    });
}
