const SW_VERSION = '1.0.3'; // Updated for static asset caching

// Cache names
const STATIC_CACHE = 'drive-static-v1';
const RUNTIME_CACHE = 'drive-runtime-v1';

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
    // Cache critical CSS and JS patterns
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing SW version:', SW_VERSION);
    event.waitUntil(
        Promise.all([
            // Cache static assets (filter unsafe entries and handle failures)
            caches.open(STATIC_CACHE).then(cache => {
                console.log('[SW] Caching static assets');
                const safeAssets = STATIC_ASSETS.filter(path => {
                    try {
                        const u = new URL(path, self.location.origin);
                        return u.protocol === 'http:' || u.protocol === 'https:';
                    } catch (e) {
                        // Exclude invalid URLs
                        console.warn('[SW] Excluding invalid static asset from cache list:', path, e);
                        return false;
                    }
                });
                if (safeAssets.length === 0) return Promise.resolve();
                return cache.addAll(safeAssets).catch(err => {
                    console.warn('[SW] cache.addAll failed, continuing without blocking install:', err);
                    // Don't fail install for cache errors
                    return Promise.resolve();
                });
            }).catch(err => {
                console.warn('[SW] Failed to open static cache during install:', err);
                return Promise.resolve();
            }),
            // Skip waiting to take control immediately
            self.skipWaiting()
        ])
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating SW version:', SW_VERSION);
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all clients
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] SW activated and controlling all clients');
            // Notify all clients that SW is ready
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SW_READY' });
                });
            });
        })
    );
});

// Handle skip waiting message from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Global handlers to help diagnose and prevent uncaught promise rejections
self.addEventListener('unhandledrejection', (e) => {
    try { console.warn('[SW] unhandledrejection:', e.reason); } catch (err) { }
});
self.addEventListener('error', (e) => {
    try { console.warn('[SW] error event:', e.message || e); } catch (err) { }
});

