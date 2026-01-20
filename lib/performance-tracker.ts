
import { apiClient } from "@/lib/api";

interface PerformancePayload {
    cryptoOp: string;
    durationMs: number;
    browser: string;
    hwConcurrency: number;
    algoVersion?: string;
    [key: string]: any;
}

export class PerformanceTracker {
    private static readonly ENABLED_KEY = 'privacy_usage_diagnostics';
    private static readonly API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://drive.ellipticc.com/api/v1') + '/events/performance';

    // Challenge Cache (Internal)
    private static cachedChallenge: string | null = null;
    private static challengeExpiry: number = 0;

    static isEnabled(): boolean {
        // Default to true if not set (or check explicit 'true')
        // Matching existing settings logical which often defaults to true
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(this.ENABLED_KEY) !== 'false';
    }

    /**
     * Get or refresh a cryptographic challenge
     */
    private static async getChallenge(): Promise<string | null> {
        const now = Date.now();

        // If we have a cached challenge that is still valid (4 minute reuse window for 5 min TTL)
        if (this.cachedChallenge && now < this.challengeExpiry) {
            return this.cachedChallenge;
        }

        try {
            const challengeRes = await fetch(`${this.API_BASE}/challenge`);
            if (!challengeRes.ok) return null;

            const { challenge, expires } = await challengeRes.json();

            this.cachedChallenge = challenge;
            // Set local expiry with 30s safety buffer
            this.challengeExpiry = now + (expires * 1000) - 30000;

            return challenge;
        } catch (err) {
            console.warn('Failed to fetch performance challenge', err);
            return null;
        }
    }

    /**
     * Track a cryptographic operation performance
     */
    static async trackCryptoOp(op: string, durationMs: number, algoVersion: string = '1.0') {
        if (!this.isEnabled()) return;

        const payload: PerformancePayload = {
            cryptoOp: op,
            durationMs: Math.round(durationMs),
            browser: this.getBrowserString(),
            hwConcurrency: navigator.hardwareConcurrency || 1,
            algoVersion
        };

        // Fire and forget, don't block the caller
        this.submit(payload).catch(err => console.warn('Performance submission failed', err));
    }

    private static getBrowserString(): string {
        if (typeof navigator === 'undefined') return 'Unknown';
        // Simple classifier
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome ' + (ua.match(/Chrome\/(\d+)/)?.[1] || '');
        if (ua.includes('Firefox')) return 'Firefox ' + (ua.match(/Firefox\/(\d+)/)?.[1] || '');
        if (ua.includes('Safari')) return 'Safari ' + (ua.match(/Version\/(\d+)/)?.[1] || '');
        return 'Other';
    }

    private static async submit(payload: PerformancePayload) {
        try {
            // 1. Get Challenge (Cached or New)
            const challenge = await this.getChallenge();
            if (!challenge) return;

            // 2. Generate Ephemeral Key
            const keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "ECDSA",
                    namedCurve: "P-256",
                },
                true, // extractable
                ["sign"]
            );

            // 3. Export Public Key (JWK)
            const pubkey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);

            // 4. Sign stable string (challenge:op:duration:browser:concurrency:version)
            // Using a stable format instead of JSON.stringify to avoid serialization differences
            const dataToSign = `${challenge}:${payload.cryptoOp}:${payload.durationMs}:${payload.browser}:${payload.hwConcurrency}:${payload.algoVersion || '1.0'}`;
            const encoder = new TextEncoder();
            const signature = await window.crypto.subtle.sign(
                {
                    name: "ECDSA",
                    hash: { name: "SHA-256" },
                },
                keyPair.privateKey,
                encoder.encode(dataToSign)
            );

            // 5. Send
            // signature is ArrayBuffer, convert to hex
            const signatureHex = Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            await fetch(this.API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challenge,
                    pubkey,
                    signature: signatureHex,
                    payload
                })
            });

        } catch (err) {
            // Internal error - likely WebCrypto related
            if (process.env.NODE_ENV !== 'production') {
                console.error('Performance tracker inner error:', err);
            }
        }
    }
}
