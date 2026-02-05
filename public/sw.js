const SW_VERSION = '1.0.2'; // Updated for static asset caching

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
            // Cache static assets
            caches.open(STATIC_CACHE).then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
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

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip chrome-extension requests entirely
    if (url.protocol === 'chrome-extension:') {
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
                            const reqUrl = new URL(event.request.url);
                            // Only cache HTTP/HTTPS requests
                            if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
                                caches.open(RUNTIME_CACHE).then(cache => {
                                    try {
                                        // Re-check protocol to avoid race conditions and attach error handling to cache.put promise
                                        const reqUrlInner = new URL(event.request.url);
                                        if (reqUrlInner.protocol === 'http:' || reqUrlInner.protocol === 'https:') {
                                            cache.put(event.request, responseClone).catch(err => {
                                                console.warn('[SW] Cache.put rejected:', event.request.url, err);
                                            });
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
                    const reqUrl = new URL(event.request.url);
                    // Only cache HTTP/HTTPS requests
                    if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
                        caches.open(RUNTIME_CACHE).then(cache => {
                            try {
                                // Re-check protocol and attach error handling to cache.put promise
                                const reqUrlInner = new URL(event.request.url);
                                if (reqUrlInner.protocol === 'http:' || reqUrlInner.protocol === 'https:') {
                                    cache.put(event.request, responseClone).catch(err => {
                                        console.warn('[SW] Cache.put rejected:', event.request.url, err);
                                    });
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
            .catch(() => {
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
