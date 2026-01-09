"use client"

import { useEffect } from "react"
import { StreamManager } from "@/lib/streaming"

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    // console.log('Service Worker registered', reg);
                    // Initialize StreamManager singleton which attaches message listeners
                    StreamManager.getInstance();
                })
                .catch(err => console.error('Service Worker registration failed', err));
        }
    }, [])

    return null
}
