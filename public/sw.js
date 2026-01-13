const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
    console.log('[SW] Installing SW version:', SW_VERSION);
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating SW version:', SW_VERSION);
    event.waitUntil(self.clients.claim().then(() => {
        console.log('[SW] Clients claimed.');
    }));
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/stream/')) {
        event.respondWith(handleStreamRequest(event));
    }
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
