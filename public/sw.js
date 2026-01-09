const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
    const client = await self.clients.get(clientId);

    if (!client) {
        const allClients = await self.clients.matchAll({ type: 'window' });
        if (allClients.length === 0) return new Response('No client connected', { status: 503 });
    }

    const rangeHeader = event.request.headers.get('Range');
    let start = 0;
    let end = null;

    if (rangeHeader) {
        const range = rangeHeader.replace(/bytes=/, "").split("-");
        start = parseInt(range[0], 10);
        if (range[1]) end = parseInt(range[1], 10);
    }

    return new Promise(async (resolve, reject) => {
        const requestId = crypto.randomUUID();
        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (msgEvent) => {
            const data = msgEvent.data;

            if (data.error) {
                resolve(new Response(null, { status: 500, statusText: data.error }));
                return;
            }

            if (!data.success) {
                resolve(new Response(null, { status: 404 }));
                return;
            }

            const totalSize = data.totalSize;
            const chunkStart = data.start;
            const chunkEnd = data.end;
            const content = data.content;

            const headers = new Headers({
                "Content-Type": data.mimeType || "application/octet-stream",
                "Content-Length": content.byteLength,
                "Accept-Ranges": "bytes",
                "Content-Range": `bytes ${chunkStart}-${chunkEnd}/${totalSize}`,
                "Cache-Control": "no-cache, no-store, must-revalidate"
            });

            resolve(new Response(content, { status: 206, headers }));
        };

        const targetClients = client ? [client] : await self.clients.matchAll({ type: 'window' });

        if (targetClients.length > 0) {
            targetClients[0].postMessage({
                type: 'STREAM_REQUEST',
                requestId,
                fileId,
                start,
                end
            }, [messageChannel.port2]);
        } else {
            resolve(new Response('No active client to serve stream', { status: 503 }));
        }
    });
}
