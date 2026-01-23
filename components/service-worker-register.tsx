"use client"

import { useEffect } from "react"
import { StreamManager } from "@/lib/streaming"

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Register ensuring high resilience
            navigator.serviceWorker.register('/sw.js')
                .then(async (reg) => {
                    // console.log('Service Worker registered', reg);

                    // If there's a waiting SW (new version), activate it immediately
                    if (reg.waiting) {
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Listen for new SW becoming available
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New SW available, auto-activate it
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                }
                            });
                        }
                    });

                    // Force update check to ensure we aren't stuck on an old one
                    await reg.update().catch(() => { });

                    // Wait for SW to be controlling before initializing StreamManager
                    await navigator.serviceWorker.ready;
                    
                    if (!navigator.serviceWorker.controller) {
                        // Reload page once to get SW control
                        window.location.reload();
                        return;
                    }

                    // Initialize StreamManager singleton which attaches message listeners
                    StreamManager.getInstance();
                })
                .catch(err => console.error('Service Worker registration failed', err));
        }
    }, [])

    return null
}