self.addEventListener('fetch', (event) => {
    // Guard URL parsing to avoid unexpected schemes or bad URLs
    let url;
    try {
        url = new URL(event.request.url);
    } catch (e) {
        console.warn('[SW] Skipping fetch handler for invalid URL:', event.request.url, e);
        return; // skip handling this request
    }

    // Skip chrome-extension and other unsupported schemes entirely
    if (url.protocol && !url.protocol.startsWith('http')) {
        // Log at debug level only for non-http schemes
        if (url.protocol !== 'about:' && url.protocol !== 'data:') {
            // console.debug('[SW] Skipping fetch for unsupported protocol:', url.protocol, event.request.url);
        }
        return;
    }

    // Exclude AI chat API from service worker (streaming)
    if (url.pathname.includes('/api/v1/ai/chat')) {
        return;
    }

    // Handle stream requests (existing functionality)
    if (url.pathname.startsWith('/stream/')) {
        event.respondWith(handleStreamRequest(event));
        return;
    }

    // Handle static assets and Next.js assets
    if (event.request.method === 'GET' &&
        (url.pathname.startsWith('/_next/static/') ||
            url.pathname.startsWith('/favicon') ||
            url.pathname.startsWith('/manifest.json') ||
            url.pathname.match(/\.(css|js|woff2?|png|jpg|jpeg|svg|ico)$/))) {

        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Return cached version if available
                    if (response) {
                        return response;
                    }

                    // Fetch and cache
                    return fetch(event.request).then(response => {
                        // Only cache successful responses
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            // Ensure we can parse the URL and it's http(s)
                            let reqUrl;
                            try {
                                reqUrl = new URL(event.request.url);
                            } catch (err) {
                                console.warn('[SW] Invalid request URL, skipping cache:', event.request.url, err);
                            }

                            if (reqUrl && (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:')) {
                                caches.open(RUNTIME_CACHE).then(cache => {
                                    try {
                                        // Re-check protocol and attach error handling to cache.put promise
                                        const reqUrlInner = new URL(event.request.url);
                                        if (reqUrlInner.protocol === 'http:' || reqUrlInner.protocol === 'https:') {
                                            try {
                                                // Use the sanitized href as cache key (avoid putting non-http request objects)
                                                const key = reqUrlInner.href;
                                                const putPromise = cache.put(key, responseClone);
                                                if (putPromise && typeof putPromise.then === 'function') {
                                                    putPromise.catch(err => {
                                                        console.warn('[SW] Cache.put rejected for key:', key, err);
                                                    });
                                                }
                                            } catch (err) {
                                                // cache.put may throw synchronously in some browsers for unsupported request schemes
                                                try { console.warn('[SW] cache.put threw synchronously for key:', reqUrlInner.href, err); } catch (e) { }
                                            }
                                        } else {
                                            console.warn('[SW] Skipping cache.put for non-http request:', event.request.url);
                                        }
                                    } catch (err) {
                                        console.warn('[SW] Unable to cache request (put-time):', event.request.url, err);
                                    }
                                }).catch(err => {
                                    console.warn('[SW] Failed to open cache for request:', event.request.url, err);
                                });
                            } else {
                                console.warn('[SW] Skipping caching for non-http request:', event.request.url);
                            }
                        }
                        return response;
                    }).catch(err => {
                        console.warn('[SW] Fetch failed for static asset, falling back to cache:', event.request.url, err);
                        return caches.match(event.request);
                    });
                })
                .catch(() => {
                    // Fallback for offline - try cache only
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For other requests, use network-first strategy
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache successful GET responses for potential future use
                if (response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    // Ensure URL parse safe
                    let reqUrl;
                    try {
                        reqUrl = new URL(event.request.url);
                    } catch (e) {
                        console.warn('[SW] Invalid request URL, skipping cache (network-first):', event.request.url, e);
                    }

                    // Only cache HTTP/HTTPS requests
                    if (reqUrl && (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:')) {
                        caches.open(RUNTIME_CACHE).then(cache => {
                            try {
                                const reqUrlInner = new URL(event.request.url);
                                if (reqUrlInner.protocol === 'http:' || reqUrlInner.protocol === 'https:') {
                                    try {
                                        const key = reqUrlInner.href;
                                        const putPromise = cache.put(key, responseClone);
                                        if (putPromise && typeof putPromise.then === 'function') {
                                            putPromise.catch(err => {
                                                console.warn('[SW] Cache.put rejected for key:', key, err);
                                            });
                                        }
                                    } catch (err) {
                                        try { console.warn('[SW] cache.put threw synchronously for key:', reqUrlInner.href, err); } catch (e) { }
                                    }
                                } else {
                                    console.warn('[SW] Skipping cache.put for non-http request:', event.request.url);
                                }
                            } catch (err) {
                                console.warn('[SW] Unable to cache request (put-time):', event.request.url, err);
                            }
                        }).catch(err => {
                            console.warn('[SW] Failed to open cache for request:', event.request.url, err);
                        });
                    } else {
                        console.warn('[SW] Skipping caching for non-http request:', event.request.url);
                    }
                }
                return response;
            })
            .catch(err => {
                console.warn('[SW] Network failed in network-first fetch, trying cache:', event.request.url, err);
                // Network failed, try cache
                return caches.match(event.request);
            })
    );
});

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

    console.log(`[SW] Stream request for ${fileId}, range: ${start}-${end || ''}, clientId: ${clientId || 'unknown'}`);

    return new Promise(async (resolve, reject) => {
        const requestId = crypto.randomUUID();
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                console.error(`[SW] Stream request ${requestId} timed out after 10s`);
                resolved = true;
                resolve(new Response('Stream request timed out', { status: 504 }));
            }
        }, 10000);

        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

        // Prioritize the client that made the request if found
        const targetClients = client ? [client, ...allClients.filter(c => c.id !== client.id)] : allClients;

        if (targetClients.length > 0) {
            console.log(`[SW] Broadcasting STREAM_REQUEST ${requestId} to ${targetClients.length} clients`);
            targetClients.forEach(c => {
                const chan = new MessageChannel();

                chan.port1.onmessage = (msgEvent) => {
                    if (resolved) return;
                    const data = msgEvent.data;

                    if (data.error) {
                        console.error(`[SW] Client returned error for ${fileId}:`, data.error);
                        return;
                    }

                    if (!data.success) {
                        return;
                    }

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
            console.error(`[SW] No window clients available for stream ${fileId}. includeUncontrolled: true was used.`);
            resolve(new Response('No active client to serve stream', { status: 503 }));
        }
    });
}
