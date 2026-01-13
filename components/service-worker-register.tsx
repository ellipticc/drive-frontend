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

                    // Force update check to ensure we aren't stuck on an old one
                    await reg.update().catch(() => { });

                    // Initialize StreamManager singleton which attaches message listeners
                    StreamManager.getInstance();
                })
                .catch(err => console.error('Service Worker registration failed', err));
        }
    }, [])

    return null
}
